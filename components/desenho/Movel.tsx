// Desenho de um móvel em escala (unidades = cm), no sistema do próprio móvel: largura em x, profundidade em y, costas em cima.
import type { ReactNode } from 'react';
import { cadeirasLocais, nPortasDe, normRot, partesCama, ret, tam, zonasCadeirasLocais } from '@/lib/geometria';
import type { Movel } from '@/lib/tipos';
import { fmtM, n1 } from '@/lib/util';

/** Translada e gira o desenho do móvel para a posição dele no cômodo. */
export function transfLocal(m: Movel): string {
  const r = ret(m), rot = normRot(m.rot), t = tam(m);
  return `translate(${n1(r.x1 + r.w / 2)} ${n1(r.y1 + r.h / 2)}) rotate(${rot}) translate(${n1(-t.larg / 2)} ${n1(-t.prof / 2)})`;
}

function portinhas(A: number, B: number, n: number, k0 = 1): ReactNode[] {
  const out: ReactNode[] = [];
  for (let k = k0; k < n; k++) out.push(<line key={'pd' + k} className="mv-l" x1={n1((k * A) / n)} y1={B - 10} x2={n1((k * A) / n)} y2={B} />);
  return out;
}

/** O desenho de cada tipo, num retângulo A × B com as costas em y = 0. */
function corpo(m: Movel, A: number, B: number): ReactNode {
  const t = m.tipo, base = <rect key="b" className={`mv-base t-${t}`} x={0} y={0} width={A} height={B} rx={2} />;
  if (t === 'cama') {
    const n = A >= 120 ? 2 : 1, g = 7, pd = Math.min(32, B * 0.18), top = 8, pw = Math.max(10, (A - (n + 1) * g) / n), fy = top + pd + 9;
    return <>
      {base}
      <rect className="mv-cab" x={0} y={0} width={A} height={5} rx={1} />
      {Array.from({ length: n }, (_, k) => <rect key={k} className="mv-trav" x={n1(g + k * (pw + g))} y={top} width={n1(pw)} height={n1(pd)} rx={5} />)}
      <rect className="mv-edr" x={0.8} y={n1(fy)} width={n1(A - 1.6)} height={n1(Math.max(1, B - fy - 0.8))} />
      <line className="mv-l" x1={0} y1={n1(fy)} x2={A} y2={n1(fy)} />
      <path className="mv-l" d={`M${n1(A - 30)} ${n1(fy)} L${A} ${n1(fy + 26)}`} />
    </>;
  }
  if (t === 'guarda-roupa' || t === 'armario') {
    return <>
      {base}
      {t === 'guarda-roupa' && <line className="mv-cabide" x1={6} y1={n1(B / 2)} x2={A - 6} y2={n1(B / 2)} />}
      <line className="mv-l forte" x1={0} y1={B - 2.5} x2={A} y2={B - 2.5} />
      {m.abertura !== 'correr' && portinhas(A, B, nPortasDe(m))}
    </>;
  }
  if (t === 'berco') {
    const r: ReactNode[] = [];
    for (let x = 10; x < A - 6; x += 9) r.push(<line key={'a' + x} className="mv-l fino" x1={x} y1={0} x2={x} y2={5} />, <line key={'b' + x} className="mv-l fino" x1={x} y1={B - 5} x2={x} y2={B} />);
    return <>{base}<rect className="mv-l" x={5} y={5} width={Math.max(1, A - 10)} height={Math.max(1, B - 10)} rx={2} />{r}</>;
  }
  if (t === 'comoda') {
    if (m.abertura === 'abrir') return <>{base}<line className="mv-l forte" x1={0} y1={B - 2.5} x2={A} y2={B - 2.5} />{portinhas(A, B, nPortasDe(m))}</>;
    const n = Math.max(1, Math.round(A / 45));
    return <>{base}<line className="mv-l forte" x1={0} y1={B - 2.5} x2={A} y2={B - 2.5} />
      {Array.from({ length: n }, (_, k) => { const c = ((k + 0.5) * A) / n; return <line key={k} className="mv-l" x1={n1(c - 7)} y1={B - 8} x2={n1(c + 7)} y2={B - 8} />; })}</>;
  }
  if (t === 'mesa') return <>{base}<line className="mv-l forte" x1={0} y1={B - 2.5} x2={A} y2={B - 2.5} /></>;
  if (t === 'cadeira') {
    const enc = Math.min(8, B * 0.18), ass = Math.min(12, B * 0.26);
    return <>{base}<rect className="mv-cab" x={2} y={0} width={n1(Math.max(1, A - 4))} height={n1(enc)} rx={2} />
      <rect className="mv-l" x={5} y={n1(ass)} width={n1(Math.max(1, A - 10))} height={n1(Math.max(4, B - ass - 5))} rx={4} /></>;
  }
  if (t === 'sofa') {
    const enc = Math.min(22, B * 0.24), braco = Math.min(16, A * 0.1), n = A >= 170 ? 3 : 2, w = (A - 2 * braco) / n;
    return <>{base}
      <rect className="mv-estofo" x={0} y={0} width={A} height={n1(enc)} rx={4} />
      <rect className="mv-estofo" x={0} y={0} width={n1(braco)} height={B} rx={4} />
      <rect className="mv-estofo" x={n1(A - braco)} y={0} width={n1(braco)} height={B} rx={4} />
      {Array.from({ length: n - 1 }, (_, k) => <line key={k} className="mv-l" x1={n1(braco + (k + 1) * w)} y1={n1(enc)} x2={n1(braco + (k + 1) * w)} y2={B - 4} />)}
    </>;
  }
  if (t === 'rack') return <>{base}<rect className="mv-tv" x={n1(A * 0.15)} y={3} width={n1(A * 0.7)} height={4} rx={1} /><line className="mv-l forte" x1={0} y1={B - 2.5} x2={A} y2={B - 2.5} /></>;
  if (t === 'estante') {
    const n = Math.max(1, Math.round(A / 40));
    return <>{base}{Array.from({ length: n - 1 }, (_, k) => <line key={k} className="mv-l" x1={n1(((k + 1) * A) / n)} y1={0} x2={n1(((k + 1) * A) / n)} y2={B} />)}<line className="mv-l forte" x1={0} y1={B - 2} x2={A} y2={B - 2} /></>;
  }
  if (t === 'geladeira') {
    const n = m.nPortas >= 2 ? 2 : 1;
    return <>{base}<line className="mv-l forte" x1={0} y1={B - 3} x2={A} y2={B - 3} />{portinhas(A, B, n)}
      <line className="mv-l" x1={n1(A * (n === 1 ? 0.82 : 0.44))} y1={B - 9} x2={n1(A * (n === 1 ? 0.82 : 0.44))} y2={B - 4} /></>;
  }
  if (t === 'fogao') {
    const r = Math.min(A, B) * 0.13;
    return <>{base}
      {[[0.3, 0.32], [0.7, 0.32], [0.3, 0.7], [0.7, 0.7]].map(([fx, fy], k) => <circle key={k} className="mv-l" cx={n1(A * fx)} cy={n1(B * fy * 0.85)} r={n1(r)} />)}
      <line className="mv-l forte" x1={0} y1={B - 2.5} x2={A} y2={B - 2.5} /></>;
  }
  if (t === 'pia') {
    const bw = Math.min(70, A * 0.45), bx = A * 0.5 - bw / 2;
    return <>{base}<rect className="mv-l" x={n1(bx)} y={n1(B * 0.22)} width={n1(bw)} height={n1(B * 0.6)} rx={6} /><circle className="mv-l" cx={n1(A * 0.5)} cy={n1(B * 0.12)} r={2.5} /></>;
  }
  if (t === 'lavadora') return <>{base}<circle className="mv-l" cx={n1(A / 2)} cy={n1(B * 0.55)} r={n1(Math.min(A, B) * 0.32)} /><line className="mv-l forte" x1={0} y1={B - 2} x2={A} y2={B - 2} /></>;
  if (t === 'escada') {
    if (m.escada === 'caracol') {
      // degraus em leque em volta do pilar do meio; a seta mostra o sentido de subida
      const r = Math.min(A, B) / 2, cx = A / 2, cy = B / 2, n = 12, rs = r * 0.62;
      const raios = Array.from({ length: n }, (_, k) => {
        const a = (k / n) * 2 * Math.PI;
        return <line key={k} className="mv-l fino" x1={n1(cx + 7 * Math.cos(a))} y1={n1(cy + 7 * Math.sin(a))} x2={n1(cx + r * Math.cos(a))} y2={n1(cy + r * Math.sin(a))} />;
      });
      const ini = { x: cx + rs, y: cy }, fim = { x: cx, y: cy - rs };
      return <>
        <rect className="mv-base t-escada" x={0} y={0} width={A} height={B} rx={2} />
        <circle className="mv-l" cx={n1(cx)} cy={n1(cy)} r={n1(r)} />
        {raios}
        <circle className="mv-cab" cx={n1(cx)} cy={n1(cy)} r={6} />
        <path className="mv-seta" d={`M${n1(ini.x)} ${n1(ini.y)} A${n1(rs)} ${n1(rs)} 0 1 1 ${n1(fim.x)} ${n1(fim.y)}`} />
        <path className="mv-seta" d={`M${n1(fim.x + 6)} ${n1(fim.y - 5)} L${n1(fim.x)} ${n1(fim.y)} L${n1(fim.x + 6)} ${n1(fim.y + 5)}`} />
      </>;
    }
    // reta: a entrada (primeiro degrau) fica na frente; a seta aponta para onde sobe
    const n = Math.max(3, Math.round(B / 28)), passo = B / n;
    return <>{base}
      {Array.from({ length: n - 1 }, (_, k) => <line key={k} className="mv-l fino" x1={0} y1={n1((k + 1) * passo)} x2={A} y2={n1((k + 1) * passo)} />)}
      <line className="mv-seta" x1={n1(A / 2)} y1={n1(B - 8)} x2={n1(A / 2)} y2={10} />
      <path className="mv-seta" d={`M${n1(A / 2 - 6)} 18 L${n1(A / 2)} 9 L${n1(A / 2 + 6)} 18`} />
    </>;
  }
  return <>{base}<line className="mv-l forte" x1={n1(A / 2 - 8)} y1={B - 5} x2={n1(A / 2 + 8)} y2={B - 5} /></>;
}

function cadeiraLocal(k: number, c: { x: number; y: number; w: number; h: number; lado: string }): ReactNode {
  // encosto do lado de fora da mesa
  const enc = Math.min(8, Math.min(c.w, c.h) * 0.2);
  let encosto: ReactNode;
  if (c.lado === 'frente') encosto = <rect className="mv-cab" x={n1(c.x + 2)} y={n1(c.y + c.h - enc)} width={n1(c.w - 4)} height={n1(enc)} rx={2} />;
  else if (c.lado === 'tras') encosto = <rect className="mv-cab" x={n1(c.x + 2)} y={n1(c.y)} width={n1(c.w - 4)} height={n1(enc)} rx={2} />;
  else if (c.lado === 'esq') encosto = <rect className="mv-cab" x={n1(c.x)} y={n1(c.y + 2)} width={n1(enc)} height={n1(c.h - 4)} rx={2} />;
  else encosto = <rect className="mv-cab" x={n1(c.x + c.w - enc)} y={n1(c.y + 2)} width={n1(enc)} height={n1(c.h - 4)} rx={2} />;
  return <g key={'cad' + k} className="mv-cadeira"><rect className="mv-base t-cadeira" x={n1(c.x)} y={n1(c.y)} width={n1(c.w)} height={n1(c.h)} rx={4} />{encosto}</g>;
}

/** O desenho completo do móvel (com baús da cama e cadeiras da mesa). */
export function Desenho({ m }: { m: Movel }) {
  const t = tam(m);
  if (m.tipo === 'cama' && (m.bauCab || m.bauPe)) {
    const p = partesCama(m);
    return <>
      {p.cab && <g><rect className="mv-base t-bau" x={n1(p.cab.x)} y={n1(p.cab.y)} width={n1(p.cab.w)} height={n1(p.cab.h)} rx={2} /><line className="mv-l" x1={n1(p.cab.x + 4)} y1={n1(p.cab.y + p.cab.h / 2)} x2={n1(p.cab.x + p.cab.w - 4)} y2={n1(p.cab.y + p.cab.h / 2)} /></g>}
      {p.pe && <g><rect className="mv-base t-bau" x={n1(p.pe.x)} y={n1(p.pe.y)} width={n1(p.pe.w)} height={n1(p.pe.h)} rx={2} /><line className="mv-l" x1={n1(p.pe.x + 4)} y1={n1(p.pe.y + p.pe.h / 2)} x2={n1(p.pe.x + p.pe.w - 4)} y2={n1(p.pe.y + p.pe.h / 2)} /></g>}
      <g transform={`translate(${n1(p.cama.x)} ${n1(p.cama.y)})`}>{corpo(m, m.larg, m.prof)}</g>
      {m.fixo && <Trava x={t.larg - 13} />}
    </>;
  }
  return <>
    {m.tipo === 'mesa' && m.cadeiras > 0 && cadeirasLocais(m).map((c, k) => cadeiraLocal(k, c))}
    {corpo(m, m.larg, m.prof)}
    {m.fixo && <Trava x={t.larg - 13} />}
  </>;
}

const Trava = ({ x }: { x: number }) => (
  <g transform={`translate(${n1(x)} 3) scale(0.42)`}><path className="mv-trava" d="M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3" /></g>
);

/** Portas e gavetas do móvel e a área das cadeiras, do lado da frente. */
export function DesenhoAbertura({ m }: { m: Movel }): ReactNode {
  const A = m.larg, B = m.prof;
  const zonas = m.tipo === 'mesa' && m.cadeiras > 0 ? zonasCadeirasLocais(m).map((z, k) => <rect key={'z' + k} className="mv-zona" x={n1(z.r.x1)} y={n1(z.r.y1)} width={n1(z.r.x2 - z.r.x1)} height={n1(z.r.y2 - z.r.y1)} rx={3} />) : null;
  if (zonas) return <>{zonas}</>;
  if (m.abertura === 'abrir') {
    const n = m.tipo === 'geladeira' ? (m.nPortas >= 2 ? 2 : 1) : nPortasDe(m), lw = A / n;
    return <>{Array.from({ length: n }, (_, k) => {
      const x0 = k * lw, x1 = (k + 1) * lw, esq = k % 2 === 0, hx = esq ? x0 : x1, fx = esq ? x1 : x0;
      return <g key={k}><path className="mv-arco" d={`M${n1(fx)} ${n1(B)} A${n1(lw)} ${n1(lw)} 0 0 ${esq ? 1 : 0} ${n1(hx)} ${n1(B + lw)}`} /><line className="mv-folha" x1={n1(hx)} y1={n1(B)} x2={n1(hx)} y2={n1(B + lw)} /></g>;
    })}</>;
  }
  if (m.abertura === 'correr') return <><line className="mv-folha" x1={3} y1={n1(B - 9)} x2={n1(A * 0.56)} y2={n1(B - 9)} /><line className="mv-folha" x1={n1(A * 0.44)} y1={n1(B - 5.5)} x2={n1(A - 3)} y2={n1(B - 5.5)} /></>;
  if (m.abertura === 'gavetas') return <rect className="mv-arco" x={1} y={n1(B)} width={n1(A - 2)} height={Math.min(45, Math.round(B * 0.75))} />;
  if (m.tipo === 'fogao') return <rect className="mv-arco" x={2} y={n1(B)} width={n1(A - 4)} height={Math.min(50, Math.round(B * 0.8))} />;
  return null;
}

/** Nome e medidas no meio do móvel (gira junto quando o móvel é estreito). */
export function Rotulo({ m }: { m: Movel }) {
  const r = ret(m), rot = normRot(m.rot), nome = m.nome, med = fmtM(m.larg) + ' × ' + fmtM(m.prof);
  let x = r.x1 + r.w / 2, y = r.y1 + r.h / 2;
  if (m.tipo === 'cama') { const v = ({ 0: [0, 1], 90: [-1, 0], 180: [0, -1], 270: [1, 0] } as Record<number, number[]>)[rot]; x += v[0] * 22; y += v[1] * 22; }
  const n = Math.max(nome.length, med.length, 4), vertical = r.w < n * 6.6 + 8 && r.h > r.w, span = (vertical ? r.h : r.w) - 8;
  const tr = vertical ? `rotate(-90 ${n1(x)} ${n1(y)})` : undefined, fs = Math.min(13, span / (n * 0.56));
  if (fs >= 7) return (
    <g className="mv-txt" transform={tr}>
      <text className="mv-nome" x={n1(x)} y={n1(y - fs * 0.12)} fontSize={n1(fs)} textAnchor="middle">{nome}</text>
      <text className="mv-med" x={n1(x)} y={n1(y + fs * 0.92)} fontSize={n1(fs * 0.86)} textAnchor="middle">{med}</text>
    </g>
  );
  const fsN = Math.min(13, span / (Math.max(nome.length, 3) * 0.56));
  if (fsN >= 6) return <g className="mv-txt" transform={tr}><text className="mv-nome" x={n1(x)} y={n1(y)} dy=".35em" fontSize={n1(fsN)} textAnchor="middle">{nome}</text></g>;
  return null;
}
