import React, { useEffect, useRef } from "react";

/**
 * AsciiShimmer — Emergent-style animated ASCII/character-matrix background.
 *
 * A lightweight canvas layer that scatters faint monospace characters across
 * the hero, denser toward the left/right edges (keeps the center readable),
 * gently morphing/shimmering over time.
 *
 * Performance/accessibility:
 * - Canvas-based (no DOM nodes per char), ~11fps mutation tick
 * - Pauses when scrolled off-screen (IntersectionObserver) or tab hidden
 * - Static render (no animation) for prefers-reduced-motion and small screens
 * - pointer-events: none, aria-hidden
 */

const CHARS = "01₿ΞÐ$€£¥+−=<>*/#%&@:;·ABCDEFHKMNPRSTUVWXYZ";

interface Cell {
  ch: string;
  alpha: number;
  target: number;
  base: number;
}

const AsciiShimmer: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.innerWidth < 600;

    const CELL_W = 22;
    const CELL_H = 26;
    const FONT = "12px 'JetBrains Mono', Menlo, Consolas, monospace";

    let raf = 0;
    let lastTick = 0;
    let cols = 0;
    let rows = 0;
    let cells: Cell[] = [];
    let inView = true;
    let pageVisible = !document.hidden;
    let animating = false;

    const rand = (n: number) => Math.floor(Math.random() * n);
    const pick = () => CHARS[rand(CHARS.length)];

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL_W);
      rows = Math.ceil(h / CELL_H);
      cells = [];
      const cx = cols / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Density mask: 0 in the central ~30% of columns, ramps up toward edges
          const dx = cx > 0 ? Math.abs(c - cx) / cx : 1;
          const edge = Math.max(0, dx * 1.4 - 0.4);
          const base = edge * (0.25 + Math.random() * 0.75);
          cells.push({
            ch: Math.random() < 0.55 ? pick() : " ",
            alpha: base * Math.random(),
            target: base * Math.random(),
            base,
          });
        }
      }
    };

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.font = FONT;
      ctx.textBaseline = "top";
      const rgb = isDark ? "255,255,255" : "10,10,10";
      const maxA = isDark ? 0.16 : 0.12;
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, i++) {
          const cell = cells[i];
          if (!cell || cell.base <= 0 || cell.ch === " ") continue;
          cell.alpha += (cell.target - cell.alpha) * 0.08;
          const a = cell.alpha * maxA;
          if (a < 0.004) continue;
          ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
          ctx.fillText(cell.ch, c * CELL_W, r * CELL_H);
        }
      }
    };

    const mutate = () => {
      const n = Math.max(4, Math.floor(cells.length * 0.008));
      for (let k = 0; k < n; k++) {
        const cell = cells[rand(cells.length)];
        if (!cell || cell.base <= 0) continue;
        if (Math.random() < 0.35) cell.ch = Math.random() < 0.85 ? pick() : " ";
        cell.target = cell.base * Math.random();
      }
    };

    const loop = (ts: number) => {
      if (!animating) return;
      if (ts - lastTick > 90) {
        mutate();
        lastTick = ts;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };

    const updateRunning = () => {
      const shouldRun = inView && pageVisible && !reduceMotion;
      if (shouldRun && !animating) {
        animating = true;
        raf = requestAnimationFrame(loop);
      } else if (!shouldRun && animating) {
        animating = false;
        cancelAnimationFrame(raf);
      }
    };

    setup();
    if (reduceMotion) {
      // Static field — draw a couple of passes so alphas settle
      for (let i = 0; i < 12; i++) draw();
    } else {
      updateRunning();
    }

    const onResize = () => {
      setup();
      if (reduceMotion) for (let i = 0; i < 12; i++) draw();
    };
    window.addEventListener("resize", onResize);

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateRunning();
    });
    io.observe(canvas);

    const onVis = () => {
      pageVisible = !document.hidden;
      updateRunning();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      animating = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="ascii-shimmer"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
};

export default AsciiShimmer;
