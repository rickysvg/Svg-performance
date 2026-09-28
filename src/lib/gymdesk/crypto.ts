import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { gymdeskMatchPepper } from "@/lib/gymdesk/config";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeNamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function firstInitial(firstName: string) {
  const part = normalizeNamePart(firstName);
  return part ? part[0] : "";
}

export function nameMatchKey(lastName: string, firstName: string) {
  const last = normalizeNamePart(lastName);
  const initial = firstInitial(firstName);
  if (!last || !initial) return "";
  return `${last}|${initial}`;
}

export function displayLabel(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  if (first && last) return `${first} ${last[0]!.toUpperCase()}.`;
  return first || last || "Member";
}

export function toE164(value: string, defaultCountry: "US" = "US") {
  const raw = value.trim();
  if (!raw) return "";
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed || !parsed.isValid()) return "";
  return parsed.format("E.164");
}

export function hmacValue(value: string, pepper = gymdeskMatchPepper()) {
  const normalized = value.trim();
  if (!normalized || !pepper) return "";
  return createHmac("sha256", pepper).update(normalized).digest("hex");
}

export function hashEmail(value: string) {
  const email = normalizeEmail(value);
  return email ? hmacValue(email) : "";
}

export function hashPhone(value: string) {
  const e164 = toE164(value);
  return e164 ? hmacValue(e164) : "";
}

export function hashNameKey(lastName: string, firstName: string) {
  const key = nameMatchKey(lastName, firstName);
  return key ? hmacValue(key) : "";
}

export function hashCode(code: string) {
  const pepper = process.env.AUTH_SECRET || "email-code";
  return createHash("sha256").update(`${pepper}:email-code:${code}`).digest("hex");
}

export function rateKeyHash(scope: string, value: string) {
  const pepper = process.env.AUTH_SECRET || "gymdesk-rate";
  return createHash("sha256").update(`${pepper}:${scope}:${value}`).digest("hex");
}

export function timingSafeEqualString(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(a.length || 1);
    timingSafeEqual(a.length ? a : dummy, dummy);
    return false;
  }
  return timingSafeEqual(a, b);
}
