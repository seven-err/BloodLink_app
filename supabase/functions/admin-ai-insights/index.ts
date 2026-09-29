import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Admin AI Insights — Groq advisory from deterministic analytics only.
 *
 * Security:
 *  - JWT required (verify_jwt)
 *  - Admin role enforced via profiles.role
 *  - Re-fetches get_admin_predictive_analytics() with caller JWT (no client-trusted stats)
 *  - Groq key stays server-side (HEMIE_LLM_API_KEY)
 *  - Read-only: no inventory / request / match / donation mutations
 *
 * Each call uses the current snapshot. Later weeks of inventory, requests, and
 * donations are picked up on the next refresh — the model must not invent them.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b'];
const LLM_TIMEOUT_MS = 30_000;
const RETIRED_GROQ_MODELS = new Set([
  'llama3-8b-8192',
  'llama3-70b-8192',
  'gemma-7b-it',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
]);

type Json = Record<string, unknown>;

const jsonResponse = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function validateRecommendations(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI returned a malformed recommendations object.');
  }
  const obj = raw as Record<string, unknown>;
  const draft = (obj.emergency_message_draft ?? {}) as Record<string, unknown>;

  const situation = asString(obj.situation_summary).trim();
  const outlook = asString(obj.prediction_outlook).trim();
  const interventions = asStringArray(obj.intervention_strategies)
    .map((s) => s.trim())
    .filter(Boolean);
  const campaigns = asStringArray(obj.prevention_campaigns)
    .map((s) => s.trim())
    .filter(Boolean);
  const title = asString(draft.title).trim();
  const body = asString(draft.body).trim();
  const caveats = asStringArray(obj.caveats).map((s) => s.trim()).filter(Boolean);

  if (
    !situation
    || !outlook
    || interventions.length === 0
    || campaigns.length === 0
    || !title
    || !body
  ) {
    throw new Error('AI recommendations failed validation (missing required fields).');
  }

  return {
    situation_summary: situation,
    prediction_outlook: outlook.slice(0, 800),
    intervention_strategies: interventions.slice(0, 6),
    prevention_campaigns: campaigns.slice(0, 6),
    emergency_message_draft: {
      title: title.slice(0, 120),
      body: body.slice(0, 500),
      target_blood_types: asStringArray(draft.target_blood_types).slice(0, 8),
      target_areas: asStringArray(draft.target_areas).slice(0, 8),
    },
    caveats: caveats.length
      ? caveats.slice(0, 6)
      : ['Recommendations are advisory only and are not medical directives.'],
  };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function trimDraft(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const sentence = cut.lastIndexOf('. ');
  return `${(sentence > 40 ? cut.slice(0, sentence + 1) : cut).trim()}…`;
}

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Replace model wording with counts copied from the analytics snapshot. */
function buildVerifiedEmergencyDraft(analytics: Json) {
  const risk = (analytics.risk ?? {}) as Json;
  const geography = (analytics.geography ?? {}) as Json;
  const rows = Array.isArray(risk.by_blood_type) ? risk.by_blood_type : [];
  const typed = rows.map((row) => {
    const r = (row ?? {}) as Json;
    return {
      blood_type: asString(r.blood_type),
      risk_level: asString(r.risk_level),
      inventory_units: asCount(r.inventory_units),
      critical_rows: asCount(r.critical_rows),
      low_rows: asCount(r.low_rows),
      recent_gap: asCount(r.recent_gap),
    };
  }).filter((row) => row.blood_type);

  const critical = typed.filter((row) => row.critical_rows > 0);
  const lowOnly = typed.filter((row) => row.critical_rows === 0 && row.low_rows > 0);
  const gapOnly = typed.filter((row) =>
    row.critical_rows === 0
    && row.low_rows === 0
    && (row.risk_level === 'high' || row.risk_level === 'moderate')
  );
  const targets = [...critical, ...lowOnly, ...gapOnly];
  const targetTypes = targets.map((row) => row.blood_type);
  const stableOnHand = typed.filter((row) =>
    row.inventory_units > 0 && !targetTypes.includes(row.blood_type)
  );
  const areas = [...new Set(
    (Array.isArray(geography.sites) ? geography.sites : [])
      .map((row) => (row ?? {}) as Json)
      .filter((site) => site.shortage_risk === 'high' || site.shortage_risk === 'moderate')
      .map((site) => asString(site.branch_location) || asString(site.display_name))
      .map((name) => name.trim())
      .filter(Boolean),
  )].slice(0, 8);

  const hospital = 'Cebu Provincial Hospital - Bogo City';
  const areasWithHospital = areas.includes(hospital) ? areas : [hospital, ...areas].slice(0, 8);

  if (targets.length === 0) {
    const onHand = stableOnHand.map((row) => `${row.blood_type} ${row.inventory_units}`).join(', ');
    return {
      title: 'No emergency shortage in current records',
      body: trimDraft(
        `${hospital} has no critical or low stock in this snapshot. ${onHand ? `Bags on hand: ${onHand}.` : ''}`.trim(),
        500,
      ),
      target_blood_types: [] as string[],
      target_areas: areasWithHospital,
    };
  }

  const parts: string[] = [];
  if (critical.length > 0) {
    parts.push(`Critical stock: ${joinList(critical.map((row) => `${row.blood_type} (${row.inventory_units} bags)`))}.`);
  }
  if (lowOnly.length > 0) {
    parts.push(`Low stock: ${joinList(lowOnly.map((row) => `${row.blood_type} (${row.inventory_units} bags)`))}.`);
  }
  if (gapOnly.length > 0) {
    parts.push(`Request gap without a critical or low stock row: ${joinList(gapOnly.map((row) => `${row.blood_type} (${row.inventory_units} bags on hand, recent gap ${row.recent_gap})`))}.`);
  }
  if (stableOnHand.length > 0) {
    parts.push(`Still on hand: ${joinList(stableOnHand.map((row) => `${row.blood_type} ${row.inventory_units}`))}.`);
  }
  const details = trimDraft(parts.join(' '), 360);
  const closing = 'Please donate today or share this alert with eligible donors.';
  const title = critical.length > 0
    ? 'Urgent Blood Shortage – Immediate Help Needed'
    : 'Blood donation needed – stock is low';
  return {
    title,
    body: trimDraft(`${hospital} needs eligible donors now. ${details} ${closing}`, 500),
    target_blood_types: targetTypes.slice(0, 8),
    target_areas: areasWithHospital,
  };
}

function buildAiSafePayload(analytics: Json) {
  const facts = (analytics.facts ?? {}) as Json;
  const inventory = (facts.inventory ?? {}) as Json;
  const recent = (facts.recent_activity ?? {}) as Json;
  const forecast = (analytics.forecast ?? {}) as Json;
  const history = Array.isArray(forecast.history)
    ? forecast.history.map((row) => {
      const r = (row ?? {}) as Json;
      return {
        week_start: r.week_start,
        units_requested: r.units_requested,
        request_count: r.request_count,
        units_completed: r.units_completed,
        completed_count: r.completed_count,
      };
    })
    : [];
  const risk = (analytics.risk ?? {}) as Json;
  const geography = (analytics.geography ?? {}) as Json;
  const quality = (analytics.data_quality ?? {}) as Json;

  const recentByType = Array.isArray(recent.by_blood_type)
    ? recent.by_blood_type.map((row) => {
      const r = (row ?? {}) as Json;
      return {
        blood_type: r.blood_type,
        units_requested: r.units_requested,
        units_completed: r.units_completed,
        supply_demand_gap: r.supply_demand_gap,
        urgent_count: r.urgent_count,
      };
    })
    : [];

  const riskByType = Array.isArray(risk.by_blood_type)
    ? risk.by_blood_type.map((row) => {
      const r = (row ?? {}) as Json;
      return {
        blood_type: r.blood_type,
        risk_level: r.risk_level,
        inventory_units: r.inventory_units,
        critical_rows: r.critical_rows,
        low_rows: r.low_rows,
        recent_units_requested: r.recent_units_requested,
        recent_units_completed: r.recent_units_completed,
        recent_gap: r.recent_gap,
      };
    })
    : [];

  const sites = Array.isArray(geography.sites)
    ? geography.sites.map((row) => {
      const r = (row ?? {}) as Json;
      return {
        display_name: r.display_name,
        branch_location: r.branch_location,
        total_units: r.total_units,
        critical_count: r.critical_count,
        low_count: r.low_count,
        shortage_risk: r.shortage_risk,
      };
    })
    : [];

  return {
    generated_at: analytics.generated_at,
    facts: {
      inventory: {
        total_units: inventory.total_units,
        banks_tracked: inventory.banks_tracked,
        banks_with_critical: inventory.banks_with_critical,
        banks_with_low: inventory.banks_with_low,
        critical_rows: inventory.critical_rows,
        low_rows: inventory.low_rows,
        by_blood_type: inventory.by_blood_type,
      },
      recent_activity: {
        window_days: recent.window_days,
        request_count: recent.request_count,
        units_requested: recent.units_requested,
        open_request_count: recent.open_request_count,
        completed_donations: recent.completed_donations,
        units_completed: recent.units_completed,
        by_blood_type: recentByType,
      },
    },
    forecast: {
      methodology: forecast.methodology,
      horizon_weeks: forecast.horizon_weeks,
      min_weeks_required: forecast.min_weeks_required,
      history,
      demand: forecast.demand,
      supply: forecast.supply,
      summary: forecast.summary,
    },
    risk: {
      methodology: risk.methodology,
      overall: risk.overall,
      high_risk_blood_types: risk.high_risk_blood_types,
      by_blood_type: riskByType,
    },
    geography: {
      included_sites: geography.included_sites,
      excluded_missing_coordinates: geography.excluded_missing_coordinates,
      note: geography.note,
      sites,
    },
    data_quality: quality,
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('AI response did not contain a JSON object.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function groqModels(): { baseUrl: string; models: string[] } {
  const baseUrl = (Deno.env.get('HEMIE_LLM_BASE_URL') || DEFAULT_GROQ_BASE_URL)
    .trim()
    .replace(/\/$/, '');
  const configured = (Deno.env.get('HEMIE_LLM_MODEL') || '').trim();
  const fallbacks = (Deno.env.get('HEMIE_LLM_FALLBACK_MODELS') || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((model) => model && !RETIRED_GROQ_MODELS.has(model));
  const primary = !configured || RETIRED_GROQ_MODELS.has(configured)
    ? DEFAULT_GROQ_MODEL
    : configured;
  return {
    baseUrl,
    models: [...new Set([primary, ...fallbacks, ...DEFAULT_GROQ_FALLBACK_MODELS])],
  };
}

function extractGroqText(payload: {
  choices?: Array<{
    message?: { content?: string | Array<{ text?: string }> };
  }>;
}): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || '').filter(Boolean).join('\n').trim();
  }
  return '';
}

async function callGroq(apiKey: string, model: string, baseUrl: string, prompt: string) {
  const reasoning = /^openai\/gpt-oss-/i.test(model);
  const messages = [
    {
      role: 'system',
      content:
        'You are Hemie, BloodLink’s advisory assistant for administrators. You produce operational recommendations from aggregated analytics only. '
        + 'You are NOT a doctor. Do not diagnose, prescribe, or issue medical directives. '
        + 'Do not invent counts, blood types, sites, or future weeks that are not in the JSON. '
        + 'The JSON is the current snapshot. Later refreshes will include more inventory, request, and donation weeks when they exist. '
        + 'If a forecast is marked insufficient, say the outlook is provisional and will sharpen as more weekly records arrive. '
        + 'If data_quality limitations are present, acknowledge them in caveats. '
        + 'Return ONLY valid JSON matching the required schema. The emergency message is a donor-facing alert that staff may send. Do not say it is a draft or that it was not sent.',
    },
    { role: 'user', content: prompt },
  ];

  const request = async (jsonMode: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: reasoning ? 2500 : 1200,
          ...(reasoning ? { reasoning_effort: 'low' } : {}),
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          stream: false,
          messages,
        }),
      });
      const payload = await response.json().catch(() => null);
      return { response, payload };
    } finally {
      clearTimeout(timer);
    }
  };

  let { response, payload } = await request(true);
  if (!response.ok && response.status === 400) {
    ({ response, payload } = await request(false));
  }

  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || `Groq request failed with status ${response.status}`;
    const err = new Error(String(message));
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  const text = extractGroqText(payload ?? {})
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .trim();
  if (!text) {
    throw new Error('Groq returned an empty reply.');
  }
  return text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    return jsonResponse({ error: 'Admin access required' }, 403);
  }

  const { data: analyticsRaw, error: analyticsError } = await userClient.rpc(
    'get_admin_predictive_analytics',
  );

  if (analyticsError) {
    return jsonResponse({ error: analyticsError.message || 'Analytics failed' }, 403);
  }

  const analytics = (analyticsRaw ?? {}) as Json;
  const quality = (analytics.data_quality ?? {}) as Json;
  const limitations = Array.isArray(quality.limitations) ? quality.limitations : [];

  // If almost nothing is known, do not invent AI narrative.
  const noSignal =
    !quality.has_recent_requests
    && !quality.has_inventory_rows
    && !quality.has_completed_donations;

  if (noSignal) {
    return jsonResponse({
      status: 'insufficient_data',
      message: 'Insufficient historical data for reliable AI recommendations.',
      analytics_generated_at: analytics.generated_at ?? null,
      limitations,
    });
  }

  const apiKey = (Deno.env.get('HEMIE_LLM_API_KEY') || '').trim();
  if (!apiKey || apiKey.toLowerCase() === 'ollama') {
    return jsonResponse({
      status: 'ai_unavailable',
      message:
        'Hemie recommendations are not configured on the server (missing API key). Deterministic analytics remain available in the admin UI.',
      analytics_generated_at: analytics.generated_at ?? null,
    });
  }

  const safePayload = buildAiSafePayload(analytics);
  const prompt =
    `Using ONLY the following aggregated BloodLink analytics JSON, produce an advisory insight and a prediction outlook.\n`
    + `Do not invent counts, blood types, or locations that are not supported by the JSON.\n`
    + `prediction_outlook must restate the forecast only when demand.sufficient or supply.sufficient is true. `
    + `If either is false, say that weekly prediction is not reliable yet and will improve when more request and donation weeks arrive.\n`
    + `If limitations exist, mention them in caveats.\n`
    + `Write plain staff-friendly language (shortage, bags, risk level — no ML jargon).\n`
    + `Name the sending hospital as "Cebu Provincial Hospital - Bogo City" in the emergency message. Do not call the message a draft.\n\n`
    + `Required JSON schema:\n`
    + `{\n`
    + `  "situation_summary": string,\n`
    + `  "prediction_outlook": string,\n`
    + `  "intervention_strategies": string[],\n`
    + `  "prevention_campaigns": string[],\n`
    + `  "emergency_message_draft": {\n`
    + `    "title": string,\n`
    + `    "body": string,\n`
    + `    "target_blood_types": string[],\n`
    + `    "target_areas": string[]\n`
    + `  },\n`
    + `  "caveats": string[]\n`
    + `}\n\n`
    + `Analytics JSON:\n${JSON.stringify(safePayload)}`;

  const { baseUrl, models } = groqModels();

  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const text = await callGroq(apiKey, model, baseUrl, prompt);
      const parsed = extractJsonObject(text);
      const recommendations = validateRecommendations(parsed);
      recommendations.emergency_message_draft = buildVerifiedEmergencyDraft(analytics);
      return jsonResponse({
        status: 'ok',
        provider: 'hemie',
        model,
        analytics_generated_at: analytics.generated_at ?? null,
        recommendations,
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const status = (lastError as Error & { status?: number }).status;
      const retryable = status === 400 || status === 404 || status === 429 || status === 503 || status == null;
      if (!retryable) {
        break;
      }
    }
  }

  return jsonResponse({
    status: 'malformed',
    error: lastError?.message || 'AI recommendations failed.',
  }, 502);
});
