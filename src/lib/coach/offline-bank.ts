export type OfflineBankEntry = {
  id: string;
  match: RegExp[];
  answer: string;
};

const CAGE_FOREARM_FRAME = [
  "Short answer: Yes. A forearm or elbow frame on the jaw is legal when you are pushing, not striking.",
  "Position: You are pinned on the cage in the clinch, chest to chest, often with an underhook.",
  "Steps: 1. Win an underhook on one side if you can. 2. Slide the forearm across the jaw or chin. Keep the elbow tight, on bone, not the throat. 3. Push the head away and turn it. 4. Step the hips off the fence at an angle, then circle out or pummel. 5. Keep your head tight to theirs.",
  "Common mistakes: a straight arm gets dragged, so bend the elbow to the ribs. Framing the chest collapses, so use the jaw. Fingers toward the eyes are a foul. Grabbing the fence is a foul too.",
  "Drill: Partner pins you on the wall for 5 rounds of 30 seconds. Frame, turn the head, angle off. Go cooperative, then half speed, then live positional with a coach watching. No unsupervised hard sparring.",
  "Rules check: Framing and pushing are not a strike and are legal. Pulling the elbow back and driving it in is an elbow strike: legal under pro rules except to the back of the head, and most amateur rule sets ban elbows. A 12-6 elbow was removed as an ABC foul in 2024, and not every commission has adopted that. Check your commission or promotion.",
].join("\n\n");

export const OFFLINE_BANK: OfflineBankEntry[] = [
  {
    id: "cage-forearm-frame",
    match: [/(?:cage|fence|wall)/i, /(?:elbow|forearm|frame)/i, /(?:jaw|chin|face|head)/i],
    answer: CAGE_FOREARM_FRAME,
  },
];

export function matchOfflineBank(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  for (const entry of OFFLINE_BANK) {
    if (entry.match.every((pattern) => pattern.test(text))) return entry.answer;
  }
  return null;
}
