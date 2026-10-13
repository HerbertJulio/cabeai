// O terreno em volta da casa (grama, calçada, rua, o caminho até a porta e as árvores), a sombra da casa sobre ele,
// as cotas gerais de cada andar e as prévias do passo a passo. Unidades = cm, na planta do andar.
import { useMemo } from 'react';
import { caixaDe } from '@/lib/casa';
import { T } from '@/lib/catalogo';
import { tx } from '@/lib/i18n';
import { arvores, caminhos, faixasDaRua } from '@/lib/jardim';
import { fmtArea } from '@/lib/resumo';
import type { Comodo, ElParede, Ret, Terreno } from '@/lib/tipos';
import { fmtM, n1 } from '@/lib/util';

type TerrenoPos = Omit<Terreno, 'andar'>;
const r = (q: Ret) => ({ x: n1(q.x1), y: n1(q.y1), width: n1(q.x2 - q.x1), height: n1(q.y2 - q.y1) });

/** Grama, calçada e o piso do caminho; a sombra das árvores e da casa. */
export function DefsJardim() {
  return <>
    <pattern id="grama" patternUnits="userSpaceOnUse" width="80" height="80">
      <rect className="pt-grama" width="80" height="80" />
      <path className="pt-grama-l" d="M10 18l2-6M14 19l1-7M42 52l2-6M46 53l1-7M64 22l-1-6M67 23l1-6M24 66l-1-6M28 67l1-6M58 74l2-5" />
    </pattern>
    <pattern id="calcada" patternUnits="userSpaceOnUse" width="60" height="60">
      <rect className="pt-calcada" width="60" height="60" />
      <path className="pt-calcada-l" d="M0 0H60M0 0V60" />
    </pattern>
    <pattern id="caminho" patternUnits="userSpaceOnUse" width="40" height="40">
      <rect className="pt-caminho" width="40" height="40" />
      <path className="pt-caminho-l" d="M0 0H40M0 20H40M0 0V20M20 20V40" />
    </pattern>
    <filter id="sombra-casa" x="-5%" y="-5%" width="115%" height="115%">
      <feGaussianBlur stdDeviation="9" />
    </filter>
  </>;
}

/** Copa de árvore vista de cima: um contorno ondulado, uns galhos e o tronco no meio. */
function Arvore({ x, y, r: R, k }: { x: number; y: number; r: number; k: number }) {
  const n = R > 120 ? 11 : 9, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k; pts.push([x + Math.cos(a) * R * 0.86, y + Math.sin(a) * R * 0.86]); }
  const bolha = R * 0.86 * Math.sin(Math.PI / n) * 1.25;
  const d = `M${n1(pts[0][0])},${n1(pts[0][1])}` + pts.map((_, i) => { const p = pts[(i + 1) % n]; return ` A${n1(bolha)},${n1(bolha)} 0 0 1 ${n1(p[0])},${n1(p[1])}`; }).join('') + ' Z';
  const galhos = [0, 1, 2, 3, 4].map((i) => { const a = k * 1.7 + (i / 5) * Math.PI * 2; return `M${n1(x)},${n1(y)} L${n1(x + Math.cos(a) * R * 0.55)},${n1(y + Math.sin(a) * R * 0.55)}`; }).join(' ');
  return (
    <g className="arvore">
      <path className="arvore-sombra" d={d} transform={`translate(${n1(R * 0.12)} ${n1(R * 0.16)})`} />
      <path className="arvore-copa" d={d} />
      <path className="arvore-galho" d={galhos} />
      <circle className="arvore-tronco" cx={n1(x)} cy={n1(y)} r={n1(Math.max(6, R * 0.07))} />
    </g>
  );
}

/** Cota: a linha com os tracinhos nas pontas e a medida no meio (deitada em "em", ou em pé). */
export function Cota({ a, b, em, eixo, texto, k = 1, cls = '' }: { a: number; b: number; em: number; eixo: 'x' | 'y'; texto: string; k?: number; cls?: string }) {
  if (b - a < 1) return null;
  const t = 5 * k, fs = 13 * k;
  if (eixo === 'x') return (
    <g className={`cota-g ${cls}`}>
      <line className="cota-l" x1={n1(a)} y1={n1(em)} x2={n1(b)} y2={n1(em)} />
      <line className="cota-l" x1={n1(a - t)} y1={n1(em + t)} x2={n1(a + t)} y2={n1(em - t)} />
      <line className="cota-l" x1={n1(b - t)} y1={n1(em + t)} x2={n1(b + t)} y2={n1(em - t)} />
      <text className="cota-t" x={n1((a + b) / 2)} y={n1(em - 5 * k)} style={{ fontSize: n1(fs) }} textAnchor="middle">{texto}</text>
    </g>
  );
  return (
    <g className={`cota-g ${cls}`}>
      <line className="cota-l" x1={n1(em)} y1={n1(a)} x2={n1(em)} y2={n1(b)} />
      <line className="cota-l" x1={n1(em - t)} y1={n1(a + t)} x2={n1(em + t)} y2={n1(a - t)} />
      <line className="cota-l" x1={n1(em - t)} y1={n1(b + t)} x2={n1(em + t)} y2={n1(b - t)} />
      <text className="cota-t" transform={`translate(${n1(em - 5 * k)} ${n1((a + b) / 2)}) rotate(-90)`} style={{ fontSize: n1(fs) }} textAnchor="middle">{texto}</text>
    </g>
  );
}

/** O terreno: a rua e a calçada na frente, a grama, o caminho até a porta da rua, as árvores, a divisa e as medidas. */
/** "plano": só o chão (para a vista em 3D, que desenha as árvores em pé e não tem cotas). */
export function TerrenoDesenho({ t, cs, els, k = 1, previa = false, plano = false }: { t: TerrenoPos; cs: Comodo[]; els: ElParede[]; k?: number; previa?: boolean; plano?: boolean }) {
  const f = faixasDaRua(t);
  const cam = useMemo(() => caminhos(t, cs, els), [t, cs, els]);
  // as árvores só aparecem com a casa no lugar (antes, elas ficariam onde a casa vai entrar)
  const arv = useMemo(() => (cs.length && !previa && !plano ? arvores(t, cs, cam) : []), [t, cs, cam, previa, plano]);
  const hz = t.rua === 'baixo' || t.rua === 'cima', meioRua = hz ? (f.rua.y1 + f.rua.y2) / 2 : (f.rua.x1 + f.rua.x2) / 2;
  const frente = hz ? t.w : t.h, fundo = hz ? t.h : t.w;
  // as cotas do terreno ficam nos lados que não são a rua
  const cotaX = t.rua === 'cima' ? t.y + t.h + 34 * k : t.y - 34 * k, cotaY = t.rua === 'esquerda' ? t.x + t.w + 34 * k : t.x - 34 * k;
  return (
    <g className={`terreno${previa ? ' previa' : ''}`} aria-hidden="true">
      <rect className="rua" {...r(f.rua)} />
      {hz ? <line className="rua-faixa" x1={n1(f.rua.x1)} y1={n1(meioRua)} x2={n1(f.rua.x2)} y2={n1(meioRua)} /> : <line className="rua-faixa" x1={n1(meioRua)} y1={n1(f.rua.y1)} x2={n1(meioRua)} y2={n1(f.rua.y2)} />}
      <text className="rua-t" style={{ fontSize: n1(20 * k) }} textAnchor="middle" dy=".35em" transform={hz ? `translate(${n1(t.x + t.w / 2)} ${n1(meioRua + (t.rua === 'baixo' ? 70 : -70))})` : `translate(${n1(meioRua + (t.rua === 'direita' ? 70 : -70))} ${n1(t.y + t.h / 2)}) rotate(-90)`}>{tx('Rua', 'Street')}</text>
      <rect className="calcada" {...r(f.calcada)} fill="url(#calcada)" />
      <rect className="lote" x={n1(t.x)} y={n1(t.y)} width={n1(t.w)} height={n1(t.h)} fill="url(#grama)" />
      {cam.map((c, i) => <rect key={i} className="caminho" {...r(c)} fill="url(#caminho)" />)}
      {arv.map((a, i) => <Arvore key={i} {...a} k={i * 0.9 + 0.3} />)}
      <rect className="lote-borda" x={n1(t.x)} y={n1(t.y)} width={n1(t.w)} height={n1(t.h)} />
      {!plano && <>
        <Cota a={t.x} b={t.x + t.w} em={cotaX} eixo="x" texto={`${fmtM(hz ? frente : fundo)} m`} k={k} cls="cota-terreno" />
        <Cota a={t.y} b={t.y + t.h} em={cotaY} eixo="y" texto={`${fmtM(hz ? fundo : frente)} m`} k={k} cls="cota-terreno" />
        {/* no canto de cima à direita (à esquerda, em cima da casa, fica o título do andar) */}
        <text className="lote-t" x={n1(t.x + t.w - 14 * k)} y={n1(t.y + 26 * k)} textAnchor="end" style={{ fontSize: n1(13 * k) }}>{tx('Terreno', 'Plot')} · {fmtArea((t.w * t.h) / 10000)}</text>
      </>}
    </g>
  );
}

/** A sombra da casa sobre o terreno (um pouco para baixo e para a direita). */
export function SombraCasa({ cs }: { cs: Comodo[] }) {
  return (
    <g className="sombra-casa" aria-hidden="true" filter="url(#sombra-casa)" transform="translate(14 18)">
      {cs.map((c) => <rect key={c.id} x={n1(c.x - T)} y={n1(c.y - T)} width={n1(c.w + 2 * T)} height={n1(c.h + 2 * T)} />)}
    </g>
  );
}

/** As cotas gerais do andar: a frente e o fundo da casa por fora, em cima e à esquerda. */
export function CotasCasa({ cs, k = 1 }: { cs: Comodo[]; k?: number }) {
  const b = caixaDe(cs);
  if (!b) return null;
  return (
    <g className="cotas-casa" aria-hidden="true">
      <Cota a={b.x1} b={b.x2} em={b.y1 - 30} eixo="x" texto={`${fmtM(b.x2 - b.x1)} m`} k={k} cls="cota-casa" />
      <Cota a={b.y1} b={b.y2} em={b.x1 - 30} eixo="y" texto={`${fmtM(b.y2 - b.y1)} m`} k={k} cls="cota-casa" />
    </g>
  );
}

/** Prévia do contorno da casa (por fora) no terreno: a medida dela no meio e os recuos até a divisa (cada recuo só
 *  quando a medida cabe na linha dele, na escala da tela). */
export function PreviaCasa({ c, t, k = 1 }: { c: { x: number; y: number; w: number; h: number }; t: TerrenoPos | null; k?: number }) {
  const medida = `${fmtM(c.w)} × ${fmtM(c.h)} m`, fs = Math.max(4, Math.min(16 * k, (c.w - 2 * T - 8) / (medida.length * 0.55), (c.h - 2 * T) * 0.4));
  const cabe = (len: number) => len >= 13 * k * 3.2;
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  return (
    <g className="previa-casa" aria-hidden="true">
      <rect className="previa-parede" x={n1(c.x)} y={n1(c.y)} width={n1(c.w)} height={n1(c.h)} />
      <rect className="previa-dentro" x={n1(c.x + T)} y={n1(c.y + T)} width={n1(Math.max(0, c.w - 2 * T))} height={n1(Math.max(0, c.h - 2 * T))} />
      <text className="previa-medida" x={n1(cx)} y={n1(cy)} dy=".35em" textAnchor="middle" style={{ fontSize: n1(fs) }}>{medida}</text>
      {t && <>
        {cabe(c.y - t.y) && <Cota a={t.y} b={c.y} em={cx} eixo="y" texto={`${fmtM(c.y - t.y)} m`} k={k} cls="cota-recuo" />}
        {cabe(t.y + t.h - c.y - c.h) && <Cota a={c.y + c.h} b={t.y + t.h} em={cx} eixo="y" texto={`${fmtM(t.y + t.h - c.y - c.h)} m`} k={k} cls="cota-recuo" />}
        {cabe(c.x - t.x) && <Cota a={t.x} b={c.x} em={cy} eixo="x" texto={`${fmtM(c.x - t.x)} m`} k={k} cls="cota-recuo" />}
        {cabe(t.x + t.w - c.x - c.w) && <Cota a={c.x + c.w} b={t.x + t.w} em={cy} eixo="x" texto={`${fmtM(t.x + t.w - c.x - c.w)} m`} k={k} cls="cota-recuo" />}
      </>}
    </g>
  );
}

/** Prévia do cômodo (só um cômodo): as paredes em volta e as medidas de dentro. */
export function PreviaComodo({ w, h, k = 1 }: { w: number; h: number; k?: number }) {
  return (
    <g className="previa-casa" aria-hidden="true">
      <rect className="previa-parede" x={-T} y={-T} width={n1(w + 2 * T)} height={n1(h + 2 * T)} />
      <rect className="previa-dentro" x={0} y={0} width={n1(w)} height={n1(h)} />
      <Cota a={0} b={w} em={-T - 26 * k} eixo="x" texto={`${fmtM(w)} m`} k={k} cls="cota-previa" />
      <Cota a={0} b={h} em={-T - 26 * k} eixo="y" texto={`${fmtM(h)} m`} k={k} cls="cota-previa" />
    </g>
  );
}
