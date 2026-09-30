const DONATION_OR_APP_TOPIC = /\b(blood\s*links?|hemie|blood|dugo|donat\w*|donor|transfus\w*|platelet\w*|plasma|bloodbank|blood\s*bank|abo|rh\s*factor|eligib\w*|screening|recipient|requests?|availability|profile|qr\s*(?:code|verif\w*)|matching|compatible|map\s*tab|messages?|chat|account|password|settings|notifications?|(?:this|the)\s+app)\b/i;
const OTHER_TASK = /\b(what(?:'s| is) the weather|weather forecast|forecast for|recipe|crypto|bitcoin|stock\s+(?:market|price)|homework|essay|poem|joke|movie|minecraft|fortnite|president|capital\s+of|write\s+(?:me\s+)?(?:code|python|javascript|a\s+(?:story|poem|song|essay))|solve\s+(?:this\s+)?(?:equation|math))\b/i;
const CONTINUATION = /^(?:yes|yeah|yep|okay|ok|sure|next|continue|go on|and then|what about that|how do i do that|tell me more|why|how|what about after|sige|oo|opo|susunod|tuloy|paano|ngano)[.!?]*$/i;
const EMERGENCY = /\b(chest pain|can'?t breathe|not breathing|unconscious|severe bleeding|stroke|heart attack|hirap huminga|atake sa puso|matinding pagdurugo|nawalan ng malay)\b/i;

function isHemieInScope(message, history = []) {
  const text = String(message || '').trim();
  if (!text || OTHER_TASK.test(text)) return false;
  if (DONATION_OR_APP_TOPIC.test(text)) return true;
  if (!CONTINUATION.test(text)) return false;
  const previous = [...history].reverse().find((entry) => entry?.role === 'user' && !isHemieContinuation(entry.content));
  return Boolean(previous && DONATION_OR_APP_TOPIC.test(previous.content) && !OTHER_TASK.test(previous.content));
}

function isHemieContinuation(message) {
  return CONTINUATION.test(String(message || '').trim());
}

function isHemieEmergency(message) {
  return EMERGENCY.test(String(message || ''));
}

function hemieEmergencyReply(message) {
  return /\b(hirap huminga|atake sa puso|matinding pagdurugo|nawalan ng malay)\b/i.test(message)
    ? 'Mukhang emergency ito. Tumawag agad sa lokal na emergency services o humingi ng agarang tulong sa healthcare personnel.'
    : 'This may be an emergency. Contact local emergency services or healthcare personnel immediately.';
}

function hemieScopeReply(message) {
  return /\b(ano|paano|pwede|maaari|dugo|sige|opo|tulong|tabang|unsa|ngano)\b/i.test(message)
    ? 'Makakatulong lang ako sa BloodLink at blood donation. Subukang magtanong tungkol sa pag-donate, blood types, o paggamit ng BloodLink.'
    : 'I can only help with BloodLink and blood donation. Try asking about donating, blood types, or using BloodLink.';
}

module.exports = { hemieEmergencyReply, hemieScopeReply, isHemieContinuation, isHemieEmergency, isHemieInScope };
