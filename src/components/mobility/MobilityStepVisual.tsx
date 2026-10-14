"use client";

import { useEffect, useState } from "react";
import { MobilityFigureFrame } from "@/components/mobility/MobilityFigure";
import { motionForBlock, poseAt } from "@/lib/mobility-motion";
import { figureForBlock, type FigureSpec } from "@/lib/mobility-poses";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MobilityStepVisual({
  blockKey,
  title,
  mirror = false,
}: {
  blockKey: string;
  title: string;
  mirror?: boolean;
}) {
  const still = figureForBlock(blockKey);
  const clip = motionForBlock(blockKey);
  const [pose, setPose] = useState<FigureSpec | null>(still);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const poseStill = figureForBlock(blockKey);
    const motion = motionForBlock(blockKey);
    if (!poseStill) return;
    let frame = 0;
    if (!motion || reducedMotion()) {
      frame = window.requestAnimationFrame(() => {
        setPose(poseStill);
        setPlaying(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const started = performance.now();
    let marked = false;
    const tick = (now: number) => {
      const progress = ((now - started) / 1000 / motion.seconds) % 1;
      setPose(poseAt(motion, poseStill, progress));
      if (!marked) {
        marked = true;
        setPlaying(true);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [blockKey]);

  if (!still || !pose) return null;
  const showMotion = Boolean(clip) && playing;
  return (
    <MobilityFigureFrame
      spec={pose}
      title={title}
      variant="hero"
      mirror={mirror}
      blockKey={blockKey}
      badge={showMotion ? `Short motion · ${clip?.seconds}s` : "Position demo"}
      motionSeconds={showMotion ? clip?.seconds : undefined}
    />
  );
}
