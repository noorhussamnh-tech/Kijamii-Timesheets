import { useEffect, useRef } from "react";

/**
 * A short burst of confetti.
 *
 * Deliberately small: no library, no canvas, a few dozen absolutely positioned
 * pieces animated by the browser's own compositor and then removed.
 *
 * Two details are load-bearing rather than incidental.
 *
 * It appends its layer straight to document.body. `position: fixed` is
 * measured against the nearest ancestor carrying a transform, filter or
 * backdrop-filter rather than the viewport, so a burst rendered inside the
 * page could be quietly trapped inside a blurred header or an animated card.
 * From the body there is nothing above it to trap it.
 *
 * And the effect depends on `fire` alone. The palette arrives as a fresh array
 * on every render, so depending on it meant every unrelated re-render -- an
 * autosave tick, a keystroke -- tore the animation down and started it again.
 * The pieces never got far enough to be seen. The palette is read through a
 * ref instead.
 *
 * It does nothing at all when the viewer has asked for reduced motion. That is
 * not a degraded experience: for somebody with vestibular sensitivity,
 * confetti is the opposite of a reward.
 */
export function Confetti({ fire, palette }: { fire: boolean; palette: readonly string[] }) {
  const host = useRef<HTMLDivElement | null>(null);
  const colors = useRef(palette);
  colors.current = palette;

  useEffect(() => {
    if (!fire || typeof document === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden";
    document.body.appendChild(layer);
    host.current = layer;

    const animations: Animation[] = [];

    for (let i = 0; i < 60; i += 1) {
      const piece = document.createElement("span");
      const color = colors.current[i % colors.current.length] ?? "#2a78d6";
      // Two shapes rather than one: a field of identical squares reads as a
      // loading state, not a celebration.
      const round = i % 3 === 0;
      piece.style.cssText = [
        "position:absolute",
        "top:-16px",
        `left:${4 + Math.random() * 92}%`,
        `width:${round ? 8 : 6}px`,
        `height:${round ? 8 : 13}px`,
        `background:${color}`,
        round ? "border-radius:50%" : "border-radius:1px",
        "will-change:transform,opacity",
      ].join(";");
      layer.appendChild(piece);

      const drift = (Math.random() - 0.5) * 300;
      const spin = 360 + Math.random() * 720;

      animations.push(
        piece.animate(
          [
            { transform: "translate3d(0,0,0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate3d(${drift * 0.6}px, 50vh, 0) rotate(${spin * 0.6}deg)`,
              opacity: 1,
              offset: 0.7,
            },
            {
              transform: `translate3d(${drift}px, 105vh, 0) rotate(${spin}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 2600 + Math.random() * 1600,
            delay: Math.random() * 450,
            easing: "cubic-bezier(0.25, 0.6, 0.35, 1)",
            fill: "forwards",
          },
        ),
      );
    }

    // The layer goes when the last piece lands, or on unmount -- whichever
    // comes first, so navigating away mid-burst leaves nothing behind.
    let done = false;
    const remove = () => {
      if (done) return;
      done = true;
      for (const animation of animations) animation.cancel();
      layer.remove();
      host.current = null;
    };
    const timer = window.setTimeout(remove, 5000);

    return () => {
      window.clearTimeout(timer);
      remove();
    };
    // `palette` is deliberately absent: see the note above.
  }, [fire]);

  // The layer is appended to the body by the effect above, so this component
  // renders nothing where it sits.
  return null;
}
