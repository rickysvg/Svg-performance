import { requireUser } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { PaywallNotice } from "@/components/PaywallNotice";
import { getOrCreateThread, isOpenAiConfigured } from "@/lib/coach/chat";
import { CoachChatForm } from "@/components/coach/CoachChatForm";
import { EmptyState } from "@/components/EmptyState";

export default async function CoachPage() {
  const user = await requireUser();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    return <PaywallNotice feature="Coach Savage AI" />;
  }
  const thread = await getOrCreateThread(user.id);
  const live = isOpenAiConfigured();

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          {live ? "Live model + safety rails" : "DEMO / offline mode"}
        </p>
        <h1 className="text-2xl font-semibold">Coach Savage AI</h1>
        <p className="mt-2 text-sm text-muted">
          This is an AI helper inspired by SVG coaching principles. It does{" "}
          <strong className="text-foreground">not</strong> claim Ricky wrote
          each reply. It will refuse pain, concussion, medical, shame, rapid
          weight-cut, and other-member record requests.
        </p>
      </div>
      <div className="space-y-3">
        {thread.messages.length === 0 ? (
          <EmptyState title="Ask Coach Savage AI">
            Try a missed class, a simple technique cue, or how heavy a lift should
            feel. For live eyes, talk to a coach on the floor. Safety rails still
            refuse pain, medical, and weight-cut asks — even offline.
          </EmptyState>
        ) : (
          thread.messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-2xl border p-4 text-sm ${
                message.role === "user"
                  ? "border-line bg-background"
                  : "border-accent/30 bg-card"
              }`}
            >
              <p className="text-xs uppercase text-muted">
                {message.role === "user" ? "You" : "Coach Savage AI"}
                {message.refused ? " · safety refusal" : ""}
                {message.offline ? " · offline" : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
            </article>
          ))
        )}
      </div>
      <CoachChatForm />
    </main>
  );
}
