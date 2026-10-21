"use client";

import { useActionState, useState } from "react";
import { saveCustomBagWorkoutAction, type BagworkFormState } from "@/app/actions/bagwork";
import { BagBodyMap } from "@/components/bagwork/BagBodyMap";
import { parseBagRegions, type BagRegion } from "@/lib/bag-body";

const initial: BagworkFormState = {};

export function CustomBagForm({
  id = "",
  name = "",
  description = "",
  regions = "",
}: {
  id?: string;
  name?: string;
  description?: string;
  regions?: string;
}) {
  const [state, action, pending] = useActionState(saveCustomBagWorkoutAction, initial);
  const [selected, setSelected] = useState<BagRegion[]>(() => parseBagRegions(regions));

  function toggle(region: BagRegion) {
    setSelected((current) =>
      current.includes(region) ? current.filter((item) => item !== region) : [...current, region],
    );
  }

  return (
    <form action={action} className="space-y-4" data-custom-bag-form>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="regions" value={selected.join(",")} />
      <label className="block text-sm">
        Name
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={name}
          placeholder="Southpaw teeps"
          className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Description
        <textarea
          name="description"
          maxLength={500}
          rows={4}
          defaultValue={description}
          placeholder="What you are working, and how you want the rounds to feel."
          className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-3"
        />
      </label>
      <BagBodyMap regions={selected} interactive onToggle={toggle} />
      {state.error ? <p className="text-sm text-signal">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-display text-sm uppercase tracking-wide text-black"
      >
        {pending ? "Saving" : "Save workout"}
      </button>
    </form>
  );
}
