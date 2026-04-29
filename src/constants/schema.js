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
  is_active: "boolean", // Whether student account is active
  created_at: "timestamp", // Student profile creation
  updated_at: "timestamp" // Last update timestamp
};

// Subject Module Schema
export const SubjectSchema = {
  id: "string", // Auto-generated document ID
  parent_id: "string", // Reference to parent's uid
  title: "string", // Subject name (e.g., "Math", "Reading")
  block_count: "number", // Number of blocks required per week
  block_duration: "number", // Duration of each block in minutes
  require_input: "boolean", // Whether student input is required on completion
  resources: "array", // Array of resource objects (links, text instructions)
  custom_fields: "array", // Subject-level custom feedback fields (see below)
  block_objectives: "object", // Map of blockIndex (string) → BlockObjectiveSchema; absent keys = free blocks
  is_active: "boolean", // Whether subject is currently active
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Block Objective Schema (nested in block_objectives map on Subject)
export const BlockObjectiveSchema = {
  instruction: "string",     // Shared instruction for all students (may be empty if only overrides exist)
  custom_fields: "array",    // Optional; if non-empty, replaces subject.custom_fields for this block
  student_overrides: "object" // Map of studentId → { instruction, custom_fields }; takes priority over shared
};

// Resource Schema (nested in Subject)
export const ResourceSchema = {
  id: "string", // Auto-generated ID
  type: "string", // "link" or "text"
  title: "string", // Resource display title
  content: "string", // URL for links, text content for text resources
  order: "number" // Display order within subject
};

// Weekly Report Schema
export const WeeklyReportSchema = {
  id: "string", // Auto-generated document ID
  student_id: "string", // Reference to student
  parent_id: "string", // Reference to parent
  week_start: "timestamp", // Start of the week period
  week_end: "timestamp", // End of the week period
  status: "string", // "active", "submitted", "archived"
  subjects: "array", // Array of subject progress objects
  total_blocks_completed: "number", // Total blocks completed this week
  total_blocks_required: "number", // Total blocks required for this week
  submission_date: "timestamp", // When student submitted the week
  evidence_files: "array", // Array of file references for compliance
  school_year_label: "string", // Cached school year label
  school_quarter_label: "string", // Cached quarter label
  week_key: "string", // YYYY-MM-DD week start key
  created_at: "timestamp",
  updated_at: "timestamp"
};

// Subject Progress Schema (nested in WeeklyReport)
export const SubjectProgressSchema = {
  subject_id: "string", // Reference to subject
  subject_title: "string", // Cached subject title
  blocks_completed: "number", // Number of blocks completed
  blocks_required: "number", // Number of blocks required
  block_entries: "array", // Array of individual block completion entries
  total_time_spent: "number" // Total minutes spent on subject this week
};

// Block Entry Schema (nested in SubjectProgress)
export const BlockEntrySchema = {
  id: "string", // Auto-generated ID
  completed_at: "timestamp", // When block was marked complete
  time_spent: "number", // Minutes spent on this block
  student_input: "string", // Student reflection (if require_input=true)
  is_locked: "boolean", // Whether entry is locked from further changes
  date: "string" // YYYY-MM-DD format for daily tracking
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

// Export collection names for Firestore
export const Collections = {
  PARENTS: "parents",
  STUDENTS: "students", 
  SUBJECTS: "subjects",
  WEEKLY_REPORTS: "weeklyReports",
  DAILY_LOGS: "dailyLogs",
  SUBMISSIONS: "submissions",
  TIMER_SESSIONS: "timerSessions"
};

// Submission Schema (for individual block completions)
export const SubmissionSchema = {
  id: "string", // Auto-generated document ID
  student_id: "string", // Reference to student
  parent_id: "string", // Reference to parent
  subject_name: "string", // Subject title (e.g., "Math", "Reading")
  subject_id: "string", // Reference to subject document
  timestamp: "timestamp", // When the submission was made
  summary_text: "string", // Student reflection (if required by subject)
  block_duration: "number", // Minutes spent on this block
  date: "string", // YYYY-MM-DD format for daily tracking
  is_locked: "boolean", // Whether this submission is locked from changes
  created_at: "timestamp"
};

// Export validation helpers
export const validateSchema = (data, schema) => {
  const errors = [];
  
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`);
    } else if (expectedType === "array" && !Array.isArray(data[key])) {
      errors.push(`Field ${key} must be an array`);
    } else if (expectedType !== "array" && typeof data[key] !== expectedType) {
      errors.push(`Field ${key} must be of type ${expectedType}`);
    }
  }
  
  return errors;
};
