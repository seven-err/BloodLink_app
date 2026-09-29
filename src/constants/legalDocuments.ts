export type LegalDocumentId = 'terms' | 'privacy';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocument = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    title: 'Terms and Conditions',
    updated: 'September 17, 2026',
    sections: [
      {
        title: 'What BloodLink does',
        paragraphs: [
          'BloodLink helps people request blood and helps donors find compatible requests nearby. The app coordinates matching, messages, notifications, and donation check-in.',
          'BloodLink is a coordination tool. It is not a hospital, blood bank, or emergency service, and it does not provide medical advice.',
        ],
      },
      {
        title: 'Emergencies',
        paragraphs: [
          'If someone needs blood immediately, contact the hospital or local emergency services. Do not wait on an app notification as the only way to get help.',
        ],
      },
      {
        title: 'Your account',
        paragraphs: [
          'Use your own name, phone number, email, and blood type. Keep your password private. You are responsible for activity on your account.',
          'Healthcare and blood bank accounts are reviewed before staff tools are unlocked.',
        ],
      },
      {
        title: 'Requests and donations',
        paragraphs: [
          'A match in the app does not mean a donation is medically approved. Eligibility, screening, and the donation itself happen at the facility.',
          'Do not offer or accept payment for blood through BloodLink. Do not create a request for someone else without their knowledge.',
        ],
      },
      {
        title: 'Messages',
        paragraphs: [
          'Use chat only to coordinate a blood request. Do not share passwords, payment details, or another person’s medical information beyond what the request needs.',
        ],
      },
      {
        title: 'Stopping use',
        paragraphs: [
          'You can stop using BloodLink at any time. To ask for your account to be removed, email support@bloodlink.app.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'September 17, 2026',
    sections: [
      {
        title: 'What we store',
        paragraphs: [
          'BloodLink stores the details you provide: name, phone number, email, blood type, profile photo, location when you allow it, blood requests, donation records, and messages about a request.',
        ],
      },
      {
        title: 'Why we use it',
        paragraphs: [
          'That information is used to sign you in, match compatible donors and requests, show nearby results, verify a donation, and send alerts you turn on.',
          'Other people only see what is needed for a request, such as blood type, a display name, and an approximate distance. Your password is never shown.',
        ],
      },
      {
        title: 'Sharing',
        paragraphs: [
          'BloodLink does not sell your information. Staff can review verification records and reports needed to run the service.',
        ],
      },
      {
        title: 'Your choices',
        paragraphs: [
          'You can turn location access and notification alerts off in your phone or in Settings. To request a copy or deletion of your account, email support@bloodlink.app.',
        ],
      },
    ],
  },
};
