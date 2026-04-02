# Project HomeTrack: Student-Led Homeschool LMS

**Project Goal:** A high-autonomy, block-based learning management system that empowers students to manage their weekly workload while providing parents with automated compliance reporting and activity feeds.

## 1. Core Philosophy: The "Block" System

Unlike traditional school software that uses rigid calendars (e.g., "Math at 9:00 AM"), HomeTrack uses Weekly Targets.

- **Parent defines:** "You must complete 5 blocks of Math this week."
- **Student decides:** "I will do 3 blocks on Monday and 2 on Thursday."
- **System tracks:** Completion, time spent, and student reflections.

## 2. Platform Architecture (SaaS Model)

Hosted on Cloudflare Pages + Firebase (Spark Tier) for zero-cost scaling.

### A. Authentication & Access

**Parent Identity:** Secure Email/Password login via Firebase Auth.

**Student Access:**
- **Magic Link:** Each student has a unique, obfuscated URL slug (e.g., hometrack.app/st/evelyn-xyz)
- **Child PIN:** Parents can set a simple 4-digit PIN to prevent siblings from interfering with each other's progress.

### B. Data Architecture (Database Schema)

- **Parent Account:** uid, email, school_name, week_start_day [0-6], timezone
- **Student Profile:** id, parent_id, name, slug, access_pin
- **Subject Module:** title, block_count, block_duration, require_input (Toggle), resources[]

**Progress Tracking:**
- **Live State:** Real-time tracking of current week checkboxes
- **Daily Log:** Snapshot of blocks "Locked" by the student
- **Archive:** Immutable weekly reports stored for historical review

## 3. The Parent Portal (Admin View)

### Dashboard & Analytics

- **Student Overview:** "Battery gauge" visual progress for each child
- **The "Pulse" Feed:** Real-time timeline showing exactly when blocks are checked and reading student reflections
- **Completion Graphs:** Charts showing progress velocity over time to identify burnout or "Monday Marathons"

### Curriculum & Scheduling

- **Module Builder:** Add/remove subjects
- **Define block counts and durations**
- **Resource Manager:** Add links or text instructions. Text resources open in a clean, in-window popup for the student

### Week Control

Define exactly when the week starts and ends (e.g., Sunday 8pm reset).

### Reporting & Compliance

- **The Evidence Drawer:** A crucial tool for legal reporting. Allows parents to go back into any completed weekly report and attach files (screenshots of grades from other apps, photos of physical worksheets, or PDFs)
- **Auto-Archive:** System automatically snapshots the week at the deadline, even if the student didn't hit "Submit Week"

## 4. The Student Portal (Student View)

### UI/UX Logic

- **Distraction-Free:** No sidebars, no ads, no "Parent Settings"
- **The Checklist:** Large, interactive blocks
  - If require_input is ON: Clicking a block triggers a modal: "What did you work on?" (1-3 sentences required)
  - If require_input is OFF: Immediate visual success feedback
- **The Resource Hub:** Centralized access to all bookmarked sites and instructions

### Submission Workflow

1. **"Submit Today's Progress":** Student clicks this when done for the day. This locks those checkboxes for the remainder of the week to prevent accidental changes.
2. **"Submit Full Week":** Triggers a final validation. If blocks are missing, it asks: "You aren't finished yet—are you sure you want to close this week?"

## 5. Support & Sustainability

- **Donation Logic:** A "Support this Project" button (Buy Me a Coffee/Ko-fi) located strictly in the Parent Portal footer
- **Mission:** Keep the platform free for families by relying on community support for hosting costs

## 6. Technical Requirements

- **Frontend:** React + Tailwind CSS + Lucide Icons
- **Backend:** Firestore (Partitioned by parent_id), Firebase Storage (for Evidence files), and Cloud Functions (for automated weekly resets)