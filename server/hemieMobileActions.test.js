const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadMobileActions({ donors = [], requests = [] } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/hemie/actions.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const captured = { donorsQuery: null, requestCalls: 0 };
  const mocks = {
    '@/services/supabase/nearbyMapDonors': {
      getNearbyMapDonors: async (query) => {
        captured.donorsQuery = query;
        return { data: donors, error: null };
      },
    },
    '@/services/supabase/openBloodRequestsFeed': {
      getOpenBloodRequestsFeed: async () => {
        captured.requestCalls += 1;
        return { data: requests, error: null };
      },
    },
    '@/utils/bloodTypeCompatibility': {
      isDonorCompatibleWithRecipient: (donor, recipient) =>
        ({ 'A+': ['O-', 'O+', 'A-', 'A+'], 'O-': ['O-'] }[recipient] ?? []).includes(donor),
    },
    '@/utils/coordinates': {
      haversineDistanceMeters: (from, to) => Math.abs(from.latitude - to.latitude) * 1000,
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    require: (id) => {
      if (!(id in mocks)) throw new Error(`Unexpected import: ${id}`);
      return mocks[id];
    },
  }, { filename: 'actions.ts' });
  return { actions: module.exports, captured };
}

test('Hemie routes only explicit BloodLink action requests', () => {
  const { actions } = loadMobileActions();
  assert.equal(actions.detectHemieActionIntent('Find compatible donors for A+'), 'compatible_donors');
  assert.equal(actions.detectHemieActionIntent('Can Hemie provide compatible donors?'), 'compatible_donors');
  assert.equal(actions.detectHemieActionIntent('Can you find urgent blood requests?'), 'urgent_requests');
  assert.equal(actions.detectHemieActionIntent('Create a blood request for O+'), 'create_request');
  assert.equal(actions.detectHemieActionIntent('Write a poem about urgent blood requests'), null);
  assert.equal(actions.detectHemieActionIntent('Find urgent blood requests for my homework'), null);
  assert.equal(actions.detectHemieActionIntent("Find urgent blood requests, I can't breathe"), null);
});

test('Hemie shows only available verified compatible donors and hides coordinates', async () => {
  const donors = [
    { fullName: 'Visible Donor', bloodType: 'O+', isAvailable: true, isVerified: true, distanceMeters: 1200 },
    { fullName: 'Wrong Type', bloodType: 'B+', isAvailable: true, isVerified: true, distanceMeters: 500 },
    { fullName: 'Unavailable', bloodType: 'A+', isAvailable: false, isVerified: true, distanceMeters: 800 },
  ];
  const { actions, captured } = loadMobileActions({ donors });
  const reply = await actions.resolveHemieAction('compatible_donors', 'Find donors for A+', {
    role: 'recipient', latitude: 14, longitude: 121, blood_type: 'A+',
  });
  assert.match(reply.message, /Visible Donor/);
  assert.doesNotMatch(reply.message, /Wrong Type|Unavailable|121/);
  assert.equal(reply.link.target, 'map');
  assert.equal(captured.donorsQuery.availableOnly, true);
  assert.equal(captured.donorsQuery.radiusKm, 25);
});

test('Hemie urgent results use the limited feed and keep patient details out', async () => {
  const requests = [
    { id: 'request-1', urgency: 'critical', blood_type: 'A+', units_needed: 2, hospital_name: 'City Hospital', patient_name: 'Private Patient', created_at: '2026-09-30', latitude: 14, longitude: 121 },
    { id: 'request-2', urgency: 'urgent', blood_type: 'B+', units_needed: 1, hospital_name: 'Other Hospital', created_at: '2026-09-30', latitude: 14, longitude: 121 },
    { id: 'request-3', urgency: 'normal', blood_type: 'O+', units_needed: 1, hospital_name: 'Routine Hospital', created_at: '2026-09-30', latitude: 14, longitude: 121 },
  ];
  const { actions, captured } = loadMobileActions({ requests });
  const reply = await actions.resolveHemieAction('urgent_requests', 'Find urgent blood requests', {
    role: 'donor', latitude: 14, longitude: 121, blood_type: 'O+',
  });
  assert.match(reply.message, /City Hospital/);
  assert.doesNotMatch(reply.message, /Private Patient|Other Hospital|Routine Hospital/);
  assert.equal(reply.link.target, 'request_detail');
  assert.equal(reply.link.requestId, 'request-1');
  assert.equal(captured.requestCalls, 1);
});

test('Hemie opens the reviewed request form without writing a request in chat', async () => {
  const { actions, captured } = loadMobileActions();
  const reply = await actions.resolveHemieAction('create_request', 'Create a blood request for O+', {
    role: 'recipient', blood_type: 'A+',
  });
  assert.equal(reply.link.target, 'create_request');
  assert.equal(reply.link.bloodType, 'O+');
  assert.match(reply.message, /review/i);
  assert.equal(captured.donorsQuery, null);
  assert.equal(captured.requestCalls, 0);
  const withoutType = await actions.resolveHemieAction('create_request', 'Create a blood request', {
    role: 'donor', blood_type: 'A+',
  });
  assert.equal(withoutType.link.bloodType, undefined);
  assert.match(withoutType.message, /Confirm the patient/);
});
