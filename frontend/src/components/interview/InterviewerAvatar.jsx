import { Component, useEffect, useRef } from 'react';

/**
 * Animated virtual interviewer. Everything is driven from one
 * requestAnimationFrame loop that writes SVG attributes directly through refs,
 * so 60fps lip-sync and blinking never cause React re-renders (and can never
 * interfere with audio playback).
 *
 * `mode`: 'speaking' | 'listening' | 'thinking' | 'idle'
 * `getMouthLevel`: () => 0..1, sampled every frame while speaking.
 */
const SKIN = '#e9b896';
const SKIN_SHADE = '#cf9575';
const HAIR = '#2b1d16';
const HAIR_HIGHLIGHT = '#4a3427';

function mouthPaths(open, smile) {
  const cornerY = 222 - smile * 3;
  const upperMid = 218.5 - open * 1.5;
  const lowerMid = 226 + open * 9 + smile * 1.2;
  const width = 15 + smile * 1.5 - open * 1.5;
  const left = 200 - width;
  const right = 200 + width;
  return {
    upper: `M${left} ${cornerY} Q${200 - width / 2} ${upperMid - 3} 200 ${upperMid - 1} Q${200 + width / 2} ${upperMid - 3} ${right} ${cornerY} Q200 ${upperMid + 2.5} ${left} ${cornerY} Z`,
    lower: `M${left} ${cornerY} Q200 ${upperMid + 2.5 + open * 7} ${right} ${cornerY} Q200 ${lowerMid + 3} ${left} ${cornerY} Z`,
    inner: `M${left + 1.5} ${cornerY} Q200 ${upperMid + 1.5} ${right - 1.5} ${cornerY} Q200 ${upperMid + 2.5 + open * 7.5} ${left + 1.5} ${cornerY} Z`
  };
}

export function InterviewerAvatar({ mode = 'idle', getMouthLevel, className = '' }) {
  const headRef = useRef(null);
  const bodyRef = useRef(null);
  const upperLipRef = useRef(null);
  const lowerLipRef = useRef(null);
  const innerMouthRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const leftIrisRef = useRef(null);
  const rightIrisRef = useRef(null);
  const browsRef = useRef(null);
  const modeRef = useRef(mode);
  const getLevelRef = useRef(getMouthLevel);

  modeRef.current = mode;
  getLevelRef.current = getMouthLevel;

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let mouthOpen = 0;
    let smile = 0.35;
    let gazeX = 0;
    let gazeY = 0;
    let brow = 0;
    let nextBlinkAt = performance.now() + 2000;
    let blinkStartedAt = -1;
    let nextGlanceAt = performance.now() + 3000;
    let glanceTarget = { x: 0, y: 0 };
    let nodUntil = 0;
    let nextNodAt = performance.now() + 5000;

    const tick = (now) => {
      const currentMode = modeRef.current;
      const t = now / 1000;

      // Mouth: follow the voice level with a fast attack and slower release.
      const target = currentMode === 'speaking' ? Math.max(0, Math.min(1, getLevelRef.current?.() || 0)) : 0;
      mouthOpen += (target - mouthOpen) * (target > mouthOpen ? 0.55 : 0.25);
      const smileTarget = currentMode === 'listening' ? 0.75 : currentMode === 'thinking' ? 0.2 : 0.45;
      smile += (smileTarget - smile) * 0.05;
      const paths = mouthPaths(mouthOpen, smile);
      upperLipRef.current?.setAttribute('d', paths.upper);
      lowerLipRef.current?.setAttribute('d', paths.lower);
      innerMouthRef.current?.setAttribute('d', paths.inner);

      // Blinks every 2.5-6s, ~150ms long; occasionally a double blink.
      let lid = 1;
      if (blinkStartedAt < 0 && now >= nextBlinkAt) blinkStartedAt = now;
      if (blinkStartedAt >= 0) {
        const p = (now - blinkStartedAt) / 150;
        if (p >= 1) {
          blinkStartedAt = -1;
          nextBlinkAt = now + (Math.random() < 0.15 ? 220 : 2500 + Math.random() * 3500);
        } else {
          lid = Math.max(0.08, Math.abs(1 - p * 2));
        }
      }
      const lidTransform = (cx) => `translate(${cx} 160) scale(1 ${lid}) translate(${-cx} -160)`;
      leftEyeRef.current?.setAttribute('transform', lidTransform(173));
      rightEyeRef.current?.setAttribute('transform', lidTransform(227));

      // Gaze: steady eye contact, with brief natural glances; looks up/aside when thinking.
      if (now >= nextGlanceAt) {
        const glancing = currentMode === 'thinking' || Math.random() < 0.35;
        glanceTarget = glancing
          ? currentMode === 'thinking'
            ? { x: 2.2, y: -2 }
            : { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 1.5 }
          : { x: 0, y: 0 };
        nextGlanceAt = now + (glancing ? 700 + Math.random() * 600 : 2500 + Math.random() * 3000);
      }
      gazeX += (glanceTarget.x - gazeX) * 0.15;
      gazeY += (glanceTarget.y - gazeY) * 0.15;
      const irisTransform = `translate(${gazeX} ${gazeY})`;
      leftIrisRef.current?.setAttribute('transform', irisTransform);
      rightIrisRef.current?.setAttribute('transform', irisTransform);

      // Brows lift slightly with emphasis while speaking and when attentive.
      const browTarget = currentMode === 'speaking' ? mouthOpen * 2.2 : currentMode === 'listening' ? 1 : 0;
      brow += (browTarget - brow) * 0.12;
      browsRef.current?.setAttribute('transform', `translate(0 ${-brow})`);

      // Head: very small idle sway, a gentle tilt while listening, and
      // occasional acknowledging nods. Kept subtle so it never distracts.
      if (!reduceMotion) {
        if (currentMode === 'listening' && now >= nextNodAt) {
          nodUntil = now + 700;
          nextNodAt = now + 4500 + Math.random() * 4000;
        }
        const nod = now < nodUntil ? Math.sin(((nodUntil - now) / 700) * Math.PI) * 2.2 : 0;
        const tilt = (currentMode === 'listening' ? 2.2 : 0) + Math.sin(t * 0.6) * 0.9 + (currentMode === 'speaking' ? Math.sin(t * 1.7) * 0.8 : 0);
        const dx = Math.sin(t * 0.45) * 1.2;
        const dy = Math.sin(t * 0.9) * 0.6 + nod;
        headRef.current?.setAttribute('transform', `translate(${dx} ${dy}) rotate(${tilt} 200 265)`);
        bodyRef.current?.setAttribute('transform', `translate(0 ${Math.sin(t * 1.4) * 0.8})`);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const initialMouth = mouthPaths(0, 0.45);

  return (
    <svg
      viewBox="60 40 280 360"
      preserveAspectRatio="xMidYMax meet"
      className={className}
      role="img"
      aria-label="AI interviewer"
    >
      <defs>
        <radialGradient id="gi-av-skin" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#f6d0b1" />
          <stop offset="60%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </radialGradient>
        <linearGradient id="gi-av-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKIN_SHADE} />
          <stop offset="45%" stopColor={SKIN} />
        </linearGradient>
        <linearGradient id="gi-av-blazer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c3a56" />
          <stop offset="100%" stopColor="#18213a" />
        </linearGradient>
        <linearGradient id="gi-av-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={HAIR_HIGHLIGHT} />
          <stop offset="55%" stopColor={HAIR} />
        </linearGradient>
      </defs>

      <g ref={bodyRef}>
        {/* Shoulders, blazer and blouse */}
        <path d="M34 400 C44 338 104 310 158 300 L242 300 C296 310 356 338 366 400 Z" fill="url(#gi-av-blazer)" />
        <path d="M170 300 L200 368 L230 300 Z" fill="#eef2f7" />
        <path d="M158 300 L200 372 L176 400 L120 400 C128 360 142 322 158 300 Z" fill="#22304b" opacity="0.9" />
        <path d="M242 300 L200 372 L224 400 L280 400 C272 360 258 322 242 300 Z" fill="#22304b" opacity="0.9" />
        <path d="M176 250 L176 304 Q200 322 224 304 L224 250 Z" fill="url(#gi-av-neck)" />
        <path d="M182 304 Q200 316 218 304 L214 312 Q200 324 186 312 Z" fill="#000" opacity="0.08" />
      </g>

      <g ref={headRef}>
        {/* Hair behind the head */}
        <path
          d="M120 172 C112 96 158 58 204 58 C258 60 294 100 286 178 C283 222 290 262 298 296 C276 306 256 300 244 286 L156 286 C144 300 124 306 102 296 C110 262 122 220 120 172 Z"
          fill="url(#gi-av-hair)"
        />
        {/* Ears */}
        <ellipse cx="141" cy="174" rx="8" ry="15" fill={SKIN_SHADE} />
        <ellipse cx="259" cy="174" rx="8" ry="15" fill={SKIN_SHADE} />
        {/* Face */}
        <path
          d="M141 160 C141 106 170 84 200 84 C231 84 259 106 259 160 C259 202 248 236 226 256 C214 267 206 271 200 271 C194 271 186 267 174 256 C152 236 141 202 141 160 Z"
          fill="url(#gi-av-skin)"
        />
        <ellipse cx="166" cy="200" rx="14" ry="8" fill="#e58e86" opacity="0.18" />
        <ellipse cx="234" cy="200" rx="14" ry="8" fill="#e58e86" opacity="0.18" />

        {/* Eyes */}
        <g ref={leftEyeRef}>
          <ellipse cx="173" cy="161" rx="11" ry="6.2" fill="#fbfaf8" />
          <g ref={leftIrisRef}>
            <circle cx="173" cy="161" r="5.3" fill="#5a3d2b" />
            <circle cx="173" cy="161" r="2.5" fill="#1b120d" />
            <circle cx="175" cy="159" r="1.3" fill="#fff" opacity="0.9" />
          </g>
          <path d="M161.5 159.5 Q173 151.5 184.5 159.5" stroke="#2b1d16" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
        <g ref={rightEyeRef}>
          <ellipse cx="227" cy="161" rx="11" ry="6.2" fill="#fbfaf8" />
          <g ref={rightIrisRef}>
            <circle cx="227" cy="161" r="5.3" fill="#5a3d2b" />
            <circle cx="227" cy="161" r="2.5" fill="#1b120d" />
            <circle cx="229" cy="159" r="1.3" fill="#fff" opacity="0.9" />
          </g>
          <path d="M215.5 159.5 Q227 151.5 238.5 159.5" stroke="#2b1d16" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>

        {/* Brows */}
        <g ref={browsRef}>
          <path d="M159 145 Q172 137 187 142" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M213 142 Q228 137 241 145" stroke={HAIR} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>

        {/* Nose */}
        <path d="M201 166 Q198 184 192 192 Q200 197.5 208 192" stroke="#b77b5e" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />

        {/* Mouth */}
        <path ref={innerMouthRef} d={initialMouth.inner} fill="#5b2026" />
        <path ref={upperLipRef} d={initialMouth.upper} fill="#b55d63" />
        <path ref={lowerLipRef} d={initialMouth.lower} fill="#c4686e" />

        {/* Front hair, swept to one side */}
        <path
          d="M139 156 C140 102 172 76 206 78 C242 80 266 106 261 156 C252 124 228 106 198 108 C178 110 160 124 151 142 C147 150 142 158 139 156 Z"
          fill="url(#gi-av-hair)"
        />
      </g>
    </svg>
  );
}

/** Static fallback so a rendering failure never takes the interview screen down. */
export class AvatarBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-4xl font-bold text-white">
          AI
        </div>
      );
    }
    return this.props.children;
  }
}
