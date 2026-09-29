begin;
select plan(32);

select has_table('public', 'donor_pre_screenings', 'pre-screening table exists');
select has_table('public', 'donor_pre_screening_reviews', 'append-only review table exists');
select has_column('public', 'donations', 'bloodbank_id', 'donations own the blood-bank association');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.donor_pre_screenings'::regclass),
  'pre-screening RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.donor_pre_screening_reviews'::regclass),
  'review-history RLS is enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.donor_pre_screenings', 'insert'),
  'authenticated direct INSERT privilege is denied'
);
select ok(
  not has_table_privilege('authenticated', 'public.donor_pre_screenings', 'update')
  and not has_table_privilege('authenticated', 'public.donor_pre_screenings', 'delete'),
  'authenticated direct UPDATE and DELETE privileges are denied'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.submit_donor_pre_screening(text,jsonb,boolean)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.submit_donor_pre_screening(text,jsonb,boolean)',
    'execute'
  ),
  'authenticated clients use the submit RPC without any service-role privilege'
);

-- Stable fixture identities.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'donor-a@bloodlink.test'),
  ('22222222-2222-4222-8222-222222222222', 'donor-b@bloodlink.test'),
  ('33333333-3333-4333-8333-333333333333', 'recipient@bloodlink.test'),
  ('44444444-4444-4444-8444-444444444444', 'admin@bloodlink.test'),
  ('55555555-5555-4555-8555-555555555555', 'staff-a@bloodlink.test'),
  ('66666666-6666-4666-8666-666666666666', 'staff-b@bloodlink.test');

update public.profiles set
  role = case id
    when '11111111-1111-4111-8111-111111111111'::uuid then 'donor'::public.user_role
    when '22222222-2222-4222-8222-222222222222'::uuid then 'donor'::public.user_role
    when '44444444-4444-4444-8444-444444444444'::uuid then 'admin'::public.user_role
    when '55555555-5555-4555-8555-555555555555'::uuid then 'bloodbank'::public.user_role
    when '66666666-6666-4666-8666-666666666666'::uuid then 'bloodbank'::public.user_role
    else 'recipient'::public.user_role
  end,
  full_name = case id
    when '11111111-1111-4111-8111-111111111111'::uuid then 'Donor A'
    when '22222222-2222-4222-8222-222222222222'::uuid then 'Donor B'
    when '33333333-3333-4333-8333-333333333333'::uuid then 'Recipient'
    when '44444444-4444-4444-8444-444444444444'::uuid then 'Admin'
    when '55555555-5555-4555-8555-555555555555'::uuid then 'Blood Bank A'
    else 'Blood Bank B'
  end,
  blood_type = case
    when id in (
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid
    ) then 'O+'::public.blood_type else null end,
  birthdate = case when id in (
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  ) then date '1990-01-01' else null end,
  weight_kg = case when id in (
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  ) then 70 else null end;

insert into public.bloodbank_verifications (
  profile_id, status, position, employee_id, hospital_name, branch_location,
  work_email, work_phone, document_paths, reviewed_by, reviewed_at
) values
  (
    '55555555-5555-4555-8555-555555555555', 'approved', 'Nurse', 'STAFF-A',
    'Blood Bank A', 'Main', 'staff-a@bloodlink.test', '+639170000001',
    array['staff-a.pdf'], '44444444-4444-4444-8444-444444444444', now()
  ),
  (
    '66666666-6666-4666-8666-666666666666', 'approved', 'Nurse', 'STAFF-B',
    'Blood Bank B', 'Main', 'staff-b@bloodlink.test', '+639170000002',
    array['staff-b.pdf'], '44444444-4444-4444-8444-444444444444', now()
  );

insert into public.blood_requests (
  id, requester_id, blood_type, units_needed, status, hospital_name
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '33333333-3333-4333-8333-333333333333', 'O+', 1, 'matched', 'Test Hospital'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '33333333-3333-4333-8333-333333333333', 'O+', 1, 'matched', 'Test Hospital');

insert into public.donor_matches (id, request_id, donor_id, status) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'accepted'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', 'accepted');

insert into public.donations (
  id, match_id, donor_id, request_id, bloodbank_id, status, verification_token
) values
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '55555555-5555-4555-8555-555555555555', 'scheduled', 'test-token-a'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '66666666-6666-4666-8666-666666666666', 'scheduled', 'test-token-b'
  );

select set_config(
  'test.valid_pre_screening',
  jsonb_build_object(
    'feeling_healthy_today', 'yes', 'taking_medication', 'no',
    'recent_vaccination', 'no', 'aspirin_past_3_days', 'no',
    'pregnant_or_recently_pregnant', 'not_applicable', 'donated_past_12_weeks', 'no',
    'transfusion_past_12_months', 'no', 'surgery_or_dental_past_12_months', 'no',
    'tattoo_piercing_blood_contact_acupuncture_past_12_months', 'no',
    'sexual_contact_relevant_screening', 'no', 'sexual_contact_exchange', 'no',
    'sexual_contact_with_worker_abroad', 'no', 'casual_sex', 'no',
    'lived_with_hepatitis', 'no', 'imprisoned_past_12_months', 'no',
    'relative_cjd', 'no', 'lived_outside_usual_residence', 'no',
    'lived_outside_philippines', 'no', 'injected_nonprescribed_substances', 'no',
    'used_clotting_factor_concentrates', 'no', 'positive_test_infectious', 'no',
    'had_hepatitis', 'no', 'had_malaria', 'no', 'sti_history', 'no',
    'cancer_history', 'no', 'heart_lung_problems', 'no',
    'bleeding_or_blood_disease', 'no', 'donating_for_testing', 'no',
    'understands_asymptomatic_transmission', 'yes'
  )::text,
  true
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select public.submit_donor_pre_screening('2026-09', current_setting('test.valid_pre_screening')::jsonb, true)$$,
  'Donor A submits own questionnaire through RPC'
);
select set_config(
  'test.screening_a_id',
  (select id::text from public.donor_pre_screenings where donor_id = '11111111-1111-4111-8111-111111111111' limit 1),
  true
);
select throws_ok(
  $$select public.submit_donor_pre_screening('2026-09', current_setting('test.valid_pre_screening')::jsonb, false)$$,
  'acknowledgement false is denied'
);
select throws_ok(
  $$select public.submit_donor_pre_screening('2026-09', '{}'::jsonb, true)$$,
  'invalid or incomplete responses are denied'
);
select throws_ok(
  $$insert into public.donor_pre_screenings (donor_id, questionnaire_version, responses, requires_staff_review, acknowledged_at, completed_at) values ('11111111-1111-4111-8111-111111111111', 'bypass', current_setting('test.valid_pre_screening')::jsonb, false, now(), now())$$,
  'Donor A direct table INSERT is denied'
);
select results_eq(
  $$select count(*) from public.donor_pre_screenings where donor_id = '11111111-1111-4111-8111-111111111111'$$,
  array[1::bigint],
  'Donor A reads own questionnaire'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select lives_ok(
  $$select public.submit_donor_pre_screening('2026-09', current_setting('test.valid_pre_screening')::jsonb, true)$$,
  'Donor B submits own questionnaire through RPC'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select results_eq(
  $$select count(*) from public.donor_pre_screenings where donor_id = '22222222-2222-4222-8222-222222222222'$$,
  array[0::bigint],
  'Donor A cannot read Donor B questionnaire'
);
select throws_ok(
  $$update public.donor_pre_screenings set questionnaire_version = 'tampered' where donor_id = '11111111-1111-4111-8111-111111111111'$$,
  'Donor A cannot modify historical questionnaire'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select results_eq(
  $$select count(*) from public.donor_pre_screenings$$,
  array[0::bigint],
  'recipient cannot read questionnaires'
);
select throws_ok(
  $$select public.submit_donor_pre_screening('2026-09', current_setting('test.valid_pre_screening')::jsonb, true)$$,
  'recipient cannot submit questionnaire'
);

set local role anon;
reset request.jwt.claim.sub;
select throws_ok(
  $$select count(*) from public.donor_pre_screenings$$,
  'anonymous cannot read questionnaires'
);
select throws_ok(
  $$select public.submit_donor_pre_screening('2026-09', current_setting('test.valid_pre_screening')::jsonb, true)$$,
  'anonymous cannot execute submission RPC'
);

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
select results_eq(
  $$select count(*) from public.get_donor_pre_screening_summary('cccccccc-cccc-4ccc-8ccc-ccccccccccc1')$$,
  array[1::bigint],
  'generic admin may read questionnaire summary metadata'
);
select throws_ok(
  $$select * from public.get_donor_pre_screening_detail('cccccccc-cccc-4ccc-8ccc-ccccccccccc1')$$,
  'generic admin cannot retrieve detailed answers or staff notes'
);

set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select results_eq(
  $$select count(*) from public.get_donor_pre_screening_summary('cccccccc-cccc-4ccc-8ccc-ccccccccccc1')$$,
  array[1::bigint],
  'associated verified blood bank reads summary'
);
select results_eq(
  $$select count(*) from public.get_donor_pre_screening_detail('cccccccc-cccc-4ccc-8ccc-ccccccccccc1')$$,
  array[1::bigint],
  'associated verified blood bank reads detailed answers'
);
select throws_ok(
  $$select * from public.get_donor_pre_screening_summary('cccccccc-cccc-4ccc-8ccc-ccccccccccc2')$$,
  'unassociated donation summary is denied to blood bank A'
);
select lives_ok(
  $$select public.review_donor_pre_screening('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', current_setting('test.screening_a_id')::uuid, 'First review')$$,
  'associated verified blood bank records review'
);

set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
select throws_ok(
  $$select public.review_donor_pre_screening('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', current_setting('test.screening_a_id')::uuid, 'Unauthorized review')$$,
  'unassociated verified blood bank cannot record review'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select throws_ok(
  $$update public.donor_pre_screening_reviews set notes = 'donor edit'$$,
  'donor cannot modify staff review history'
);

set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
select lives_ok(
  $$select public.review_donor_pre_screening('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', current_setting('test.screening_a_id')::uuid, 'Second review')$$,
  're-review appends another audit record'
);
select results_eq(
  $$select count(*) from public.donor_pre_screening_reviews where donation_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'$$,
  array[2::bigint],
  'staff review creates immutable audit history'
);
select results_eq(
  $$select count(*) from public.donor_pre_screening_reviews where donation_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' and notes = 'First review'$$,
  array[1::bigint],
  'previous review history is not overwritten'
);
select throws_ok(
  $$delete from public.donor_pre_screening_reviews where donation_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'$$,
  'review history cannot be deleted by staff'
);

select * from finish();
rollback;
