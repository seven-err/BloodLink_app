export const DONOR_PRE_SCREENING_VERSION = '2026-09-27-v1';

export type PreScreeningAnswer = 'yes' | 'no' | 'not_applicable' | 'dont_know';

export type DonorPreScreeningResponses = Record<string, string>;

export type DonorPreScreeningQuestion = {
  key: string;
  number: number;
  prompt: string;
  options?: { label: string; value: PreScreeningAnswer }[];
  detailKey?: string;
  detailLabel?: string;
  detailPlaceholder?: string;
  detailRequired?: boolean;
};

export type DonorPreScreeningStep = {
  title: string;
  subtitle: string;
  questions: DonorPreScreeningQuestion[];
};

const yesNo: { label: string; value: PreScreeningAnswer }[] = [
  { label: 'Yes', value: 'yes' as const },
  { label: 'No', value: 'no' as const },
];

const steps: DonorPreScreeningStep[] = [
  {
    title: 'Current Health',
    subtitle: 'Tell us how you are feeling and about recent medicines or vaccination.',
    questions: [
      { key: 'feeling_healthy_today', number: 1, prompt: 'Are you feeling healthy and well today?' },
      { key: 'taking_medication', number: 2, prompt: 'Are you currently taking any medication?', detailKey: 'medication_details', detailLabel: 'Medication details (optional)', detailPlaceholder: 'Name or reason, if known' },
      { key: 'recent_vaccination', number: 3, prompt: 'Have you received any vaccination recently?', detailKey: 'vaccination_details', detailLabel: 'Vaccination details or date', detailPlaceholder: 'Vaccine and date, if known', detailRequired: true },
      { key: 'aspirin_past_3_days', number: 4, prompt: 'In the past 3 days, have you taken aspirin or medicine containing aspirin?' },
      { key: 'pregnant_or_recently_pregnant', number: 5, prompt: 'If applicable, are you currently pregnant, or have you been pregnant within the past 6 weeks?', options: [...yesNo, { label: 'Not Applicable', value: 'not_applicable' }] },
    ],
  },
  {
    title: 'Recent Medical & Donation History',
    subtitle: 'These answers help blood-bank personnel prepare for the in-person assessment.',
    questions: [
      { key: 'donated_past_12_weeks', number: 6, prompt: 'Have you donated blood, platelets, or plasma within the past 12 weeks?', detailKey: 'recent_donation_date', detailLabel: 'Donation date (optional)', detailPlaceholder: 'YYYY-MM-DD, if known' },
      { key: 'transfusion_past_12_months', number: 7, prompt: 'Within the past 12 months, have you received a blood transfusion?' },
      { key: 'surgery_or_dental_past_12_months', number: 8, prompt: 'Within the past 12 months, have you undergone surgery or a dental operation?', detailKey: 'surgery_dental_details', detailLabel: 'Details (optional)', detailPlaceholder: 'Procedure and date, if known' },
      { key: 'tattoo_piercing_blood_contact_acupuncture_past_12_months', number: 9, prompt: 'Within the past 12 months, have you had a tattoo, piercing, accidental blood contact, injury, or acupuncture?', detailKey: 'exposure_procedure_details', detailLabel: 'Details (optional)', detailPlaceholder: 'What happened and when' },
    ],
  },
  {
    title: 'Exposure & Donor History',
    subtitle: 'Your answers are private and available only to you and authorized blood-bank staff.',
    questions: [
      { key: 'sexual_contact_relevant_screening', number: 10, prompt: 'Within the past 12 months, have you had sexual contact relevant to donor-history screening?' },
      { key: 'sexual_contact_exchange', number: 11, prompt: 'Within the past 12 months, have you had sexual contact in exchange for money or material gain?' },
      { key: 'sexual_contact_with_worker_abroad', number: 12, prompt: 'Within the past 12 months, have you had sexual contact with a person who has worked abroad?' },
      { key: 'casual_sex', number: 13, prompt: 'Within the past 12 months, have you engaged in casual sex?' },
      { key: 'lived_with_hepatitis', number: 14, prompt: 'Within the past 12 months, have you lived with someone who has hepatitis?' },
      { key: 'imprisoned_past_12_months', number: 15, prompt: 'Within the past 12 months, have you been imprisoned?' },
      { key: 'relative_cjd', number: 16, prompt: 'Has any relative had Creutzfeldt-Jakob disease?', options: [...yesNo, { label: "Don't Know", value: 'dont_know' }] },
      { key: 'lived_outside_usual_residence', number: 17, prompt: 'Have you ever lived outside your usual place of residence?', detailKey: 'other_residence_location', detailLabel: 'Location', detailPlaceholder: 'City, province, or region', detailRequired: true },
      { key: 'lived_outside_philippines', number: 18, prompt: 'Have you ever lived outside the Philippines?', detailKey: 'countries_lived_in', detailLabel: 'Country or countries', detailPlaceholder: 'List the countries', detailRequired: true },
      { key: 'injected_nonprescribed_substances', number: 19, prompt: 'Have you ever used needles to take drugs, steroids, or anything not prescribed by a doctor?' },
      { key: 'used_clotting_factor_concentrates', number: 20, prompt: 'Have you ever used clotting-factor concentrates?' },
    ],
  },
  {
    title: 'Medical History',
    subtitle: 'These responses do not determine final eligibility.',
    questions: [
      { key: 'positive_test_infectious', number: 21, prompt: 'Have you ever had a positive test for HIV, hepatitis, syphilis, or malaria?' },
      { key: 'had_hepatitis', number: 22, prompt: 'Have you ever had hepatitis?' },
      { key: 'had_malaria', number: 23, prompt: 'Have you ever had malaria?' },
      { key: 'sti_history', number: 24, prompt: 'Have you ever been diagnosed with or treated for genital warts, syphilis, gonorrhea, or another sexually transmitted infection?' },
      { key: 'cancer_history', number: 25, prompt: 'Have you ever had cancer, including leukemia?' },
      { key: 'heart_lung_problems', number: 26, prompt: 'Have you ever had heart or lung problems?' },
      { key: 'bleeding_or_blood_disease', number: 27, prompt: 'Have you ever had a bleeding condition or blood disease?' },
    ],
  },
  {
    title: 'Donor Understanding',
    subtitle: 'Confirm why you are donating and what preliminary screening means.',
    questions: [
      { key: 'donating_for_testing', number: 28, prompt: 'Are you donating because you want to be tested for HIV or hepatitis?' },
      { key: 'understands_asymptomatic_transmission', number: 29, prompt: 'Do you understand that HIV or hepatitis may potentially be transmitted even when a person feels well?' },
    ],
  },
];

export const DONOR_PRE_SCREENING_STEPS: DonorPreScreeningStep[] = steps.map((step) => ({
  ...step,
  questions: step.questions.map((question) => ({ ...question, options: question.options ?? yesNo })),
}));

export const DONOR_PRE_SCREENING_QUESTIONS = DONOR_PRE_SCREENING_STEPS.flatMap(
  (step) => step.questions,
);

export const formatPreScreeningAnswer = (value: string | undefined) => {
  if (value === 'not_applicable') return 'Not Applicable';
  if (value === 'dont_know') return "Don't Know";
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return 'Not answered';
};
