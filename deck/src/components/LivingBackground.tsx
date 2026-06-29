import { useEffect, useRef } from "react";

type N = { x: number; y: number; vx: number; vy: number; r: number; age: number; max: number };
type Birth = { x: number; y: number; tx: number; ty: number; t: number };

// Interactive "living lineage" field: drifting nodes that link into a plexus,
// continuously born (as children of existing nodes) and dying, evolution behind
// the content. Plus a slow aurora wash and a cursor glow. Mounted once, app-wide.
export const LivingBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    let W = 0, H = 0, LINK = 150, target = 60, raf = 0;
    const mouse = { x: -9999, y: -9999, active: false };
    let nodes: N[] = [];
    let births: Birth[] = [];

    const makeNode = (x?: number, y?: number, fresh = false): N => ({
      x: x ?? Math.random() * W,
      y: y ?? Math.random() * H,
      vx: rand(-0.22, 0.22),
      vy: rand(-0.22, 0.22),
      r: rand(1.1, 2.4),
      age: fresh ? 0 : Math.random(),
      max: rand(720, 1500),
    });

    const resize = () => {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      target = Math.max(28, Math.min(92, Math.round((W * H) / 21000)));
      LINK = Math.max(120, Math.min(168, W / 9));
      while (nodes.length < target) nodes.push(makeNode());
    };
    resize();

    let tick = 0;
    const step = () => {
      tick++;
      ctx.clearRect(0, 0, W, H);

      // birth / death, keep the population near target with continuous turnover
      nodes = nodes.filter((n) => n.age < 1);
      while (nodes.length < target) {
        const parent = nodes.length ? nodes[(Math.random() * nodes.length) | 0] : undefined;
        const child = makeNode(parent ? parent.x + rand(-34, 34) : undefined, parent ? parent.y + rand(-34, 34) : undefined, true);
        nodes.push(child);
        if (parent && !reduce) births.push({ x: parent.x, y: parent.y, tx: child.x, ty: child.y, t: 0 });
      }

      for (const n of nodes) {
        if (!reduce) {
          n.x += n.vx; n.y += n.vy;
          if (mouse.active) {
            const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
            if (d2 < 16900 && d2 > 1) { const d = Math.sqrt(d2); const f = (130 - d) / 130; n.vx += (dx / d) * f * 0.05; n.vy += (dy / d) * f * 0.05; }
          }
          n.vx *= 0.99; n.vy *= 0.99;
          if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
          if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
          n.age += 1 / n.max;
        }
      }

      // links between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const al = (1 - Math.sqrt(d2) / LINK) * 0.22;
            ctx.strokeStyle = `rgba(37,99,235,${al})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // brighter links toward the cursor
      if (mouse.active) {
        for (const n of nodes) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 40000) { const al = (1 - Math.sqrt(d2) / 200) * 0.4; ctx.strokeStyle = `rgba(37,99,235,${al})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
        }
      }

      // birth flourishes (a warm line drawing out to each new child)
      if (births.length) {
        births = births.filter((bz) => bz.t < 1);
        for (const bz of births) {
          bz.t += 0.045;
          const cx = bz.x + (bz.tx - bz.x) * bz.t, cy = bz.y + (bz.ty - bz.y) * bz.t;
          ctx.strokeStyle = `rgba(180,83,9,${(1 - bz.t) * 0.5})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(bz.x, bz.y); ctx.lineTo(cx, cy); ctx.stroke();
        }
      }

      // nodes
      for (const n of nodes) {
        const a = Math.min(1, n.age * 8) * (n.age > 0.85 ? (1 - n.age) / 0.15 : 1);
        ctx.fillStyle = `rgba(37,99,235,${0.4 * a})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      if (!reduce) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
      if (glowRef.current) glowRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    };
    const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => resize();
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce) raf = requestAnimationFrame(step); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: "radial-gradient(120% 100% at 50% -10%, #ffffff 0%, #e7edf7 62%)" }}>
      <div className="aurora-blob" style={{ background: "radial-gradient(circle, #c7d6f5, transparent 70%)", width: "55vw", height: "55vw", left: "-12vw", top: "-16vh", animationName: "drift", animationDuration: "27s" }} />
      <div className="aurora-blob" style={{ background: "radial-gradient(circle, #cfe8e0, transparent 70%)", width: "50vw", height: "50vw", right: "-14vw", top: "4vh", animationName: "drift2", animationDuration: "33s", animationDelay: "-9s" }} />
      <div className="aurora-blob" style={{ background: "radial-gradient(circle, #d8d0f2, transparent 70%)", width: "48vw", height: "48vw", left: "22vw", bottom: "-24vh", animationName: "drift", animationDuration: "39s", animationDelay: "-17s" }} />
      <div className="aurora-blob" style={{ background: "radial-gradient(circle, #f1ddc6, transparent 72%)", width: "30vw", height: "30vw", right: "10vw", bottom: "-12vh", animationName: "drift2", animationDuration: "31s", animationDelay: "-5s", opacity: 0.4 }} />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div ref={glowRef} className="absolute" style={{ left: 0, top: 0, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.10), transparent 60%)", mixBlendMode: "multiply" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(135% 130% at 50% 42%, transparent 62%, rgba(15,23,42,0.05) 100%)" }} />
    </div>
  );
};
