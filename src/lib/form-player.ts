/** How long the still stays up before we treat the embed as blocked or missing. */
export const FORM_PLAYER_READY_MS = 8000;
/** A later clip still tries the embed, with enough time for a slow but working network. */
export const FORM_PLAYER_RETRY_MS = 4000;

let embedBlocked = false;

/** The previous clip failed. The next one still mounts a player. */
export function formEmbedBlocked() {
  return embedBlocked;
}

export function noteFormEmbedResult(result: "ready" | "failed") {
  embedBlocked = result === "failed";
}

export function resetFormEmbedBlocked() {
  embedBlocked = false;
}

export function formClipFallbackLimitMs(previousBlocked = false) {
  return previousBlocked ? FORM_PLAYER_RETRY_MS : FORM_PLAYER_READY_MS;
}

export function formClipFallbackPhase(input: {
  ready: boolean;
  errored: boolean;
  elapsedMs: number;
  limitMs?: number;
}): "loading" | "ready" | "failed" {
  if (input.errored) return "failed";
  if (input.ready) return "ready";
  if (input.elapsedMs >= (input.limitMs ?? FORM_PLAYER_READY_MS)) return "failed";
  return "loading";
}

/**
 * YouTube's player replaces the element it was given with an iframe.
 * That node is not one React rendered. Destroy the player, then remove
 * whatever is left, so React can unmount the wrapper without removeChild.
 */
export function releaseFormPlayer(
  mount: { firstChild: unknown; removeChild(child: unknown): unknown },
  player: { destroy?: () => void } | null,
) {
  try {
    player?.destroy?.();
  } catch {
    // The iframe may already have been detached.
  }
  while (mount.firstChild) {
    mount.removeChild(mount.firstChild);
  }
}
