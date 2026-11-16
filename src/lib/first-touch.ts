/**
 * First-touch attribution. The browser stores one record for 30 days and
 * signup copies it onto the account. A later visit must not replace it.
 *
 * The cookie is host-only (no Domain attribute), so svgperformance.app and
 * svg-performance.vercel.app each keep the touch from the host that was landed on.
 */

export const FIRST_TOUCH_COOKIE = "svg_first_touch";
export const FIRST_TOUCH_DAYS = 30;
export const FIRST_TOUCH_MAX_AGE_SECONDS = FIRST_TOUCH_DAYS * 24 * 60 * 60;
export const FIRST_TOUCH_MAX_AGE_MS = FIRST_TOUCH_MAX_AGE_SECONDS * 1000;

export const ATTRIBUTION_LIMITS = {
  utm: 100,
  referrer: 300,
  landingPath: 200,
} as const;

/** Referrers from these hosts are the site itself, on either production host. */
export const OWN_ATTRIBUTION_HOSTS = ["svgperformance.app", "svg-performance.vercel.app"] as const;

const FUTURE_SKEW_MS = 5 * 60 * 1000;

const UTM_FIELDS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
  ["utm_term", "utmTerm"],
] as const;

export type FirstTouch = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  landingPath: string | null;
  firstTouchAt: string;
};

export type FirstTouchDecision =
  | { action: "keep"; record: FirstTouch }
  | { action: "write"; record: FirstTouch }
  | { action: "ignore" };

type ParamSource = string | URLSearchParams | Record<string, unknown> | null | undefined;

export function cleanAttributionString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

export function isOwnAttributionHost(hostname: unknown): boolean {
  if (typeof hostname !== "string") return false;
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (OWN_ATTRIBUTION_HOSTS as readonly string[]).includes(host);
}

/** Origin plus path. Query string and fragment are dropped. */
export function originAndPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return cleanAttributionString(`${url.origin}${url.pathname}`, ATTRIBUTION_LIMITS.referrer);
  } catch {
    return null;
  }
}

export function externalReferrer(referrer: unknown, pageUrl: unknown): string | null {
  const ref = originAndPath(referrer);
  if (!ref || typeof pageUrl !== "string" || !pageUrl.trim()) return null;
  let refUrl: URL;
  let page: URL;
  try {
    refUrl = new URL(ref);
    page = new URL(pageUrl);
  } catch {
    return null;
  }
  if (isOwnAttributionHost(refUrl.hostname)) return null;
  if (refUrl.origin === page.origin) return null;
  return ref;
}

export function landingPathFromPage(pageUrl: unknown): string | null {
  if (typeof pageUrl !== "string" || !pageUrl.trim()) return null;
  try {
    return cleanAttributionString(new URL(pageUrl).pathname || "/", ATTRIBUTION_LIMITS.landingPath);
  } catch {
    const path = pageUrl.trim().split(/[?#]/)[0] ?? "";
    if (!path.startsWith("/")) return null;
    return cleanAttributionString(path, ATTRIBUTION_LIMITS.landingPath);
  }
}

function readParam(source: ParamSource, key: string): unknown {
  if (typeof source === "string") {
    const query = source.startsWith("?") ? source.slice(1) : source;
    try {
      return new URLSearchParams(query).get(key);
    } catch {
      return null;
    }
  }
  if (source instanceof URLSearchParams) {
    return source.get(key);
  }
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const record = source as Record<string, unknown>;
    return record[key];
  }
  return null;
}

export function readUtmFields(source: ParamSource): Omit<FirstTouch, "referrer" | "landingPath" | "firstTouchAt"> {
  return {
    utmSource: cleanAttributionString(readParam(source, UTM_FIELDS[0][0]), ATTRIBUTION_LIMITS.utm),
    utmMedium: cleanAttributionString(readParam(source, UTM_FIELDS[1][0]), ATTRIBUTION_LIMITS.utm),
    utmCampaign: cleanAttributionString(readParam(source, UTM_FIELDS[2][0]), ATTRIBUTION_LIMITS.utm),
    utmContent: cleanAttributionString(readParam(source, UTM_FIELDS[3][0]), ATTRIBUTION_LIMITS.utm),
    utmTerm: cleanAttributionString(readParam(source, UTM_FIELDS[4][0]), ATTRIBUTION_LIMITS.utm),
  };
}

function hasCampaignSignal(fields: Pick<FirstTouch, "utmSource" | "utmMedium" | "utmCampaign">): boolean {
  return Boolean(fields.utmSource || fields.utmMedium || fields.utmCampaign);
}

export function buildFirstTouch(input: {
  search?: ParamSource;
  referrer?: unknown;
  pageUrl?: unknown;
  now?: Date;
}): FirstTouch | null {
  const utm = readUtmFields(input.search ?? "");
  const pageUrl = typeof input.pageUrl === "string" ? input.pageUrl : "";
  const referrer = externalReferrer(input.referrer, pageUrl);
  if (!hasCampaignSignal(utm) && !referrer) return null;
  const now = input.now ?? new Date();
  return {
    ...utm,
    referrer,
    landingPath: landingPathFromPage(pageUrl),
    firstTouchAt: now.toISOString(),
  };
}

export function serializeFirstTouch(record: FirstTouch): string {
  const payload: Record<string, string> = { firstTouchAt: record.firstTouchAt };
  const keys = [
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "utmTerm",
    "referrer",
    "landingPath",
  ] as const;
  for (const key of keys) {
    const value = record[key];
    if (value) payload[key] = value;
  }
  return JSON.stringify(payload);
}

function cleanStoredReferrer(value: unknown): string | null {
  const ref = originAndPath(value);
  if (!ref) return null;
  try {
    if (isOwnAttributionHost(new URL(ref).hostname)) return null;
  } catch {
    return null;
  }
  return ref;
}

export function parseStoredFirstTouch(raw: unknown, now = new Date()): FirstTouch | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let decoded = raw.trim();
  if (decoded.startsWith("%7B") || decoded.startsWith("%7b")) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
  }
  let data: unknown;
  try {
    data = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const stamp = cleanAttributionString(record.firstTouchAt, 40);
  if (!stamp) return null;
  const at = new Date(stamp);
  if (Number.isNaN(at.getTime())) return null;
  const age = now.getTime() - at.getTime();
  if (age < -FUTURE_SKEW_MS || age > FIRST_TOUCH_MAX_AGE_MS) return null;
  const parsed: FirstTouch = {
    utmSource: cleanAttributionString(record.utmSource, ATTRIBUTION_LIMITS.utm),
    utmMedium: cleanAttributionString(record.utmMedium, ATTRIBUTION_LIMITS.utm),
    utmCampaign: cleanAttributionString(record.utmCampaign, ATTRIBUTION_LIMITS.utm),
    utmContent: cleanAttributionString(record.utmContent, ATTRIBUTION_LIMITS.utm),
    utmTerm: cleanAttributionString(record.utmTerm, ATTRIBUTION_LIMITS.utm),
    referrer: cleanStoredReferrer(record.referrer),
    landingPath: landingPathFromPage(
      typeof record.landingPath === "string" && record.landingPath.startsWith("/")
        ? `https://svgperformance.app${record.landingPath.split(/[?#]/)[0]}`
        : record.landingPath,
    ),
    firstTouchAt: at.toISOString(),
  };
  if (!hasCampaignSignal(parsed) && !parsed.referrer) return null;
  return parsed;
}

export function resolveFirstTouch(input: {
  search?: ParamSource;
  referrer?: unknown;
  pageUrl?: unknown;
  existing?: unknown;
  now?: Date;
}): FirstTouchDecision {
  const now = input.now ?? new Date();
  const existing = parseStoredFirstTouch(input.existing, now);
  if (existing) return { action: "keep", record: existing };
  const record = buildFirstTouch({ search: input.search, referrer: input.referrer, pageUrl: input.pageUrl, now });
  if (!record) return { action: "ignore" };
  return { action: "write", record };
}

export function readCookieValue(header: unknown, name: string): string | null {
  if (typeof header !== "string" || !header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    const raw = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Host-only cookie. No Domain, so each production host keeps its own first touch. */
export function firstTouchSetCookie(record: FirstTouch, secure: boolean): string {
  const value = encodeURIComponent(serializeFirstTouch(record));
  const parts = [
    `${FIRST_TOUCH_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${FIRST_TOUCH_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function captureFirstTouchFromLocation(input: {
  href: string;
  referrer: string;
  cookieHeader: string;
  secure: boolean;
  now?: Date;
}): { cookie: string | null; record: FirstTouch | null } {
  let search = "";
  try {
    search = new URL(input.href).search;
  } catch {
    search = "";
  }
  const decision = resolveFirstTouch({
    search,
    referrer: input.referrer,
    pageUrl: input.href,
    existing: readCookieValue(input.cookieHeader, FIRST_TOUCH_COOKIE),
    now: input.now,
  });
  if (decision.action === "ignore") return { cookie: null, record: null };
  if (decision.action === "keep") return { cookie: null, record: decision.record };
  return { cookie: firstTouchSetCookie(decision.record, input.secure), record: decision.record };
}

export function captureBrowserFirstTouch(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    const result = captureFirstTouchFromLocation({
      href: window.location.href,
      referrer: document.referrer,
      cookieHeader: document.cookie,
      secure: window.location.protocol === "https:",
    });
    if (result.cookie) document.cookie = result.cookie;
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error("first-touch capture failed", name);
  }
}

/**
 * Runs in the root document before hydration, including /, /waitlist, and /register.
 * A click on an internal link must not get there before the first touch is stored.
 */
export const FIRST_TOUCH_BOOT_SCRIPT = `(function(){try{
var NAME=${JSON.stringify(FIRST_TOUCH_COOKIE)};
var MAX_AGE=${FIRST_TOUCH_MAX_AGE_SECONDS};
var UTM_MAX=${ATTRIBUTION_LIMITS.utm};
var REF_MAX=${ATTRIBUTION_LIMITS.referrer};
var PATH_MAX=${ATTRIBUTION_LIMITS.landingPath};
var OWN=${JSON.stringify([...OWN_ATTRIBUTION_HOSTS])};
function clean(value,max){if(typeof value!=="string")return null;var cleaned=value.replace(/[\\u0000-\\u001F\\u007F]/g,"").trim();if(!cleaned)return null;return cleaned.slice(0,max);}
function ownHost(hostname){if(typeof hostname!=="string")return false;var host=hostname.toLowerCase().replace(/\\.$/,"");for(var i=0;i<OWN.length;i++){if(OWN[i]===host)return true;}return false;}
function originPath(value){if(typeof value!=="string"||!value.trim())return null;try{var url=new URL(value.trim());if(url.protocol!=="http:"&&url.protocol!=="https:")return null;return clean(url.origin+url.pathname,REF_MAX);}catch(err){return null;}}
function externalReferrer(referrer,page){var ref=originPath(referrer);if(!ref)return null;try{var refUrl=new URL(ref);if(ownHost(refUrl.hostname))return null;if(refUrl.origin===page.origin)return null;return ref;}catch(err){return null;}}
function existingRaw(){var header=document.cookie||"";var parts=header.split(";");for(var i=0;i<parts.length;i++){var part=parts[i].replace(/^\\s+/,"");var eq=part.indexOf("=");if(eq<=0)continue;if(part.slice(0,eq)!==NAME)continue;var raw=part.slice(eq+1);try{return decodeURIComponent(raw);}catch(err){return raw;}}return "";}
function locked(raw){if(typeof raw!=="string"||!raw)return false;var data;try{data=JSON.parse(raw);}catch(err){return false;}if(!data||typeof data!=="object"||typeof data.firstTouchAt!=="string")return false;var at=new Date(data.firstTouchAt).getTime();if(typeof at!=="number"||at!==at)return false;var age=Date.now()-at;if(age<-300000||age>MAX_AGE*1000)return false;if(clean(data.utmSource,UTM_MAX)||clean(data.utmMedium,UTM_MAX)||clean(data.utmCampaign,UTM_MAX))return true;var ref=originPath(data.referrer);if(!ref)return false;try{if(ownHost(new URL(ref).hostname))return false;}catch(err){return false;}return true;}
if(locked(existingRaw()))return;
var page;try{page=new URL(location.href);}catch(err){return;}
function utm(key){return clean(page.searchParams.get(key),UTM_MAX);}
var utmSource=utm("utm_source");var utmMedium=utm("utm_medium");var utmCampaign=utm("utm_campaign");var utmContent=utm("utm_content");var utmTerm=utm("utm_term");
var ref=externalReferrer(document.referrer,page);
if(!utmSource&&!utmMedium&&!utmCampaign&&!ref)return;
var payload={firstTouchAt:new Date().toISOString()};
if(utmSource)payload.utmSource=utmSource;if(utmMedium)payload.utmMedium=utmMedium;if(utmCampaign)payload.utmCampaign=utmCampaign;if(utmContent)payload.utmContent=utmContent;if(utmTerm)payload.utmTerm=utmTerm;
if(ref)payload.referrer=ref;
var path=clean(page.pathname||"/",PATH_MAX);if(path)payload.landingPath=path;
var cookie=NAME+"="+encodeURIComponent(JSON.stringify(payload))+"; Path=/; Max-Age="+MAX_AGE+"; SameSite=Lax";
if(location.protocol==="https:")cookie+="; Secure";
document.cookie=cookie;
}catch(e){}})();`;
