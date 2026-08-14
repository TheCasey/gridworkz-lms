#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);

function readText(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

const manifest = readJson('extensions/chrome-lockdown-poc/manifest.json');
const popupHtml = readText('extensions/chrome-lockdown-poc/popup.html');
const popupJs = readText('extensions/chrome-lockdown-poc/popup.js');
const optionsHtml = readText('extensions/chrome-lockdown-poc/options.html');
const optionsJs = readText('extensions/chrome-lockdown-poc/options.js');
const blockedHtml = readText('extensions/chrome-lockdown-poc/blocked.html');
const blockedJs = readText('extensions/chrome-lockdown-poc/blocked.js');
const allowlistHtml = readText('extensions/chrome-lockdown-poc/allowlist.html');
const allowlistJs = readText('extensions/chrome-lockdown-poc/allowlist.js');
const backgroundJs = readText('extensions/chrome-lockdown-poc/background.js');
const youtubeJs = readText('extensions/chrome-lockdown-poc/youtube-content.js');
const stylesCss = readText('extensions/chrome-lockdown-poc/styles.css');
const contract = readText('docs/specs/lockdown-production-behavior-contract.md');
const runbook = readText('docs/support/lockdown-support-runbook.md');

assert.equal(manifest.name, 'Own Path Lockdown');
assert.equal(
  manifest.description,
  'Trusted device pairing, secure policy sync, and cached enforcement for Own Path Lockdown.'
);
assert.equal(manifest.version, '1.0.0');
assert.deepEqual(
  manifest.permissions,
  [
    'storage',
    'alarms',
    'scripting',
    'declarativeNetRequest',
    'declarativeNetRequestFeedback',
  ]
);
assert.deepEqual(
  manifest.host_permissions,
  ['http://*/*', 'https://*/*']
);

assert.ok(manifest.background?.service_worker, 'manifest includes a background service worker');
assert.equal(manifest.background.type, 'module');
assert.equal(manifest.options_page, 'options.html');
assert.equal(manifest.action?.default_popup, 'popup.html');
assert.equal(manifest.action?.default_title, 'Own Path Lockdown');
assert.deepEqual(
  manifest.content_scripts?.[0]?.js,
  ['youtube-content.js'],
  'manifest wires the YouTube content script locally'
);

for (const [label, source] of [
  ['popup.html', popupHtml],
  ['popup.js', popupJs],
  ['options.html', optionsHtml],
  ['options.js', optionsJs],
  ['blocked.html', blockedHtml],
  ['blocked.js', blockedJs],
  ['allowlist.html', allowlistHtml],
  ['allowlist.js', allowlistJs],
  ['background.js', backgroundJs],
  ['youtube-content.js', youtubeJs],
]) {
  assert.ok(
    !/GridWorkz/i.test(source),
    `${label} still contains GridWorkz branding`
  );
  assert.ok(
    !/\blegacy PoC\b/i.test(source),
    `${label} still contains legacy PoC user-facing copy`
  );
}

for (const [label, source] of [
  ['popup.html', popupHtml],
  ['popup.js', popupJs],
  ['options.html', optionsHtml],
  ['options.js', optionsJs],
  ['blocked.html', blockedHtml],
  ['blocked.js', blockedJs],
  ['allowlist.html', allowlistHtml],
  ['allowlist.js', allowlistJs],
  ['background.js', backgroundJs],
  ['youtube-content.js', youtubeJs],
]) {
  assert.ok(
    !/<script[^>]+src=["']https?:\/\//i.test(source),
    `${label} references a remote executable script URL`
  );
  assert.ok(
    !/\bimport\s*\(\s*["']https?:\/\//i.test(source),
    `${label} dynamically imports a remote executable script URL`
  );
  assert.ok(
    !/\bfrom\s+["']https?:\/\//i.test(source),
    `${label} imports a remote executable script URL`
  );
}

assert.match(runbook, /Chrome Web Store Privacy And Permission Checklist/);
assert.match(runbook, /Manual QA Matrix/);
assert.match(runbook, /Support Runbook/);
assert.match(runbook, /pairing failures/i);
assert.match(runbook, /stale policy/i);
assert.match(runbook, /revoked device/i);
assert.match(runbook, /downgrade/i);
assert.match(runbook, /local unpair/i);
assert.match(runbook, /stuck cached enforcement/i);
assert.match(runbook, /privacy policy states that Own Path/i);
assert.match(runbook, /Internal Compatibility Note/);
assert.match(runbook, /legacy pairing-format handling/i);

assert.match(contract, /## Phase 7 Release Hardening Status/);
assert.match(contract, /### Resolved In This Workflow/);
assert.match(contract, /### Remaining Paid-Readiness And Manual Gates/);
assert.match(contract, /live Chrome Web Store installed-build smoke remains to be performed/i);
assert.match(contract, /automated extension regression suite is still not present/i);
assert.match(contract, /need live, staging, or production-like validation/i);
assert.match(contract, /parent device list and revocation/i);
assert.match(contract, /state-specific blocked UI, URL and creator tester, explicit system allowlist, and their parent-facing flows/i);
assert.match(contract, /Emergency parent unlock or temporary allow, kiosk mode, project and worksheet integration, paid-readiness end-to-end validation, and real customer\/payment reliance decisions remain the true follow-on gaps/i);
for (const stalePhrase of [
  /Policy states are too coarse/i,
  /blocked-page copy is generic and still uses GridWorkz branding/i,
  /There is no extension or kiosk subject viewer\/work launcher yet/i,
  /Extension folder and manifest still carry PoC\/current GridWorkz naming/i,
  /There is no automated extension regression suite or Chrome Web Store installed-build validation workflow/i,
  /state-specific blocked UI, URL and creator tester, explicit system allowlist, and emergency parent unlock or temporary allow flows remain required/i,
  /parent device list and revocation remain required/i,
]) {
  assert.ok(!stalePhrase.test(contract), `contract still contains stale gap claim: ${stalePhrase}`);
}

assert.ok(stylesCss.includes('.panel'), 'extension stylesheet is present for the package');
assert.ok(
  /Older pairing format/i.test(optionsHtml) || /older pairing format/i.test(optionsJs),
  'older pairing compatibility is intentionally documented in the package'
);
assert.match(optionsHtml, /Parent recovery/i);
assert.match(optionsHtml, /Clear older local pairing/i);
assert.match(optionsJs, /clearButton\.hidden = paired/);
assert.match(optionsJs, /recoveryCode/);
assert.match(backgroundJs, /validateTrustedRecovery/);
assert.match(backgroundJs, /recovery_unpaired/);

console.log('Lockdown release package checks passed.');
