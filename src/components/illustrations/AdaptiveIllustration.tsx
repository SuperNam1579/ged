export default function AdaptiveIllustration() {
  return (
    <svg viewBox="0 0 400 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      {/* Background blob */}
      <ellipse cx="200" cy="200" rx="170" ry="140" fill="#d8ecfd" />

      {/* Screen / device */}
      <rect x="80" y="100" width="240" height="160" rx="16" fill="white" stroke="#d8e6f7" strokeWidth="2" />
      <rect x="80" y="100" width="240" height="36" rx="16" fill="#1e90e8" />
      <rect x="80" y="120" width="240" height="16" fill="#1e90e8" />
      <circle cx="104" cy="118" r="6" fill="white" opacity="0.5" />
      <circle cx="124" cy="118" r="6" fill="white" opacity="0.5" />
      <circle cx="144" cy="118" r="6" fill="white" opacity="0.5" />

      {/* Chart bars */}
      <rect x="110" y="200" width="28" height="40" rx="6" fill="#d8e6f7" />
      <rect x="150" y="180" width="28" height="60" rx="6" fill="#1cb0f6" />
      <rect x="190" y="160" width="28" height="80" rx="6" fill="#1e90e8" />
      <rect x="230" y="145" width="28" height="95" rx="6" fill="#1e90e8" />
      <rect x="270" y="170" width="28" height="70" rx="6" fill="#1cb0f6" />

      {/* Trend arrow */}
      <path d="M110 215 L155 185 L195 165 L240 150" stroke="#ffc700" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 3" />
      <polygon points="240,142 252,152 238,158" fill="#ffc700" />

      {/* Brain icon blob */}
      <circle cx="310" cy="90" r="40" fill="#1670be" />
      <path d="M296 88 Q296 76 308 76 Q312 68 320 72 Q328 68 332 76 Q344 76 344 88 Q344 102 332 104 Q328 112 320 108 Q312 112 308 104 Q296 102 296 88Z" fill="white" opacity="0.9" />
      <path d="M308 88 Q314 82 320 88 Q326 82 332 88" stroke="#1670be" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M308 96 Q314 102 320 96 Q326 102 332 96" stroke="#1670be" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Sparkles */}
      <path d="M60 80 L64 70 L68 80 L78 84 L68 88 L64 98 L60 88 L50 84 Z" fill="#ffc700" />
      <path d="M350 200 L353 192 L356 200 L364 203 L356 206 L353 214 L350 206 L342 203 Z" fill="#1cb0f6" />

      {/* Level badge */}
      <circle cx="68" cy="270" r="26" fill="#ffc700" stroke="white" strokeWidth="3" />
      <text x="68" y="278" textAnchor="middle" fill="#3c3c3c" fontSize="13" fontWeight="800" fontFamily="sans-serif">LVL</text>
      <text x="68" y="292" textAnchor="middle" fill="#3c3c3c" fontSize="10" fontFamily="sans-serif">5</text>
    </svg>
  );
}
