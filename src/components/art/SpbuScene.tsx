/**
 * Ilustrasi semi-isometrik buatan sendiri: SPBU dengan kanopi, petugas, kendaraan operasional,
 * kardus arsip, dan rak arsip. (Bukan logo resmi; logo Pertamina Retail dipasang terpisah.)
 */
const S = 0.95, OX = 360, OY = 118;
const P = (x: number, y: number, z = 0): [number, number] => [OX + (x - y) * 0.866 * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (a: [number, number][]) => a.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");

type C = { top: string; left: string; right: string };
function Box({ x, y, z, w, d, h, c, stroke = "rgba(22,59,99,.12)" }: { x: number; y: number; z: number; w: number; d: number; h: number; c: C; stroke?: string }) {
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  return (
    <g stroke={stroke} strokeWidth=".6" strokeLinejoin="round">
      <polygon points={pts(left)} fill={c.left} />
      <polygon points={pts(right)} fill={c.right} />
      <polygon points={pts(top)} fill={c.top} />
    </g>
  );
}
/** Pita warna di sisi kiri (menghadap +y) atau kanan (menghadap +x) sebuah balok. */
function BandL({ x, y, w, d, z0, z1, fill }: { x: number; y: number; w: number; d: number; z0: number; z1: number; fill: string }) {
  return <polygon points={pts([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1)])} fill={fill} />;
}
function BandR({ x, y, w, d, z0, z1, fill }: { x: number; y: number; w: number; d: number; z0: number; z1: number; fill: string }) {
  return <polygon points={pts([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x + w, y, z1)])} fill={fill} />;
}

const WHITE: C = { top: "#FFFFFF", left: "#E9EFF7", right: "#D5DFEC" };
const CARD: C = { top: "#F5D9A6", left: "#DDA862", right: "#C48F4D" };
const RED: C = { top: "#F25A5F", left: "#E52329", right: "#B91C21" };
const BLUE: C = { top: "#3C9AE0", left: "#006CB7", right: "#00508A" };
const NAVY: C = { top: "#2D5A8C", left: "#163B63", right: "#0F2C4B" };
const GRAY: C = { top: "#E3E9F0", left: "#B9C5D3", right: "#A3B1C2" };

function Person({ x, y, shirt, cap, pants = "#163B63", clip, flip }: { x: number; y: number; shirt: string; cap?: string; pants?: string; clip?: boolean; flip?: boolean }) {
  const [cx, cy] = P(x, y, 0);
  return (
    <g transform={`translate(${cx} ${cy}) scale(${flip ? -1 : 1} 1)`}>
      <ellipse cx="0" cy="2" rx="13" ry="4" fill="rgba(22,59,99,.18)" />
      <rect x="-7" y="-26" width="5.5" height="26" rx="2.5" fill={pants} />
      <rect x="1.5" y="-26" width="5.5" height="26" rx="2.5" fill={pants} />
      <rect x="-10" y="-58" width="20" height="36" rx="8" fill={shirt} />
      <rect x="-14" y="-55" width="6" height="24" rx="3" fill={shirt} transform="rotate(8 -11 -55)" />
      <rect x="8" y="-55" width="6" height="24" rx="3" fill={shirt} transform="rotate(-18 11 -55)" />
      <circle cx="0" cy="-67" r="9" fill="#F2C9A0" />
      <circle cx="-3" cy="-67.5" r="1.1" fill="#163B63" /><circle cx="3" cy="-67.5" r="1.1" fill="#163B63" />
      <path d="M-3 -63.5 Q0 -61.5 3 -63.5" stroke="#163B63" strokeWidth="1" fill="none" strokeLinecap="round" />
      {cap ? <path d="M-9.5 -69 Q0 -82 9.5 -69 L12 -68 L-9.5 -68 Z" fill={cap} /> : <path d="M-9 -69 Q0 -80 9 -69 Q4 -73 -9 -69Z" fill="#3a2a1c" />}
      {clip && (<g transform="translate(9 -50) rotate(-12)"><rect width="11" height="15" rx="1.5" fill="#fff" stroke="#9fb4cc" /><rect x="3" y="-2" width="5" height="3" rx="1" fill="#E52329" /><path d="M2.5 5h6M2.5 8h6M2.5 11h4" stroke="#9fb4cc" strokeWidth="1" /></g>)}
    </g>
  );
}

export function SpbuScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 720 470" className={className} role="img" aria-label="Ilustrasi SPBU Pertamina dengan petugas, kendaraan operasional, kardus arsip, dan rak arsip">
      <defs>
        <radialGradient id="bgG" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#CFE4F6" /></radialGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E5F1FB" /><stop offset="1" stopColor="#F5F8FC" /></linearGradient>
      </defs>
      <ellipse cx="360" cy="235" rx="340" ry="225" fill="url(#bgG)" />
      <circle cx="105" cy="95" r="34" fill="#fff" opacity=".7" /><circle cx="130" cy="85" r="26" fill="#fff" opacity=".7" /><circle cx="600" cy="70" r="30" fill="#fff" opacity=".7" />

      {/* alas */}
      <Box x={0} y={0} z={-16} w={300} d={300} h={16} c={{ top: "#DCE9F6", left: "#B4CDE6", right: "#9DBFDF" }} />
      <polygon points={pts([P(14, 14), P(286, 14), P(286, 286), P(14, 286)])} fill="#C6D6E7" />
      <polygon points={pts([P(14, 14), P(286, 14), P(286, 24), P(14, 24)])} fill="#69B345" opacity=".9" />
      <g stroke="#fff" strokeWidth="2" strokeDasharray="10 8" opacity=".9"><polyline points={pts([P(150, 175), P(150, 285)])} fill="none" /></g>

      {/* rak arsip (kiri depan) */}
      <g>
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <Box x={20} y={188} z={8 + r * 28} w={44} d={72} h={3} c={{ top: "#CBD6E3", left: "#9FB0C4", right: "#8798AE" }} />
            {Array.from({ length: 7 }).map((_, i) => (
              <Box key={i} x={24} y={192 + i * 9.6} z={11 + r * 28} w={34} d={6.4} h={22} c={[{ top: "#F5C9CB", left: "#E52329", right: "#B91C21" }, { top: "#C7E3B5", left: "#69B345", right: "#4F9033" }, { top: "#BBD9F0", left: "#006CB7", right: "#00508A" }, CARD][(i + r) % 4]} />
            ))}
          </g>
        ))}
        <Box x={18} y={186} z={0} w={4} d={4} h={92} c={NAVY} /><Box x={62} y={186} z={0} w={4} d={4} h={92} c={NAVY} />
        <Box x={18} y={256} z={0} w={4} d={4} h={92} c={NAVY} /><Box x={62} y={256} z={0} w={4} d={4} h={92} c={NAVY} />
      </g>

      {/* tiang harga (belakang kanan) */}
      <Box x={232} y={26} z={0} w={7} d={7} h={150} c={NAVY} />
      <Box x={214} y={20} z={118} w={44} d={20} h={46} c={WHITE} />
      <BandL x={214} y={20} w={44} d={20} z0={150} z1={162} fill="#E52329" />
      <BandL x={214} y={20} w={44} d={20} z0={138} z1={150} fill="#006CB7" />
      <BandL x={214} y={20} w={44} d={20} z0={126} z1={138} fill="#69B345" />
      <BandR x={214} y={20} w={44} d={20} z0={126} z1={162} fill="#006CB7" />

      {/* van operasional (kanan) */}
      <g>
        <Box x={206} y={96} z={6} w={92} d={40} h={36} c={{ top: "#FFFFFF", left: "#F1F5FA", right: "#D5DFEC" }} />
        <BandL x={206} y={96} w={92} d={40} z0={14} z1={22} fill="#006CB7" />
        <BandL x={206} y={96} w={92} d={40} z0={22} z1={27} fill="#E52329" />
        <BandR x={206} y={96} w={92} d={40} z0={14} z1={22} fill="#00508A" />
        <Box x={298} y={98} z={6} w={22} d={36} h={24} c={{ top: "#BFE0F7", left: "#8FC6EA", right: "#6FB0DA" }} />
        {[[218, 136], [280, 136], [218, 96], [280, 96]].slice(0, 2).map(([wx, wy], i) => (
          <ellipse key={i} cx={P(wx + 10, wy, 6)[0]} cy={P(wx + 10, wy, 6)[1]} rx="11" ry="12" fill="#163B63" />
        ))}
        {[[222, 136], [286, 136]].map(([wx, wy], i) => (<ellipse key={i} cx={P(wx, wy, 4)[0]} cy={P(wx, wy, 4)[1]} rx="5" ry="6" fill="#B9C5D3" />))}
      </g>

      {/* pilar kanopi */}
      <Box x={62} y={46} z={0} w={8} d={8} h={118} c={WHITE} /><Box x={176} y={46} z={0} w={8} d={8} h={118} c={WHITE} />
      {/* pulau pompa */}
      <Box x={82} y={92} z={0} w={86} d={16} h={7} c={GRAY} />
      <Box x={84} y={128} z={0} w={86} d={16} h={7} c={GRAY} />
      {[96, 130].map((px) => (
        <g key={px}>
          <Box x={px} y={94} z={7} w={16} d={12} h={44} c={RED} /><BandL x={px} y={94} w={16} d={12} z0={34} z1={44} fill="#006CB7" />
          <Box x={px + 2} y={96} z={51} w={12} d={8} h={6} c={WHITE} />
        </g>
      ))}
      {[98, 132].map((px) => (
        <g key={px}>
          <Box x={px} y={130} z={7} w={16} d={12} h={44} c={RED} /><BandL x={px} y={130} w={16} d={12} z0={34} z1={44} fill="#69B345" />
          <Box x={px + 2} y={132} z={51} w={12} d={8} h={6} c={WHITE} />
        </g>
      ))}
      {/* pilar depan + atap kanopi */}
      <Box x={62} y={150} z={0} w={8} d={8} h={118} c={WHITE} /><Box x={176} y={150} z={0} w={8} d={8} h={118} c={WHITE} />
      <Box x={52} y={38} z={118} w={142} d={130} h={16} c={WHITE} />
      <BandL x={52} y={38} w={142} d={130} z0={124} z1={130} fill="#E52329" />
      <BandL x={52} y={38} w={142} d={130} z0={130} z1={134} fill="#69B345" />
      <BandR x={52} y={38} w={142} d={130} z0={118} z1={134} fill="#006CB7" />

      {/* kardus arsip bertumpuk */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Box x={196 - i * 1} y={176 + (i % 2) * 2} z={i * 24} w={40} d={30} h={24} c={CARD} />
          <polygon points={pts([P(200, 206 + (i % 2) * 2, i * 24 + 10), P(214, 206 + (i % 2) * 2, i * 24 + 10), P(214, 206 + (i % 2) * 2, i * 24 + 18), P(200, 206 + (i % 2) * 2, i * 24 + 18)])} fill="#fff" />
        </g>
      ))}
      <Box x={236} y={200} z={0} w={30} d={24} h={20} c={CARD} />
      <Box x={150} y={218} z={0} w={26} d={20} h={20} c={CARD} />

      {/* orang */}
      <Person x={104} y={176} shirt="#E52329" cap="#fff" />
      <Person x={170} y={190} shirt="#006CB7" clip flip />
      <Person x={70} y={170} shirt="#69B345" cap="#163B63" pants="#2D5A8C" />

      {/* dokumen melayang */}
      <g className="animate-floaty">
        <g transform="translate(556 150) rotate(8)"><rect width="46" height="58" rx="5" fill="#fff" stroke="#BBD9F0" strokeWidth="2" /><path d="M9 14h28M9 24h28M9 34h20" stroke="#BBD9F0" strokeWidth="3" strokeLinecap="round" /><circle cx="36" cy="46" r="7" fill="#69B345" /><path d="M32.5 46l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></g>
      </g>
      <g className="animate-floaty" style={{ animationDelay: "1.2s" }}>
        <g transform="translate(70 215) rotate(-10)"><path d="M0 10a6 6 0 016-6h16l6 7h24a6 6 0 016 6v30a6 6 0 01-6 6H6a6 6 0 01-6-6z" fill="#F5C543" /><path d="M0 18h64v28a6 6 0 01-6 6H6a6 6 0 01-6-6z" fill="#FBD866" /></g>
      </g>
    </svg>
  );
}
