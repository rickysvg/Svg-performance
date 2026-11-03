import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FORM_PLAYER_READY_MS,
  FORM_PLAYER_RETRY_MS,
  formClipFallbackLimitMs,
  formClipFallbackPhase,
  formEmbedBlocked,
  noteFormEmbedResult,
  releaseFormPlayer,
  resetFormEmbedBlocked,
} from "@/lib/form-player";

type Node = {
  parent: Node | null;
  children: Node[];
  firstChild: Node | null;
  appendChild(child: Node): Node;
  replaceChild(next: Node, old: Node): Node;
  removeChild(child: Node): Node;
};

function createNode(): Node {
  const node: Node = {
    parent: null,
    children: [],
    get firstChild() {
      return this.children[0] ?? null;
    },
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
      return child;
    },
    replaceChild(next, old) {
      const index = this.children.indexOf(old);
      if (index < 0) {
        const error = new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
        error.name = "NotFoundError";
        throw error;
      }
      old.parent = null;
      next.parent = this;
      this.children[index] = next;
      return old;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index < 0) {
        const error = new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
        error.name = "NotFoundError";
        throw error;
      }
      this.children.splice(index, 1);
      child.parent = null;
      return child;
    },
  };
  return node;
}

describe("form clip fallback", () => {
  it("keeps the still until the player is ready, then falls back at the timeout", () => {
    expect(formClipFallbackPhase({ ready: false, errored: false, elapsedMs: FORM_PLAYER_READY_MS - 1 })).toBe(
      "loading",
    );
    expect(formClipFallbackPhase({ ready: false, errored: false, elapsedMs: FORM_PLAYER_READY_MS })).toBe("failed");
    expect(formClipFallbackPhase({ ready: true, errored: false, elapsedMs: FORM_PLAYER_READY_MS })).toBe("ready");
    expect(formClipFallbackPhase({ ready: true, errored: true, elapsedMs: 0 })).toBe("failed");
  });

  it("retries the next clip on a shorter limit after one embed fails", () => {
    resetFormEmbedBlocked();
    expect(formClipFallbackLimitMs(formEmbedBlocked())).toBe(FORM_PLAYER_READY_MS);
    noteFormEmbedResult("failed");
    expect(formEmbedBlocked()).toBe(true);
    expect(formClipFallbackLimitMs(formEmbedBlocked())).toBe(FORM_PLAYER_RETRY_MS);
    expect(FORM_PLAYER_RETRY_MS).toBe(4000);
    expect(FORM_PLAYER_RETRY_MS).toBeLessThan(FORM_PLAYER_READY_MS);
    noteFormEmbedResult("ready");
    expect(formEmbedBlocked()).toBe(false);
    const player = readFileSync("src/components/training/FormClipPlayer.tsx", "utf8");
    expect(player).toContain("data-form-player-mount");
    expect(player).toContain("releaseFormPlayer");
    expect(player).toContain("new Player");
    expect(player).not.toContain("formEmbedBlocked()) return");
    expect(player).toContain("useSheetBehavior");
  });

  it("unmounts after YouTube replaces the player node", () => {
    const parent = createNode();
    const mount = createNode();
    parent.appendChild(mount);
    const slot = createNode();
    mount.appendChild(slot);
    const iframe = createNode();
    mount.replaceChild(iframe, slot);

    expect(() => mount.removeChild(slot)).toThrow(/removeChild/);

    let destroyed = false;
    releaseFormPlayer(mount, {
      destroy() {
        destroyed = true;
        if (iframe.parent === mount) mount.removeChild(iframe);
      },
    });

    expect(destroyed).toBe(true);
    expect(mount.firstChild).toBeNull();
    expect(() => parent.removeChild(mount)).not.toThrow();
    expect(parent.firstChild).toBeNull();
  });
});
