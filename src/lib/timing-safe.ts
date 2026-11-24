import { timingSafeEqual } from "node:crypto";

/** Compares two strings without leaking the secret through an early length return. */
export function timingSafeEqualString(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const length = Math.max(a.length, b.length, 1);
  const aBuf = Buffer.alloc(length);
  const bBuf = Buffer.alloc(length);
  a.copy(aBuf);
  b.copy(bBuf);
  return timingSafeEqual(aBuf, bBuf) && a.length === b.length;
}
