/**
 * GridWorkz LMS Data Schema
 * Single source of truth for Firestore data structures
 */

// Parent Account Schema
export const ParentSchema = {
  uid: "string", // Firebase Auth UID
  email: "string", // Parent email address
  school_name: "string", // Homeschool name/identifier
  school_year_start: "string", // YYYY-MM-DD
  school_year_end: "string", // YYYY-MM-DD
  week_start_day: "number", // 0-6 (Sunday=0, Monday=1, etc.)
  week_reset_day: "number", // 0-6 weekly rollover day
  week_reset_hour: "number", // 0-23 local rollover hour
  week_reset_minute: "number", // 0-59 local rollover minute
  timezone: "string", // IANA timezone identifier
  last_rollover_week_key: "string", // YYYY-MM-DD week start key
  created_at: "timestamp", // Account creation timestamp
  updated_at: "timestamp" // Last update timestamp
};

// Student Profile Schema
export const StudentSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  name: "string", // Student display name
  slug: "string", // Unique URL slug for student portal access
  access_pin: "string", // Optional 4-digit PIN for sibling protection
  week_reset_day: "number", // Public copy of school weekly rollover day
  week_reset_hour: "number", // Public copy of school weekly rollover hour
  week_reset_minute: "number", // Public copy of school weekly rollover minute
  timezone: "string", // IANA timezone for weekly rollover
  lockdown_schedule: "object", // Optional student-bound lockdown schedule and off-hours resource windows
  is_active: "boolean", // Whether student account is active
  created_at: "timestamp", // Student profile creation
  updated_at: "timestamp" // Last update timestamp
};

// Subject resource schema (nested in Subject and reused by planning contracts)
export const ResourceSchema = {
  name: "string", // Display label shown in curriculum and the student portal
  url: "string", // Resource destination URL
  lockdown_origin: "string", // Optional explicit origin override for device-policy derivation
  youtube_channel_id: "string", // Optional stable YouTube channel id when the resource should allow a creator instead of a full origin
  youtube_channel_title: "string", // Optional creator title snapshot paired with youtube_channel_id
  youtube_channel_handle: "string", // Optional creator handle snapshot paired with youtube_channel_id
};

export const LockdownResourceWindowSchema = {
  id: "string", // Stable local identifier for one approved off-hours window
  label: "string", // Parent-facing label such as Evening Reading
  days: "array", // Day indexes 0-6 in the student's local timezone
  start_time: "string", // HH:MM local start time
  end_time: "string", // HH:MM local end time
  resources: "array", // Array of ResourceSchema items allowed during the window
};

export const LockdownScheduleSchema = {
  timezone: "string", // Optional override; falls back to the student's timezone
  school_days: "array", // Day indexes 0-6 that count as school days
  school_day_start_time: "string", // HH:MM local school-day start
  school_day_end_time: "string", // HH:MM local school-day end
  off_hours_resource_windows: "array", // Array of LockdownResourceWindowSchema entries
};

// Subject custom field schema (subject-level or block-level prompt)
export const CustomFieldSchema = {
  id: "string", // Stable local identifier for response tracking
  type: "string", // Input type, e.g. text, url, number, file
  label: "string", // Student-facing prompt
  placeholder: "string", // Optional helper copy
  required: "boolean", // Whether the field must be answered
};

// Block objective override schema (student-specific override nested in block_objectives)
export const BlockObjectiveStudentOverrideSchema = {
  instruction: "string", // Student-specific instruction override
  custom_fields: "array", // Student-specific custom field override
};

// Block objective schema (nested in block_objectives map on Subject)
export const BlockObjectiveSchema = {
  instruction: "string", // Shared instruction for the block
  custom_fields: "array", // Optional; if non-empty, replaces subject.custom_fields for this block
  student_overrides: "object", // Map of studentId -> BlockObjectiveStudentOverrideSchema
};

// Subject module schema
export const SubjectSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  student_ids: "array", // Current live multi-student assignment list; legacy student_id docs are handled via compatibility helpers
  title: "string", // Subject name (e.g., "Math", "Reading")
  block_count: "number", // Number of weekly work blocks
  block_length: "number", // Planned minutes per block on the live subject record; submissions/reports still use block_duration
  color: "string", // Parent-selected accent color for the subject
  require_timer: "boolean", // Whether the student must use the timer before submission
  require_input: "boolean", // Whether the student must submit a written summary
  resources: "array", // Array of ResourceSchema items
  custom_fields: "array", // Array of CustomFieldSchema items
  block_objectives: "object", // Map of blockIndex (string) -> BlockObjectiveSchema
  is_active: "boolean", // Whether subject is currently active
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Shared weekly planning vocabulary
export const WeeklyBlockCategories = Object.freeze({
  LESSON: "lesson",
  REVIEW: "review",
  PRACTICE: "practice",
  ASSESSMENT: "assessment",
  PROJECT_WORK: "project_work",
});

export const WeeklyBlockCategoryValues = Object.values(WeeklyBlockCategories);

export const WeeklyBlockCompletionModes = Object.freeze({
  TIME_BOXED: "time_boxed",
  TASK_COMPLETE: "task_complete",
  HYBRID: "hybrid",
});

export const WeeklyBlockCompletionModeValues = Object.values(WeeklyBlockCompletionModes);

export const WeeklyPlanStatuses = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
});

export const WeeklyPlanStatusValues = Object.values(WeeklyPlanStatuses);

// Planning source reference schema (template/unit/block linkage)
export const PlanningSourceReferenceSchema = {
  type: "string", // Source kind such as url, text, file, legacy_subject
  label: "string", // Human-readable source label
  locator: "string", // Optional source locator, chapter, section, or URL
};

// Curriculum template unit/module schema
export const CurriculumTemplateUnitSchema = {
  id: "string", // Stable unit or module identifier
  title: "string", // Unit or module title
  objective_summary: "string", // Parent-facing summary of the unit
  estimated_blocks: "number", // Estimated number of weekly blocks to cover the unit
  suggested_category: "string", // WeeklyBlock.category recommendation
  suggested_completion_mode: "string", // WeeklyBlock.completion_mode recommendation
  source_references: "array", // Array of PlanningSourceReferenceSchema items
};

// Curriculum template schema
export const CurriculumTemplateSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  title: "string", // Parent-facing curriculum template title
  subject_area: "string", // Subject-area label such as Math or Reading
  curriculum_mode: "string", // manual_recurring, sequenced_resource, etc.
  default_block_count: "number", // Suggested weekly block count
  default_block_length: "number", // Suggested minutes per block
  default_category: "string", // Default WeeklyBlock.category
  default_completion_mode: "string", // Default WeeklyBlock.completion_mode
  color: "string", // Default template accent color
  require_timer: "boolean", // Default timer expectation for derived assignments
  require_input: "boolean", // Default written reflection expectation
  resources: "array", // Array of ResourceSchema items
  custom_fields: "array", // Array of CustomFieldSchema items
  units: "array", // Array of CurriculumTemplateUnitSchema items
  block_objectives: "object", // Optional compatibility map carried from legacy subjects
  legacy_subject_id: "string", // Compatibility reference back to the current subject model
  legacy_subject_title: "string", // Compatibility title snapshot from the current subject model
  is_active: "boolean", // Whether the template is active for future planning
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Assignment current-position schema
export const AssignmentPositionSchema = {
  unit_id: "string", // Current unit or module id when sequencing exists
  unit_index: "number", // Current unit index for lightweight sequencing
  block_offset: "number", // Block offset within the current unit
  last_advanced_at: "timestamp", // When the assignment position last moved forward
};

// Assignment schema
export const AssignmentSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student receiving the assignment
  curriculum_template_id: "string", // Linked CurriculumTemplate id
  title: "string", // Student-facing assignment title
  assignment_mode: "string", // sequential or weekly_custom
  status: "string", // active, paused, completed
  weekly_block_count: "number", // Planned weekly workload for the student
  block_length: "number", // Planned minutes per block for the student
  default_category: "string", // Default WeeklyBlock.category
  default_completion_mode: "string", // Default WeeklyBlock.completion_mode
  color: "string", // Student-facing accent color
  require_timer: "boolean", // Whether timer usage is expected
  require_input: "boolean", // Whether written reflection is expected
  resources: "array", // Array of ResourceSchema items
  custom_fields: "array", // Array of CustomFieldSchema items
  block_objectives: "object", // Optional per-block instructional overrides
  current_position: "object", // AssignmentPositionSchema when sequencing is in use
  legacy_subject_id: "string", // Compatibility reference back to the current subject model
  legacy_subject_title: "string", // Compatibility title snapshot from the current subject model
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Weekly block schema (nested in WeeklyPlan)
export const WeeklyBlockSchema = {
  id: "string", // Stable weekly block identifier within the plan
  assignment_id: "string", // Source Assignment id; Phase 2 uses a deterministic compatibility id until assignments are persisted
  student_id: "string", // Student doing the work
  title: "string", // Student-facing title for the block
  instruction: "string", // Final instruction shown for the week
  resources: "array", // Array of ResourceSchema items
  custom_fields: "array", // Array of CustomFieldSchema items
  category: "string", // WeeklyBlock.category using shared vocabulary
  completion_mode: "string", // WeeklyBlock.completion_mode using shared vocabulary
  planned_duration_minutes: "number", // Planned effort target for the block
  require_timer: "boolean", // Whether timer usage is required or recommended
  require_input: "boolean", // Whether written reflection is required
  legacy_subject_id: "string", // Compatibility reference for existing submissions/timers
  legacy_subject_title: "string", // Compatibility title snapshot
  legacy_block_index: "number", // Compatibility reference for existing block-index flows
};

// Weekly plan schema
export const WeeklyPlanSchema = {
  id: "string", // Stable document ID: `${parent_id}_${student_id}_${week_key}`
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student whose week is being planned
  week_key: "string", // YYYY-MM-DD week start key
  week_start: "timestamp", // Start of the planned week
  week_end: "timestamp", // End of the planned week
  status: "string", // draft, published, archived
  assignment_ids: "array", // Assignment ids included in the week; Phase 2 uses deterministic compatibility ids derived from student + legacy subject
  weekly_exceptions: "array", // One-off weekly adjustments or add-ons
  blocks: "array", // Array of WeeklyBlockSchema items
  published_at: "timestamp", // Timestamp when the week becomes live
  archived_at: "timestamp", // Timestamp when the week is archived into reporting
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Weekly Report Schema
export const WeeklyReportSchema = {
  id: "string", // Deterministic document ID: `${parent_id}_${student_id}_${week_key}`
  student_id: "string", // Reference to student
  student_name: "string", // Cached student display name for printing and filters
  parent_id: "string", // Reference to parent
  week_key: "string", // YYYY-MM-DD week start key
  week_start: "timestamp", // Start of the week period
  week_end: "timestamp", // End of the week period
  week_ending: "timestamp", // Compatibility alias still used by report queries/sorting
  weekly_goal: "number", // Total assigned blocks for the week
  total_blocks: "number", // Total completed blocks for the week
  total_hours: "number", // Rounded hours from block_duration totals
  subject_ids: "array", // Legacy subject ids represented in the snapshot
  subject_titles: "array", // Cached subject titles represented in the snapshot
  subjects_data: "object", // Map of legacy subject id -> SubjectProgressSchema
  summaries: "array", // Flat list of student summary text snippets for compatibility surfaces
  attachments: "array", // Placeholder for future evidence attachments
  snapshot_model: "string", // weekly_plan when built from a published/archived plan, otherwise subjects
  weekly_plan_id: "string", // Exact weekly plan backing the record; empty on subject fallback
  school_year_label: "string", // Cached school year label
  school_year_start: "timestamp", // Cached school year range start
  school_year_end: "timestamp", // Cached school year range end
  school_quarter: "number", // Cached quarter index
  school_quarter_label: "string", // Cached quarter label
  record_source: "string", // manual or automatic archival path
  created_at: "timestamp"
};

// Subject Progress Schema (nested in WeeklyReport)
export const SubjectProgressSchema = {
  subjectId: "string", // Legacy subject id for compatibility reporting
  subjectTitle: "string", // Cached subject title used in print and filter surfaces
  totalBlocks: "number", // Number of completed blocks for the subject
  goalBlocks: "number", // Number of assigned blocks for the subject-week snapshot
  totalMinutes: "number", // Total minutes spent on subject submissions this week
  summaries: "array" // Array of BlockEntrySchema summary rows
};

// Block Entry Schema (nested in SubjectProgress)
export const BlockEntrySchema = {
  text: "string", // Student-written summary text
  blockNumber: "number", // Human-readable block number (1-based)
  date: "timestamp", // When the submission was recorded
  duration: "number", // Minutes spent on this block
  manualOverride: "boolean" // Whether a parent marked the block complete
};

// Daily Log Schema (for real-time tracking)
export const DailyLogSchema = {
  id: "string", // Auto-generated document ID
  student_id: "string", // Reference to student
  date: "string", // YYYY-MM-DD format
  blocks_locked: "array", // Array of locked block entry IDs
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Timer Session Schema (for cross-device timer persistence)
export const TimerSessionSchema = {
  id: "string", // Deterministic: `${student_id}_${subject_id}`
  student_id: "string", // Reference to student
  parent_id: "string", // Reference to parent
  subject_id: "string", // Reference to subject
  block_index: "number", // Current block tied to the timer
  start_time: "number", // Client timestamp in ms when timer started
  duration_ms: "number", // Original timer duration in milliseconds
  duration_minutes: "number", // Original timer duration in minutes
  target_end_time: "number", // Client timestamp in ms when timer should end
  initial_duration_ms: "number", // For progress calculations
  remaining_time: "number", // Cached remaining ms for paused timers
  is_running: "boolean", // Whether the timer is actively counting down
  paused_at: "number", // Client timestamp in ms when paused
  resumed_at: "number", // Client timestamp in ms when most recently resumed
  completed_at: "number", // Client timestamp in ms when timer hit zero
  saved_at: "number", // Client timestamp in ms for last local sync
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Lockdown Policy Schema (derived prototype policy document)
export const LockdownPolicySchema = {
  parent_id: "string", // Reference to parent's uid and document owner
  is_enabled: "boolean", // Whether blocking is currently enabled
  allowed_origins: "array", // Origin-level allowlist entries such as https://www.khanacademy.org
  allowed_youtube_channels: "array", // Approved creators stored by stable channel_id
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Lockdown enrollment session schema (server-owned production pairing ticket)
export const LockdownEnrollmentSessionSchema = {
  id: "string", // Random trusted document id minted by Cloud Functions
  parent_id: "string", // Parent uid that requested the enrollment material
  student_id: "string", // Student bound to the device-policy derivation for this enrollment
  source_policy_parent_id: "string", // Parent uid whose student-bound published weekly plan is read server-side
  source_policy_kind: "string", // Source marker such as published_weekly_plan_derived_policy_v1
  token_hash: "string", // Server-stored hash of the one-time enrollment token
  status: "string", // pending, consumed, expired, or revoked
  expires_at: "timestamp", // Short-lived enrollment expiration
  consumed_device_id: "string", // Device document id once the ticket is exchanged
  consumed_at: "timestamp", // When the one-time ticket was exchanged
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Lockdown device schema (server-owned production credential record)
export const LockdownDeviceSchema = {
  id: "string", // Random trusted device id minted by Cloud Functions
  parent_id: "string", // Parent uid that owns the device pairing
  student_id: "string", // Student whose published weekly plan and timers drive the derived policy
  source_policy_parent_id: "string", // Parent uid whose student-bound policy context is read server-side
  source_policy_kind: "string", // Source marker such as published_weekly_plan_derived_policy_v1
  pairing_contract: "string", // Contract identifier such as trusted_lockdown_enrollment_v1
  policy_read_contract: "string", // Contract identifier such as trusted_lockdown_device_policy_v1
  credential_hash: "string", // Server-stored hash of the opaque device credential
  status: "string", // active or revoked
  device_name: "string", // Extension-provided display label
  device_platform: "string", // Extension-reported platform or browser family
  extension_version: "string", // Extension version reported at enrollment time
  paired_at: "timestamp", // When the trusted device credential was minted
  last_seen_at: "timestamp", // Last successful policy-read or exchange touch
  last_policy_read_at: "timestamp", // Last successful trusted policy fetch
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Account Entitlement nested schemas (server-owned billing and plan state)
export const AccountEntitlementFeatureOverridesSchema = {
  can_use_projects: "boolean", // Optional override for the planned projects feature
  can_use_lockdown_extension: "boolean", // Optional override for browser extension access
  can_use_lockdown_kiosk: "boolean" // Optional override for kiosk mode access
};

export const AccountEntitlementUsageSnapshotSchema = {
  students: "number", // Cached student usage snapshot from trusted backend flows
  curriculum_items: "number" // Cached active curriculum usage snapshot from trusted backend flows
};

export const AccountEntitlementSchema = {
  parent_id: "string", // Parent uid and document owner; document id should match this uid
  plan_id: "string", // Stable internal plan id: free | core | lockdown
  subscription_status: "string", // trialing | active | past_due | canceled
  billing_provider: "string", // Billing authority identifier, e.g. stripe
  feature_overrides: "object", // See AccountEntitlementFeatureOverridesSchema; trusted-only
  usage_snapshot: "object", // See AccountEntitlementUsageSnapshotSchema; preserved by trusted flows
  trial_ends_at: "timestamp", // Nullable timestamp when a trial is active
  current_period_end: "timestamp", // Nullable timestamp for current billing period
  updated_at: "timestamp" // Last trusted backend update written by the billing webhook
};

// Export collection names for Firestore
export const Collections = {
  PARENTS: "parents",
  STUDENTS: "students", 
  SUBJECTS: "subjects",
  CURRICULUM_TEMPLATES: "curriculumTemplates",
  ASSIGNMENTS: "assignments",
  WEEKLY_PLANS: "weeklyPlans",
  WEEKLY_REPORTS: "weeklyReports",
  DAILY_LOGS: "dailyLogs",
  SUBMISSIONS: "submissions",
  TIMER_SESSIONS: "timerSessions",
  ACCOUNT_ENTITLEMENTS: "accountEntitlements",
  LOCKDOWN_POLICIES: "lockdownPolicies",
  LOCKDOWN_ENROLLMENT_SESSIONS: "lockdownEnrollmentSessions",
  LOCKDOWN_DEVICES: "lockdownDevices"
};

export const TrustedFunctionNames = {
  CREATE_STUDENT: "createStudent",
  CREATE_SUBJECT: "createSubject",
  BILLING_WEBHOOK: "billingWebhook",
  ISSUE_LOCKDOWN_ENROLLMENT: "issueLockdownEnrollment",
  EXCHANGE_LOCKDOWN_ENROLLMENT: "lockdownExchangeEnrollment",
  READ_LOCKDOWN_DEVICE_POLICY: "readLockdownDevicePolicy"
};

// Submission Schema (for individual block completions)
export const SubmissionSchema = {
  id: "string", // Auto-generated document ID
  student_id: "string", // Reference to student
  parent_id: "string", // Reference to parent
  subject_name: "string", // Subject title (e.g., "Math", "Reading")
  subject_id: "string", // Reference to subject document
  block_index: "number", // Zero-based subject block index used by the live portal
  timestamp: "timestamp", // When the submission was made
  summary_text: "string", // Student reflection (if required by subject)
  block_duration: "number", // Minutes spent on this block
  resources_used: "array", // Resource indices selected during submission
  custom_field_responses: "object", // Map of custom field id -> submitted value
  date: "string", // YYYY-MM-DD format for daily tracking
  is_locked: "boolean", // Whether this submission is locked from changes
  created_at: "timestamp"
};

// Export validation helpers
export const validateSchema = (data, schema) => {
  const errors = [];

  const matchesExpectedType = (value, expectedType) => {
    if (expectedType === "array") {
      return Array.isArray(value);
    }

    if (expectedType === "object") {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    if (expectedType === "timestamp") {
      return value !== null && value !== undefined;
    }

    return typeof value === expectedType;
  };
  
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`);
    } else if (!matchesExpectedType(data[key], expectedType)) {
      errors.push(`Field ${key} must be of type ${expectedType}`);
    }
  }
  
  return errors;
};
