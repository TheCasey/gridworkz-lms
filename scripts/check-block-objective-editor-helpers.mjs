#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  getBlockObjectiveStatus,
  getBlockObjectiveStatusLabel,
} from '../src/utils/blockObjectiveStatusUtils.js';

const withInstruction = {
  instruction: 'Read chapter 4 and write three takeaways.',
  custom_fields: [],
  student_overrides: {},
};

assert.deepEqual(getBlockObjectiveStatus(withInstruction), {
  configured: true,
  instructionConfigured: true,
  customFieldCount: 0,
  studentOverrideCount: 0,
  labels: ['Instruction'],
});
assert.equal(getBlockObjectiveStatusLabel(withInstruction), 'Instruction');

const withCustomFields = {
  instruction: '',
  custom_fields: [
    { id: 'field_1', type: 'text', label: 'What did you practice?', placeholder: '', required: false },
  ],
  student_overrides: {},
};

assert.equal(getBlockObjectiveStatus(withCustomFields).configured, true);
assert.equal(getBlockObjectiveStatus(withCustomFields).customFieldCount, 1);
assert.equal(getBlockObjectiveStatusLabel(withCustomFields), '1 field');

const withStudentOverride = {
  instruction: '',
  custom_fields: [],
  student_overrides: {
    student_ada: { instruction: 'Use the audio lesson today.', custom_fields: [] },
  },
};

assert.equal(getBlockObjectiveStatus(withStudentOverride).configured, true);
assert.equal(getBlockObjectiveStatus(withStudentOverride).studentOverrideCount, 1);
assert.equal(getBlockObjectiveStatusLabel(withStudentOverride), '1 student');

const emptyBlock = {
  instruction: '',
  custom_fields: [],
  student_overrides: {},
};

assert.deepEqual(getBlockObjectiveStatus(emptyBlock), {
  configured: false,
  instructionConfigured: false,
  customFieldCount: 0,
  studentOverrideCount: 0,
  labels: [],
});
assert.equal(getBlockObjectiveStatusLabel(emptyBlock), 'Not configured');

const blankDefaultField = {
  instruction: '',
  custom_fields: [
    { id: 'field_blank', type: 'text', label: '', placeholder: '', required: false },
  ],
  student_overrides: {},
};

assert.equal(getBlockObjectiveStatus(blankDefaultField).configured, false);
assert.equal(getBlockObjectiveStatusLabel(blankDefaultField), 'Not configured');

console.log('Block objective editor helper checks passed.');
console.log(JSON.stringify({
  instruction: getBlockObjectiveStatusLabel(withInstruction),
  advancedFields: getBlockObjectiveStatusLabel(withCustomFields),
  studentSpecific: getBlockObjectiveStatusLabel(withStudentOverride),
  empty: getBlockObjectiveStatusLabel(emptyBlock),
}, null, 2));
