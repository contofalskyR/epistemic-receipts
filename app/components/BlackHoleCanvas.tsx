"use client";
import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 300;
const EVENT_HORIZON = 80;
const INNER_MIN = EVENT_HORIZON + 50;

// ω(r) = k/r so the outermost particle (at viewport diagonal) orbits in 60s @ 60fps
// period(r_max) = 2π·r_max / k = 3600 frames  →  k = 2π·r_max / 3600
function computeK(rMax: number) {
  return (2 * Math.PI * rMax) / 3600;
}

type Particle = { angle: number; r: number; vr: number };

function spawnParticle(rMax: number): Particle {
  return {
    angle: Math.random() * Math.PI * 2,
    r: INNER_MIN + Math.random() * (rMax - INNER_MIN),
    vr: (Math.random() - 0.5) * 0.08,
  };
}

export default function BlackHoleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let cx = W * 0.7;
    let cy = H * 0.4;
    let rMax = Math.sqrt(W * W + H * H);
    let k = computeK(rMax);

    const particles: Particle[] = Array.from(
      { length: PARTICLE_COUNT },
      () => spawnParticle(rMax)
    );

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      el!.width = W;
      el!.height = H;
      cx = W * 0.7;
      cy = H * 0.4;
      rMax = Math.sqrt(W * W + H * H);
      k = computeK(rMax);
      for (const p of particles) {
        if (p.r > rMax) Object.assign(p, spawnParticle(rMax));
      }
    }

    resize();

    // Reduced-motion: static snapshot, no animation loop
    if (prefersReduced) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      for (const p of particles) {
        const px = cx + Math.cos(p.angle) * p.r;
        const py = cy + Math.sin(p.angle) * p.r;
        if (px < 0 || px > W || py < 0 || py > H) continue;
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, EVENT_HORIZON, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      return;
    }

    // Seed canvas black so the first frame isn't a transparency flash
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    let animId = 0;
    let running = true;

    function frame() {
      if (!running) return;

      // Trail — fade previous frames toward black
      ctx!.fillStyle = "rgba(0,0,0,0.05)";
      ctx!.fillRect(0, 0, W, H);

      // Particles
      ctx!.fillStyle = "rgba(255,255,255,0.9)";
      for (const p of particles) {
        p.angle += k / p.r;
        p.r += p.vr;

        if (p.r < INNER_MIN || p.r > rMax + 80) {
          Object.assign(p, spawnParticle(rMax));
          continue;
        }

        const px = cx + Math.cos(p.angle) * p.r;
        const py = cy + Math.sin(p.angle) * p.r;
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;

        ctx!.beginPath();
        ctx!.arc(px, py, p.r < 200 ? 1.5 : 1, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Corner vignettes for text legibility (top-left, bottom-left)
      const g1 = ctx!.createRadialGradient(0, 0, 0, 0, 0, Math.min(W, H) * 0.65);
      g1.addColorStop(0, "rgba(0,0,0,0.45)");
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = g1;
      ctx!.fillRect(0, 0, W, H);

      const g2 = ctx!.createRadialGradient(0, H, 0, 0, H, Math.min(W, H) * 0.5);
      g2.addColorStop(0, "rgba(0,0,0,0.35)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = g2;
      ctx!.fillRect(0, 0, W, H);

      // Event horizon glow ring
      const glow = ctx!.createRadialGradient(cx, cy, EVENT_HORIZON, cx, cy, EVENT_HORIZON + 45);
      glow.addColorStop(0, "rgba(50,35,80,0.75)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(cx, cy, EVENT_HORIZON + 45, 0, Math.PI * 2);
      ctx!.fill();

      // Event horizon — solid black disc
      ctx!.beginPath();
      ctx!.arc(cx, cy, EVENT_HORIZON, 0, Math.PI * 2);
      ctx!.fillStyle = "#000";
      ctx!.fill();

      animId = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animId);
      } else {
        running = true;
        frame();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);
    frame();

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        opacity: 0.8,
        pointerEvents: "none",
      }}
    />
  );
}
