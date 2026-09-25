"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { persistDetectedTimeZoneAction } from "@/app/actions/profile";
import { TIMEZONE_COOKIE, isValidTimeZone } from "@/lib/timezone";

function writeTimeZoneCookie(timeZone: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(timeZone)};path=/;max-age=${maxAge};samesite=lax`;
}

export function TimeZoneSync({ savedTimeZone }: { savedTimeZone?: string | null }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (savedTimeZone && isValidTimeZone(savedTimeZone)) {
      writeTimeZoneCookie(savedTimeZone);
      return;
    }
    if (!isValidTimeZone(detected)) return;
    writeTimeZoneCookie(detected);
    void persistDetectedTimeZoneAction(detected).then((changed) => {
      if (changed) router.refresh();
    });
  }, [savedTimeZone, router]);

  return null;
}
