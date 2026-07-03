export default function ProgressIllustration() {
  return (
    <svg viewBox="0 0 400 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      {/* Background blob */}
      <ellipse cx="200" cy="200" rx="165" ry="145" fill="#d8ecfd" />

      {/* Trophy base */}
      <rect x="170" y="290" width="60" height="16" rx="6" fill="#ffc700" />
      <rect x="185" y="270" width="30" height="24" rx="4" fill="#ffc700" />

      {/* Trophy cup */}
      <path d="M140 140 Q138 200 175 220 Q200 230 200 230 Q200 230 225 220 Q262 200 260 140Z" fill="#ffc700" />
      <path d="M140 140 L120 140 Q110 180 138 198" stroke="#ffc700" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M260 140 L280 140 Q290 180 262 198" stroke="#ffc700" strokeWidth="12" strokeLinecap="round" fill="none" />

      {/* Trophy shine */}
      <path d="M165 155 Q172 148 180 155" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M165 170 Q175 162 185 170" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5" />

      {/* Star on trophy */}
      <path d="M200 158 L206 175 L224 175 L210 185 L215 202 L200 192 L185 202 L190 185 L176 175 L194 175 Z" fill="white" opacity="0.85" />

      {/* Progress rings */}
      <circle cx="100" cy="120" r="42" stroke="#d8e6f7" strokeWidth="8" fill="none" />
      <circle cx="100" cy="120" r="42" stroke="#1e90e8" strokeWidth="8" fill="none"
        strokeDasharray="176 264" strokeLinecap="round" transform="rotate(-90 100 120)" />
      <text x="100" y="116" textAnchor="middle" fill="#0f2748" fontSize="16" fontWeight="800" fontFamily="Fredoka, sans-serif">85%</text>
      <text x="100" y="132" textAnchor="middle" fill="#5b769a" fontSize="9" fontFamily="Fredoka, sans-serif">Math</text>

      <circle cx="300" cy="120" r="42" stroke="#d8e6f7" strokeWidth="8" fill="none" />
      <circle cx="300" cy="120" r="42" stroke="#1cb0f6" strokeWidth="8" fill="none"
        strokeDasharray="213 264" strokeLinecap="round" transform="rotate(-90 300 120)" />
      <text x="300" y="116" textAnchor="middle" fill="#0f2748" fontSize="16" fontWeight="800" fontFamily="Fredoka, sans-serif">72%</text>
      <text x="300" y="132" textAnchor="middle" fill="#5b769a" fontSize="9" fontFamily="Fredoka, sans-serif">Science</text>

      {/* Subject pills */}
      <rect x="88" y="210" width="90" height="26" rx="13" fill="#d8ecfd" />
      <text x="133" y="228" textAnchor="middle" fill="#1670be" fontSize="11" fontWeight="700" fontFamily="Fredoka, sans-serif">Social Studies</text>

      <rect x="222" y="210" width="70" height="26" rx="13" fill="#ffc700" opacity="0.3" />
      <text x="257" y="228" textAnchor="middle" fill="#7a5a00" fontSize="11" fontWeight="700" fontFamily="Fredoka, sans-serif">Language</text>

      {/* Sparkles */}
      <path d="M52 200 L56 190 L60 200 L70 204 L60 208 L56 218 L52 208 L42 204 Z" fill="#1e90e8" />
      <path d="M348 160 L351 153 L354 160 L361 163 L354 166 L351 173 L348 166 L341 163 Z" fill="#1cb0f6" />
    </svg>
  );
}
