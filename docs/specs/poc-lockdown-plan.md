# Lockdown PoC Plan

Status: Ready

Companion document: [lockdown-browser-extension-plan.md](lockdown-browser-extension-plan.md)

## Execution State

Live run state now belongs in [poc-lockdown-state.yaml](poc-lockdown-state.yaml).
This plan stays focused on phase definitions, exit criteria, and the expected state
transitions.

```yaml
workflow_name: lockdown-browser-extension-poc
current_phase: 1
current_phase_name: "Extension shell with local-only policy data"
current_role: developer
phase_status: ready_for_developer
owner: none
last_completed_phase: 0
blocked_reason: none
last_updated: 2026-05-04
plan_path: docs/specs/poc-lockdown-plan.md
handoff_path: docs/specs/poc-lockdown-runs/phase-01.md
```

### Execution State Rules

- `current_role` is the role that should act now.
- `current_phase` is the only phase the next agent should work on.
- `owner` can be set to `developer` or `tester` while that automation is actively working, then reset to `none` at handoff.
- `phase_status` must be one of:
  - `ready_for_developer`
  - `in_progress`
  - `ready_for_tester`
  - `blocked`
  - `done`
- When `phase_status` is `ready_for_developer`, only the developer automation should act.
- When `phase_status` is `ready_for_tester`, only the tester automation should act.
- When `phase_status` is `blocked`, no later phase should start.
- When a tester passes a phase, the tester should advance the state file to the next phase and set that next phase to `ready_for_developer`.
- When the tester passes Phase 5, set `workflow_state: complete`, `current_role: none`, `current_phase: none`, and `phase_status: done`.

## Agent Workflow Contract

This plan is structured for a monitored, agentic workflow with at least two automations:

- `developer`: implements the active phase
- `tester`: validates the active phase, preferably with Playwright where applicable

Recommended operating pattern:

1. Developer reads `poc-lockdown-state.yaml` and works only on the listed phase.
2. Developer updates the phase notes, records what changed, and flips the state file to `ready_for_tester`.
3. Tester validates only that phase.
4. If validation fails, tester sets `phase_status: ready_for_developer` and records the failure reason under that phase.
5. If validation passes, tester advances the state file to the next phase.

## Goal

Turn the broader lockdown concept into a narrow proof of concept that answers three questions:

- Can a Chrome MV3 extension reliably block non-approved websites with a simple on/off control?
- Can YouTube access be restricted by approved creator/channel instead of allowing all of `youtube.com`?
- Can the parent dashboard act as a lightweight remote-control portal for the extension without first building the full curriculum-aware policy system?

## PoC Scope

- Chrome extension only. Do not include kiosk mode in the prototype.
- Extension popup includes a button to turn blocking on/off.
- Extension popup includes a button to view the currently allowed websites and approved YouTube creators.
- Blocking uses a small derived policy document, not direct reads from raw curriculum or timer state.
- Parent web portal can remotely turn blocking on/off.
- Parent web portal can remotely edit the website allowlist.
- The extension enforces creator-level YouTube access from an approved channel list.

## Explicit Non-Goals

- Automatic block switching based on the active curriculum block
- Off-hours schedules and additional resource windows
- Full device management, fleet enrollment, or kiosk deployment
- Hardened device authentication or tamper resistance
- Multi-student conflict resolution or per-subject dynamic policies

## Recommended PoC Architecture

The broad lockdown plan is intentionally larger than what should be built first. For the prototype, the cleanest slice is:

1. A parent-owned derived policy document in Firestore.
2. A Chrome extension that reads only that policy document.
3. A dashboard control panel that writes the policy document.

That keeps the prototype decoupled from the current public student portal rules and avoids making the extension depend on raw subject, timer, or report documents.

### Suggested Policy Shape

Use one prototype policy document per paired device or student session. A minimal shape is:

```js
{
  parent_id: "uid",
  student_id: "optional-student-doc-id",
  is_enabled: true,
  allowed_origins: [
    "https://www.khanacademy.org",
    "https://www.desmos.com"
  ],
  allowed_youtube_channels: [
    {
      channel_id: "UCxxxx",
      title: "CrashCourse Kids",
      handle: "@crashcoursekids"
    }
  ],
  updated_at: "timestamp"
}
```

Implementation notes for the prototype:

- Store websites as origin-level entries first. Avoid path-level matching in the PoC.
- Store YouTube approvals by stable `channel_id`. Display names and handles are helpful UI fields, but they should not be the enforcement key.
- Prefer extension polling plus local caching over a more complex real-time sync path for the first pass.
- Block general YouTube browsing while blocking is active. Only direct video or channel experiences that resolve to an approved `channel_id` should remain usable.

## Phase Queue

| Phase | Name | Role order | Initial state | Passes control to |
| --- | --- | --- | --- | --- |
| 1 | Extension shell with local-only policy data | `developer -> tester` | `ready_for_developer` | Phase 2 developer |
| 2 | Creator-level YouTube enforcement | `developer -> tester` | `pending` | Phase 3 developer |
| 3 | Parent portal writes policy | `developer -> tester` | `pending` | Phase 4 developer |
| 4 | Extension pairing and remote sync | `developer -> tester` | `pending` | Phase 5 developer |
| 5 | End-to-end validation and gap capture | `developer -> tester` | `pending` | workflow complete |

## Phase 1

### Name

Extension shell with local-only policy data

### Role Sequence

`developer -> tester`

### Start When

- `current_role: developer`
- `current_phase: 1`
- `phase_status: ready_for_developer`

### Developer Task

- Create `extensions/chrome-lockdown-poc/` with an MV3 manifest, background/service worker, popup UI, and a simple blocked interstitial page.
- Add a popup button to toggle blocking on/off.
- Add a popup button that opens an allowlist view showing approved website origins and approved YouTube creators.
- Seed the extension with a hardcoded or local-storage-backed mock policy.

### Developer Exit Criteria

- With blocking off, normal browsing works.
- With blocking on, allowlisted websites load and non-allowlisted websites redirect to the blocked interstitial.
- The allowlist button shows both website entries and creator/channel entries.

### Developer Handoff Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: tester
current_phase: 1
current_phase_name: "Extension shell with local-only policy data"
phase_status: ready_for_tester
owner: none
last_completed_phase: 0
blocked_reason: none
```

### Tester Task

- Verify the extension can be loaded locally.
- Verify the popup toggle changes blocking behavior.
- Verify at least one allowlisted site and one blocked site behave correctly.
- Verify the allowlist view shows website and creator entries.

### Tester Pass Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 2
current_phase_name: "Creator-level YouTube enforcement"
phase_status: ready_for_developer
owner: none
last_completed_phase: 1
blocked_reason: none
```

### Tester Fail Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 1
current_phase_name: "Extension shell with local-only policy data"
phase_status: ready_for_developer
owner: none
last_completed_phase: 0
blocked_reason: "Tester notes go here"
```

### Phase Notes

- Status: `ready_for_developer`
- Developer notes: `None yet`
- Tester notes: `None yet`

## Phase 2

### Name

Creator-level YouTube enforcement

### Role Sequence

`developer -> tester`

### Start When

- `current_role: developer`
- `current_phase: 2`
- `phase_status: ready_for_developer`

### Developer Task

- Add a YouTube content script for `watch` and `shorts` pages.
- Detect the current creator using page metadata or DOM data and normalize it to a `channel_id`.
- Allow playback only when the resolved `channel_id` exists in `allowed_youtube_channels`.
- Show a clear blocked state when a video belongs to a non-approved creator.

### Developer Exit Criteria

- An approved creator's video is playable while blocking is on.
- A non-approved creator's video is blocked while blocking is on.
- Non-YouTube website blocking still behaves the same as in Phase 1.

### Developer Handoff Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: tester
current_phase: 2
current_phase_name: "Creator-level YouTube enforcement"
phase_status: ready_for_tester
owner: none
last_completed_phase: 1
blocked_reason: none
```

### Tester Task

- Use Playwright or another browser-driven check to validate at least one approved creator video.
- Validate at least one blocked creator video.
- Confirm the extension still blocks non-allowlisted websites after the YouTube logic is added.

### Tester Pass Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 3
current_phase_name: "Parent portal writes policy"
phase_status: ready_for_developer
owner: none
last_completed_phase: 2
blocked_reason: none
```

### Tester Fail Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 2
current_phase_name: "Creator-level YouTube enforcement"
phase_status: ready_for_developer
owner: none
last_completed_phase: 1
blocked_reason: "Tester notes go here"
```

### Phase Notes

- Status: `pending`
- Developer notes: `None yet`
- Tester notes: `None yet`

## Phase 3

### Name

Parent portal writes policy

### Role Sequence

`developer -> tester`

### Start When

- `current_role: developer`
- `current_phase: 3`
- `phase_status: ready_for_developer`

### Developer Task

- Add a Lockdown PoC panel inside the authenticated dashboard flow instead of creating a new standalone app.
- Let parents toggle `is_enabled` from the web portal.
- Let parents edit the website allowlist from the web portal.
- Persist the prototype policy to Firestore and show the current saved values after reload.

### Developer Exit Criteria

- A parent can sign in, change the blocking state, save, refresh, and still see the saved value.
- A parent can add and remove website origins and see the persisted list after reload.
- Invalid website entries are rejected before save.

### Developer Handoff Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: tester
current_phase: 3
current_phase_name: "Parent portal writes policy"
phase_status: ready_for_tester
owner: none
last_completed_phase: 2
blocked_reason: none
```

### Tester Task

- Verify the dashboard control panel is reachable from the authenticated parent flow.
- Validate save and reload behavior for the on/off toggle.
- Validate add, edit, and remove behavior for website origins.
- Confirm invalid website entries are rejected.

### Tester Pass Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 4
current_phase_name: "Extension pairing and remote sync"
phase_status: ready_for_developer
owner: none
last_completed_phase: 3
blocked_reason: none
```

### Tester Fail Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 3
current_phase_name: "Parent portal writes policy"
phase_status: ready_for_developer
owner: none
last_completed_phase: 2
blocked_reason: "Tester notes go here"
```

### Phase Notes

- Status: `pending`
- Developer notes: `None yet`
- Tester notes: `None yet`

## Phase 4

### Name

Extension pairing and remote sync

### Role Sequence

`developer -> tester`

### Start When

- `current_role: developer`
- `current_phase: 4`
- `phase_status: ready_for_developer`

### Developer Task

- Add an extension options or setup screen where a parent can enter a policy ID or pairing code.
- Have the extension poll Firestore for policy changes on startup and on a short interval.
- Cache the last known policy in extension storage so the browser still enforces the last synced rules if the network drops.
- Reflect the remote state in the popup UI, including last sync time or sync status.

### Developer Exit Criteria

- Changing the web portal toggle updates the extension within the polling window.
- Editing the allowlisted websites in the web portal changes live extension behavior without reinstalling the extension.
- Restarting the browser preserves the last synced policy.

### Developer Handoff Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: tester
current_phase: 4
current_phase_name: "Extension pairing and remote sync"
phase_status: ready_for_tester
owner: none
last_completed_phase: 3
blocked_reason: none
```

### Tester Task

- Validate the extension can be paired or pointed at the saved policy.
- Validate remote on/off changes propagate from portal to extension.
- Validate website allowlist edits propagate from portal to extension.
- Validate browser restart preserves the last synced policy.

### Tester Pass Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 5
current_phase_name: "End-to-end validation and gap capture"
phase_status: ready_for_developer
owner: none
last_completed_phase: 4
blocked_reason: none
```

### Tester Fail Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 4
current_phase_name: "Extension pairing and remote sync"
phase_status: ready_for_developer
owner: none
last_completed_phase: 3
blocked_reason: "Tester notes go here"
```

### Phase Notes

- Status: `pending`
- Developer notes: `None yet`
- Tester notes: `None yet`

## Phase 5

### Name

End-to-end validation and gap capture

### Role Sequence

`developer -> tester`

### Start When

- `current_role: developer`
- `current_phase: 5`
- `phase_status: ready_for_developer`

### Developer Task

- Write a short manual QA checklist and capture screenshots or notes for the core flows.
- Verify the full loop for extension toggle, remote portal toggle, website allowlist changes, and approved-creator YouTube access.
- Document the intentional gaps that remain before production work begins.

### Developer Exit Criteria

- The QA checklist exists in the repo.
- The core round-trip flow is documented.
- Known gaps are written clearly enough to seed follow-up planning.

### Developer Handoff Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: tester
current_phase: 5
current_phase_name: "End-to-end validation and gap capture"
phase_status: ready_for_tester
owner: none
last_completed_phase: 4
blocked_reason: none
```

### Tester Task

- Run the end-to-end flow across the extension and the parent portal.
- Confirm the checklist matches actual behavior.
- Confirm the remaining gaps are explicitly documented instead of hidden as implicit failures.

### Tester Pass Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: complete
current_role: none
current_phase: none
current_phase_name: none
phase_status: done
owner: none
last_completed_phase: 5
blocked_reason: none
```

### Tester Fail Action

Update `poc-lockdown-state.yaml` to:

```yaml
workflow_state: active
current_role: developer
current_phase: 5
current_phase_name: "End-to-end validation and gap capture"
phase_status: ready_for_developer
owner: none
last_completed_phase: 4
blocked_reason: "Tester notes go here"
```

### Phase Notes

- Status: `pending`
- Developer notes: `None yet`
- Tester notes: `None yet`

## PoC Exit Criteria

The prototype is successful when all of the following are true:

- The extension can be manually turned on and off from its popup.
- The extension can show the current list of allowed websites and approved YouTube creators.
- Website blocking follows the active allowlist when blocking is on.
- YouTube videos are allowed only for explicitly approved creators/channels.
- A parent can remotely turn blocking on and off from the dashboard.
- A parent can remotely change the website allowlist and see the extension enforce the change after sync.

## Follow-Up Work After The PoC

If the prototype works, the next planning document should cover:

- deriving policy from curriculum blocks instead of manual editing
- whether channel allowlists should also be editable from the parent portal in the next iteration
- stronger device pairing and trust boundaries
- kiosk mode and Chrome OS managed-device rollout
- schedule-aware policies for school hours and off-hours
