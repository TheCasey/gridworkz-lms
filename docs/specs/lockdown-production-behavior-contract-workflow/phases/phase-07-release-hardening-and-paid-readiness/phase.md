# Phase 7: Release Hardening And Paid Readiness

## Goal

Prepare the extension path and future kiosk assumptions for Chrome Web Store publish and paid-customer reliance with branding, privacy disclosures, packaging checks, QA matrix, and support runbook.

## Depends On

- Phase 6: Embedded Work Launcher Foundation

## Expected Downstream Role Sequence

`developer -> tester`

## Scope

- Rename user-facing extension surfaces from GridWorkz to Own Path or document any transitional branding.
- Remove or hide legacy PoC pairing from production extension surfaces.
- Create release QA, privacy disclosure, support runbook, stale-cache, downgrade, revoke, and launcher validation docs.

## Deliverables

- Production extension manifest/copy/package readiness pass
- Chrome Web Store privacy and permission disclosure checklist
- Manual QA matrix covering contract states, device revoke, downgrade, network loss, YouTube, and launcher behavior
- Support runbook for pairing, stale policy, revoked device, downgrade, local unpair, and stuck cached enforcement

## Files Or Areas To Touch

- extensions/chrome-lockdown-poc/manifest.json
- extensions/chrome-lockdown-poc/popup.html
- extensions/chrome-lockdown-poc/options.html
- extensions/chrome-lockdown-poc/blocked.html
- docs/specs/lockdown-production-behavior-contract.md
- docs/specs/lockdown-browser-extension-plan.md
- docs/support/lockdown-support-runbook.md
- scripts/check-lockdown-release-package.mjs

## Read First

- docs/specs/lockdown-production-behavior-contract.md
- docs/specs/lockdown-browser-extension-plan.md
- extensions/chrome-lockdown-poc/manifest.json
- extensions/chrome-lockdown-poc/popup.html
- extensions/chrome-lockdown-poc/options.html
- extensions/chrome-lockdown-poc/blocked.html

## Exit Criteria

- Production extension surfaces no longer expose PoC pairing or accidental GridWorkz branding unless intentionally documented.
- Chrome Web Store publish checklist covers single purpose, permissions, privacy disclosures, and no remote executable code.
- Paid-readiness QA matrix separates required first publish, required before paid reliance, future kiosk mode, and future project/worksheet integration.
- Support runbook can handle the most likely Lockdown failure and recovery scenarios.

## Automated Test Expectation

Add a release package/checklist script that validates manifest fields, required extension files, legacy PoC visibility, branding strings, and presence of release/runbook docs.

## Test Files

- scripts/check-lockdown-release-package.mjs

## Test Cases To Cover

- Manifest uses production name, description, version, and expected permissions.
- Legacy PoC pairing copy is absent from production surfaces or flagged intentionally.
- Required support runbook and QA matrix sections exist.
- No remote executable script URL is referenced by extension files.
- Own Path privacy disclosure checklist exists.

## No-Test Rationale

None. If automated tests are not useful for this phase, record the rationale here before accepting the phase.

## Validation Modes

- `unit-regression`: preferred tools `shell`; default evidence focused check script output. Run the existing focused automated tests that cover the active slice before widening scope.
- `extension-smoke`: preferred tools `playwright`, `computer-use`, `Chrome extension manual load`; default evidence extension runtime evidence, screenshot or storage/policy summary. Validate the browser extension in a live browser context, including load, install, and core interaction paths.
- `manual-qa`: preferred tools `human`; default evidence manual verification note. Document the manual follow-up that a human must complete before final merge or release confidence.
- `build-health`: preferred tools `shell`; default evidence npm run lint output, npm run build output. Run the narrowest compile, typecheck, or package-health commands that prove the slice still builds.

## Runtime Targets

- Installed or unpacked Chrome extension package
- Chrome Web Store disclosure checklist
- Disposable production-like account if available

## Evidence Required

- release package check output
- extension smoke evidence
- manual QA matrix summary
- lint/build output

## Allowed Discovery

Start with the listed read-first files, then follow imports, routes, existing check scripts, extension files, functions, and nearby docs only as needed for the active phase.

## Test Commands

- node scripts/check-lockdown-release-package.mjs
- npm run lint
- npm run build

## Manual Verification Follow-Up

- Chrome Web Store installed-build validation and any real payment/customer reliance decision remain manual release gates.

## Master Developer Review Focus

Confirm that Release Hardening And Paid Readiness is still the right active phase, assign the automated test expectation and narrowest useful validation strategy, and write the next downstream prompt only when the work packet is execution-ready.

## Runtime Handoff Notes

- `developer`: Implement only Release Hardening And Paid Readiness. Start from the prompt read-first list, keep the change set narrow, add or update focused automated tests when behavior changes, and do not start later phases.
- `tester`: Validate only Release Hardening And Paid Readiness using the automated test expectation, declared validation modes, runtime targets, and evidence requirements. Prefer live checks when the phase guidance calls for them, then return control to master-developer.

## Next Phase Inputs

- Accepted production behavior contract implementation and follow-on kiosk-mode implementation track.
