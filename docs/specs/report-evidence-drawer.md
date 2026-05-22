# Report Evidence Drawer

Status: Draft

## Goal

Add a reporting workflow that lets parents attach supporting files to a completed weekly report for compliance and record-keeping.

## Why This Exists

The original product plan explicitly called for an “Evidence Drawer,” but the current app stops at report generation, review, and print output.

## Minimum Scope

- Add an evidence section to weekly report detail views.
- Allow parents to attach one or more files to a report.
- Store file metadata in `weeklyReports.attachments`.
- Back the files with Firebase Storage rather than Firestore blobs.

## Current Contract

Saved weekly report payloads currently initialize `weeklyReports.attachments` as an empty array. This is the implemented report evidence metadata field name and should remain the code-facing contract unless a future migration has a specific product reason.

Placeholder attachment metadata should be small and Firestore-safe. The future Evidence Drawer implementation should store file descriptors in `attachments`, not file blobs. Expected descriptor fields include:

- `id`: stable attachment metadata id
- `name`: parent-visible file name
- `storagePath`: Firebase Storage object path
- `contentType`: MIME type
- `sizeBytes`: file size in bytes
- `uploadedAt`: upload timestamp
- `uploadedBy`: parent uid that added the file

## Product Questions To Resolve

- Which file types are allowed
- Maximum file size and per-report attachment count
- Whether parents can edit attachments after a week has rolled over
- Whether files belong to the report forever or can be detached later

## Technical Notes

- The schema already includes `attachments` as the weekly report evidence metadata placeholder.
- This feature should not be built until the Storage contract and security rules are defined.
- If rollover is moved server-side, attachment mutability rules should be defined at the same time.
- Future Evidence Drawer work should add upload UI, Firebase Storage rules, and any metadata validation in that dedicated workflow rather than in the reporting safety fixes workflow.
