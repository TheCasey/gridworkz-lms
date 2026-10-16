import { randomUUID } from 'node:crypto';
import {
  BILLING_LEASE_MS, BILLING_REPLAY_MS, billingId, providerId, providerParent,
  isTerminalSubscription, validateBillingPayload, verifyProviderMode, verifyCorePrice, verifyPortalConfiguration,
  requiresLegacyBillingReconciliation, legacyBillingProviderIds,
} from './coreBillingPolicy.js';

// Stripe is injected by the production adapter, never selected by request data.
export const createCoreBillingService = ({ db, Timestamp, HttpsError, getStripe, getConfig,
  buildBillingWrite, queueAudit, now = Date.now }) => {
  const accountRef = (uid) => db.collection('billingAccounts').doc(uid);
  const receiptRef = (event, config) => db.collection('billingEventReceipts').doc(billingId(`${config.mode}:${event.id}`));
  const fail = (message = 'Billing needs reconciliation before another purchase.', code = 'billing_reconciliation_required') => {
    throw new HttpsError('failed-precondition', message, { code });
  };
  const stamp = () => Timestamp.fromMillis(now());
  const requireParent = async (uid) => {
    if (!(await db.collection('parents').doc(uid).get()).exists) {
      throw new HttpsError('permission-denied', 'A parent account is required to manage billing.', { code: 'billing_parent_required' });
    }
  };
  const requireConfig = (config) => {
    if (!config.valid) fail('Billing is not configured.');
  };
  const acquire = async (uid, config) => {
    const token = randomUUID();
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(accountRef(uid));
      const account = snap.data() || {};
      if (account.mode && account.mode !== config.mode) fail('Billing mode requires reconciliation.');
      if (account.lease?.expires_at_ms > now()) throw new HttpsError('unavailable', 'Billing is busy. Retry shortly.');
      tx.set(accountRef(uid), { parent_id: uid, mode: config.mode,
        lease: { token, expires_at_ms: now() + BILLING_LEASE_MS }, updated_at: stamp() }, { merge: true });
    });
    return { uid, token };
  };
  const fenced = async (lease, callback) => db.runTransaction(async (tx) => {
    const snap = await tx.get(accountRef(lease.uid));
    const account = snap.data();
    if (account?.lease?.token !== lease.token || account.lease.expires_at_ms <= now()) {
      throw new HttpsError('unavailable', 'Billing operation expired. Retry shortly.');
    }
    return callback(tx, account);
  });
  const patch = (lease, fields) => fenced(lease, async (tx) => {
    tx.set(accountRef(lease.uid), { ...fields, updated_at: stamp() }, { merge: true });
  });
  const read = (lease) => fenced(lease, async (tx, account) => account);
  const release = (lease) => db.runTransaction(async (tx) => {
    const snap = await tx.get(accountRef(lease.uid));
    if (snap.data()?.lease?.token === lease.token) tx.update(accountRef(lease.uid), { lease: null });
  });
  const run = async (uid, config, callback) => {
    const lease = await acquire(uid, config);
    try { return await callback(lease); } finally { await release(lease); }
  };
  const markConflict = async (lease, reason = 'billing_conflict') => {
    await patch(lease, { reconciliation_required: true, reconciliation_reason: reason });
    fail();
  };
  const verifyCustomer = async (stripe, account, uid, config) => {
    if (!account.stripe_customer_id) fail('No verified billing customer is linked.');
    const customer = await stripe.customers.retrieve(account.stripe_customer_id);
    verifyProviderMode(customer, config, HttpsError);
    if (customer.deleted || providerParent(customer) !== uid) fail('Billing customer requires reconciliation.');
    return customer;
  };
  const currentSubscriptions = async (stripe, customer, uid, config, priorSubscriptionIds = []) => {
    const list = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 });
    if (list.has_more) fail();
    if (priorSubscriptionIds.some((id) => !list.data.some((subscription) => subscription.id === id))) fail();
    for (const subscription of list.data) {
      verifyProviderMode(subscription, config, HttpsError);
      // Historical subscriptions may carry the parent only on their verified
      // customer. Explicit contradictory subscription metadata is never accepted.
      if (providerId(subscription.customer) !== customer.id
        || ['parent_id', 'parentId', 'uid'].some((key) => subscription.metadata?.[key] !== undefined
          && subscription.metadata[key] !== '') && providerParent(subscription) !== uid) fail();
    }
    return list.data.filter((subscription) => !isTerminalSubscription(subscription));
  };
  const subscriptionParentHint = async (stripe, customerId, config) => {
    const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    const candidates = new Set();
    for (const subscription of list.data) {
      verifyProviderMode(subscription, config, HttpsError);
      if (providerId(subscription.customer) !== customerId) fail();
      const uid = providerParent(subscription);
      if (uid) candidates.add(uid);
    }
    // This hint can only route to a deny-only reconciliation marker or an already
    // verified private binding. It never authorizes adoption of this customer.
    return candidates.size === 1 ? [...candidates][0] : '';
  };
  const journal = (lease, operation, stage, intentId, request = null) => fenced(lease, async (tx) => {
    tx.create(db.collection('billingCheckoutAttempts').doc(), {
      parent_id: lease.uid, intent_id: intentId, operation, stage, request, created_at: stamp(),
    });
  });
  const providerMutation = async (lease, operation, intentId, request, callback) => {
    await journal(lease, operation, 'started', intentId, request);
    try {
      const result = await callback();
      await journal(lease, operation, 'succeeded', intentId);
      return result;
    } catch (error) {
      await journal(lease, operation, 'unknown', intentId);
      // Do not expose provider bodies, IDs or card information to clients/logs.
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', 'Billing provider did not confirm the result. Retry the same request.', { code: 'billing_outcome_unknown' });
    }
  };
  const validateSession = (session, uid, customerId, intent, config) => {
    verifyProviderMode(session, config, HttpsError);
    if (providerParent(session) !== uid || providerId(session.customer) !== customerId
      || session.metadata?.checkout_intent !== intent.intent_id || session.mode !== 'subscription') fail();
  };

  const checkout = async ({ parentId, payload }) => {
    validateBillingPayload({ parentId, payload, checkout: true, HttpsError });
    await requireParent(parentId);
    const config = getConfig();
    requireConfig(config);
    if (!config.checkoutEnabled || !config.priceId) fail('Core checkout is not available yet.');
    return run(parentId, config, async (lease) => {
      const stripe = getStripe();
      verifyCorePrice(await stripe.prices.retrieve(config.priceId), config, HttpsError);
      let account = await read(lease);
      if (account.reconciliation_required) fail();
      if (!account.stripe_customer_id && requiresLegacyBillingReconciliation(
        (await db.collection('accountEntitlements').doc(parentId).get()).data() || {}
      )) return markConflict(lease, 'legacy_binding_required');
      let customer = account.stripe_customer_id ? await verifyCustomer(stripe, account, parentId, config) : null;
      if (customer) {
        const subscriptions = await currentSubscriptions(stripe, customer, parentId, config);
        if (subscriptions.length > 1) return markConflict(lease);
        if (subscriptions.length) fail('An existing subscription must be managed before another purchase.');
      }
      let pending = account.pending_checkout;
      if (pending?.session_id) {
        const session = await stripe.checkout.sessions.retrieve(pending.session_id);
        const existingIntent = (await db.collection('billingCheckoutIntents').doc(pending.intent_key).get()).data();
        if (!existingIntent) return markConflict(lease);
        if (existingIntent.mode !== config.mode || existingIntent.price_id !== config.priceId
          || existingIntent.return_url !== config.returnUrl) return markConflict(lease);
        validateSession(session, parentId, customer?.id, existingIntent, config);
        if (session.status === 'open' && session.url) return { url: session.url, reused: true };
        if (session.status !== 'expired') fail('Your checkout is being confirmed. Retry shortly.');
        await patch(lease, { pending_checkout: null });
        pending = null;
      }
      const intentKey = pending?.intent_key || billingId(`${parentId}:${payload.intent_id}`);
      const intentRef = db.collection('billingCheckoutIntents').doc(intentKey);
      let intent;
      await fenced(lease, async (tx, latest) => {
        const previous = await tx.get(intentRef);
        if (previous.exists) {
          intent = previous.data();
          if (!pending) fail('This checkout intent is finished. Start a new request.', 'billing_intent_closed');
        } else {
          intent = { parent_id: parentId, intent_id: payload.intent_id, mode: config.mode,
            price_id: config.priceId, return_url: config.returnUrl, created_at_ms: now(),
            existing_customer_id: customer?.id || null,
            customer_parameters: { metadata: { parent_id: parentId, checkout_intent: payload.intent_id } },
            checkout_parameters: {
              mode: 'subscription', client_reference_id: parentId,
              line_items: [{ price: config.priceId, quantity: 1 }],
              success_url: `${config.returnUrl}?billing=success`, cancel_url: `${config.returnUrl}?billing=canceled`,
              metadata: { parent_id: parentId, plan_id: 'core', checkout_intent: payload.intent_id },
              subscription_data: { metadata: { parent_id: parentId, plan_id: 'core', checkout_intent: payload.intent_id } },
            },
          };
          tx.create(intentRef, intent);
        }
        if (intent.mode !== config.mode || intent.price_id !== config.priceId || intent.return_url !== config.returnUrl) fail();
        tx.set(accountRef(parentId), { pending_checkout: latest.pending_checkout || {
          intent_key: intentKey, intent_id: intent.intent_id, created_at_ms: intent.created_at_ms,
        } }, { merge: true });
      });
      account = await read(lease);
      // Never replay a potentially pruned idempotency key. Known sessions were reconciled above.
      if (now() - intent.created_at_ms >= BILLING_REPLAY_MS) return markConflict(lease);
      const key = (operation) => `gridworkz:${config.mode}:${intentKey}:${operation}`;
      if (!customer) {
        const request = { parameters: intent.customer_parameters, idempotency_key: key('customer') };
        customer = await providerMutation(lease, 'customer', intent.intent_id, request,
          () => stripe.customers.create(request.parameters, { idempotencyKey: request.idempotency_key }));
        verifyProviderMode(customer, config, HttpsError);
        if (providerParent(customer) !== parentId) return markConflict(lease);
        await patch(lease, { stripe_customer_id: customer.id });
      }
      // List sessions to recover a response lost before its ID was persisted. Never create a
      // second open session, including one initiated by an older compatible integration.
      const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit: 100 });
      if (sessions.has_more) return markConflict(lease);
      const open = sessions.data.filter((session) => session.status === 'open');
      if (open.length > 1) return markConflict(lease);
      let session = open[0];
      if (session) validateSession(session, parentId, customer.id, intent, config);
      if (!session) {
        const completed = sessions.data.find((item) => item.metadata?.checkout_intent === intent.intent_id && item.status !== 'expired');
        if (completed) fail('Your checkout is being confirmed. Retry shortly.');
        const request = { parameters: { ...intent.checkout_parameters, customer: customer.id }, idempotency_key: key('checkout') };
        session = await providerMutation(lease, 'checkout', intent.intent_id, request,
          () => stripe.checkout.sessions.create(request.parameters, { idempotencyKey: request.idempotency_key }));
      }
      validateSession(session, parentId, customer.id, intent, config);
      if (session.status !== 'open' || !session.url) fail('Your checkout is being confirmed. Retry shortly.');
      await patch(lease, { pending_checkout: { ...account.pending_checkout, session_id: session.id } });
      return { url: session.url, reused: Boolean(pending) };
    });
  };

  const portal = async ({ parentId, payload }) => {
    validateBillingPayload({ parentId, payload, HttpsError });
    await requireParent(parentId);
    const config = getConfig();
    requireConfig(config);
    if (!config.portalConfigurationId) fail('Billing management is not configured.');
    return run(parentId, config, async (lease) => {
      const stripe = getStripe();
      const customer = await verifyCustomer(stripe, await read(lease), parentId, config);
      verifyPortalConfiguration(await stripe.billingPortal.configurations.retrieve(config.portalConfigurationId), config, HttpsError);
      await read(lease);
      const session = await stripe.billingPortal.sessions.create({ customer: customer.id,
        configuration: config.portalConfigurationId, return_url: config.returnUrl });
      await read(lease);
      return { url: session.url };
    });
  };

  const status = async ({ parentId, payload }) => {
    validateBillingPayload({ parentId, payload, status: true, HttpsError });
    await requireParent(parentId);
    const config = getConfig();
    const account = (await accountRef(parentId).get()).data() || {};
    const missingLegacyBinding = !account.stripe_customer_id && requiresLegacyBillingReconciliation(
      (await db.collection('accountEntitlements').doc(parentId).get()).data() || {}
    );
    let checkoutAvailable = false;
    let portalAvailable = false;
    let bindingState = account.reconciliation_required || missingLegacyBinding ? 'reconciliation_required' : 'unbound';
    let hasSubscription = false;
    try {
      requireConfig(config);
      const stripe = getStripe();
      if (account.stripe_customer_id) {
        if (account.mode !== config.mode) fail();
        const customer = await verifyCustomer(stripe, account, parentId, config);
        bindingState = account.reconciliation_required ? 'reconciliation_required' : 'bound';
        const subscriptions = await currentSubscriptions(stripe, customer, parentId, config);
        hasSubscription = subscriptions.length > 0;
        if (subscriptions.length > 1) bindingState = 'reconciliation_required';
        if (config.portalConfigurationId) {
          try {
            verifyPortalConfiguration(await stripe.billingPortal.configurations.retrieve(config.portalConfigurationId), config, HttpsError);
            portalAvailable = true;
          } catch { /* An unsafe portal configuration never disables a separately valid purchase. */ }
        }
      }
      if (config.checkoutEnabled && bindingState !== 'reconciliation_required' && !hasSubscription) {
        verifyCorePrice(await stripe.prices.retrieve(config.priceId), config, HttpsError);
        checkoutAvailable = true;
      }
    } catch {
      if (account.stripe_customer_id) bindingState = 'reconciliation_required';
    }
    return { checkout_available: checkoutAvailable, portal_available: portalAvailable,
      binding_state: bindingState, mode: config.mode };
  };

  const webhook = async (event) => {
    const config = getConfig();
    if (!config.valid) throw new HttpsError('unavailable', 'Billing webhook is not configured.');
    verifyProviderMode(event, config, HttpsError);
    const receipt = receiptRef(event, config);
    if ((await receipt.get()).exists) return { duplicate: true };
    const supported = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];
    const customerId = providerId(event.data?.object?.customer);
    const records = supported.includes(event.type) && customerId
      ? await db.collection('billingAccounts').where('stripe_customer_id', '==', customerId).limit(2).get() : null;
    const discard = async (disposition) => {
      await db.runTransaction(async (tx) => {
        if (!(await tx.get(receipt)).exists) tx.create(receipt, { event_id: event.id,
          mode: config.mode, event_type: event.type, disposition, created_at: stamp() });
      });
      return { disposition };
    };
    if (!supported.includes(event.type)) return discard('ignored_event_type');
    const retryIdentity = () => {
      throw new HttpsError('unavailable', 'Billing identity requires reconciliation. Retry after resolution.', { code: 'billing_reconciliation_required' });
    };
    if (!customerId || records?.size > 1) return retryIdentity();
    let uid = records?.size === 1 ? records.docs[0].id : '';
    if (!uid) {
      // Signed event data supplies only the lookup ID. Identity comes from the
      // current provider customer, and is reverified after acquiring the UID fence.
      try {
        const currentCustomer = await getStripe().customers.retrieve(customerId);
        verifyProviderMode(currentCustomer, config, HttpsError);
        uid = !currentCustomer.deleted && providerParent(currentCustomer);
        if (!currentCustomer.deleted && !uid) uid = await subscriptionParentHint(getStripe(), customerId, config);
      } catch (error) {
        if (error instanceof HttpsError && error.code === 'failed-precondition'
          || error?.code === 'resource_missing' && error?.statusCode === 404) return retryIdentity();
        throw error;
      }
      if (!uid || !(await db.collection('parents').doc(uid).get()).exists) return retryIdentity();
    }
    if (records?.size === 1 && records.docs[0].data().mode !== config.mode) return retryIdentity();
    return run(uid, config, async (lease) => {
      const stripe = getStripe();
      let account = await read(lease);
      const reconciliationReceipt = (disposition) => fenced(lease, async (tx) => {
        if (!(await tx.get(receipt)).exists) tx.create(receipt, { event_id: event.id,
          event_type: event.type, mode: config.mode, parent_id: uid, disposition, created_at: stamp() });
        tx.set(accountRef(uid), { reconciliation_required: true }, { merge: true });
        return { disposition };
      });
      let subscriptions;
      try {
        if (!account.stripe_customer_id) {
          const customer = await stripe.customers.retrieve(customerId);
          verifyProviderMode(customer, config, HttpsError);
          if (customer.deleted || providerParent(customer) !== uid) {
            // Recheck the deny-only hint under the UID fence before retaining a
            // retryable identity problem; never infer an adoptable customer link.
            if (await subscriptionParentHint(stripe, customerId, config) !== uid) return retryIdentity();
            fail();
          }
          const entitlement = (await db.collection('accountEntitlements').doc(uid).get()).data() || {};
          const priorIds = legacyBillingProviderIds(entitlement);
          if (priorIds.customers.some((id) => id !== customer.id)) fail();
          await currentSubscriptions(stripe, customer, uid, config, priorIds.subscriptions);
          await fenced(lease, async (tx, latest) => {
            const [otherBindings, latestEntitlement, parent] = await Promise.all([
              tx.get(db.collection('billingAccounts').where('stripe_customer_id', '==', customer.id).limit(2)),
              tx.get(db.collection('accountEntitlements').doc(uid)),
              tx.get(db.collection('parents').doc(uid)),
            ]);
            const latestIds = legacyBillingProviderIds(latestEntitlement.data() || {});
            if (!parent.exists || latest.stripe_customer_id
              || otherBindings.docs.some((doc) => doc.id !== uid)
              || latestIds.customers.some((id) => id !== customer.id)
              || latestIds.subscriptions.some((id) => !priorIds.subscriptions.includes(id))) fail();
            const cleared = ['legacy_binding_required', 'provider_identity_invalid'].includes(latest.reconciliation_reason)
              ? { reconciliation_required: false, reconciliation_reason: null } : {};
            tx.set(accountRef(uid), { ...cleared, stripe_customer_id: customer.id,
              binding_source: 'verified_legacy_metadata', updated_at: stamp() }, { merge: true });
          });
          account = await read(lease);
        }
        const customer = await verifyCustomer(stripe, account, uid, config);
        subscriptions = await currentSubscriptions(stripe, customer, uid, config);
      } catch (error) {
        const invalidBinding = error instanceof HttpsError && error.code === 'failed-precondition'
          || error?.code === 'resource_missing' && error?.statusCode === 404;
        if (!invalidBinding) throw error;
        await patch(lease, { reconciliation_required: true, reconciliation_reason: 'provider_identity_invalid' });
        return retryIdentity();
      }
      if (subscriptions.length > 1) {
        return reconciliationReceipt('multiple_subscriptions');
      }
      // The event is only a trigger. An old deletion must resolve the replacement's
      // current provider state, never restore the event's stale subscription snapshot.
      const subscription = subscriptions[0] || null;
      return fenced(lease, async (tx, latest) => {
        const existingReceipt = await tx.get(receipt);
        const entitlementRef = db.collection('accountEntitlements').doc(uid);
        const existingSnapshot = await tx.get(entitlementRef);
        if (existingReceipt.exists) return { duplicate: true };
        const existingEntitlement = existingSnapshot.data() || {};
        const nowTimestamp = stamp();
        const result = buildBillingWrite({ parentId: uid, existingEntitlement, subscription,
          nowTimestamp, nowMillis: now() });
        if (!result) {
          tx.set(accountRef(uid), { reconciliation_required: true }, { merge: true });
          tx.create(receipt, { event_id: event.id, event_type: event.type, parent_id: uid,
            mode: config.mode, disposition: 'unmapped_plan', created_at: nowTimestamp });
          return { disposition: 'unmapped_plan' };
        }
        tx.set(entitlementRef, result.entitlementDoc, { merge: true });
        const cleared = latest.reconciliation_reason === 'provider_identity_invalid'
          ? { reconciliation_required: false, reconciliation_reason: null } : {};
        tx.set(accountRef(uid), { ...cleared, stripe_subscription_id: subscription?.id || null,
          subscription_status: subscription?.status || 'canceled', updated_at: nowTimestamp }, { merge: true });
        queueAudit(tx, { parentId: uid, reason: event.type,
          before: existingSnapshot.exists ? existingEntitlement : null,
          after: { ...existingEntitlement, ...result.entitlementDoc }, createdAt: nowTimestamp,
          hasExpiredManualOverride: result.hasExpiredManualOverride });
        tx.create(receipt, { event_id: event.id, event_type: event.type, parent_id: uid,
          mode: config.mode, disposition: 'synced', created_at: nowTimestamp });
        return { disposition: 'synced' };
      });
    });
  };
  return { checkout, portal, status, webhook };
};
