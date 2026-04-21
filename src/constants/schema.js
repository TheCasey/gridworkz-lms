/**
 * GridWorkz LMS Data Schema
 * Single source of truth for Firestore data structures
 */

// Parent Account Schema
export const ParentSchema = {
  uid: "string", // Firebase Auth UID
  email: "string", // Parent email address
  school_name: "string", // Homeschool name/identifier
  week_start_day: "number", // 0-6 (Sunday=0, Monday=1, etc.)
  timezone: "string", // IANA timezone identifier
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

// Export collection names for Firestore
export const Collections = {
  PARENTS: "parents",
  STUDENTS: "students", 
  SUBJECTS: "subjects",
  WEEKLY_REPORTS: "weeklyReports",
  DAILY_LOGS: "dailyLogs",
  SUBMISSIONS: "submissions"
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
