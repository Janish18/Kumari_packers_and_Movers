import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Interactive moving-truck illustration (pure SVG + CSS, no external assets).
 * Hover the truck to "honk"; the road, wheels and skyline animate continuously.
 */
export default function TruckScene({ className = '' }) {
  const reduce = useReducedMotion()
  const [honk, setHonk] = useState(false)
  return (
    <div className={`relative select-none ${className}`} aria-hidden>
      <svg viewBox="0 0 640 420" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF8453" stopOpacity=".28" /><stop offset="1" stopColor="#3C5499" stopOpacity="0" /></linearGradient>
          <linearGradient id="ts-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8453" /><stop offset="1" stopColor="#F0501A" /></linearGradient>
          <linearGradient id="ts-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8EEFF" /><stop offset="1" stopColor="#93A5D4" /></linearGradient>
          <radialGradient id="ts-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFC6AD" /><stop offset="1" stopColor="#FF6B35" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="470" cy="110" r="130" fill="url(#ts-sun)" opacity=".7" />
        <circle cx="470" cy="110" r="46" fill="#FFA17A" opacity=".9" />
        <ellipse cx="320" cy="250" rx="300" ry="140" fill="url(#ts-sky)" />

        {/* skyline (slow parallax drift) */}
        <motion.g animate={reduce ? undefined : { x: [0, -40] }} transition={{ duration: 18, repeat: Infinity, ease: 'linear', repeatType: 'mirror' }}>
          {[[20, 150, 46, 120], [76, 110, 40, 160], [126, 170, 52, 100], [188, 90, 44, 180], [242, 140, 38, 130], [290, 120, 56, 150], [356, 160, 42, 110], [408, 100, 50, 170], [468, 150, 40, 120], [518, 125, 54, 145], [582, 165, 44, 105]].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y + 40} width={w} height={h} rx="4" fill="#17224A" opacity={0.55 + (i % 3) * 0.12} />
              {Array.from({ length: Math.floor(h / 26) }).map((__, r) => <rect key={r} x={x + 8} y={y + 52 + r * 24} width={w - 16} height="6" rx="2" fill="#FFC6AD" opacity={(i + r) % 3 === 0 ? 0.65 : 0.12} />)}
            </g>
          ))}
        </motion.g>

        {/* drifting clouds */}
        <motion.g animate={reduce ? undefined : { x: [-30, 30] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }} opacity=".5">
          <ellipse cx="130" cy="70" rx="38" ry="12" fill="#fff" /><ellipse cx="160" cy="62" rx="26" ry="10" fill="#fff" />
          <ellipse cx="380" cy="44" rx="34" ry="10" fill="#fff" />
        </motion.g>

        {/* road */}
        <rect x="10" y="318" width="620" height="60" rx="14" fill="#0A1226" opacity=".92" />
        <rect x="10" y="318" width="620" height="4" rx="2" fill="#2B3D78" />

        {/* truck */}
        <g className={reduce ? '' : 'animate-truck-bob'} style={{ transformOrigin: '320px 300px' }} onMouseEnter={() => setHonk(true)} onMouseLeave={() => setHonk(false)} pointerEvents="all">
          <ellipse cx="320" cy="322" rx="190" ry="9" fill="#000" opacity=".28" />
          <rect x="130" y="170" width="250" height="132" rx="12" fill="url(#ts-box)" />
          <rect x="130" y="170" width="250" height="132" rx="12" fill="none" stroke="#fff" strokeOpacity=".25" />
          <text x="255" y="226" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="26" fill="#fff">KUMARI</text>
          <text x="255" y="250" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="11" letterSpacing="4" fill="#101B36">PACKERS &amp; MOVERS</text>
          {[150, 200, 250, 300, 350].map((x) => <rect key={x} x={x} y="266" width="2" height="26" fill="#fff" opacity=".25" />)}
          {/* cab */}
          <path d="M386 206h52c9 0 14 3 19 10l24 34c3 4 5 8 5 14v38H386z" fill="#101B36" />
          <path d="M398 216h40c5 0 8 2 11 6l17 26h-68z" fill="url(#ts-glass)" />
          <rect x="474" y="278" width="14" height="10" rx="3" fill="#FFC857" />
          <rect x="386" y="296" width="106" height="8" rx="4" fill="#2B3D78" />
          {/* wheels */}
          {[190, 270, 440].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="306" r="24" fill="#0A1226" stroke="#2B3D78" strokeWidth="3" />
              <g className={reduce ? '' : 'animate-wheel'} style={{ transformOrigin: `${cx}px 306px`, transformBox: 'fill-box' }}>
                <circle cx={cx} cy="306" r="12" fill="#E1E7F5" />
                {[0, 60, 120, 180, 240, 300].map((a) => <rect key={a} x={cx - 1.5} y="296" width="3" height="9" rx="1.5" fill="#101B36" transform={`rotate(${a} ${cx} 306)`} />)}
                <circle cx={cx} cy="306" r="3.5" fill="#FF6B35" />
              </g>
            </g>
          ))}
          {/* exhaust puffs */}
          {!reduce && [0, 1, 2].map((i) => (
            <motion.circle key={i} cx="120" cy="290" r="6" fill="#fff" initial={{ opacity: 0 }} animate={{ x: [-0, -50], y: [0, -26], opacity: [0.5, 0], scale: [0.6, 1.8] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.65 }} />
          ))}
        </g>

        {/* honk bubble */}
        <motion.g initial={false} animate={{ opacity: honk ? 1 : 0, y: honk ? 0 : 8, scale: honk ? 1 : 0.8 }} style={{ transformOrigin: '500px 180px' }}>
          <rect x="478" y="138" width="92" height="38" rx="19" fill="#fff" /><path d="M500 175l-8 14 22-10z" fill="#fff" />
          <text x="524" y="162" textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight="700" fontSize="14" fill="#101B36">Beep beep!</text>
        </motion.g>

        {/* moving lane dashes */}
        <rect x="30" y="352" width="580" height="4" className="road animate-road-dash" fill="none" />
      </svg>

      {/* floating parcels */}
      <motion.div className="absolute -left-2 top-6 grid h-12 w-12 place-items-center rounded-2xl bg-white/90 text-2xl shadow-lift" animate={reduce ? undefined : { y: [0, -12, 0], rotate: [-4, 4, -4] }} transition={{ duration: 5, repeat: Infinity }}>📦</motion.div>
      <motion.div className="absolute right-4 top-28 grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 text-xl shadow-glow" animate={reduce ? undefined : { y: [0, 10, 0], rotate: [3, -3, 3] }} transition={{ duration: 6, repeat: Infinity, delay: 1 }}>🛋️</motion.div>
    </div>
  )
}
