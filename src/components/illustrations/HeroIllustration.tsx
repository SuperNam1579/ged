export default function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 480 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full h-full"
    >
      {/* Body blob */}
      <ellipse cx="240" cy="340" rx="120" ry="80" fill="#58cc02" />

      {/* Head */}
      <circle cx="240" cy="200" r="90" fill="#ffd5b0" />

      {/* Hair */}
      <path d="M155 185 Q160 110 240 105 Q320 110 325 185 Q310 160 240 158 Q170 160 155 185Z" fill="#3c3c3c" />

      {/* Eyes */}
      <circle cx="210" cy="195" r="14" fill="white" />
      <circle cx="270" cy="195" r="14" fill="white" />
      <circle cx="213" cy="196" r="8" fill="#3c3c3c" />
      <circle cx="273" cy="196" r="8" fill="#3c3c3c" />
      <circle cx="216" cy="193" r="3" fill="white" />
      <circle cx="276" cy="193" r="3" fill="white" />

      {/* Smile */}
      <path d="M215 225 Q240 248 265 225" stroke="#3c3c3c" strokeWidth="3.5" strokeLinecap="round" fill="none" />

      {/* Graduation cap */}
      <rect x="170" y="120" width="140" height="18" rx="4" fill="#3c3c3c" />
      <polygon points="240,88 170,120 310,120" fill="#3c3c3c" />
      <rect x="296" y="118" width="5" height="30" fill="#3c3c3c" />
      <circle cx="298.5" cy="152" r="8" fill="#ffc700" />

      {/* Arms */}
      <ellipse cx="148" cy="310" rx="28" ry="52" rx="28" ry="52" fill="#58cc02" transform="rotate(-15 148 310)" />
      <ellipse cx="332" cy="310" rx="28" ry="52" fill="#58cc02" transform="rotate(15 332 310)" />

      {/* Hands holding book */}
      <circle cx="135" cy="356" r="22" fill="#ffd5b0" />
      <circle cx="345" cy="356" r="22" fill="#ffd5b0" />

      {/* Book */}
      <rect x="148" y="338" width="184" height="120" rx="8" fill="#1cb0f6" />
      <rect x="148" y="338" width="92" height="120" rx="8" fill="#0d91d4" />
      <line x1="240" y1="338" x2="240" y2="458" stroke="white" strokeWidth="3" />
      {/* Book lines */}
      <rect x="164" y="362" width="58" height="6" rx="3" fill="white" opacity="0.7" />
      <rect x="164" y="378" width="50" height="6" rx="3" fill="white" opacity="0.7" />
      <rect x="164" y="394" width="54" height="6" rx="3" fill="white" opacity="0.7" />
      <rect x="258" y="362" width="58" height="6" rx="3" fill="white" opacity="0.7" />
      <rect x="258" y="378" width="50" height="6" rx="3" fill="white" opacity="0.7" />
      <rect x="258" y="394" width="54" height="6" rx="3" fill="white" opacity="0.7" />

      {/* Legs */}
      <ellipse cx="205" cy="415" rx="30" ry="48" fill="#4b4b4b" />
      <ellipse cx="275" cy="415" rx="30" ry="48" fill="#4b4b4b" />

      {/* Shoes */}
      <ellipse cx="200" cy="458" rx="36" ry="14" fill="#3c3c3c" />
      <ellipse cx="280" cy="458" rx="36" ry="14" fill="#3c3c3c" />

      {/* Stars / sparkles */}
      <path d="M60 120 L65 105 L70 120 L85 125 L70 130 L65 145 L60 130 L45 125 Z" fill="#ffc700" />
      <path d="M400 80 L404 68 L408 80 L420 84 L408 88 L404 100 L400 88 L388 84 Z" fill="#a570ff" />
      <path d="M420 200 L423 192 L426 200 L434 203 L426 206 L423 214 L420 206 L412 203 Z" fill="#58cc02" />
      <path d="M40 260 L43 252 L46 260 L54 263 L46 266 L43 274 L40 266 L32 263 Z" fill="#cc348d" />

      {/* XP badge */}
      <circle cx="360" cy="160" r="32" fill="#ffc700" />
      <text x="360" y="167" textAnchor="middle" fill="#3c3c3c" fontSize="16" fontWeight="800" fontFamily="sans-serif">XP</text>

      {/* Checkmark bubble */}
      <circle cx="95" cy="200" r="28" fill="#d7ffb8" stroke="#58cc02" strokeWidth="3" />
      <path d="M82 200 L92 212 L110 190" stroke="#58cc02" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
