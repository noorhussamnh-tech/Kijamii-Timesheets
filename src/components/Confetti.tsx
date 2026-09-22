import { useEffect, useRef } from "react";

/**
 * Confetti. A lot of it.
 *
 * No library and no canvas: a few hundred absolutely positioned pieces
 * animated by the browser's own compositor and then removed. Everything here
 * animates `transform` and `opacity` only, which the compositor handles off
 * the main thread, so the count can be silly without the page stuttering --
 * the expensive part of a burst this size is creating the elements, and they
 * go in as one fragment rather than one append per piece.
 *
 * How much is "a lot" depends on the screen. A fixed count that feels
 * overwhelming on a phone is a light drizzle on a 27-inch monitor, so the
 * number is drawn from the viewport's area and then clamped at both ends.
 *
 * It arrives in waves rather than one dump. A single volley is over in a
 * second and reads as a glitch; staggering the starts over a second and a
 * half means the screen keeps filling while the first pieces are still
 * falling, which is what "overwhelming" actually looks like.
 *
 * Three other details are load-bearing rather than incidental.
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
 * confetti is the opposite of a reward, and five hundred pieces of it is the
 * opposite twice over.
 */

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Pieces per burst, from the viewport's area. */
function pieceCount(width: number, height: number, multiplier: number): number {
  const area = Math.max(width, 320) * Math.max(height, 480);
  // ~1360 on a laptop, 1800 on a big monitor, 420 on a phone -- where the
  // screen is small enough that 420 already buries it.
  return Math.round(Math.min(1800, Math.max(420, area / 950)) * multiplier);
}

export function Confetti({
  fire,
  palette,
  /** Scales the burst. 1 is the full, deliberately excessive amount. */
  intensity = 1,
}: {
  fire: boolean;
  palette: readonly string[];
  intensity?: number;
}) {
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
    const fragment = document.createDocumentFragment();
    const total = pieceCount(window.innerWidth, window.innerHeight, intensity);

    // The last piece to start, so the layer is removed when the burst has
    // actually finished rather than at a guessed time.
    let lastEnd = 0;

    for (let i = 0; i < total; i += 1) {
      const piece = document.createElement("span");
      const color = colors.current[i % colors.current.length] ?? "#2a78d6";

      /*
       * Four shapes. A field of identical squares reads as a loading state,
       * not a celebration -- and at this count the eye picks out the
       * repetition immediately, so the streamers and the occasional big
       * piece are what stop it looking like static.
       */
      const shape = i % 7;
      const round = shape === 0 || shape === 3;
      const streamer = shape === 5;
      const big = shape === 6;

      const width = round ? rand(6, 13) : streamer ? rand(3, 5) : rand(5, big ? 14 : 9);
      const height = round ? width : streamer ? rand(18, 30) : rand(9, big ? 22 : 15);

      // A fifth of the pieces are fired up from the bottom corners; the rest
      // rain from above the top edge. The cannons are what make it feel like
      // it is coming from everywhere rather than simply falling.
      const cannon = i % 5 === 0;
      const fromLeft = i % 10 === 0;

      piece.style.cssText = [
        "position:absolute",
        cannon ? "bottom:-20px" : "top:-24px",
        cannon
          ? fromLeft
            ? `left:${rand(-2, 12)}%`
            : `left:${rand(88, 102)}%`
          : `left:${rand(-4, 104)}%`,
        `width:${width.toFixed(1)}px`,
        `height:${height.toFixed(1)}px`,
        `background:${color}`,
        round ? "border-radius:50%" : "border-radius:1px",
        "will-change:transform,opacity",
      ].join(";");
      fragment.appendChild(piece);

      const spin = 540 + Math.random() * 1440;
      // Tumbling on two axes rather than one. A flat spin looks like a
      // sticker turning; the flip is what makes a piece read as paper.
      const flip = Math.random() * 1080;
      /*
       * Starts are spread over three seconds and each piece falls for up to
       * seven, so the waves overlap three or four deep and the top of the
       * screen keeps refilling while the first pieces are still landing.
       * Spreading the starts without lengthening the fall would just thin
       * every instant out.
       *
       * The cannons go early. They are the bang, and a bang that arrives two
       * seconds into the applause is not one.
       */
      const delay = cannon ? Math.random() * 900 : Math.random() * 3200;
      const duration = cannon ? rand(3000, 5200) : rand(3400, 7000);
      lastEnd = Math.max(lastEnd, delay + duration);

      const keyframes: Keyframe[] = cannon
        ? (() => {
            const dx = (fromLeft ? 1 : -1) * rand(120, 620);
            const apex = rand(50, 95);
            return [
              { transform: "translate3d(0,0,0) rotate3d(1,1,0,0deg)", opacity: 1 },
              {
                transform: `translate3d(${(dx * 0.65).toFixed(0)}px, -${apex.toFixed(0)}vh, 0) rotate3d(1,1,0,${(spin * 0.45).toFixed(0)}deg)`,
                opacity: 1,
                offset: 0.42,
              },
              {
                transform: `translate3d(${dx.toFixed(0)}px, 25vh, 0) rotate3d(1,1,0,${spin.toFixed(0)}deg)`,
                opacity: 0,
              },
            ];
          })()
        : (() => {
            const drift = (Math.random() - 0.5) * 520;
            return [
              { transform: "translate3d(0,0,0) rotate3d(1,1,0,0deg)", opacity: 1 },
              {
                transform: `translate3d(${(drift * 0.55).toFixed(0)}px, 45vh, 0) rotate3d(1,1,0,${(flip * 0.5).toFixed(0)}deg)`,
                opacity: 1,
                offset: 0.65,
              },
              {
                transform: `translate3d(${drift.toFixed(0)}px, 115vh, 0) rotate3d(1,1,0,${(spin + flip).toFixed(0)}deg)`,
                opacity: 0,
              },
            ];
          })();

      animations.push(
        piece.animate(keyframes, {
          duration,
          delay,
          easing: cannon ? "cubic-bezier(0.2, 0.75, 0.5, 1)" : "cubic-bezier(0.25, 0.6, 0.35, 1)",
          fill: "forwards",
        }),
      );
    }

    layer.appendChild(fragment);

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
    const timer = window.setTimeout(remove, lastEnd + 400);

    return () => {
      window.clearTimeout(timer);
      remove();
    };
    // `palette` is deliberately absent: see the note above.
  }, [fire, intensity]);

  // The layer is appended to the body by the effect above, so this component
  // renders nothing where it sits.
  return null;
}
