export default function AssessmentIllustration() {
  return (
    <svg viewBox="0 0 400 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="w-full h-full">
      {/* Background blob */}
      <ellipse cx="200" cy="195" rx="168" ry="148" fill="#d8ecfd" />

      {/* Clipboard body */}
      <rect x="100" y="90" width="200" height="230" rx="14" fill="white" stroke="#d8e6f7" strokeWidth="2" />
      <rect x="150" y="78" width="100" height="30" rx="10" fill="#1e90e8" />
      <circle cx="200" cy="78" r="10" fill="#1670be" />

      {/* Question rows */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(0, ${i * 42})`}>
          {/* Question line */}
          <rect x="124" y="138" width="120" height="8" rx="4" fill="#d8e6f7" />
          {/* Answer options */}
          <circle cx="126" cy="162" r="8" fill={i === 1 ? "#1e90e8" : "#d8e6f7"} />
          {i === 1 && <path d="M121 162 L125 167 L132 157" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          <rect x="140" y="157" width="60" height="8" rx="4" fill="#d8e6f7" />

          <circle cx="126" cy="182" r="8" fill={i === 3 ? "#1e90e8" : "#d8e6f7"} />
          {i === 3 && <path d="M121 182 L125 187 L132 177" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          <rect x="140" y="177" width="48" height="8" rx="4" fill="#d8e6f7" />
        </g>
      ))}

      {/* Character peeking from side */}
      <circle cx="336" cy="180" r="44" fill="#ffd5b0" />
      {/* Eyes */}
      <circle cx="322" cy="174" r="7" fill="white" />
      <circle cx="350" cy="174" r="7" fill="white" />
      <circle cx="324" cy="175" r="4" fill="#3c3c3c" />
      <circle cx="352" cy="175" r="4" fill="#3c3c3c" />
      {/* Eyebrows */}
      <path d="M316 163 Q322 158 328 162" stroke="#3c3c3c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M344 160 Q350 155 356 160" stroke="#3c3c3c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Smile */}
      <path d="M320 192 Q336 204 352 192" stroke="#3c3c3c" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Hair */}
      <path d="M296 168 Q300 130 336 125 Q372 130 376 168 Q365 148 336 146 Q307 148 296 168Z" fill="#1e90e8" />

      {/* Pencil */}
      <rect x="64" y="140" width="12" height="80" rx="6" fill="#ffc700" transform="rotate(20 64 140)" />
      <polygon points="64,218 76,218 70,236" fill="#ffd5b0" transform="rotate(20 64 140)" />
      <rect x="64" y="136" width="12" height="12" rx="2" fill="#1cb0f6" transform="rotate(20 64 140)" />

      {/* Stars */}
      <path d="M48 100 L52 90 L56 100 L66 104 L56 108 L52 118 L48 108 L38 104 Z" fill="#ffc700" />
      <path d="M358 260 L361 253 L364 260 L371 263 L364 266 L361 273 L358 266 L351 263 Z" fill="#1e90e8" />
    </svg>
  );
}
