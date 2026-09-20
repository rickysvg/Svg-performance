export default function CoachStubPage() {
  return (
    <main className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">
        Placeholder — Milestone 2
      </p>
      <h1 className="text-2xl font-semibold">Coach Savage AI</h1>
      <p className="text-sm text-muted">
        Text chat with safety rails is planned later. The knowledge base is
        empty on purpose. This screen does not give training, medical, or
        weight-cut advice.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
        <li>It will not claim to be Ricky writing each reply.</li>
        <li>It will not invent rapid weight-cut or dehydration protocols.</li>
        <li>It will only use the signed-in member&apos;s own records.</li>
      </ul>
    </main>
  );
}
