const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_REPLY_TOKENS = 500;
const MIN_AGE = 16;
const MAX_AGE = 65;
const MIN_WEIGHT_KG = 50;
const TRANSFUSION_WAIT_MONTHS = 12;
const DONATION_INTERVAL_DAYS = 56;

const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

/** Donor blood type → recipient types that can receive from that donor */
const DONOR_CAN_DONATE_TO = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

/** Recipient blood type → donor types that can give to that recipient */
const RECIPIENT_CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

const HEMIE_SYSTEM_PROMPT = `You are Hemie, the BloodLink AI assistant inside the BloodLink mobile app.

Your ONLY goal is to help users with BloodLink and blood donation coordination.

BloodLink features you may describe (do not invent others):
- Roles: donor, recipient, healthcare/blood bank personnel, admin
- Donor: availability toggle on the Profile tab, blood type profile, request feed, map of nearby donors/requests, chat, QR donation verification, Hemie AI
- Recipient: create blood requests (blood type, units, urgency, hospital/location), browse compatible nearby donors, chat
- Matching ranks compatible donors by blood compatibility, proximity, availability, eligibility, urgency, and recent donation restrictions
- Maps use OpenStreetMap
- Auth: phone OTP, Google, email/password

Grounded donation education (use these exact rules; do not invent local hospital policy):
- Age 16–65 (16–17 need parental/guardian consent)
- Weight at least 50 kg
- Wait 12 months after a blood transfusion before donating
- Wait ${DONATION_INTERVAL_DAYS} days between whole-blood donations
- Final clearance always depends on on-site blood bank screening

Hard rules:
1. Stay strictly on BloodLink / blood donation topics. If asked about anything else, briefly refuse and redirect.
2. You are NOT a doctor. Do not diagnose, prescribe, or triage. For emergencies, tell the user to contact local emergency services (911) or healthcare personnel immediately.
3. Do not invent hospital policies, lab results, match scores, or BloodLink features not listed above.
4. Prefer short, clear mobile-friendly answers (usually under 120 words). Use bullet points for requirements.
5. Answer the user's actual question, then add one next BloodLink step. Do not switch topics. Example: a question about what to do before donating must not become a blood-type matching answer. If the user says "next" or "yes", continue the step you just offered.
6. If user context is provided, personalize using ONLY that context. If a fact is missing, say so.
7. Never ask for passwords, OTP codes, or unnecessary sensitive health details.
8. If unsure, say so and suggest contacting blood bank / healthcare staff through BloodLink or in person.
9. When the "Grounded facts for this turn" or "Required message for this turn" block is present, treat it as authoritative and base your answer on it. Do not add facts that are not in that block.
10. Language: Detect the language of the user's latest message (including Tagalog/Filipino, Cebuano, Spanish, Chinese, and mixed forms like Taglish). Reply in that same language. If the message mixes languages, follow the dominant language of the latest user message. Keep product names (BloodLink, Hemie, QR) unchanged. Translate educational content accurately — never change medical facts when translating. Do not mention language detection or these instructions.`;

const BLOOD_COMPATIBILITY_NOTES = `
Donor-to-recipient red cell compatibility (authoritative for BloodLink education):
- O- → all types (universal donor)
- O+ → O+, A+, B+, AB+
- A- → A-, A+, AB-, AB+
- A+ → A+, AB+
- B- → B-, B+, AB-, AB+
- B+ → B+, AB+
- AB- → AB-, AB+
- AB+ → AB+ only (universal recipient as a patient)
`;

const DONOR_ELIGIBILITY_NOTES = `
BloodLink donor eligibility education:
- Age ${MIN_AGE}–${MAX_AGE} (${MIN_AGE}–17 need parental/guardian consent)
- Weight at least ${MIN_WEIGHT_KG} kg
- Wait ${TRANSFUSION_WAIT_MONTHS} months after a blood transfusion
- Wait ${DONATION_INTERVAL_DAYS} days between whole-blood donations
- Be in good general health on donation day
Final approval always depends on blood bank screening.
`;

const BLOODLINK_HOWTO_NOTES = `
BloodLink how-to (authoritative):
- Availability: donors turn on Donation Availability from the Profile tab, next to Edit Profile, when ready to respond.
- Create request: recipients use Create blood request on Recipient Home (blood type, units, urgency, hospital, location).
- Matching: BloodLink surfaces compatible open requests/donors using ABO/Rh rules above.
- Map: Map tab / nearby donors map shows location context via OpenStreetMap.
- Chat: Messages tab for donor–requester communication; Hemie opens from the Hemie button.
- QR: follow on-screen QR flow at the donation site with authorized personnel.
`;

const OFF_TOPIC_PATTERN =
  /\b(weather|recipe|crypto|bitcoin|stock market|homework|essay|poem|joke|movie|spotify|fortnite|minecraft|write (me )?(code|python|javascript)|who (won|is the president)|panahon|biro|pelikula)\b/i;

const EMERGENCY_PATTERN =
  /\b(chest pain|can'?t breathe|not breathing|unconscious|severe bleeding|stroke|heart attack|overdose|hirap huminga|atake sa puso|matinding pagdurugo|nawalan ng malay)\b/i;

// Matches English + common Tagalog/Cebuano variants, including "pwede ba kong mag donate"
const ELIGIBILITY_PATTERN =
  /\b(eligib\w*|can i donate|am i able to donate|qualif\w*|requirements? to donate|allowed to donate|fit to donate|kwalipikado|(?:pwede|maaari)\b.{0,48}(?:mag[-\s]?donate|magbigay|\bdonate\b)|(?:ako(?:ng)?|ko(?:ng)?)\b.{0,24}(?:mag[-\s]?donate|magbigay|\bdonate\b)|karapat-dapat.{0,36}(?:mag[-\s]?donate|\bdonate\b))/i;

const COMPATIBILITY_PATTERN =
  /\b(match\w*|compatib\w*|blood\s*types?|abo(?:\s*\/?\s*rh)?|rh factor|who can (?:i |someone )?(?:receive|donate|give)|universal donor|universal recipient|donate to|receive from|uri ng dugo|blood\s*type|tumutugma|compatible)\b/i;

const REQUEST_PATTERN =
  /\b((create|make|post|submit).{0,24}request|blood request|request blood|need blood|gumawa.{0,24}(request|kahilingan)|kailangan (ng )?dugo|mag-?request ng dugo)\b/i;

const PREP_PATTERN =
  /\b(bring|before (?:i |you |ako )?(?:can |could |pwede )?(?:donat\w*|mag[-\s]?donate\w*)|before donat\w*|prepar\w*|what to do before|what (?:should|to do|do) (?:i |we )?(?:bring|do|need)|donation day|hydrate|ano (?:ang )?dapat (?:dalhin|gawin)|bago (?:ako )?mag[-\s]?donate|maghanda|steps before|prior to donat\w*)\b/i;

const ON_TOPIC_PATTERN =
  /\b(blood\s*links?|bloodlink|hemie|blood|donat\w*|donor|dugo|eligib\w*|kwalipikado|kahilingan|compatib\w*|transfus\w*|hospital|urgency|recipient|screening|openstreetmap|blood bank|platelet|plasma|abo|rh factor)\b/i;

const AVAILABILITY_PATTERN =
  /\b(availability|available to donate|donation availability|toggle|available (ba )?(ako|to donate)|i-?on ang availability)\b/i;

const QR_PATTERN = /\b(qr|verify donation|verification code|scan code|i-?scan|beripikasyon)\b/i;

const INTERVAL_PATTERN =
  /\b(how (soon|often|long).{0,40}(donat|again)|between donations|donation interval|wait (to|before) donat|56 day|8 week|gaano (katagal|kadalas).{0,40}(donat|magbigay)|kailan (ulit|pwede).{0,20}donat)\b/i;

const MAP_PATTERN =
  /\b(map|nearby donor|find donor|location|openstreetmap|mapa|malapit na donor|hanapin ang donor)\b/i;

const CHAT_PATTERN = /\b(chat|message|messaging|hemie|mag-?chat|mag-?message)\b/i;

const GREETING_PATTERN =
  /\b(hello|hi|hey|kumusta|kamusta|magandang (umaga|hapon|gabi)|hola|bonjour)\b|你好|こんにちは|안녕하세요/i;

const HELP_PATTERN =
  /\b(help|help me|tulong|tabang|assist( me)?|paano (ba )?(ito|gumana)|what can you (do|help))\b/i;

const FOLLOW_UP_PATTERN =
  /^(yes|yeah|yep|yup|ok|okay|sure|next|continue|go on|what(?:'s| is) next|and then|how do i do that|opo|sige|oo|susunod|tuloy)[.!?]*$/i;

const DONOR_GUIDE_STEPS = ['eligibility', 'prep', 'availability', 'map', 'qr'];
const RECIPIENT_GUIDE_STEPS = ['request', 'compatibility', 'map', 'chat'];

const GUIDE_QUESTIONS = {
  eligibility: 'Am I eligible to donate?',
  prep: 'What should I do before I donate?',
  availability: 'How do I turn on donation availability?',
  map: 'How do I use the map?',
  qr: 'How does QR verification work?',
  request: 'How do I create a blood request?',
  compatibility: 'How does blood matching work?',
  chat: 'How do I message a donor?',
  interval: 'How long should I wait between donations?',
};

function isFollowUp(text) {
  return FOLLOW_UP_PATTERN.test(normalizeText(text).toLowerCase());
}

function getGuideSteps(context = {}) {
  return context.role === 'recipient' ? RECIPIENT_GUIDE_STEPS : DONOR_GUIDE_STEPS;
}

function classifyTopic(question) {
  const normalized = normalizeText(question);
  if (!normalized || isFollowUp(normalized)) {
    return null;
  }
  if (EMERGENCY_PATTERN.test(normalized)) return 'safety';
  if (OFF_TOPIC_PATTERN.test(normalized)) return 'guardrail';
  if (ELIGIBILITY_PATTERN.test(normalized)) return 'eligibility';
  if (INTERVAL_PATTERN.test(normalized)) return 'interval';
  if (PREP_PATTERN.test(normalized)) return 'prep';
  if (COMPATIBILITY_PATTERN.test(normalized)) return 'compatibility';
  if (REQUEST_PATTERN.test(normalized)) return 'request';
  if (AVAILABILITY_PATTERN.test(normalized)) return 'availability';
  if (QR_PATTERN.test(normalized)) return 'qr';
  if (MAP_PATTERN.test(normalized)) return 'map';
  if (CHAT_PATTERN.test(normalized) && !/\bhemie\b/i.test(normalized)) return 'chat';
  if (HELP_PATTERN.test(normalized) || GREETING_PATTERN.test(normalized)) return 'help';
  if (!ON_TOPIC_PATTERN.test(normalized)) return 'guardrail';
  return null;
}

function detectGuideLocale(question, messages = []) {
  const fromQuestion = detectUserLocale(question);
  if (fromQuestion === 'fil' || !isFollowUp(question)) {
    return fromQuestion;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user' && detectUserLocale(message.content) === 'fil') {
      return 'fil';
    }
  }

  return 'en';
}

function resolveGuidedQuestion(question, messages = [], context = {}) {
  const locale = detectGuideLocale(question, messages);
  if (!isFollowUp(question)) {
    return { question, locale, topic: classifyTopic(question), done: false };
  }

  const steps = getGuideSteps(context);
  let furthest = -1;
  let priorFollowUps = 0;

  for (const message of messages.slice(0, -1)) {
    if (message?.role !== 'user') {
      continue;
    }
    if (isFollowUp(message.content)) {
      priorFollowUps += 1;
      continue;
    }
    const index = steps.indexOf(classifyTopic(message.content));
    if (index > furthest) {
      furthest = index;
    }
  }

  const nextIndex = furthest + 1 + priorFollowUps;
  if (nextIndex >= steps.length) {
    return { question, locale, topic: null, done: true };
  }

  const topic = steps[nextIndex];
  return {
    question: GUIDE_QUESTIONS[topic],
    locale,
    topic,
    done: false,
  };
}

function guideCue(topic, locale) {
  const cues = {
    eligibility: {
      en: 'Reply "next" and I will check your eligibility against your BloodLink profile.',
      fil: 'Mag-reply ng "next" at titingnan ko ang eligibility mo base sa BloodLink profile.',
    },
    prep: {
      en: 'Reply "next" for what to bring and do before you donate.',
      fil: 'Mag-reply ng "next" para sa dapat dalhin at gawin bago mag-donate.',
    },
    availability: {
      en: 'Reply "next" and I will show you how to turn on Donation Availability on your Profile tab.',
      fil: 'Mag-reply ng "next" para sa pag-on ng Donation Availability sa Profile tab.',
    },
    map: {
      en: 'Reply "next" and I will show you how to find nearby requests or donors on the Map tab.',
      fil: 'Mag-reply ng "next" para sa Map tab at nearby requests o donors.',
    },
    qr: {
      en: 'Reply "next" for the QR verification step at the donation site.',
      fil: 'Mag-reply ng "next" para sa QR verification sa donation site.',
    },
    request: {
      en: 'Reply "next" and I will walk you through creating a blood request.',
      fil: 'Mag-reply ng "next" para sa paggawa ng blood request.',
    },
    compatibility: {
      en: 'Reply "next" and I will explain which blood types match.',
      fil: 'Mag-reply ng "next" para sa blood type matching.',
    },
    chat: {
      en: 'Reply "next" and I will show you how to message a matched donor or requester.',
      fil: 'Mag-reply ng "next" para sa Messages tab.',
    },
  };

  return cues[topic]?.[locale] || cues[topic]?.en || '';
}

function finishedGuide(locale) {
  if (locale === 'fil') {
    return 'Tapos na ang mga pangunahing hakbang sa BloodLink. Pwede mong tanungin ulit ang eligibility, matching, preparation, o QR verification.';
  }
  return 'That covers the main BloodLink steps. You can ask me to revisit eligibility, matching, preparation, or QR verification.';
}

function startGuide(context, locale) {
  if (context.role === 'recipient') {
    return locale === 'fil'
      ? 'Gagabayan kita sa BloodLink.\n\n1. Gumawa ng blood request\n2. Tingnan ang compatible blood types\n3. Hanapin ang nearby donors sa Map\n4. Mag-message sa Messages tab\n\nMag-reply ng "next" para magsimula sa paggawa ng request.'
      : 'I will guide you through requesting blood on BloodLink.\n\n1. Create a blood request\n2. Confirm compatible blood types\n3. Find nearby donors on the Map tab\n4. Message them in Messages\n\nReply "next" to start by creating a request.';
  }

  return locale === 'fil'
    ? 'Gagabayan kita sa pag-donate gamit ang BloodLink.\n\n1. I-check ang eligibility\n2. Maghanda bago mag-donate\n3. I-on ang Donation Availability sa Profile tab\n4. Hanapin ang request sa Map\n5. Kumpletuhin ang QR verification sa donation site\n\nMag-reply ng "next" para simulan ang eligibility check.'
    : 'I will guide you through donating on BloodLink, one step at a time.\n\n1. Check eligibility\n2. Prepare for donation day\n3. Turn on Donation Availability on your Profile tab\n4. Find a matching request on the Map tab\n5. Complete QR verification at the donation site\n\nReply "next" to start with eligibility.';
}

function applyConversationGuide(answer, topic, context, locale) {
  if (!answer || answer.kind === 'safety' || topic === 'help') {
    return answer;
  }

  if (answer.kind === 'guardrail') {
    const cue = guideCue(getGuideSteps(context)[0], locale);
    return { ...answer, reply: `${answer.reply}\n\n${cue}` };
  }

  if (answer.kind !== 'grounded') {
    return answer;
  }

  if (topic === 'eligibility') {
    const issues = getEligibilityIssues(context);
    const hasProfileBasics = Boolean(context.birthdate) && context.weightKg != null;
    if (!hasProfileBasics || issues.length > 0) {
      const hold = locale === 'fil'
        ? 'Huwag munang mag-donate hanggang ma-clear ang mga item sa itaas. Kapag tapos na, mag-reply ng "next" para sa preparation.'
        : 'Do not donate until the items above are cleared. When they are, reply "next" for donation-day preparation.';
      return { ...answer, reply: `${answer.reply}\n\n${hold}` };
    }
  }

  const steps = getGuideSteps(context);
  const roleKey = context.role === 'recipient' ? 'recipient' : 'donor';
  const overrides = {
    donor: { compatibility: 'map', interval: 'prep' },
    recipient: { eligibility: 'request', prep: 'request', interval: 'request', availability: 'request', qr: 'chat' },
  };
  const nextTopic = overrides[roleKey][topic] || (steps.includes(topic) ? steps[steps.indexOf(topic) + 1] : steps[0]);
  if (!nextTopic) {
    return { ...answer, reply: `${answer.reply}\n\n${finishedGuide(locale)}` };
  }

  return { ...answer, reply: `${answer.reply}\n\n${guideCue(nextTopic, locale)}` };
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Rough locale for local (non-LLM) replies: en | fil (covers Tagalog/Filipino/Taglish/Cebuano help cues). */
function detectUserLocale(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return 'en';
  }

  if (
    /^(tabang|tulong)[!?.]*$/i.test(normalized) ||
    /\b(tabang|unsa|asa|salamat kaayo)\b/i.test(normalized)
  ) {
    return 'fil';
  }

  if (
    /\b(pwede|maaari|ako(?:ng)?|ko(?:ng)?|tulong|kumusta|kamusta|dugo|opo|\bpo\b|paano|ano|salamat|mag[-\s]?donate|magbigay|ba ako|ba ko)\b/i.test(
      normalized,
    )
  ) {
    return 'fil';
  }

  return 'en';
}

function normalizeBloodType(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return BLOOD_TYPES.includes(normalized) ? normalized : null;
}

function parseDateOnly(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const dateOnly = trimmed.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }

  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function calculateAge(birthdate) {
  const born = parseDateOnly(birthdate);
  if (!born) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - born.getUTCFullYear();
  const monthDiff = today.getMonth() - born.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getUTCDate())) {
    age -= 1;
  }

  return age;
}

function getDaysUntilNextEligible(lastDonationAt) {
  const lastDonation = lastDonationAt ? new Date(lastDonationAt) : null;
  if (!lastDonation || Number.isNaN(lastDonation.getTime())) {
    return null;
  }

  const eligibleDate = new Date(lastDonation);
  eligibleDate.setDate(eligibleDate.getDate() + DONATION_INTERVAL_DAYS);
  eligibleDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((eligibleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysRemaining);
}

function isTransfusionWaitComplete(lastTransfusionDate) {
  if (!lastTransfusionDate) {
    return true;
  }

  const transfusionDate = parseDateOnly(lastTransfusionDate);
  if (!transfusionDate) {
    return false;
  }

  const waitUntil = new Date(transfusionDate);
  waitUntil.setUTCMonth(waitUntil.getUTCMonth() + TRANSFUSION_WAIT_MONTHS);

  return Date.now() >= waitUntil.getTime();
}

function getEligibilityIssues(context = {}) {
  const issues = [];
  const age = context.birthdate ? calculateAge(context.birthdate) : null;

  if (context.birthdate) {
    if (age === null) {
      issues.push('Enter a valid birthdate in your profile.');
    } else if (age < MIN_AGE || age > MAX_AGE) {
      issues.push(`Donors must be between ${MIN_AGE} and ${MAX_AGE} years old.`);
    } else if (age === 16 || age === 17) {
      issues.push('Parental or guardian written consent is required for donors aged 16 or 17.');
    }
  }

  if (context.weightKg != null) {
    const weightKg = Number(context.weightKg);
    if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG) {
      issues.push(`Weight must be at least ${MIN_WEIGHT_KG} kg (110 lbs).`);
    }
  }

  if (context.lastTransfusionDate && !isTransfusionWaitComplete(context.lastTransfusionDate)) {
    issues.push(
      `You must wait ${TRANSFUSION_WAIT_MONTHS} months after a blood transfusion before donating.`,
    );
  }

  const daysUntilEligible = getDaysUntilNextEligible(context.lastDonationAt);
  if (daysUntilEligible != null && daysUntilEligible > 0) {
    issues.push(
      `Wait ${daysUntilEligible} more day${daysUntilEligible === 1 ? '' : 's'} before your next whole-blood donation (${DONATION_INTERVAL_DAYS}-day interval).`,
    );
  }

  return issues;
}

function buildLocalEligibilityReply(context = {}, locale = 'en') {
  const requirementsEn = [
    `Age: ${MIN_AGE} to ${MAX_AGE} years old (${MIN_AGE} and 17-year-olds require written parental or guardian consent).`,
    `Weight: At least ${MIN_WEIGHT_KG} kg (110 lbs).`,
    `Wait ${TRANSFUSION_WAIT_MONTHS} months from your last blood transfusion before donating.`,
    `Wait ${DONATION_INTERVAL_DAYS} days between whole-blood donations.`,
    'Be in good general health on donation day.',
  ];
  const requirementsFil = [
    `Edad: ${MIN_AGE} hanggang ${MAX_AGE} taong gulang (kailangan ng written parental/guardian consent ang ${MIN_AGE}–17).`,
    `Timbang: Hindi bababa sa ${MIN_WEIGHT_KG} kg (110 lbs).`,
    `Maghintay ng ${TRANSFUSION_WAIT_MONTHS} buwan pagkatapos ng blood transfusion bago mag-donate.`,
    `Maghintay ng ${DONATION_INTERVAL_DAYS} araw sa pagitan ng whole-blood donations.`,
    'Dapat maganda ang general health sa araw ng donation.',
  ];

  const hasProfileBasics = Boolean(context.birthdate) && context.weightKg != null;

  if (!hasProfileBasics) {
    if (locale === 'fil') {
      return `General donor eligibility:\n\n${requirementsFil.map((item) => `• ${item}`).join('\n')}\n\nKumpletuhin ang profile mo para mas personal ang gabay. Final clearance pa rin ang blood bank screening.`;
    }
    return `General donor eligibility includes:\n\n${requirementsEn.map((item) => `• ${item}`).join('\n')}\n\nComplete your profile so I can give more personalized guidance. Final clearance still depends on blood bank screening.`;
  }

  const issues = getEligibilityIssues(context);

  if (issues.length === 0) {
    if (locale === 'fil') {
      return 'Base sa BloodLink profile mo, pasok ka sa basic eligibility checks (edad, timbang, transfusion wait, at donation interval). Final approval pa rin ang health screening sa araw ng donation.';
    }
    return 'Based on your BloodLink profile, you meet the basic eligibility checks (age, weight, transfusion wait, and donation interval). Final approval still depends on a health screening on donation day.';
  }

  if (locale === 'fil') {
    return `Ito ang mga dapat mong i-review:\n\n${issues.map((issue) => `• ${issue}`).join('\n')}\n\nPwede mong i-update ang profile o makipag-usap sa blood bank staff para sa buong assessment.`;
  }

  return `Here are eligibility items to review:\n\n${issues.map((issue) => `• ${issue}`).join('\n')}\n\nYou can update your profile or speak with staff at the blood bank for a full assessment.`;
}

function buildCompatibilityReply(context = {}, locale = 'en') {
  const bloodType = normalizeBloodType(context.bloodType);

  if (bloodType) {
    if (context.role === 'recipient') {
      const donors = RECIPIENT_CAN_RECEIVE_FROM[bloodType].join(', ');
      if (locale === 'fil') {
        return `Ang blood type mo ay ${bloodType}. Bilang recipient, pwede kang tumanggap ng red cells mula sa: ${donors}.\n\nGinagamit ito ng BloodLink para ipakita ang compatible nearby donors. O- ang universal donor; AB+ ang universal recipient.`;
      }
      return `Your blood type is ${bloodType}. As a recipient, you can receive red cells from: ${donors}.\n\nBloodLink uses this ABO/Rh matching to surface compatible nearby donors. O- is the universal donor type; AB+ is the universal recipient type.`;
    }

    const recipients = DONOR_CAN_DONATE_TO[bloodType].join(', ');
    if (locale === 'fil') {
      return `Ang blood type mo ay ${bloodType}. Bilang donor, pwede kang magbigay ng red cells sa: ${recipients}.\n\nGinagamit ito ng BloodLink para ipakita ang compatible open requests. O- ang universal donor; AB+ ang universal recipient.`;
    }
    return `Your blood type is ${bloodType}. As a donor, you can give red cells to: ${recipients}.\n\nBloodLink uses this ABO/Rh matching to surface compatible open requests. O- is the universal donor type; AB+ is the universal recipient type.`;
  }

  if (locale === 'fil') {
    return 'Ang blood matching ay sumusunod sa ABO at Rh compatibility. O- ay pwedeng mag-donate sa lahat (universal donor). AB+ ay pwedeng tumanggap mula sa lahat (universal recipient). I-set ang blood type mo sa Profile para sa personalized guidance.';
  }

  return 'Blood matching follows ABO and Rh compatibility. O- can donate to all types (universal donor). AB+ can receive from all types (universal recipient). BloodLink uses your profile blood type to surface compatible requests and donors. Set your blood type in Profile for personalized guidance.';
}

function buildDonationIntervalReply(context = {}, locale = 'en') {
  const daysUntilEligible = getDaysUntilNextEligible(context.lastDonationAt);

  if (daysUntilEligible == null) {
    if (locale === 'fil') {
      return `May ${DONATION_INTERVAL_DAYS}-day wait ang BloodLink sa pagitan ng whole-blood donations. Kung wala kang recent donation (o hindi pa naka-log), baka pwede ka na—kumpirmahin sa on-site screening.`;
    }
    return `BloodLink follows a ${DONATION_INTERVAL_DAYS}-day wait between whole-blood donations. If you have not donated recently (or have not logged a donation), you may be ready now—confirm during on-site screening.`;
  }

  if (daysUntilEligible === 0) {
    if (locale === 'fil') {
      return `Base sa last donation mo, tapos na ang ${DONATION_INTERVAL_DAYS}-day wait at pwede ka nang mag-donate ulit, subject sa on-site screening.`;
    }
    return `Based on your last donation on file, you have completed the ${DONATION_INTERVAL_DAYS}-day wait and may donate again, subject to on-site screening.`;
  }

  if (locale === 'fil') {
    return `Base sa last donation mo, maghintay pa ng ${daysUntilEligible} araw bago ang susunod na whole-blood donation (${DONATION_INTERVAL_DAYS}-day interval ang BloodLink).`;
  }

  return `Based on your last donation on file, wait ${daysUntilEligible} more day${daysUntilEligible === 1 ? '' : 's'} before your next whole-blood donation (BloodLink uses a ${DONATION_INTERVAL_DAYS}-day interval).`;
}

function getHelpReply(locale = 'en', context = {}) {
  return startGuide(context, locale);
}

function getFallbackHelpReply(locale = 'en') {
  if (locale === 'fil') {
    return 'Matutulungan kita sa donor eligibility, 56-day donation interval, blood type matching, paggawa ng blood request, donation preparation, at paggamit ng BloodLink. Subukan ang suggested questions o magtanong sa sarili mong salita.';
  }
  return 'I can help with donor eligibility, the 56-day donation interval, blood type matching, creating blood requests, donation preparation, and using BloodLink. Try one of the suggested questions or ask in your own words.';
}

function buildClassifiedReply(question, context = {}, options = {}) {
  const normalized = normalizeText(question);
  const locale = options.locale || (options.preferLocalLanguage === false ? 'en' : detectUserLocale(question));

  if (EMERGENCY_PATTERN.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'Parang medical emergency ito. Tumawag agad sa local emergency services (911) o healthcare personnel. Hindi makakapagbigay ang Hemie ng emergency medical care.'
          : 'This sounds like a medical emergency. Contact local emergency services (911) or healthcare personnel immediately. Hemie cannot provide emergency medical care.',
      kind: 'safety',
    };
  }

  if (OFF_TOPIC_PATTERN.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'Ako si Hemie, BloodLink assistant mo. Tanging blood donation, eligibility, matching, at paggamit ng BloodLink ang kayang tulungan ko. Ano ang gusto mong malaman tungkol diyan?'
          : "I'm Hemie, your BloodLink assistant. I can only help with blood donation, eligibility, matching, and how to use BloodLink. What would you like to know about those?",
      kind: 'guardrail',
    };
  }

  if (ELIGIBILITY_PATTERN.test(normalized)) {
    return { reply: buildLocalEligibilityReply(context, locale), kind: 'grounded' };
  }

  if (INTERVAL_PATTERN.test(normalized)) {
    return { reply: buildDonationIntervalReply(context, locale), kind: 'grounded' };
  }

  if (PREP_PATTERN.test(normalized)) {
    return { reply: buildPreparationReply(locale), kind: 'grounded' };
  }

  if (COMPATIBILITY_PATTERN.test(normalized)) {
    return { reply: buildCompatibilityReply(context, locale), kind: 'grounded' };
  }

  if (REQUEST_PATTERN.test(normalized)) {
    if (context.role === 'recipient') {
      return {
        reply:
          locale === 'fil'
            ? 'Pumunta sa Recipient Home at i-tap ang Create blood request. Ilagay ang blood type, units needed, urgency, hospital details, at location para makasagot ang nearby compatible donors.'
            : 'Go to Recipient Home and tap Create blood request. Add the blood type, units needed, urgency, hospital details, and location so nearby compatible donors can respond.',
        kind: 'grounded',
      };
    }

    return {
      reply:
        locale === 'fil'
          ? 'Ang blood requests ay ginagawa ng recipients. Kung kailangan ng dugo, gamitin ang recipient mode o hilingin sa caregiver ng patient na gumawa ng request mula sa Recipient Home.'
          : "Blood requests are created by recipients. If you need blood, use recipient mode or ask the patient's caregiver to create a request from Recipient Home.",
      kind: 'grounded',
    };
  }

  if (AVAILABILITY_PATTERN.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'I-on ang Donation Availability sa Profile tab, katabi ng Edit Profile, kapag handa ka nang tumugon sa nearby requests. Panatilihing updated ang profile at verification para mas mabilis kang ma-match.'
          : 'Turn on Donation Availability from your Profile tab, next to Edit Profile, when you are ready to respond to nearby requests. Keep your profile and verification up to date so recipients can match with you faster.',
      kind: 'grounded',
    };
  }

  if (QR_PATTERN.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'Gumagamit ang BloodLink ng QR codes para i-verify ang donation sessions. Sundan ang on-screen QR flow sa donation site kasama ang authorized personnel.'
          : 'BloodLink uses QR codes to help verify donation sessions. Follow the on-screen QR flow when you are at the donation site with authorized personnel.',
      kind: 'grounded',
    };
  }

  if (MAP_PATTERN.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'Gamitin ang Map tab para tingnan ang nearby donors at request locations sa OpenStreetMap. Pwede ring mag-browse ang recipients ng compatible nearby donors mula sa Recipient Home.'
          : 'Use the Map tab to explore nearby donors and request locations on OpenStreetMap. Recipients can also browse compatible nearby donors from Recipient Home.',
      kind: 'grounded',
    };
  }

  if (CHAT_PATTERN.test(normalized) && !/\bhemie\b/i.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'Buksan ang Messages tab para makipag-chat sa matched donors o requesters. Gamitin si Hemie (ang chat na ito) para sa donation education at BloodLink how-to questions.'
          : 'Open the Messages tab to chat with matched donors or requesters. Use Hemie (this chat) for donation education and BloodLink how-to questions.',
      kind: 'grounded',
    };
  }

  if (HELP_PATTERN.test(normalized) || GREETING_PATTERN.test(normalized)) {
    return {
      reply: getHelpReply(locale, context),
      kind: 'grounded',
    };
  }

  if (!ON_TOPIC_PATTERN.test(normalized)) {
    return {
      reply:
        locale === 'fil'
          ? 'Ako si Hemie, BloodLink assistant mo. Tanging blood donation, eligibility, matching, at paggamit ng BloodLink ang kayang tulungan ko. Ano ang gusto mong malaman tungkol diyan?'
          : "I'm Hemie, your BloodLink assistant. I can only help with blood donation, eligibility, matching, and how to use BloodLink. What would you like to know about those?",
      kind: 'guardrail',
    };
  }

  return null;
}

function getGroundedHemieReply(question, context = {}, options = {}) {
  const guided = resolveGuidedQuestion(question, options.messages || [], context);
  if (guided.done) {
    return { reply: finishedGuide(guided.locale), kind: 'grounded' };
  }

  const answer = buildClassifiedReply(guided.question, context, {
    ...options,
    locale: guided.locale,
  });
  if (!answer) {
    return null;
  }

  return applyConversationGuide(
    answer,
    guided.topic || classifyTopic(guided.question),
    context,
    guided.locale,
  );
}

function buildPreparationReply(locale = 'en') {
  if (locale === 'fil') {
    return 'Bago mag-donate, magdala ng valid ID, kumain ng healthy meal, uminom ng maraming tubig, at magpahinga nang sapat. Iwasan ang alcohol bago mag-donate at i-disclose ang medications o recent illnesses sa screening.';
  }

  return 'Before donating, bring a valid ID, eat a healthy meal, drink plenty of water, and get adequate rest. Avoid alcohol before donation and disclose medications or recent illnesses during screening.';
}

function getLocalHemieReply(question, context = {}, messages) {
  const grounded = getGroundedHemieReply(question, context, {
    preferLocalLanguage: true,
    messages: messages || [{ role: 'user', content: question }],
  });
  if (grounded) {
    return grounded.reply;
  }

  return getFallbackHelpReply(detectUserLocale(question));
}

function sanitizeContext(rawContext) {
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return {};
  }

  const context = {};

  if (typeof rawContext.role === 'string' && rawContext.role.trim()) {
    context.role = rawContext.role.trim().slice(0, 40);
  }

  const bloodType = normalizeBloodType(rawContext.bloodType);
  if (bloodType) {
    context.bloodType = bloodType;
  }

  if (typeof rawContext.birthdate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawContext.birthdate)) {
    context.birthdate = rawContext.birthdate;
  }

  if (rawContext.weightKg != null) {
    const weightKg = Number(rawContext.weightKg);
    if (Number.isFinite(weightKg) && weightKg > 0 && weightKg < 500) {
      context.weightKg = weightKg;
    }
  }

  if (
    typeof rawContext.lastTransfusionDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(rawContext.lastTransfusionDate)
  ) {
    context.lastTransfusionDate = rawContext.lastTransfusionDate;
  }

  if (typeof rawContext.lastDonationAt === 'string' && rawContext.lastDonationAt.trim()) {
    const lastDonationAt = rawContext.lastDonationAt.trim();
    const parsed = new Date(lastDonationAt);
    if (!Number.isNaN(parsed.getTime())) {
      context.lastDonationAt = lastDonationAt.slice(0, 32);
    }
  }

  if (typeof rawContext.isAvailable === 'boolean') {
    context.isAvailable = rawContext.isAvailable;
  }

  return context;
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { error: 'Provide at least one chat message.' };
  }

  const messages = [];

  for (const entry of rawMessages.slice(-MAX_HISTORY_MESSAGES)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: 'Each message must be an object.' };
    }

    const role = entry.role === 'assistant' ? 'assistant' : entry.role === 'user' ? 'user' : null;
    const content = normalizeText(entry.content);

    if (!role) {
      return { error: 'Message role must be user or assistant.' };
    }

    if (!content) {
      return { error: 'Message content cannot be empty.' };
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
    }

    messages.push({ role, content });
  }

  if (messages[messages.length - 1]?.role !== 'user') {
    return { error: 'The latest message must come from the user.' };
  }

  return { messages };
}

function buildGroundedFactsBlock(question, context) {
  // Keep authoritative facts in English for the LLM; it will reply in the user's language.
  const grounded = getGroundedHemieReply(question, context, { preferLocalLanguage: false });
  if (!grounded) {
    return null;
  }

  if (grounded.kind === 'safety' || grounded.kind === 'guardrail') {
    return `Required message for this turn (convey this exact meaning in the user's language; do not soften safety or topic limits):\n${grounded.reply}`;
  }

  if (grounded.kind !== 'grounded') {
    return null;
  }

  return `Grounded facts for this turn (authoritative — answer from these, in the user's language):\n${grounded.reply}`;
}

function buildContextBlock(context, question = '') {
  const lines = [
    DONOR_ELIGIBILITY_NOTES.trim(),
    BLOOD_COMPATIBILITY_NOTES.trim(),
    BLOODLINK_HOWTO_NOTES.trim(),
    'Current user context:',
  ];

  lines.push(`- role: ${context.role || 'unknown'}`);
  lines.push(`- bloodType: ${context.bloodType || 'unknown'}`);
  lines.push(`- birthdate: ${context.birthdate || 'unknown'}`);
  lines.push(`- weightKg: ${context.weightKg != null ? context.weightKg : 'unknown'}`);
  lines.push(`- lastTransfusionDate: ${context.lastTransfusionDate || 'none on file'}`);
  lines.push(`- lastDonationAt: ${context.lastDonationAt || 'none on file'}`);
  lines.push(
    `- daysUntilNextDonationEligible: ${
      getDaysUntilNextEligible(context.lastDonationAt) ?? 'unknown (no last donation on file)'
    }`,
  );
  lines.push(
    `- isAvailable: ${typeof context.isAvailable === 'boolean' ? context.isAvailable : 'unknown'}`,
  );

  const bloodType = normalizeBloodType(context.bloodType);
  if (bloodType) {
    lines.push(`- canDonateTo: ${DONOR_CAN_DONATE_TO[bloodType].join(', ')}`);
    lines.push(`- canReceiveFrom: ${RECIPIENT_CAN_RECEIVE_FROM[bloodType].join(', ')}`);
  }

  const eligibilityIssues = getEligibilityIssues(context);
  lines.push(
    `- eligibilityFlags: ${
      eligibilityIssues.length ? eligibilityIssues.join(' | ') : 'no basic profile flags'
    }`,
  );

  const groundedFacts = question ? buildGroundedFactsBlock(question, context) : null;
  if (groundedFacts) {
    lines.push(groundedFacts);
  }

  return lines.join('\n');
}

// Groq OpenAI-compatible chat completions. callOpenAiCompat appends /chat/completions.
const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b'];
const RETIRED_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
]);
const OLLAMA_PLACEHOLDER_API_KEY = 'ollama';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];
const DEFAULT_GEMINI_NATIVE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function isPlaceholderApiKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || normalized === OLLAMA_PLACEHOLDER_API_KEY;
}

function isLlmConfigured(env = process.env) {
  return !isPlaceholderApiKey(env.HEMIE_LLM_API_KEY);
}

function parseModelList(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueModels(models) {
  const seen = new Set();
  const unique = [];

  for (const model of models) {
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    unique.push(model);
  }

  return unique;
}

function isGeminiBaseUrl(baseUrl) {
  return /generativelanguage\.googleapis\.com/i.test(baseUrl);
}

function isGeminiModel(model) {
  return /^gemini-/i.test(model);
}

function isLlamaRequest(baseUrl, model) {
  return /llama/i.test(model) || /together\.(xyz|ai)/i.test(baseUrl);
}

function isGroqBaseUrl(baseUrl) {
  return /api\.groq\.com/i.test(baseUrl);
}

function isReasoningGroqModel(model) {
  return /^openai\/gpt-oss-/i.test(model);
}

function isOllamaPlaceholderUrl(baseUrl) {
  return /(?:127\.0\.0\.1|localhost):11434/i.test(baseUrl);
}

function isOllamaPlaceholderModel(model) {
  return /^(llama3(?:\.1)?|llama2)$/i.test(model);
}

function getLlmConfig(env = process.env) {
  const apiKey = (env.HEMIE_LLM_API_KEY || '').trim();
  let configuredBaseUrl = (env.HEMIE_LLM_BASE_URL || '').trim().replace(/\/$/, '');
  let configuredModel = (env.HEMIE_LLM_MODEL || '').trim();
  const fallbackModels = parseModelList(env.HEMIE_LLM_FALLBACK_MODELS);

  if (isOllamaPlaceholderUrl(configuredBaseUrl)) {
    configuredBaseUrl = '';
  }
  if (isOllamaPlaceholderModel(configuredModel) || RETIRED_GROQ_MODELS.has(configuredModel)) {
    configuredModel = '';
  }

  const usesGemini = isGeminiBaseUrl(configuredBaseUrl) || isGeminiModel(configuredModel);

  if (usesGemini) {
    const primaryModel = configuredModel || DEFAULT_GEMINI_MODEL;
    return {
      apiKey,
      baseUrl: configuredBaseUrl,
      models: uniqueModels([primaryModel, ...fallbackModels, ...DEFAULT_GEMINI_FALLBACK_MODELS]),
      provider: 'gemini',
    };
  }

  const primaryModel = configuredModel || DEFAULT_GROQ_MODEL;
  const baseUrl = configuredBaseUrl || DEFAULT_GROQ_BASE_URL;
  const provider = isGroqBaseUrl(baseUrl)
    ? 'groq'
    : isLlamaRequest(baseUrl, primaryModel)
      ? 'llama'
      : 'openai-compat';
  const safeFallbacks =
    provider === 'groq'
      ? fallbackModels.filter(
          (model) =>
            !isGeminiModel(model) &&
            !isOllamaPlaceholderModel(model) &&
            !RETIRED_GROQ_MODELS.has(model),
        )
      : fallbackModels;

  return {
    apiKey,
    baseUrl,
    models: uniqueModels([
      primaryModel,
      ...safeFallbacks,
      ...(provider === 'groq' ? DEFAULT_GROQ_FALLBACK_MODELS : []),
    ]),
    provider,
  };
}

function buildSystemPrompt(context, latestUserMessage) {
  return `${HEMIE_SYSTEM_PROMPT}\n\n${buildContextBlock(context, latestUserMessage)}`;
}

function toGeminiContents(messages) {
  const contents = [];

  for (const message of messages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const text = normalizeText(message.content);
    if (!text) {
      continue;
    }

    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text = `${last.parts[0].text}\n${text}`;
      continue;
    }

    contents.push({
      role,
      parts: [{ text }],
    });
  }

  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    throw new Error('Gemini request requires a latest user message.');
  }

  return contents;
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return normalizeText(
    parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n'),
  );
}

function createLlmError(detail, status) {
  const error = new Error(detail);
  error.status = status;
  return error;
}

async function callGeminiNative({
  messages,
  context,
  model,
  apiKey,
  fetchImpl = fetch,
  systemPrompt,
  signal,
}) {
  const latestUserMessage = messages[messages.length - 1]?.content || '';
  const url = `${DEFAULT_GEMINI_NATIVE_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    signal,
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt || buildSystemPrompt(context, latestUserMessage) }],
      },
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_REPLY_TOKENS,
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw createLlmError(
      payload?.error?.message || payload?.message || `Gemini request failed with status ${response.status}`,
      response.status,
    );
  }

  const reply = extractGeminiText(payload);
  if (!reply) {
    throw createLlmError('Gemini returned an empty reply.', 502);
  }

  return reply;
}

async function callOpenAiCompat({
  messages,
  context,
  model,
  apiKey,
  baseUrl,
  fetchImpl = fetch,
  systemPrompt,
  signal,
}) {
  const latestUserMessage = messages[messages.length - 1]?.content || '';

  const requestBody = {
    model,
    temperature: 0.2,
    max_tokens: isReasoningGroqModel(model) ? 2048 : MAX_REPLY_TOKENS,
    ...(isReasoningGroqModel(model) ? { reasoning_effort: 'low' } : {}),
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt || buildSystemPrompt(context, latestUserMessage) },
      ...messages,
    ],
  };

  let lastReply = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        ...requestBody,
        max_tokens: requestBody.max_tokens * (attempt + 1),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw createLlmError(
        payload?.error?.message || payload?.message || `LLM request failed with status ${response.status}`,
        response.status,
      );
    }

    const reply = extractOpenAiReply(payload);
    const truncated = payload?.choices?.[0]?.finish_reason === 'length';

    if (reply) {
      lastReply = reply;
    }

    if (reply && !truncated) {
      return reply;
    }
  }

  if (lastReply) {
    return lastReply;
  }

  throw createLlmError('LLM returned an empty reply.', 502);
}

function extractOpenAiReply(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('\n');
  }

  return normalizeReply(text.replace(/<think>[\s\S]*?<\/think>/gi, ' '));
}

function normalizeReply(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function shouldTryNextModel(error) {
  const status = Number(error?.status);
  if (status === 404 || status === 429 || status === 503) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('not found') ||
    message.includes('no longer available') ||
    message.includes('high demand') ||
    message.includes('does not exist') ||
    message.includes('unsupported') ||
    message.includes('empty reply')
  );
}

async function callHemieLlm({
  messages,
  context,
  fetchImpl = fetch,
  env = process.env,
  systemPrompt,
  signal,
}) {
  const { apiKey, baseUrl, models, provider } = getLlmConfig(env);
  let lastError = null;

  for (const model of models) {
    try {
      if (provider === 'gemini') {
        return await callGeminiNative({
          messages,
          context,
          model,
          apiKey,
          fetchImpl,
          systemPrompt,
          signal,
        });
      }

      return await callOpenAiCompat({
        messages,
        context,
        model,
        apiKey,
        baseUrl,
        fetchImpl,
        systemPrompt,
        signal,
      });
    } catch (error) {
      lastError = error;
      console.error(`Hemie LLM model failed (${model}):`, error?.status || error?.name || 'Error');

      if (!shouldTryNextModel(error)) {
        throw error;
      }
    }
  }

  throw lastError || createLlmError('All Hemie LLM models failed.', 502);
}

async function generateHemieReply({
  messages,
  context = {},
  fetchImpl = fetch,
  env = process.env,
}) {
  const latestUserMessage = messages[messages.length - 1]?.content || '';
  const locale = detectGuideLocale(latestUserMessage, messages);
  const grounded = getGroundedHemieReply(latestUserMessage, context, { messages });
  const llmConfigured = isLlmConfigured(env);

  // Known donation and BloodLink answers stay deterministic so the model cannot switch topics.
  if (grounded) {
    return { reply: grounded.reply, source: grounded.kind };
  }

  if (!llmConfigured) {
    return {
      reply: getLocalHemieReply(latestUserMessage, context, messages),
      source: 'local',
    };
  }

  try {
    const reply = await callHemieLlm({ messages, context, fetchImpl, env });
    const topic = classifyTopic(latestUserMessage);
    const guidedReply = topic
      ? applyConversationGuide({ reply, kind: 'grounded' }, topic, context, locale).reply
      : `${reply}\n\n${guideCue(getGuideSteps(context)[0], locale)}`;
    return { reply: guidedReply, source: 'llm' };
  } catch (error) {
    console.error('Hemie LLM failed, using local fallback:', error);
    return {
      reply: getLocalHemieReply(latestUserMessage, context, messages),
      source: 'local_fallback',
    };
  }
}

async function verifySupabaseAccessToken(token, { fetchImpl = fetch, env = process.env } = {}) {
  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !anonKey) {
    const error = new Error('Hemie auth is not configured on the server.');
    error.status = 503;
    throw error;
  }

  const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!response.ok) {
    const error = new Error('Invalid or expired session.');
    error.status = 401;
    throw error;
  }

  const user = await response.json();
  if (!user?.id) {
    const error = new Error('Invalid or expired session.');
    error.status = 401;
    throw error;
  }

  return user;
}

module.exports = {
  HEMIE_SYSTEM_PROMPT,
  DONATION_INTERVAL_DAYS,
  callHemieLlm,
  generateHemieReply,
  getLocalHemieReply,
  getGroundedHemieReply,
  getLlmConfig,
  isLlmConfigured,
  sanitizeContext,
  sanitizeMessages,
  verifySupabaseAccessToken,
};
