import { SPRINT_NO_BIKE } from "@/lib/bike-sessions";

export function BikeZoneNote({
  zone,
}: {
  zone: { label: string; guide: string; alternative?: typeof SPRINT_NO_BIKE };
}) {
  return (
    <div className="rounded-2xl bg-black px-4 py-3 text-sm text-white">
      <p className="font-display uppercase tracking-wide text-highlighter">{zone.label}</p>
      <p className="mt-1 text-white/80">{zone.guide}</p>
      {zone.alternative ? (
        <div className="mt-2 space-y-1 text-xs text-white/70">
          <p>{zone.alternative.text}</p>
          {zone.alternative.posts.map((post) => (
            <p key={post.url}>
              Idea seen in a post by {zone.alternative?.handle}.{" "}
              <a
                href={post.url}
                className="text-highlighter underline"
                target="_blank"
                rel="noreferrer"
              >
                Their post
              </a>{" "}
              ({post.idea}).
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
