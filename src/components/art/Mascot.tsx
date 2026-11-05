/** Maskot "Tanya si GEMAS": kardus arsip ramah dengan map dokumen. */
export function Mascot({ size = 120, className = "", mood = "happy" }: { size?: number; className?: string; mood?: "happy" | "think" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className={className} role="img" aria-label="Maskot Tanya si GEMAS">
      <ellipse cx="80" cy="150" rx="46" ry="7" fill="rgba(22,59,99,.15)" />
      {/* map keluar dari kardus */}
      <g transform="rotate(-8 60 50)"><rect x="42" y="14" width="44" height="52" rx="5" fill="#fff" stroke="#BBD9F0" strokeWidth="2" /><path d="M50 28h28M50 38h28M50 48h18" stroke="#BBD9F0" strokeWidth="3" strokeLinecap="round" /></g>
      <g transform="rotate(10 100 50)"><rect x="82" y="10" width="44" height="52" rx="5" fill="#FBD866" /><path d="M82 22h20l4-6h22" stroke="#F5C543" strokeWidth="3" fill="none" /></g>
      {/* badan kardus */}
      <path d="M26 62 L80 46 L134 62 L134 128 L80 146 L26 128Z" fill="#E7B877" />
      <path d="M26 62 L80 78 L134 62 L80 46Z" fill="#F5D9A6" />
      <path d="M80 78 L80 146 L26 128 L26 62Z" fill="#DDA862" />
      <path d="M80 78 L134 62 L134 128 L80 146Z" fill="#C48F4D" opacity=".55" />
      <path d="M62 54 L100 66" stroke="#fff" strokeWidth="9" opacity=".55" strokeLinecap="round" />
      {/* label GEMAS */}
      <rect x="92" y="96" width="30" height="16" rx="3" fill="#006CB7" transform="skewY(-14) translate(0 22)" />
      {/* wajah */}
      <g>
        <circle cx="52" cy="102" r="10" fill="#fff" /><circle cx="78" cy="108" r="10" fill="#fff" />
        <circle cx={mood === "think" ? 54 : 53} cy={mood === "think" ? 99 : 103} r="5" fill="#163B63" /><circle cx={mood === "think" ? 80 : 79} cy={mood === "think" ? 105 : 109} r="5" fill="#163B63" />
        <circle cx="54.5" cy="101" r="1.6" fill="#fff" /><circle cx="80.5" cy="107" r="1.6" fill="#fff" />
        {mood === "happy" ? <path d="M54 122 Q66 134 80 126" stroke="#163B63" strokeWidth="3.5" fill="none" strokeLinecap="round" /> : <path d="M56 125 Q66 123 78 128" stroke="#163B63" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
        <ellipse cx="40" cy="116" rx="5" ry="3" fill="#E52329" opacity=".35" /><ellipse cx="90" cy="126" rx="5" ry="3" fill="#E52329" opacity=".35" />
      </g>
      {/* lengan melambai */}
      <path d="M134 90 Q152 78 148 62" stroke="#DDA862" strokeWidth="8" fill="none" strokeLinecap="round" /><circle cx="148" cy="60" r="7" fill="#F5D9A6" />
      <path d="M26 96 Q10 104 14 120" stroke="#DDA862" strokeWidth="8" fill="none" strokeLinecap="round" /><circle cx="14" cy="122" r="7" fill="#F5D9A6" />
    </svg>
  );
}

/** Tanda aplikasi GEMAS (bukan logo Pertamina). */
export function GemasMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="#006CB7" />
      <path d="M9 15a3 3 0 013-3h6l3 3.5h7a3 3 0 013 3V28a3 3 0 01-3 3H12a3 3 0 01-3-3z" fill="#fff" />
      <path d="M9 19h22v9a3 3 0 01-3 3H12a3 3 0 01-3-3z" fill="#E5F1FB" />
      <circle cx="29" cy="12" r="4.2" fill="#69B345" /><path d="M27.2 12l1.3 1.3 2.3-2.6" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <rect x="9" y="19" width="22" height="2.6" fill="#E52329" />
    </svg>
  );
}
