import Link from "next/link";

export function CoachFab({
  name,
  thumb,
  raised = false,
}: {
  name: string;
  thumb: string;
  raised?: boolean;
}) {
  return (
    <Link
      href="/coach"
      data-coach-fab
      data-coach-fab-raised={raised ? "" : undefined}
      aria-label={`Open SVG Coach. Your coach is ${name}.`}
      className="coach-fab"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt="" width={96} height={96} className="coach-fab-photo" />
    </Link>
  );
}
