import { useEffect, useState } from "react";

export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), 2300);
    const doneTimer = setTimeout(onDone, 2800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const letters = "IntellMeet".split("");

  return (
    <div className={`splash ${leaving ? "splash-leaving" : ""}`} onClick={onDone}>
      <div className="splash-glow" />
      <div className="splash-content">
        <svg className="splash-logo" viewBox="0 0 64 64" width="88" height="88">
          <defs>
            <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#splashGrad)" />
          <rect x="14" y="21" width="24" height="22" rx="5" fill="#ffffff" />
          <path d="M42 28 L52 22 V42 L42 36 Z" fill="#ffffff" />
          <circle cx="26" cy="32" r="3.5" fill="#6366f1" />
        </svg>

        <h1 className="splash-title">
          {letters.map((letter, i) => (
            <span
              key={i}
              className={i >= 6 ? "accent" : ""}
              style={{ animationDelay: `${0.55 + i * 0.07}s` }}
            >
              {letter}
            </span>
          ))}
        </h1>

        <p className="splash-tagline">Meet. Talk. Get the summary.</p>

        <div className="splash-bar">
          <span />
        </div>
      </div>
    </div>
  );
}