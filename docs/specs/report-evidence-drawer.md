# Report Evidence Drawer

Status: Draft

## Goal

Add a reporting workflow that lets parents attach supporting files to a completed weekly report for compliance and record-keeping.

## Why This Exists

The original product plan explicitly called for an “Evidence Drawer,” but the current app stops at report generation, review, and print output.

## Minimum Scope

- Add an evidence section to weekly report detail views.
- Allow parents to attach one or more files to a report.
- Store file metadata in `weeklyReports.evidence_files`.
- Back the files with Firebase Storage rather than Firestore blobs.

## Product Questions To Resolve

- Which file types are allowed
- Maximum file size and per-report attachment count
- Whether parents can edit attachments after a week has rolled over
- Whether files belong to the report forever or can be detached later

## Technical Notes

- The schema already includes `evidence_files`.
- This feature should not be built until the Storage contract and security rules are defined.
- If rollover is moved server-side, attachment mutability rules should be defined at the same time.
