# Tooling And Linting

Status: Complete

## Implementation Status

This upgrade is now implemented.

Delivered outcomes:

- a root ESLint configuration now exists for the React/Vite app, the Firebase functions workspace, and the Lockdown browser extension
- generated output such as `dist/` is excluded from linting
- `npm run lint` now passes and can act as a real gate instead of a placeholder script
- a lightweight GitHub Actions workflow now runs `npm run lint` and `npm run build`

## Original Problem

`npm run lint` existed in `package.json` but failed immediately because the repo had no ESLint config file.

## Goal

Create a real linting baseline that can gate changes instead of acting like a placeholder script.

## Suggested Scope

- Add an ESLint config for the current React/Vite stack.
- Make the existing `npm run lint` command pass.
- Decide whether to lint generated build output or explicitly ignore `dist/`.
- Add a lightweight CI check for build and lint.

## Why This Mattered

- Agents could not rely on lint output.
- The repo has no automated test suite, so linting is one of the few low-cost quality gates available.
