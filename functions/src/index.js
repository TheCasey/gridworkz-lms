import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';

initializeApp();

const db = getFirestore();

const REGION = process.env.FUNCTIONS_REGION || 'us-central1';
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_CORE_PRICE_ID = defineSecret('STRIPE_CORE_PRICE_ID');
const STRIPE_LOCKDOWN_PRICE_ID = defineSecret('STRIPE_LOCKDOWN_PRICE_ID');

const COLLECTIONS = Object.freeze({
  ACCOUNT_ENTITLEMENTS: 'accountEntitlements',
  PARENTS: 'parents',
  STUDENTS: 'students',
  SUBJECTS: 'subjects',
});

const PLAN_IDS = Object.freeze({
  FREE: 'free',
  CORE: 'core',
  LOCKDOWN: 'lockdown',
});

const SUBSCRIPTION_STATUSES = Object.freeze({
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
});

const PLAN_LIMITS = Object.freeze({
  [PLAN_IDS.FREE]: Object.freeze({
    maxStudents: 2,
    maxActiveSubjects: 3,
    features: Object.freeze({
      can_use_projects: false,
      can_use_lockdown_extension: false,
      can_use_lockdown_kiosk: false,
    }),
  }),
  [PLAN_IDS.CORE]: Object.freeze({
    maxStudents: 10,
    maxActiveSubjects: null,
    features: Object.freeze({
      can_use_projects: true,
      can_use_lockdown_extension: false,
      can_use_lockdown_kiosk: false,
    }),
  }),
  [PLAN_IDS.LOCKDOWN]: Object.freeze({
    maxStudents: 10,
    maxActiveSubjects: null,
    features: Object.freeze({
      can_use_projects: true,
      can_use_lockdown_extension: true,
      can_use_lockdown_kiosk: true,
    }),
  }),
});

const DEFAULT_PARENT_SETTINGS = Object.freeze({
  week_reset_day: 1,
  week_reset_hour: 0,
  week_reset_minute: 0,
  timezone: 'America/Chicago',
});

const normalizePlanId = (planId) => (
  Object.values(PLAN_IDS).includes(planId) ? planId : PLAN_IDS.FREE
);

const buildFeatureSet = (planId, featureOverrides = {}) => {
  const planFeatures = PLAN_LIMITS[normalizePlanId(planId)].features;

  return Object.keys(planFeatures).reduce((resolved, featureKey) => {
    resolved[featureKey] = typeof featureOverrides?.[featureKey] === 'boolean'
      ? featureOverrides[featureKey]
      : planFeatures[featureKey];
    return resolved;
  }, {});
};

const entitlementRef = (parentId) => (
  db.collection(COLLECTIONS.ACCOUNT_ENTITLEMENTS).doc(parentId)
);

const trimString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const ensureAuthenticated = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }

  return request.auth.uid;
};

const slugifyStudentName = (name) => (
  trimString(name)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    || 'student'
);

const buildStudentSlug = (name) => (
  `${slugifyStudentName(name)}-${randomBytes(4).toString('hex').slice(0, 6)}`
);

const toTimestampOrNull = (seconds) => (
  Number.isFinite(seconds) ? Timestamp.fromMillis(seconds * 1000) : null
);

const getAccountEntitlementState = async (parentId) => {
  const snapshot = await entitlementRef(parentId).get();
  const data = snapshot.exists ? snapshot.data() : {};
  const planId = normalizePlanId(data?.plan_id);

  return {
    exists: snapshot.exists,
    data,
    planId,
    limits: PLAN_LIMITS[planId],
    features: buildFeatureSet(planId, data?.feature_overrides),
  };
};

const countStudentsForParent = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.STUDENTS)
    .where('parent_id', '==', parentId)
    .get();

  return snapshot.size;
};

const countActiveSubjectsForParent = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.SUBJECTS)
    .where('parent_id', '==', parentId)
    .where('is_active', '==', true)
    .get();

  return snapshot.size;
};

const loadParentSettings = async (parentId) => {
  const snapshot = await db.collection(COLLECTIONS.PARENTS).doc(parentId).get();
  const data = snapshot.exists ? snapshot.data() : {};

  return {
    week_reset_day: Number.isInteger(data?.week_reset_day) ? data.week_reset_day : DEFAULT_PARENT_SETTINGS.week_reset_day,
    week_reset_hour: Number.isInteger(data?.week_reset_hour) ? data.week_reset_hour : DEFAULT_PARENT_SETTINGS.week_reset_hour,
    week_reset_minute: Number.isInteger(data?.week_reset_minute) ? data.week_reset_minute : DEFAULT_PARENT_SETTINGS.week_reset_minute,
    timezone: trimString(data?.timezone) || DEFAULT_PARENT_SETTINGS.timezone,
  };
};

const validateAccessPin = (accessPin) => {
  if (accessPin == null || accessPin === '') {
    return null;
  }

  const normalized = trimString(accessPin);
  if (!/^\d{4}$/.test(normalized)) {
    throw new HttpsError('invalid-argument', 'Access PINs must be 4 numeric digits.');
  }

  return normalized;
};

const normalizeResourceList = (resources = []) => {
  if (!Array.isArray(resources)) {
    throw new HttpsError('invalid-argument', 'Resources must be an array.');
  }

  return resources
    .map((resource) => ({
      name: trimString(resource?.name),
      url: trimString(resource?.url),
    }))
    .filter((resource) => resource.name);
};

const normalizeCustomFields = (customFields = []) => {
  if (!Array.isArray(customFields)) {
    throw new HttpsError('invalid-argument', 'Custom fields must be an array.');
  }

  return customFields
    .map((field) => ({
      id: trimString(field?.id) || randomBytes(6).toString('hex'),
      type: trimString(field?.type) || 'text',
      label: trimString(field?.label),
      placeholder: trimString(field?.placeholder),
      required: Boolean(field?.required),
    }))
    .filter((field) => field.label);
};

const normalizeBlockObjectives = (blockObjectives = {}) => {
  if (!blockObjectives || typeof blockObjectives !== 'object' || Array.isArray(blockObjectives)) {
    throw new HttpsError('invalid-argument', 'Block objectives must be an object map.');
  }

  return Object.fromEntries(
    Object.entries(blockObjectives).flatMap(([blockIndex, objective]) => {
      const instruction = trimString(objective?.instruction);
      const customFields = normalizeCustomFields(objective?.custom_fields || []);
      const studentOverrides = Object.fromEntries(
        Object.entries(objective?.student_overrides || {}).flatMap(([studentId, override]) => {
          const overrideInstruction = trimString(override?.instruction);
          const overrideFields = normalizeCustomFields(override?.custom_fields || []);
          if (!overrideInstruction && !overrideFields.length) {
            return [];
          }

          return [[studentId, {
            instruction: overrideInstruction,
            custom_fields: overrideFields,
          }]];
        })
      );

      if (!instruction && !customFields.length && !Object.keys(studentOverrides).length) {
        return [];
      }

      return [[blockIndex, {
        instruction,
        custom_fields: customFields,
        student_overrides: studentOverrides,
      }]];
    })
  );
};

const assertParentOwnsStudents = async (parentId, studentIds) => {
  const uniqueStudentIds = Array.from(new Set(studentIds));
  const studentSnapshots = await Promise.all(
    uniqueStudentIds.map((studentId) => db.collection(COLLECTIONS.STUDENTS).doc(studentId).get())
  );

  const allOwned = studentSnapshots.every((snapshot) => (
    snapshot.exists &&
    snapshot.data()?.parent_id === parentId
  ));

  if (!allOwned) {
    throw new HttpsError(
      'failed-precondition',
      'Every assigned student must exist and belong to the current parent account.'
    );
  }
};

const getStripeClient = () => {
  const apiKey = trimString(STRIPE_SECRET_KEY.value());
  if (!apiKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  return new Stripe(apiKey);
};

const resolveStripePlanIdFromPriceId = (priceId) => {
  const lockdownPriceIds = new Set([trimString(STRIPE_LOCKDOWN_PRICE_ID.value())].filter(Boolean));
  const corePriceIds = new Set([trimString(STRIPE_CORE_PRICE_ID.value())].filter(Boolean));

  if (!priceId) return null;
  if (lockdownPriceIds.has(priceId)) return PLAN_IDS.LOCKDOWN;
  if (corePriceIds.has(priceId)) return PLAN_IDS.CORE;
  return null;
};

const resolveStripePlanIdFromSubscription = (subscription) => {
  const metadataPlanId = normalizePlanId(
    trimString(subscription?.metadata?.plan_id || subscription?.metadata?.gridworkz_plan_id)
  );

  if (metadataPlanId !== PLAN_IDS.FREE || trimString(subscription?.metadata?.plan_id || subscription?.metadata?.gridworkz_plan_id)) {
    return metadataPlanId;
  }

  const priceId = trimString(subscription?.items?.data?.[0]?.price?.id);
  return resolveStripePlanIdFromPriceId(priceId);
};

const resolveStripeParentIdFromObject = (stripeObject) => {
  const metadataParentId = trimString(
    stripeObject?.metadata?.parent_id ||
    stripeObject?.metadata?.parentId ||
    stripeObject?.metadata?.uid
  );

  if (metadataParentId) {
    return metadataParentId;
  }

  const clientReferenceId = trimString(stripeObject?.client_reference_id);
  return clientReferenceId || '';
};

const resolveStripeParentIdFromSubscription = async (stripe, subscription) => {
  const directParentId = resolveStripeParentIdFromObject(subscription);
  if (directParentId) {
    return directParentId;
  }

  const customerId = trimString(subscription?.customer);
  if (!customerId) {
    return '';
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (customer?.deleted) {
    return '';
  }

  return resolveStripeParentIdFromObject(customer);
};

const mapStripeSubscriptionStatus = (stripeStatus) => {
  switch (stripeStatus) {
    case 'trialing':
      return SUBSCRIPTION_STATUSES.TRIALING;
    case 'active':
      return SUBSCRIPTION_STATUSES.ACTIVE;
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return SUBSCRIPTION_STATUSES.PAST_DUE;
    case 'canceled':
    case 'incomplete_expired':
      return SUBSCRIPTION_STATUSES.CANCELED;
    default:
      return SUBSCRIPTION_STATUSES.CANCELED;
  }
};

const buildEntitlementDocument = ({
  parentId,
  existingEntitlement = {},
  planId,
  subscriptionStatus,
  trialEndsAt,
  currentPeriodEnd,
}) => ({
  parent_id: parentId,
  plan_id: planId,
  subscription_status: subscriptionStatus,
  billing_provider: 'stripe',
  feature_overrides: existingEntitlement?.feature_overrides || {},
  usage_snapshot: existingEntitlement?.usage_snapshot || {
    students: 0,
    curriculum_items: 0,
  },
  trial_ends_at: trialEndsAt,
  current_period_end: currentPeriodEnd,
  updated_at: FieldValue.serverTimestamp(),
});

const syncEntitlementFromSubscription = async (stripe, subscription) => {
  const parentId = await resolveStripeParentIdFromSubscription(stripe, subscription);
  if (!parentId) {
    throw new Error('Stripe subscription is missing parent_id metadata or customer metadata.');
  }

  const rawPlanId = resolveStripePlanIdFromSubscription(subscription);
  if (!rawPlanId) {
    throw new Error('Stripe subscription is missing plan_id metadata and no known price mapping matched.');
  }

  const subscriptionStatus = mapStripeSubscriptionStatus(subscription.status);
  const planId = subscriptionStatus === SUBSCRIPTION_STATUSES.CANCELED
    ? PLAN_IDS.FREE
    : rawPlanId;

  const existingSnapshot = await entitlementRef(parentId).get();
  const entitlementDoc = buildEntitlementDocument({
    parentId,
    existingEntitlement: existingSnapshot.exists ? existingSnapshot.data() : {},
    planId,
    subscriptionStatus,
    trialEndsAt: toTimestampOrNull(subscription.trial_end),
    currentPeriodEnd: toTimestampOrNull(subscription.current_period_end),
  });

  await entitlementRef(parentId).set(entitlementDoc, { merge: true });
};

export const createStudent = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const name = trimString(request.data?.name);

  if (!name) {
    throw new HttpsError('invalid-argument', 'Student name is required.');
  }

  const accessPin = validateAccessPin(request.data?.accessPin);
  const entitlementState = await getAccountEntitlementState(parentId);
  const currentStudentCount = await countStudentsForParent(parentId);

  if (
    entitlementState.limits.maxStudents != null &&
    currentStudentCount >= entitlementState.limits.maxStudents
  ) {
    throw new HttpsError(
      'resource-exhausted',
      'This account has reached the current plan student limit.'
    );
  }

  const parentSettings = await loadParentSettings(parentId);
  const slug = buildStudentSlug(name);
  const studentDoc = {
    name,
    slug,
    access_pin: accessPin,
    parent_id: parentId,
    week_reset_day: parentSettings.week_reset_day,
    week_reset_hour: parentSettings.week_reset_hour,
    week_reset_minute: parentSettings.week_reset_minute,
    timezone: parentSettings.timezone,
    is_active: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const createdRef = await db.collection(COLLECTIONS.STUDENTS).add(studentDoc);

  return {
    id: createdRef.id,
    slug,
  };
});

export const createSubject = onCall({ region: REGION }, async (request) => {
  const parentId = ensureAuthenticated(request);
  const title = trimString(request.data?.title);
  const studentIds = Array.isArray(request.data?.student_ids)
    ? request.data.student_ids.map((studentId) => trimString(studentId)).filter(Boolean)
    : [];
  const blockCount = Number.parseInt(request.data?.block_count, 10);
  const blockLength = Number.parseInt(request.data?.block_length, 10);

  if (!title) {
    throw new HttpsError('invalid-argument', 'Subject title is required.');
  }

  if (!studentIds.length) {
    throw new HttpsError('invalid-argument', 'At least one assigned student is required.');
  }

  if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 20) {
    throw new HttpsError('invalid-argument', 'Block count must be an integer between 1 and 20.');
  }

  if (!Number.isInteger(blockLength) || blockLength < 5 || blockLength > 120) {
    throw new HttpsError('invalid-argument', 'Block length must be an integer between 5 and 120 minutes.');
  }

  const entitlementState = await getAccountEntitlementState(parentId);
  const currentActiveSubjectCount = await countActiveSubjectsForParent(parentId);

  if (
    entitlementState.limits.maxActiveSubjects != null &&
    currentActiveSubjectCount >= entitlementState.limits.maxActiveSubjects
  ) {
    throw new HttpsError(
      'resource-exhausted',
      'This account has reached the current plan active subject limit.'
    );
  }

  await assertParentOwnsStudents(parentId, studentIds);

  const subjectDoc = {
    student_ids: Array.from(new Set(studentIds)),
    parent_id: parentId,
    title,
    block_count: blockCount,
    block_length: blockLength,
    color: trimString(request.data?.color) || '#3B82F6',
    resources: normalizeResourceList(request.data?.resources || []),
    require_input: Boolean(request.data?.require_input),
    custom_fields: normalizeCustomFields(request.data?.custom_fields || []),
    require_timer: Boolean(request.data?.require_timer),
    block_objectives: normalizeBlockObjectives(request.data?.block_objectives || {}),
    is_active: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const createdRef = await db.collection(COLLECTIONS.SUBJECTS).add(subjectDoc);

  return {
    id: createdRef.id,
  };
});

export const billingWebhook = onRequest({
  region: REGION,
  invoker: 'public',
  secrets: [
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_CORE_PRICE_ID,
    STRIPE_LOCKDOWN_PRICE_ID,
  ],
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  const webhookSecret = trimString(STRIPE_WEBHOOK_SECRET.value());
  const signature = request.get('stripe-signature');

  if (!webhookSecret || !signature) {
    response.status(500).send('Stripe webhook is not configured.');
    return;
  }

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId = trimString(session.subscription);
        if (!subscriptionId) {
          throw new Error('checkout.session.completed is missing a subscription id.');
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const hydratedSubscription = {
          ...subscription,
          metadata: {
            ...(session.metadata || {}),
            ...(subscription.metadata || {}),
          },
          client_reference_id: session.client_reference_id || subscription.client_reference_id,
        };
        await syncEntitlementFromSubscription(stripe, hydratedSubscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncEntitlementFromSubscription(stripe, event.data.object);
        break;
      }
      default:
        break;
    }

    response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe entitlement webhook failed:', error);
    response.status(400).send(error.message || 'Webhook processing failed.');
  }
});
