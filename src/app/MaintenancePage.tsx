import { useEffect, useRef, useState, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────── */
interface Particle {
  id: number;
  x: number; y: number;
  baseX: number; baseY: number;
  size: number;
  speedX: number; speedY: number;
  opacity: number;
  type: "dot" | "cross" | "ring";
  hue: number;
}

/* ─── Hooks ──────────────────────────────────────────────── */
function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let v = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      v += step;
      if (v >= target) { setCount(target); clearInterval(id); }
      else setCount(Math.floor(v));
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return count;
}

/* ─── Constants ──────────────────────────────────────────── */
const STEPS = [
  "Upgrading database schemas…",
  "Optimizing server clusters…",
  "Deploying security patches…",
  "Syncing patient records…",
  "Running system diagnostics…",
];

const STATUS_CARDS = [
  { label: "API Services", status: "Offline",  icon: "⚡", color: "#f59e0b" },
  { label: "Database",     status: "Updating", icon: "🗄️", color: "#38bdf8" },
  { label: "Auth System",  status: "Stable",   icon: "🔐", color: "#34d399" },
  { label: "CDN",          status: "Active",   icon: "🌐", color: "#34d399" },
];

/* ─── Component ──────────────────────────────────────────── */
export function MaintenancePage() {
  const { w } = useWindowSize();
  const isMobile  = w < 480;
  const isTablet  = w >= 480 && w < 768;
  const isDesktop = w >= 768;

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number>(0);
  const particleRef = useRef<Particle[]>([]);
  const ptrRef      = useRef({ x: -9999, y: -9999 });

  const [progress,   setProgress]   = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [visible,    setVisible]    = useState(false);
  const [hovered,    setHovered]    = useState<number | null>(null);
  const [pulse,      setPulse]      = useState(false);

  const eta = useCounter(47, 1800);

  /* — mount fade */
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  /* — progress */
  useEffect(() => {
    const id = setInterval(() => setProgress(p => { if (p >= 73) { clearInterval(id); return 73; } return p + 0.35; }), 80);
    return () => clearInterval(id);
  }, []);

  /* — step ticker */
  useEffect(() => {
    const id = setInterval(() => setActiveStep(s => (s + 1) % STEPS.length), 3000);
    return () => clearInterval(id);
  }, []);

  /* — pulse dot */
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1100);
    return () => clearInterval(id);
  }, []);

  /* — pointer (mouse + touch) */
  useEffect(() => {
    const onMouse    = (e: MouseEvent)  => { ptrRef.current = { x: e.clientX,   y: e.clientY }; };
    const onLeave    = ()               => { ptrRef.current = { x: -9999, y: -9999 }; };
    const onTouch    = (e: TouchEvent)  => { const t = e.touches[0]; if (t) ptrRef.current = { x: t.clientX, y: t.clientY }; };
    const onTouchEnd = ()               => { ptrRef.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove",  onMouse);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchmove",  onTouch,    { passive: true });
    window.addEventListener("touchend",   onTouchEnd);
    return () => {
      window.removeEventListener("mousemove",  onMouse);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove",  onTouch);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  }, []);

  /* — canvas */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const count = isMobile ? 45 : isTablet ? 58 : 72;
    particleRef.current = Array.from({ length: count }, (_, i) => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      return {
        id: i, x, y, baseX: x, baseY: y,
        size: Math.random() * 2.2 + 0.7,
        speedX: (Math.random() - 0.5) * 0.26,
        speedY: (Math.random() - 0.5) * 0.26,
        opacity: Math.random() * 0.4 + 0.08,
        type: i % 7 === 0 ? "cross" : i % 11 === 0 ? "ring" : "dot",
        hue: Math.random() * 28 + 198,
      };
    });

    const REPEL = isMobile ? 100 : 140;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ptr = ptrRef.current;

      particleRef.current.forEach(p => {
        p.baseX += p.speedX;
        p.baseY += p.speedY;
        if (p.baseX < 0) p.baseX = canvas.width;
        if (p.baseX > canvas.width) p.baseX = 0;
        if (p.baseY < 0) p.baseY = canvas.height;
        if (p.baseY > canvas.height) p.baseY = 0;

        const dx = p.baseX - ptr.x, dy = p.baseY - ptr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL && dist > 0) {
          const push = ((REPEL - dist) / REPEL) * (REPEL / dist) * 9;
          const ang  = Math.atan2(dy, dx);
          p.x += (p.baseX + Math.cos(ang) * push - p.x) * 0.18;
          p.y += (p.baseY + Math.sin(ang) * push - p.y) * 0.18;
        } else {
          p.x += (p.baseX - p.x) * 0.07;
          p.y += (p.baseY - p.y) * 0.07;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        if (p.type === "cross") {
          ctx.strokeStyle = `hsla(${p.hue},85%,76%,1)`;
          ctx.lineWidth = p.size * 0.6;
          const arm = p.size * 3;
          ctx.beginPath();
          ctx.moveTo(p.x - arm, p.y); ctx.lineTo(p.x + arm, p.y);
          ctx.moveTo(p.x, p.y - arm); ctx.lineTo(p.x, p.y + arm);
          ctx.stroke();
        } else if (p.type === "ring") {
          ctx.strokeStyle = `hsla(${p.hue},88%,72%,1)`;
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = `hsla(${p.hue},88%,70%,1)`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });

      /* connection lines */
      const CONN = isMobile ? 80 : 115;
      for (let i = 0; i < particleRef.current.length; i++)
        for (let j = i + 1; j < particleRef.current.length; j++) {
          const a = particleRef.current[i], b = particleRef.current[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < CONN) {
            ctx.save();
            ctx.globalAlpha = (1 - d / CONN) * 0.09;
            ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.restore();
          }
        }

      /* pointer glow */
      if (ptr.x !== -9999) {
        const g = ctx.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 85);
        g.addColorStop(0, "rgba(56,189,248,0.07)");
        g.addColorStop(1, "rgba(56,189,248,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 85, 0, Math.PI * 2); ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animRef.current); };
  }, [isMobile, isTablet]);

  /* ─── Derived sizes ──────────────────────────────────────── */
  const logoSize   = isMobile ? 88  : isTablet ? 100 : 112;
  const logoImg    = isMobile ? 66  : isTablet ? 76  : 84;
  const ring1Inset = isMobile ? -26 : isTablet ? -32 : -38;
  const ring2Inset = isMobile ? -18 : isTablet ? -22 : -26;
  const ring3Inset = isMobile ? -10 : isTablet ? -12 : -14;
  const etaFontSz  = isMobile ? "34px" : isTablet ? "40px" : "46px";
  const cardCols   = isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(150px, 1fr))";
  const pagePad    = isMobile ? "32px 16px 56px" : isTablet ? "40px 24px 60px" : "52px 28px 72px";
  const badgeMb    = isMobile ? "32px" : "44px";
  const logoMb     = isMobile ? "24px" : "32px";
  const titleMb    = isMobile ? "10px" : "14px";
  const subMb      = isMobile ? "32px" : "44px";
  const etaPad     = isMobile ? "18px 28px" : "22px 44px";
  const etaGap     = isMobile ? "32px" : isTablet ? "44px" : "56px";
  const etaMb      = isMobile ? "24px" : "32px";
  const barMb      = isMobile ? "8px" : "10px";
  const stepMb     = isMobile ? "32px" : "44px";
  const cardsMb    = isMobile ? "36px" : "52px";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(135deg,#020817 0%,#0b1a3b 40%,#0d2954 70%,#0a1628 100%)",
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
      overflow: "hidden",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.9s ease",
    }}>
      {/* Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Sora:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      {/* Ambient glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 55% at 50% 30%,rgba(14,165,233,.11) 0%,transparent 70%)", pointerEvents: "none" }} />

      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(56,189,248,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.03) 1px,transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />

      {/* ── Scroll container ── */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", height: "100vh",
        overflowY: "auto",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: pagePad,
        boxSizing: "border-box",
      }}>

        {/* Live badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "7px",
          background: "rgba(56,189,248,.07)",
          border: "1px solid rgba(56,189,248,.20)",
          borderRadius: "100px",
          padding: isMobile ? "5px 14px" : "6px 20px",
          marginBottom: badgeMb,
          animation: "sd .8s ease .1s both",
          maxWidth: "90vw",
        }}>
          <span style={{
            width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0,
            background: pulse ? "#38bdf8" : "#0ea5e9",
            boxShadow: pulse ? "0 0 14px #38bdf8" : "0 0 6px #0ea5e9",
            transition: "all .6s ease", display: "inline-block",
          }} />
          <span style={{ color: "#7dd3fc", fontSize: isMobile ? "10px" : "11.5px", fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {isMobile ? "Maintenance In Progress" : "System Maintenance In Progress"}
          </span>
        </div>

        {/* Logo + rings */}
        <div style={{ position: "relative", marginBottom: logoMb, animation: "sd .8s ease .2s both", flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: `${ring1Inset}px`, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "rgba(56,189,248,.55)", borderRightColor: "rgba(56,189,248,.12)", animation: "spin 8s linear infinite" }} />
          <div style={{ position: "absolute", inset: `${ring2Inset}px`, borderRadius: "50%", border: "1px dashed rgba(56,189,248,.15)", animation: "spin 14s linear infinite reverse" }} />
          <div style={{ position: "absolute", inset: `${ring3Inset}px`, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#38bdf8", borderBottomColor: "rgba(56,189,248,.16)", animation: "spin 3.5s linear infinite" }} />

          <div style={{
            width: `${logoSize}px`, height: `${logoSize}px`, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%,rgba(56,189,248,.14),rgba(14,165,233,.07))",
            border: "1px solid rgba(56,189,248,.24)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 50px rgba(56,189,248,.20),0 0 100px rgba(14,165,233,.08),inset 0 1px 0 rgba(255,255,255,.06)",
            backdropFilter: "blur(14px)", overflow: "hidden",
          }}>
            <img
              src="/logo.png"
              alt="Manalo Medical Clinic"
              style={{ width: `${logoImg}px`, height: `${logoImg}px`, objectFit: "contain", borderRadius: "50%", filter: "drop-shadow(0 0 14px rgba(56,189,248,.65))" }}
            />
          </div>

          {/* pulse halo */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", animation: "halo 2.5s ease-out infinite" }} />
        </div>

        {/* Clinic name */}
        <p style={{
          color: "rgba(125,211,252,.65)", fontSize: isMobile ? "10px" : "11.5px",
          fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase",
          margin: "0 0 10px", animation: "sd .8s ease .3s both", textAlign: "center",
        }}>
          Manalo Medical Clinic
        </p>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Sora',sans-serif",
          fontSize: isMobile ? "clamp(26px,8vw,36px)" : isTablet ? "clamp(32px,5vw,46px)" : "clamp(36px,5vw,60px)",
          fontWeight: 700, color: "#f0f9ff",
          margin: `0 0 ${titleMb}`,
          textAlign: "center", letterSpacing: "-0.025em", lineHeight: 1.1,
          animation: "sd .8s ease .35s both",
        }}>
          We're Under<br />
          <span style={{
            background: "linear-gradient(90deg,#7dd3fc,#38bdf8,#0ea5e9,#38bdf8,#7dd3fc)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", backgroundSize: "250% auto",
            animation: "shimmer 4s linear infinite",
          }}>
            Maintenance
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          color: "rgba(186,230,253,.58)",
          fontSize: isMobile ? "13px" : isTablet ? "14.5px" : "16px",
          fontWeight: 300, textAlign: "center",
          maxWidth: isMobile ? "320px" : "450px",
          lineHeight: 1.78, margin: `0 0 ${subMb}`,
          animation: "sd .8s ease .45s both",
          padding: "0 8px",
        }}>
          {isMobile
            ? "Our systems are being upgraded. We'll be back shortly."
            : "Our clinical systems are being upgraded to deliver a faster, safer, and more reliable experience. We'll be back shortly."}
        </p>

        {/* ETA counters */}
        <div style={{
          background: "rgba(14,165,233,.065)",
          border: "1px solid rgba(56,189,248,.16)",
          borderRadius: "20px",
          padding: etaPad,
          marginBottom: etaMb,
          display: "flex", gap: etaGap, alignItems: "center",
          backdropFilter: "blur(14px)",
          animation: "sd .8s ease .55s both",
          flexWrap: "wrap", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(14,165,233,.07)",
          width: isMobile ? "calc(100% - 32px)" : "auto",
          maxWidth: "480px",
          boxSizing: "border-box",
        }}>
          {[
            { val: String(eta).padStart(2, "0"), label: "Est. Minutes" },
            { val: `${Math.round(progress)}%`, label: "Complete" },
          ].map((item, i) => (
            <div key={item.label} style={{ display: "flex", gap: etaGap, alignItems: "center" }}>
              {i > 0 && <div style={{ width: "1px", height: "52px", background: "rgba(56,189,248,.12)" }} />}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "'Sora',sans-serif", fontSize: etaFontSz, fontWeight: 700,
                  color: "#38bdf8", lineHeight: 1,
                  textShadow: "0 0 28px rgba(56,189,248,.50)",
                  letterSpacing: "-0.03em",
                }}>{item.val}</div>
                <div style={{ color: "rgba(186,230,253,.38)", fontSize: "9.5px", letterSpacing: "0.13em", textTransform: "uppercase", marginTop: "5px" }}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          width: "100%", maxWidth: isMobile ? "calc(100% - 32px)" : "540px",
          marginBottom: barMb,
          animation: "sd .8s ease .65s both",
        }}>
          <div style={{ height: "5px", background: "rgba(56,189,248,.09)", borderRadius: "100px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "linear-gradient(90deg,#0284c7,#0ea5e9,#38bdf8,#7dd3fc)",
              borderRadius: "100px", transition: "width .4s ease",
              boxShadow: "0 0 16px rgba(56,189,248,.60)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.26),transparent)", animation: "barShimmer 1.6s ease infinite" }} />
            </div>
          </div>
        </div>

        {/* Step ticker */}
        <div style={{
          color: "#7dd3fc", fontSize: isMobile ? "11.5px" : "12.5px",
          marginBottom: stepMb, letterSpacing: "0.04em",
          animation: "sd .8s ease .7s both",
          minHeight: "20px", textAlign: "center",
          padding: "0 16px",
        }}>
          <span key={activeStep} style={{ animation: "fadeSwap .45s ease" }}>
            ↳ {STEPS[activeStep]}
          </span>
        </div>

        {/* Status cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: cardCols,
          gap: isMobile ? "10px" : "14px",
          width: "100%", maxWidth: isMobile ? "calc(100% - 32px)" : isTablet ? "480px" : "720px",
          marginBottom: cardsMb,
          animation: "sd .8s ease .8s both",
        }}>
          {STATUS_CARDS.map((card, i) => (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: hovered === i ? "rgba(56,189,248,.09)" : "rgba(255,255,255,.022)",
                border: `1px solid ${hovered === i ? "rgba(56,189,248,.30)" : "rgba(56,189,248,.08)"}`,
                borderRadius: "16px",
                padding: isMobile ? "16px 14px" : "20px 18px",
                cursor: "default", transition: "all .28s ease",
                transform: hovered === i ? "translateY(-4px)" : "translateY(0)",
                backdropFilter: "blur(10px)",
                boxShadow: hovered === i ? "0 12px 36px rgba(56,189,248,.09)" : "none",
              }}
            >
              <div style={{ fontSize: isMobile ? "18px" : "20px", marginBottom: "10px" }}>{card.icon}</div>
              <div style={{ color: "rgba(186,230,253,.45)", fontSize: "9.5px", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: "6px" }}>
                {card.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: card.color, boxShadow: `0 0 7px ${card.color}`,
                  display: "inline-block",
                  animation: card.status === "Updating" ? "pulseDot 1.3s ease-in-out infinite" : "none",
                }} />
                <span style={{ color: card.color, fontSize: isMobile ? "12px" : "13px", fontWeight: 600 }}>{card.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          width: "100%", maxWidth: isMobile ? "calc(100% - 32px)" : "520px", height: "1px",
          background: "linear-gradient(90deg,transparent,rgba(56,189,248,.13),transparent)",
          marginBottom: "28px",
          animation: "sd .8s ease .9s both",
        }} />

        {/* Footer */}
        <div style={{ animation: "sd .8s ease .95s both", textAlign: "center", padding: "0 16px" }}>
          <p style={{ color: "rgba(186,230,253,.32)", fontSize: isMobile ? "11.5px" : "12.5px", margin: "0 0 7px" }}>
            For urgent medical inquiries, reach us at
          </p>
          <a
            href="mailto:manalomedicalclinic.ph@gmail.com"
            style={{
              color: "#38bdf8",
              fontSize: isMobile ? "12px" : "13.5px",
              fontWeight: 500, textDecoration: "none",
              borderBottom: "1px solid rgba(56,189,248,.22)",
              paddingBottom: "1px", transition: "color .2s,border-color .2s",
              wordBreak: "break-all",
            }}
            onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = "#7dd3fc"; a.style.borderBottomColor = "rgba(125,211,252,.45)"; }}
            onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = "#38bdf8"; a.style.borderBottomColor = "rgba(56,189,248,.22)"; }}
          >
            manalomedicalclinic.ph@gmail.com
          </a>
          <p style={{ color: "rgba(186,230,253,.15)", fontSize: "10.5px", marginTop: "14px", letterSpacing: "0.04em" }}>
            © {new Date().getFullYear()} Manalo Medical Clinic · All Rights Reserved
          </p>
        </div>

      </div>{/* /scroll */}

      <style>{`
        @keyframes sd        { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes shimmer   { 0%{background-position:0% center} 100%{background-position:250% center} }
        @keyframes barShimmer{ 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        @keyframes fadeSwap  { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        @keyframes halo      { 0%{box-shadow:0 0 0 0 rgba(56,189,248,.32)} 70%{box-shadow:0 0 0 24px rgba(56,189,248,0)} 100%{box-shadow:0 0 0 0 rgba(56,189,248,0)} }
        ::-webkit-scrollbar      { width:3px }
        ::-webkit-scrollbar-track{ background:transparent }
        ::-webkit-scrollbar-thumb{ background:rgba(56,189,248,.15);border-radius:4px }
        *{ -webkit-tap-highlight-color:transparent; box-sizing:border-box }
      `}</style>
    </div>
  );
}