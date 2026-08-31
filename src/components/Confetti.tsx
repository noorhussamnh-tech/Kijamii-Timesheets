import { useEffect, useRef } from "react";

/**
 * A short burst of confetti.
 *
 * Deliberately small: no library, no canvas, a few dozen absolutely positioned
 * pieces animated by the browser's own compositor and then removed. It renders
 * into a layer that ignores pointer events, so a celebration can never sit
 * between somebody and the button they were reaching for.
 *
 * It does nothing at all when the viewer has asked for reduced motion. That is
 * not a degraded experience -- for somebody with vestibular sensitivity,
 * confetti is the opposite of a reward.
 */
export function Confetti({ fire, palette }: { fire: boolean; palette: readonly string[] }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!fire || !node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pieces: HTMLSpanElement[] = [];
    const animations: Animation[] = [];

    for (let i = 0; i < 44; i += 1) {
      const piece = document.createElement("span");
      const color = palette[i % palette.length] ?? "#2a78d6";
      // Two shapes rather than one: a field of identical squares reads as a
      // loading state, not a celebration.
      const round = i % 3 === 0;
      piece.style.cssText = [
        "position:absolute",
        "top:-12px",
        `left:${5 + Math.random() * 90}%`,
        `width:${round ? 7 : 5}px`,
        `height:${round ? 7 : 11}px`,
        `background:${color}`,
        round ? "border-radius:50%" : "border-radius:1px",
        "will-change:transform,opacity",
      ].join(";");
      node.appendChild(piece);
      pieces.push(piece);

      const drift = (Math.random() - 0.5) * 260;
      const spin = 360 + Math.random() * 720;
      const duration = 2200 + Math.random() * 1400;

      animations.push(
        piece.animate(
          [
            { transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate3d(${drift * 0.6}px, 45vh, 0) rotate(${spin * 0.6}deg)`,
              opacity: 1,
              offset: 0.7,
            },
            {
              transform: `translate3d(${drift}px, 100vh, 0) rotate(${spin}deg)`,
              opacity: 0,
            },
          ],
          {
            duration,
            delay: Math.random() * 500,
            easing: "cubic-bezier(0.25, 0.6, 0.35, 1)",
            fill: "forwards",
          },
        ),
      );
    }

    // Everything is torn down on unmount too, so navigating away mid-burst
    // does not leave animations running against a detached tree.
    return () => {
      for (const animation of animations) animation.cancel();
      for (const piece of pieces) piece.remove();
    };
  }, [fire, palette]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    />
  );
}
