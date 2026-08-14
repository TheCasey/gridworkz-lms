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
  access_pin: "string", // Optional 4-6 digit PIN for sibling protection
  week_reset_day: "number", // Public copy of school weekly rollover day
  week_reset_hour: "number", // Public copy of school weekly rollover hour
  week_reset_minute: "number", // Public copy of school weekly rollover minute
  timezone: "string", // IANA timezone for weekly rollover
  lockdown_schedule: "object", // Optional student-bound lockdown schedule plus legacy off-hours resource windows used as migration input
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

// Phase 1 contract only: this defines the parent-owned off-block resource assignment shape
// without choosing the final Firestore persistence path. Helpers may also accept equivalent
// nested `assignment` input during migration.
export const LockdownResourceAssignmentSchema = {
  assign_to_all_students: "boolean", // True when the resource applies to every student under the parent
  student_ids: "array", // Explicit student assignment list when assign_to_all_students is false
};

// Phase 1 contract only: household off-block resource-library entry used by Lockdown policy
// helpers. Final storage location and CRUD ownership are deferred to a later phase.
export const LockdownResourceLibraryEntrySchema = {
  id: "string", // Stable local or document identifier for the parent-managed resource entry
  name: "string", // Parent-facing label for the approved resource
  url: "string", // Website URL, origin, YouTube channel URL, handle URL, watch URL, or channel id input
  lockdown_origin: "string", // Optional exact origin override when the saved website should resolve without a path
  youtube_channel_id: "string", // Stable YouTube creator channel id when known
  youtube_channel_title: "string", // Optional creator title snapshot paired with youtube_channel_id
  youtube_channel_handle: "string", // Optional creator handle snapshot paired with youtube_channel_id
  assign_to_all_students: "boolean", // Whether this off-block resource applies to every student
  student_ids: "array", // Explicit student ids when the resource is limited to selected students
  is_active: "boolean", // Whether the resource is still eligible for derived policy behavior
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
  off_hours_resource_windows: "array", // Legacy migration input: array of LockdownResourceWindowSchema entries
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

// Reusable curriculum block definition stored on Subject.
// Weekly plans select quantities from this library and expand them into unique WeeklyBlock items.
export const CurriculumBlockDefinitionSchema = {
  id: "string", // Stable block-library id scoped to a subject
  title: "string", // Parent/student-facing block name
  type: "string", // standard, project, parent_led, test, or custom
  instruction: "string", // Default instruction used when this block is assigned
  custom_fields: "array", // Optional block-level prompts
  default_quantity: "number", // Quantity used when building the default week
  pinned: "boolean", // Whether this block is promoted in quick planning surfaces
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
  curriculum_blocks: "array", // Array of CurriculumBlockDefinitionSchema items; fallback is generated from block_count/block_objectives
  default_block_quantities: "object", // Optional map of curriculumBlockId -> default weekly quantity
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
  curriculum_block_id: "string", // Reusable curriculum block definition id when planned from curriculum_blocks
  curriculum_block_title: "string", // Snapshot of reusable block title
  curriculum_block_type: "string", // Snapshot of reusable block type
  curriculum_block_source_index: "number", // Original index in subject.curriculum_blocks
  curriculum_block_occurrence: "number", // Occurrence number when the same reusable block is assigned more than once
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
  assigned_blocks_snapshot: "array", // Weekly-plan block snapshots, including incomplete assigned blocks when available
  summaries: "array", // Flat list of student summary text snippets for compatibility surfaces
  attachments: "array", // Placeholder for future evidence attachment metadata
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

// Assigned Block Snapshot Schema (nested in WeeklyReport)
export const AssignedBlockSnapshotSchema = {
  blockId: "string", // WeeklyPlan block id when available
  assignmentId: "string", // Source assignment id when available
  title: "string", // Student-facing block title snapshot
  instruction: "string", // Final instruction shown for the week
  category: "string", // WeeklyBlock.category snapshot
  completionMode: "string", // WeeklyBlock.completion_mode snapshot
  plannedDurationMinutes: "number", // Planned effort target for the block
  completed: "boolean", // Whether this assigned block had a matched submission
  completionStatus: "string", // completed or incomplete
  resources: "array", // ResourceSchema snapshots visible for the block
  legacySubjectId: "string", // Compatibility subject reference used by existing submissions/timers
  legacySubjectTitle: "string", // Compatibility subject title snapshot
  legacyBlockIndex: "number", // Compatibility block index used by existing submissions/timers
  matchedSubmissionSummary: "object" // Submission summary snapshot when a matching completion exists
};

// Attachment Metadata Schema (nested in WeeklyReport.attachments)
export const AttachmentMetadataSchema = {
  id: "string", // Stable metadata id for one attached evidence file
  name: "string", // Parent-visible file name
  storagePath: "string", // Firebase Storage object path
  contentType: "string", // MIME type recorded at upload time
  sizeBytes: "number", // File size in bytes
  uploadedAt: "timestamp", // When the file metadata was attached to the report
  uploadedBy: "string" // Parent uid that added the file
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
  system_resources: "array", // Own Path system pages, endpoints, and decision-state resources kept separate from learning allowlists
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Lockdown policy state metadata schema (shared production vocabulary for previews, launchers, and future kiosk mode)
export const LockdownPolicyStateMetadataSchema = {
  state: "string", // Canonical production state: active_block, no_active_session, no_published_plan, no_active_work, off_hours_open, off_hours_closed, entitlement_inactive, device_revoked, unpaired, or stale_cached_policy
  policy_state: "string", // Contract alias for the canonical production state
  legacy_policy_state: "string", // Compatibility copy of the older enforcement state when still needed
  school_time_state: "string", // school_time or off_hours
  off_hours_window_state: "string", // open or closed for off-hours normalization
  entitlement_state: "string", // active or inactive
  device_state: "string", // active, revoked, or unpaired
  cache_state: "string", // fresh or stale
  active_work_state: "string", // active_block, no_active_session, no_published_plan, or no_active_work
  active_work_session: "object", // LockdownActiveWorkSessionSchema when active work is known; null when no active session exists
  weekly_plan_exists: "boolean", // Whether a published weekly plan is present in the current policy context
  published_weekly_plan_exists: "boolean", // Alias retained for function/client parity and source-policy metadata
  weekly_plan_id: "string", // Published weekly plan backing the current state, when present
  weekly_plan_status: "string", // Current weekly plan status snapshot, such as draft or published
};

// Lockdown active work session schema (shared contract for timer, task-complete, project, and worksheet launchers)
export const LockdownActiveWorkSessionSchema = {
  id: "string", // Stable active-work session id when the session is persisted or derived from a timer
  kind: "string", // timer, task_complete, project, or worksheet
  status: "string", // active, paused, completed, archived, or empty when not yet started
  source_kind: "string", // Source marker such as published_weekly_plan_derived_policy_v1
  parent_id: "string", // Parent uid that owns the policy context
  student_id: "string", // Student bound to the active work session
  subject_id: "string", // Legacy subject compatibility reference
  subject_title: "string", // Compatibility title snapshot for legacy subject-based work
  assignment_id: "string", // Assignment id when the work session is sourced from a persisted assignment
  weekly_plan_id: "string", // Published weekly plan backing the active work session
  block_id: "string", // Weekly-plan block id when available
  block_index: "number", // Legacy block index compatibility field when timers still key off legacy subjects
  block_title: "string", // Student-facing block title snapshot
  legacy_subject_id: "string", // Legacy subject id compatibility reference
  legacy_subject_title: "string", // Legacy subject title compatibility snapshot
  legacy_block_index: "number", // Legacy block index compatibility reference
  project_id: "string", // Future project-work identifier
  project_title: "string", // Future project-work title snapshot
  project_work_id: "string", // Future project-work session/run identifier
  worksheet_id: "string", // Future worksheet identifier
  worksheet_title: "string", // Future worksheet title snapshot
  worksheet_work_id: "string", // Future worksheet response/session identifier
  timer_session_id: "string", // Timer session id when the active work session is timer-backed
  started_at: "timestamp", // Session start timestamp or client time snapshot
  updated_at: "timestamp", // Last session update timestamp
  completed_at: "timestamp", // Completion timestamp when the session finishes
  target_end_time: "number", // Client epoch millis for timer-backed sessions
  duration_ms: "number", // Client duration in milliseconds for timer-backed sessions
  remaining_time: "number", // Cached remaining timer duration in milliseconds
  is_running: "boolean", // Whether a timer-backed session is currently running
  resource_ids: "array", // Optional resource identifiers attached to future launcher-owned sessions
  metadata: "object", // Extra normalized metadata that should survive future session shapes
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

// Lockdown recovery session schema (server-owned parent-authorized local unpair ticket)
export const LockdownRecoverySessionSchema = {
  id: "string", // Random trusted document id minted by Cloud Functions
  parent_id: "string", // Parent uid that requested the recovery material
  student_id: "string", // Student binding expected on the paired device
  device_id: "string", // Device record that may clear its local pairing
  token_hash: "string", // Server-stored hash of the one-time recovery token
  status: "string", // pending, consumed, expired, or revoked
  expires_at: "timestamp", // Short-lived recovery expiration
  consumed_device_id: "string", // Device document id once the ticket is accepted
  consumed_at: "timestamp", // When the one-time ticket was accepted
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

// Lockdown household resource-library record schema (parent-owned, callable-written)
export const TrustedLockdownResourceLibraryRecordSchema = {
  id: "string", // Stable document id for one household resource-library entry
  parent_id: "string", // Parent uid that owns the saved resource record
  name: "string", // Parent-facing label for the approved website or YouTube creator
  url: "string", // Normalized origin or YouTube channel URL stored after trusted validation
  lockdown_origin: "string", // Exact origin used for website allowlist derivation when applicable
  youtube_channel_id: "string", // Stable creator channel id when the entry targets a YouTube creator
  youtube_channel_title: "string", // Optional creator title snapshot
  youtube_channel_handle: "string", // Optional creator handle snapshot
  assign_to_all_students: "boolean", // Whether every active student under the parent receives the resource
  student_ids: "array", // Explicit active student assignments when assign_to_all_students is false
  is_active: "boolean", // Whether the entry should participate in derived policy behavior
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Support operator schema (server-owned operator allowlist)
export const SupportOperatorSchema = {
  uid: "string", // Firebase Auth UID; document id should match this uid
  email: "string", // Operator email address for session display and audit attribution
  role: "string", // support | admin
  is_active: "boolean", // Whether this operator can access trusted operator callables
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Account Entitlement nested schemas (server-owned billing and plan state)
export const AccountEntitlementFeatureOverridesSchema = {
  can_use_projects: "boolean", // Optional override for the planned projects feature
  can_use_daily_routines: "boolean", // Optional override for grouped daily routine access; included on Free by default
  can_use_chores: "boolean", // Optional override for paid chore pools, allowance tracking, and achievements
  can_use_rewards: "boolean", // Optional override for paid points, reward-store behavior, redemptions, and cosmetics
  can_use_lockdown_extension: "boolean", // Optional override for browser extension access
  can_use_lockdown_kiosk: "boolean" // Optional override for kiosk mode access
};

export const AccountEntitlementUsageSnapshotSchema = {
  students: "number", // Cached student usage snapshot from trusted backend flows
  curriculum_items: "number" // Cached active curriculum usage snapshot from trusted backend flows
};

export const AccountEntitlementBillingStateSchema = {
  plan_id: "string", // Billing-backed plan id: free | core | lockdown
  subscription_status: "string", // Billing-backed status: trialing | active | past_due | canceled | null
  billing_provider: "string", // Billing authority identifier, e.g. stripe, or null
  feature_overrides: "object", // Provider-backed feature overrides, normally empty
  trial_ends_at: "timestamp", // Nullable timestamp when a trial is active
  current_period_end: "timestamp", // Nullable timestamp for current billing period
  updated_at: "timestamp" // Last billing-state update from trusted backend
};

export const AccountEntitlementManualOverrideSchema = {
  is_active: "boolean", // Whether this override should currently drive effective state
  plan_id: "string", // Override plan id: free | core | lockdown
  subscription_status: "string", // Override status: trialing | active | past_due | canceled | null
  feature_overrides: "object", // See AccountEntitlementFeatureOverridesSchema
  reason: "string", // Required support/test reason for operator mutations
  expires_at: "timestamp", // Nullable expiration timestamp for temporary overrides
  applied_by_uid: "string", // Operator uid that applied the override
  applied_by_email: "string", // Operator email snapshot for audit display
  applied_at: "timestamp" // When the override was applied
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
  resolution_source: "string", // billing | manual_override | fallback_initialized
  updated_via: "string", // billing_webhook | operator_console | operator_clear_override
  billing_state: "object", // See AccountEntitlementBillingStateSchema
  manual_override: "object", // See AccountEntitlementManualOverrideSchema, nullable
  updated_at: "timestamp" // Last trusted backend entitlement document update
};

export const EntitlementAuditLogSchema = {
  parent_id: "string", // Parent account affected by the entitlement event
  operator_uid: "string", // Operator uid for manual events; null for webhook/system events
  operator_email: "string", // Operator email snapshot; null for webhook/system events
  event_type: "string", // billing_webhook_sync | override_applied | override_cleared | record_initialized | override_expired
  reason: "string", // Human-entered reason or trusted backend event source
  before: "object", // Shallow entitlement snapshot before the event
  after: "object", // Shallow entitlement snapshot after the event
  created_at: "timestamp" // Server-owned audit event creation time
};

// Future chores, routines, allowance, points, and rewards vocabulary
export const ChoreFrequencyPools = Object.freeze({
  WEEKLY: "weekly",
  MONTHLY: "monthly",
});

export const ChoreFrequencyPoolValues = Object.values(ChoreFrequencyPools);

export const ChoreClaimStatuses = Object.freeze({
  CLAIMED: "claimed",
  COMPLETED: "completed",
  RELEASED: "released",
  EXPIRED: "expired",
  CANCELED: "canceled",
});

export const ChoreClaimStatusValues = Object.values(ChoreClaimStatuses);

export const ChoreCompletionStatuses = Object.freeze({
  COMPLETED: "completed",
  APPROVED: "approved",
  REJECTED: "rejected",
  RETURNED: "returned",
});

export const ChoreCompletionStatusValues = Object.values(ChoreCompletionStatuses);

export const AllowancePeriodCadences = Object.freeze({
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
});

export const AllowancePeriodCadenceValues = Object.values(AllowancePeriodCadences);

export const AllowanceCompletionPolicies = Object.freeze({
  ALL_OR_NOTHING: "all_or_nothing",
  PRORATED: "prorated",
});

export const AllowanceCompletionPolicyValues = Object.values(AllowanceCompletionPolicies);

export const PointSourceTypes = Object.freeze({
  SCHOOL_BLOCK: "school_block",
  CHORE_COMPLETION: "chore_completion",
  ROUTINE_COMPLETION: "routine_completion",
  ADJUSTMENT: "adjustment",
  REWARD_REDEMPTION_RESERVATION: "reward_redemption_reservation",
  REWARD_REDEMPTION_REFUND: "reward_redemption_refund",
  REWARD_BUILT_IN_UNLOCK: "reward_built_in_unlock",
});

export const PointSourceTypeValues = Object.values(PointSourceTypes);

export const RewardCatalogItemTypes = Object.freeze({
  BUILT_IN: "built_in",
  PARENT_CREATED: "parent_created",
});

export const RewardCatalogItemTypeValues = Object.values(RewardCatalogItemTypes);

export const RewardRedemptionStatuses = Object.freeze({
  REQUESTED: "requested",
  APPROVED: "approved",
  FULFILLED: "fulfilled",
  REJECTED: "rejected",
  CANCELED: "canceled",
});

export const RewardRedemptionStatusValues = Object.values(RewardRedemptionStatuses);

export const RoutineChecklistItemSchema = {
  id: "string", // Stable local checklist item identifier
  label: "string", // Student-facing checklist label
};

export const RoutineTemplateSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  title: "string", // Parent-facing routine title such as Morning Routine
  student_ids: "array", // Explicit student assignment list; empty means no student assignment yet
  checklist_items: "array", // Array of RoutineChecklistItemSchema items
  counts_toward_allowance: "boolean", // Whether completion can contribute to allowance later
  counts_toward_points: "boolean", // Whether completion can contribute to points later
  is_active: "boolean", // Whether the template is active
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const RoutineCompletionSchema = {
  id: "string", // Deterministic document ID such as `${routine_template_id}_${student_id}_${date_key}`
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student completing the routine
  routine_template_id: "string", // Reference to the routine template
  date_key: "string", // Local YYYY-MM-DD key for the student's routine day
  completed_item_ids: "array", // Checklist state snapshot stored under one routine completion record
  completed_at: "timestamp", // When the student finished the routine for the day
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const ChoreQuotaSchema = {
  required_routine_days: "number", // Required routine-completion days within the target period
  required_weekly_chore_blocks: "number", // Required weekly chore blocks
  required_monthly_chore_blocks: "number", // Required monthly chore blocks
};

export const ChoreAllowancePolicySchema = {
  period_type: "string", // weekly | biweekly | monthly
  allowance_amount: "number", // Base allowance amount for the period
  completion_policy: "string", // all_or_nothing | prorated
  include_routines: "boolean", // Whether eligible routine days count toward allowance
};

export const ChoreSettingsSchema = {
  parent_id: "string", // Parent uid and document owner; document id should match this uid
  claim_expiration_hours: "number", // Parent-configured claim window before a chore can be reclaimed
  timezone: "string", // IANA timezone used for routine-day keys and availability windows
  week_reset_day: "number", // Weekly rollover day for chore pools
  week_reset_hour: "number", // Weekly rollover hour for chore pools
  week_reset_minute: "number", // Weekly rollover minute for chore pools
  quotas: "object", // Map of studentId -> ChoreQuotaSchema
  allowance_policy: "object", // ChoreAllowancePolicySchema snapshot for future allowance calculations
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const ChoreDefinitionSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  title: "string", // Student-facing chore title
  frequency_pool: "string", // weekly | monthly
  eligible_student_ids: "array", // Explicit eligible student ids when not open to all siblings
  all_students_eligible: "boolean", // Whether every student under the parent may claim the chore
  instructions: "string", // Student-facing instructions
  definition_of_done: "string", // Parent-authored definition of done
  proof_requirement: "string", // Optional proof note for later workflows
  effort_label: "string", // Difficulty or effort label snapshot
  minimum_cooldown_days: "number", // Minimum cooldown applied on top of the pool boundary
  requires_parent_approval: "boolean", // Whether a later completion needs parent review
  is_active: "boolean", // Whether the chore is active in the available pool
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const ChoreClaimSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student holding the claim
  chore_definition_id: "string", // Reference to the chore definition
  status: "string", // claimed | completed | released | expired | canceled
  claim_expiration_hours: "number", // Snapshot of the claim window used for expiration
  claimed_at: "timestamp", // When the claim began
  expires_at: "timestamp", // Absolute claim expiration time
  released_at: "timestamp", // When the claim was released back to the pool
  completed_at: "timestamp", // When the claim rolled into a completion flow
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const ChoreCompletionSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student who completed the chore
  chore_definition_id: "string", // Reference to the chore definition
  claim_id: "string", // Linked claim id when the completion flowed from a claim
  status: "string", // completed | approved | rejected | returned
  completed_at: "timestamp", // When the student marked the chore complete
  approved_at: "timestamp", // When a parent approved the completion
  reviewed_at: "timestamp", // Last parent review timestamp
  proof_note: "string", // Optional student proof text
  proof_attachments: "array", // Future evidence attachment metadata ids or snapshots
  quota_blocks: "number", // Snapshot of how many quota blocks this completion contributes; MVP uses 1
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const AllowancePeriodSchema = {
  id: "string", // Deterministic or generated period document ID
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student whose allowance period is being tracked
  period_type: "string", // weekly | biweekly | monthly
  period_key: "string", // Stable key for the allowance period
  period_start: "timestamp", // Start of the allowance period
  period_end: "timestamp", // End of the allowance period
  required_counts: "object", // Required routine/chore counts snapshot for the period
  completed_counts: "object", // Completed routine/chore counts snapshot for the period
  calculated_earned_amount: "number", // Calculated earned amount before adjustments
  parent_adjustment_amount: "number", // Parent-entered adjustment amount
  paid_amount: "number", // Paid amount snapshot
  paid_status: "string", // unpaid | partially_paid | paid
  paid_at: "timestamp", // When the parent marked the period paid
  policy_snapshot: "object", // Allowance policy snapshot used for calculation
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const RewardSettingsSchema = {
  parent_id: "string", // Parent uid and document owner; document id should match this uid
  school_block_points: "number", // Configured points per school block
  chore_block_points: "number", // Configured points per chore block
  routine_day_points: "number", // Configured points per routine day
  routine_points_enabled: "boolean", // Whether routine completions award points
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const PointLedgerEntrySchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student receiving the point entry
  wallet_id: "string", // Reference to the student wallet record
  source_type: "string", // school_block | chore_completion | routine_completion | adjustment
  source_id: "string", // Source event identifier for idempotency and attribution
  delta_points: "number", // Positive or negative point adjustment
  balance_after: "number", // Optional post-entry wallet balance snapshot
  description: "string", // Parent-facing explanation or reward attribution note
  metadata: "object", // Future source attribution payload
  created_at: "timestamp"
};

export const StudentPointWalletSchema = {
  id: "string", // Deterministic document ID such as the student id
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Wallet owner
  total_points: "number", // Current available point balance
  lifetime_points: "number", // Lifetime points earned before redemptions
  updated_at: "timestamp"
};

export const RewardCatalogItemSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  type: "string", // built_in | parent_created
  title: "string", // Student-facing reward title
  description: "string", // Student-facing reward description
  point_cost: "number", // Cost in shared student points
  stock_quantity: "number", // Parent-managed stock quantity
  available_quantity: "number", // Remaining quantity available for redemption
  eligible_student_ids: "array", // Empty means available to any student under the parent
  redemption_requires_approval: "boolean", // Whether redemption should wait for parent approval
  fulfillment_terms: "string", // Parent-authored fulfillment note or placeholder unlock description
  built_in_key: "string", // Stable built-in reward identifier when type is built_in
  unlock_type: "string", // avatar | badge | profile_theme for built-in placeholder unlocks
  unlock_key: "string", // Stable placeholder unlock value within unlock_type
  is_active: "boolean", // Whether the reward is visible in the catalog
  created_at: "timestamp",
  updated_at: "timestamp"
};

export const RewardRedemptionSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  student_id: "string", // Student requesting the reward
  reward_catalog_item_id: "string", // Linked reward catalog item id
  status: "string", // requested | approved | fulfilled | rejected | canceled
  reward_type_snapshot: "string", // built_in | parent_created snapshot preserved for history
  title_snapshot: "string", // Reward title snapshot preserved for history
  point_cost_snapshot: "number", // Reward cost snapshot preserved for history
  stock_quantity_snapshot: "number", // Reward stock snapshot preserved for history
  available_quantity_snapshot: "number", // Available stock snapshot preserved at request time
  fulfillment_terms_snapshot: "string", // Parent-authored fulfillment snapshot for history
  built_in_key_snapshot: "string", // Stable built-in reward snapshot when applicable
  unlock_type_snapshot: "string", // avatar | badge | profile_theme when applicable
  unlock_key_snapshot: "string", // Stable unlock value when applicable
  requested_at: "timestamp", // When the student requested the reward
  approved_at: "timestamp", // When a parent approved the reward
  fulfilled_at: "timestamp", // When a parent marked the reward fulfilled
  rejected_at: "timestamp", // When a parent rejected the reward
  canceled_at: "timestamp", // When the request was canceled
  created_at: "timestamp",
  updated_at: "timestamp"
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
  CHORE_SETTINGS: "choreSettings",
  ROUTINE_TEMPLATES: "routineTemplates",
  CHORE_DEFINITIONS: "choreDefinitions",
  ROUTINE_COMPLETIONS: "routineCompletions",
  CHORE_CLAIMS: "choreClaims",
  CHORE_COMPLETIONS: "choreCompletions",
  ALLOWANCE_PERIODS: "allowancePeriods",
  REWARD_SETTINGS: "rewardSettings",
  POINT_LEDGER_ENTRIES: "pointLedgerEntries",
  STUDENT_POINT_WALLETS: "studentPointWallets",
  REWARD_CATALOG_ITEMS: "rewardCatalogItems",
  REWARD_REDEMPTIONS: "rewardRedemptions",
  ACCOUNT_ENTITLEMENTS: "accountEntitlements",
  ENTITLEMENT_AUDIT_LOGS: "entitlementAuditLogs",
  SUPPORT_OPERATORS: "supportOperators",
  LOCKDOWN_POLICIES: "lockdownPolicies",
  LOCKDOWN_ENROLLMENT_SESSIONS: "lockdownEnrollmentSessions",
  LOCKDOWN_RECOVERY_SESSIONS: "lockdownRecoverySessions",
  LOCKDOWN_DEVICES: "lockdownDevices",
  LOCKDOWN_RESOURCE_LIBRARY: "lockdownResourceLibrary"
};

export const TrustedFunctionNames = {
  CREATE_STUDENT: "createStudent",
  CREATE_SUBJECT: "createSubject",
  GET_OPERATOR_SESSION: "getOperatorSession",
  SEARCH_PARENT_ACCOUNTS: "searchParentAccounts",
  GET_OPERATOR_ENTITLEMENT_RECORD: "getOperatorEntitlementRecord",
  INITIALIZE_ENTITLEMENT_RECORD: "initializeEntitlementRecord",
  APPLY_ENTITLEMENT_OVERRIDE: "applyEntitlementOverride",
  CLEAR_ENTITLEMENT_OVERRIDE: "clearEntitlementOverride",
  BILLING_WEBHOOK: "billingWebhook",
  ISSUE_LOCKDOWN_ENROLLMENT: "issueLockdownEnrollment",
  EXCHANGE_LOCKDOWN_ENROLLMENT: "lockdownExchangeEnrollment",
  ISSUE_LOCKDOWN_RECOVERY: "issueLockdownRecovery",
  RECOVER_LOCKDOWN_DEVICE_PAIRING: "lockdownRecoverDevicePairing",
  LIST_LOCKDOWN_DEVICES: "listLockdownDevices",
  REVOKE_LOCKDOWN_DEVICE: "revokeLockdownDevice",
  UPSERT_LOCKDOWN_RESOURCE_LIBRARY_ENTRY: "upsertLockdownResourceLibraryEntry",
  DELETE_LOCKDOWN_RESOURCE_LIBRARY_ENTRY: "deleteLockdownResourceLibraryEntry",
  READ_LOCKDOWN_DEVICE_POLICY: "readLockdownDevicePolicy",
  UPSERT_CHORE_SETTINGS: "upsertChoreSettings",
  UPSERT_ROUTINE_TEMPLATE: "upsertRoutineTemplate",
  UPSERT_CHORE_DEFINITION: "upsertChoreDefinition",
  SYNC_ALLOWANCE_LEDGER: "syncAllowanceLedger",
  UPSERT_REWARD_SETTINGS: "upsertRewardSettings",
  ADJUST_STUDENT_POINTS: "adjustStudentPoints",
  UPSERT_REWARD_CATALOG_ITEM: "upsertRewardCatalogItem",
  REQUEST_REWARD_REDEMPTION: "requestRewardRedemption",
  CANCEL_REWARD_REDEMPTION: "cancelRewardRedemption",
  REVIEW_REWARD_REDEMPTION: "reviewRewardRedemption",
  READ_STUDENT_CHORE_STATE: "readStudentChoreState",
  CLAIM_CHORE: "claimChore",
  COMPLETE_CHORE: "completeChore",
  COMPLETE_ROUTINE: "completeRoutine",
  REVIEW_CHORE_COMPLETION: "reviewChoreCompletion"
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
