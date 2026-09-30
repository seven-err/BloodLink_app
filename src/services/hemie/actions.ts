import { getNearbyMapDonors } from '@/services/supabase/nearbyMapDonors';
import { getOpenBloodRequestsFeed } from '@/services/supabase/openBloodRequestsFeed';
import type { Profile } from '@/services/supabase/profiles';
import type { BloodType } from '@/types/database';
import { isDonorCompatibleWithRecipient } from '@/utils/bloodTypeCompatibility';
import { haversineDistanceMeters } from '@/utils/coordinates';

export type HemieActionIntent = 'compatible_donors' | 'urgent_requests' | 'create_request';
export type HemieActionLink =
  | { label: string; target: 'create_request'; bloodType?: BloodType }
  | { label: string; target: 'request_detail'; requestId: string }
  | { label: string; target: 'map' | 'requests' };
export type HemieActionReply = { message: string; link?: HemieActionLink };

const BLOOD_TYPE_IN_TEXT = /(?:^|[^a-z0-9])(AB|A|B|O)\s*([+-])(?=$|[^a-z0-9])/i;
const NON_ACTION_TASK = /\b(poem|joke|movie|homework|recipe|crypto|bitcoin|what(?:'s| is) the weather|chest pain|can'?t breathe|not breathing|unconscious|severe bleeding|stroke|heart attack|hirap huminga|matinding pagdurugo)\b/i;
const REQUEST_ACTION = /^(?:create|make|post|submit|start|file|gumawa|mag-?request)\b.{0,45}\b(?:blood\s*)?requests?\b/i;
const URGENT_REQUEST_ACTION = /^(?:(?:find|show(?: me)?|list|search(?: for)?|look\s+for|hanap\w*|are\s+there|any)\b.{0,45})?\b(?:urgent|critical|emergency|agarang|madalian)\b.{0,45}\b(?:blood\s*)?requests?\b/i;
const DONOR_ACTION = /^(?:find|show(?: me)?|list|provide|suggest|recommend|give\s+me|search(?: for)?|look\s+for|hanap\w*|who\s+are)\b.{0,50}\bdonors?\b|^compatible\s+donors?\b/i;

export function detectHemieActionIntent(message: string): HemieActionIntent | null {
  if (NON_ACTION_TASK.test(message)) return null;
  const text = message.trim().replace(/^(?:please|can\s+(?:you|hemie)|could\s+you|i\s+(?:want|need)\s+to|help\s+me|how\s+do\s+i)\s+/i, '');
  if (REQUEST_ACTION.test(text)) return 'create_request';
  if (URGENT_REQUEST_ACTION.test(text)) return 'urgent_requests';
  if (DONOR_ACTION.test(text)) return 'compatible_donors';
  return null;
}

function bloodTypeFromMessage(message: string): BloodType | null {
  const match = BLOOD_TYPE_IN_TEXT.exec(message);
  return match ? `${match[1].toUpperCase()}${match[2]}` as BloodType : null;
}

function profileLocation(profile: Profile) {
  if (
    profile?.latitude == null || profile.longitude == null ||
    !Number.isFinite(profile.latitude) || !Number.isFinite(profile.longitude) ||
    Math.abs(profile.latitude) > 90 || Math.abs(profile.longitude) > 180
  ) return null;
  return { latitude: profile.latitude, longitude: profile.longitude };
}

export async function resolveHemieAction(
  intent: HemieActionIntent,
  message: string,
  profile: Profile,
): Promise<HemieActionReply> {
  if (intent === 'create_request') {
    const bloodType = bloodTypeFromMessage(message) ?? undefined;
    return {
      message: 'I can open the BloodLink request form. Confirm the patient’s needed blood type, facility, location, units, and urgency there, then review the full request before posting it.',
      link: { label: 'Open request form', target: 'create_request', ...(bloodType ? { bloodType } : {}) },
    };
  }

  if (intent === 'compatible_donors') {
    const recipientType = bloodTypeFromMessage(message) ??
      (profile?.role === 'recipient' ? profile.blood_type : null);
    if (!recipientType) {
      return { message: 'Which blood type does the recipient need? Include it in your question, such as “Find compatible donors for A+.”' };
    }
    const location = profileLocation(profile);
    if (!location) {
      return { message: 'Set your location in Profile to search nearby donors, or open the Map tab and allow location access.' };
    }
    const { data, error } = await getNearbyMapDonors({
      originLatitude: location.latitude,
      originLongitude: location.longitude,
      radiusKm: 25,
      maxResults: 100,
      availableOnly: true,
    });
    if (error) throw new Error('Unable to load nearby donors. Please try again.');
    const compatible = (data ?? [])
      .filter((donor) => donor.isAvailable && donor.isVerified && isDonorCompatibleWithRecipient(donor.bloodType, recipientType))
      .slice(0, 3);
    const mapLink: HemieActionLink | undefined = profile?.role === 'recipient' && profile.blood_type === recipientType
      ? { label: 'Open Map', target: 'map' }
      : undefined;
    if (!compatible.length) {
      return { message: `No available, verified ${recipientType}-compatible donors appeared within 25 km of your saved location. Try again later; a blood bank must confirm any actual match.`, link: mapLink };
    }
    const lines = compatible.map((donor) =>
      `• ${donor.fullName} (${donor.bloodType}) — ${(donor.distanceMeters / 1000).toFixed(1)} km away`,
    );
    return {
      message: `Available verified donors whose red cells are generally compatible with ${recipientType}, within 25 km of your saved location:\n${lines.join('\n')}\nAvailability can change. A blood bank must confirm suitability and the actual match.`,
      link: mapLink,
    };
  }

  if (profile?.role !== 'donor') {
    return { message: 'Urgent blood requests are shown to donors. If you are registered as a donor, switch to Donate mode and open Requests.' };
  }
  const { data, error } = await getOpenBloodRequestsFeed();
  if (error) throw new Error('Unable to load urgent requests. Please try again.');
  const location = profileLocation(profile);
  const donorType = profile.blood_type;
  const nearbyOnly = /\b(near\s+me|nearby|malapit)\b/i.test(message);
  if (nearbyOnly && !location) {
    return { message: 'Set your location in Profile before searching for urgent requests near you.' };
  }
  const urgent = (data ?? [])
    .filter((request) => request.urgency === 'urgent' || request.urgency === 'critical')
    .filter((request) => !donorType || isDonorCompatibleWithRecipient(donorType, request.blood_type))
    .map((request) => ({
      request,
      distance: location && request.latitude != null && request.longitude != null
        ? haversineDistanceMeters(location, { latitude: request.latitude, longitude: request.longitude })
        : null,
    }))
    .filter((item) => !nearbyOnly || (item.distance != null && item.distance <= 25_000))
    .sort((a, b) => {
      if (a.request.urgency !== b.request.urgency) return a.request.urgency === 'critical' ? -1 : 1;
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      return new Date(b.request.created_at).getTime() - new Date(a.request.created_at).getTime();
    })
    .slice(0, 3);
  if (!urgent.length) {
    return { message: `No open ${nearbyOnly ? 'nearby ' : ''}urgent requests${donorType ? ` compatible with ${donorType}` : ''} are visible right now. Check the Requests tab for updates.`, link: { label: 'Open Requests', target: 'requests' } };
  }
  const lines = urgent.map(({ request, distance }) =>
    `• ${request.urgency.toUpperCase()} ${request.blood_type}: ${request.units_needed} unit${request.units_needed === 1 ? '' : 's'} at ${request.hospital_name}${distance == null ? '' : ` (${(distance / 1000).toFixed(1)} km)`}`,
  );
  return {
    message: `Open urgent requests${donorType ? ` compatible with your ${donorType} red cells` : ' (not filtered by blood type)'}:\n${lines.join('\n')}\nOpen Requests to check current details before responding.${donorType ? ' Compatibility does not confirm donation eligibility.' : ' Set your blood type in Profile to filter by compatibility.'}`,
    link: { label: 'View first request', target: 'request_detail', requestId: urgent[0].request.id },
  };
}
