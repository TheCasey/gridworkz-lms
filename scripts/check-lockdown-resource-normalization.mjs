#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  deriveLockdownTargetsFromResources,
  evaluateLockdownResourceAgainstPolicy,
  LockdownResourceTestDecisions,
  normalizeLockdownResourceLibraryEntry,
  normalizeLockdownResourceReference,
  selectAssignedLockdownResources,
} from '../src/utils/lockdownPolicyUtils.js';
import {
  normalizeLockdownResourceLibraryEntry as normalizeFunctionResourceLibraryEntry,
  selectAssignedLockdownResources as selectFunctionAssignedLockdownResources,
} from '../functions/src/index.js';

const policy = {
  allowed_origins: [
    'https://www.khanacademy.org',
    'https://example.com',
  ],
  allowed_youtube_channels: [
    {
      channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
      title: 'Crash Course Kids',
      handle: '@crashcoursekids',
    },
    {
      channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
      title: 'Khan Academy',
      handle: '@khanacademy',
    },
  ],
};

const assertDecision = (label, result, decision) => {
  assert.equal(result.decision, decision, `${label}: expected ${decision} but got ${result.decision}`);
  return result;
};

const lessonOrigin = assertDecision(
  'lesson url',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'https://www.khanacademy.org/lesson/algebra?utm_source=parent' },
    policy,
  }),
  LockdownResourceTestDecisions.ALLOW
);

assert.equal(lessonOrigin.normalized_origin, 'https://www.khanacademy.org');
assert.equal(
  normalizeLockdownResourceReference({ url: 'https://www.khanacademy.org/lesson/algebra?utm_source=parent' }).normalized_origin,
  'https://www.khanacademy.org'
);

const subdomainResult = assertDecision(
  'subdomain url',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'https://sub.example.com/path/to/lesson' },
    policy,
  }),
  LockdownResourceTestDecisions.DENY
);

assert.equal(subdomainResult.normalized_origin, 'https://sub.example.com');

const channelResult = assertDecision(
  'youtube channel url',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'https://www.youtube.com/channel/UCONtPx56PSebXJOxbFv-2jQ' },
    policy,
  }),
  LockdownResourceTestDecisions.ALLOW
);

assert.equal(channelResult.youtube.channel_id, 'UCONtPx56PSebXJOxbFv-2jQ');
assert.equal(channelResult.youtube.normalized_url, 'https://www.youtube.com/channel/UCONtPx56PSebXJOxbFv-2jQ');

const handleResult = assertDecision(
  'youtube handle url',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'https://www.youtube.com/@khanacademy' },
    policy,
  }),
  LockdownResourceTestDecisions.ALLOW
);

assert.equal(handleResult.youtube.channel_id, 'UC4a-Gbdw7vOaccHmFo40b9g');
assert.equal(handleResult.youtube.handle, '@khanacademy');

const videoNeedsMetadata = assertDecision(
  'youtube video url without metadata',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    policy,
  }),
  LockdownResourceTestDecisions.METADATA_NEEDED
);

assert.equal(videoNeedsMetadata.reason, 'youtube_channel_metadata_required');

const videoWithMetadata = assertDecision(
  'youtube video url with metadata',
  evaluateLockdownResourceAgainstPolicy({
    resource: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtube_channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
      youtube_channel_title: 'Khan Academy',
      youtube_channel_handle: '@khanacademy',
    },
    policy,
  }),
  LockdownResourceTestDecisions.ALLOW
);

assert.equal(videoWithMetadata.youtube.channel_id, 'UC4a-Gbdw7vOaccHmFo40b9g');
assert.equal(videoWithMetadata.youtube.normalized_url, 'https://www.youtube.com/channel/UC4a-Gbdw7vOaccHmFo40b9g');
assert.equal(videoWithMetadata.url, 'https://www.youtube.com/channel/UC4a-Gbdw7vOaccHmFo40b9g');
assert.equal(videoWithMetadata.youtube.video_id, 'dQw4w9WgXcQ');

const youtubeHomeResult = normalizeLockdownResourceReference({
  url: 'https://www.youtube.com',
});

assert.equal(youtubeHomeResult.resource_type, 'youtube');
assert.equal(youtubeHomeResult.status, LockdownResourceTestDecisions.UNSUPPORTED);
assert.equal(youtubeHomeResult.reason, 'invalid_youtube_reference');
assert.equal(youtubeHomeResult.normalized_origin, '');

const playlistResult = assertDecision(
  'youtube playlist',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'https://www.youtube.com/playlist?list=PL1234567890' },
    policy,
  }),
  LockdownResourceTestDecisions.UNSUPPORTED
);

assert.equal(playlistResult.reason, 'youtube_playlist_unsupported');

const invalidEntry = assertDecision(
  'invalid entry',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'bad url' },
    policy,
  }),
  LockdownResourceTestDecisions.UNSUPPORTED
);

assert.equal(invalidEntry.reason, 'invalid_url');

const unsupportedScheme = assertDecision(
  'unsupported scheme',
  evaluateLockdownResourceAgainstPolicy({
    resource: { url: 'ftp://example.com/resource' },
    policy,
  }),
  LockdownResourceTestDecisions.UNSUPPORTED
);

assert.equal(unsupportedScheme.reason, 'unsupported_scheme');

const nestedLibraryEntryInput = {
  id: 'resource_khan_youtube',
  resource: {
    name: 'Khan Academy',
    url: 'https://www.youtube.com/@khanacademy',
    youtube_channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
    youtube_channel_title: 'Khan Academy',
    youtube_channel_handle: 'khanacademy',
  },
  assignment: {
    student_ids: ['student_ada', 'student_ada', ''],
  },
};

const normalizedLibraryEntry = normalizeLockdownResourceLibraryEntry(nestedLibraryEntryInput);
const normalizedFunctionLibraryEntry = normalizeFunctionResourceLibraryEntry(nestedLibraryEntryInput);

assert.deepEqual(normalizedLibraryEntry, normalizedFunctionLibraryEntry);
assert.equal(normalizedLibraryEntry.youtube_channel_handle, '@khanacademy');
assert.deepEqual(normalizedLibraryEntry.student_ids, ['student_ada']);
assert.equal(normalizedLibraryEntry.assign_to_all_students, false);

const resourceLibrary = [
  {
    id: 'resource_desmos_all',
    name: 'Desmos',
    url: 'https://www.desmos.com/calculator',
    assign_to_all_students: true,
  },
  nestedLibraryEntryInput,
  {
    id: 'resource_readworks_grace',
    name: 'ReadWorks',
    url: 'https://www.readworks.org/article',
    student_ids: ['student_grace'],
  },
  {
    id: 'resource_inactive',
    name: 'Inactive Resource',
    url: 'https://inactive.example.com/path',
    assign_to_all_students: true,
    is_active: false,
  },
];

const adaAssignedResources = selectAssignedLockdownResources({
  resourceLibrary,
  studentId: 'student_ada',
});
const graceAssignedResources = selectAssignedLockdownResources({
  resourceLibrary,
  studentId: 'student_grace',
});

assert.deepEqual(
  adaAssignedResources.map((resource) => resource.name),
  ['Desmos', 'Khan Academy']
);
assert.deepEqual(
  graceAssignedResources.map((resource) => resource.name),
  ['Desmos', 'ReadWorks']
);
assert.deepEqual(
  adaAssignedResources,
  selectFunctionAssignedLockdownResources({
    resourceLibrary,
    studentId: 'student_ada',
  })
);
assert.deepEqual(
  graceAssignedResources,
  selectFunctionAssignedLockdownResources({
    resourceLibrary,
    studentId: 'student_grace',
  })
);
assert.equal(
  adaAssignedResources.some((resource) => resource.name === 'Inactive Resource'),
  false
);

const derivedTargets = deriveLockdownTargetsFromResources([
  {
    name: 'Lesson URL',
    url: 'https://www.khanacademy.org/lesson/algebra',
  },
  {
    name: 'Root domain',
    url: 'https://example.com',
  },
  {
    name: 'Subdomain',
    url: 'https://sub.example.com/path',
  },
  {
    name: 'Crash Course Kids',
    url: 'https://www.youtube.com/channel/UCONtPx56PSebXJOxbFv-2jQ',
  },
  {
    name: 'Khan Academy video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    youtube_channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
    youtube_channel_title: 'Khan Academy',
    youtube_channel_handle: '@khanacademy',
  },
  {
    name: 'YouTube home',
    url: 'https://www.youtube.com',
  },
  {
    name: 'Missing YouTube metadata',
    url: 'https://www.youtube.com/@crashcoursekids',
  },
  {
    name: 'Playlist',
    url: 'https://www.youtube.com/playlist?list=PL1234567890',
  },
  {
    name: 'Invalid URL',
    url: 'bad url',
  },
  {
    name: 'Unsupported scheme',
    url: 'ftp://example.com/resource',
  },
]);

assert.deepEqual(derivedTargets.allowed_origins, [
  'https://www.khanacademy.org',
  'https://example.com',
  'https://sub.example.com',
]);
assert.deepEqual(derivedTargets.allowed_youtube_channels, [
  {
    channel_id: 'UCONtPx56PSebXJOxbFv-2jQ',
    title: 'Crash Course Kids',
    handle: '',
  },
  {
    channel_id: 'UC4a-Gbdw7vOaccHmFo40b9g',
    title: 'Khan Academy',
    handle: '@khanacademy',
  },
]);

assert.deepEqual(
  derivedTargets.unsupported_resources.map((resource) => resource.reason).sort(),
  [
    'invalid_url',
    'invalid_youtube_reference',
    'unsupported_scheme',
    'youtube_channel_metadata_required',
    'youtube_playlist_unsupported',
  ].sort()
);

console.log('Lockdown resource normalization checks passed.');
