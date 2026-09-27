"use client";

import { useEffect } from "react";
import { markFormCheckSeenAction } from "@/app/actions/form-check";

export function FormCheckSeenMarker({ unseen }: { unseen: number }) {
  useEffect(() => {
    if (unseen > 0) {
      void markFormCheckSeenAction();
    }
  }, [unseen]);
  return null;
}
