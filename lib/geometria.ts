// Geometria de um cômodo (cm; origem = canto interno de cima à esquerda do cômodo).
import { tx } from './i18n';
import { NOME_PAREDE, PAREDES, PUXAR_CADEIRA, TIPOS, VERBO_AB, horizontal } from './catalogo';
import type { Avaliacao, ComodoCompleto, ElParede, Movel, Parede, Problema, Ret, RetMedida } from './tipos';
import { clamp } from './util';

export type Lado = 'esq' | 'dir' | 'cima' | 'baixo';
export type LadoLocal = 'frente' | 'tras' | 'esq' | 'dir';

export function normRot(r: unknown): number {
  const v = Math.round((Number(r) || 0) / 90) * 90;
  return ((v % 360) + 360) % 360;
}

type ComBau = Partial<Pick<Movel, 'tipo' | 'bauCab' | 'bauCabLarg' | 'bauCabAl' | 'bauCabDx' | 'bauPe' | 'bauPeLarg' | 'bauPeAl' | 'bauPeDx'>>;
type Medidas = Pick<Movel, 'larg' | 'prof' | 'rot'> & ComBau;
type Posto = Medidas & Pick<Movel, 'x' | 'y'>;

export interface Parte { x: number; y: number; w: number; h: number }
/** Cama com baú: onde fica cada peça dentro do conjunto (coordenadas do próprio móvel, cabeceira em cima). */
export function partesCama(m: Medidas): { L: number; P: number; cama: Parte; cab: Parte | null; pe: Parte | null } {
  const A = m.larg, B = m.prof;
  const cabP = m.tipo === 'cama' && m.bauCab ? m.bauCab : 0, peP = m.tipo === 'cama' && m.bauPe ? m.bauPe : 0;
  if (!cabP && !peP) return { L: A, P: B, cama: { x: 0, y: 0, w: A, h: B }, cab: null, pe: null };
  const pos = (bl: number, al: string | undefined, dx: number | undefined) => (al === 'esq' ? 0 : al === 'dir' ? A - bl : (A - bl) / 2) + (dx || 0);
  const cabL = cabP ? m.bauCabLarg || A : 0, peL = peP ? m.bauPeLarg || A : 0;
  const xc = cabP ? pos(cabL, m.bauCabAl, m.bauCabDx) : 0, xp = peP ? pos(peL, m.bauPeAl, m.bauPeDx) : 0;
  const minX = Math.min(0, cabP ? xc : 0, peP ? xp : 0), maxX = Math.max(A, cabP ? xc + cabL : A, peP ? xp + peL : A);
  return {
    L: maxX - minX, P: cabP + B + peP,
    cama: { x: 0 - minX, y: cabP, w: A, h: B },
    cab: cabP ? { x: xc - minX, y: 0, w: cabL, h: cabP } : null,
    pe: peP ? { x: xp - minX, y: cabP + B, w: peL, h: peP } : null
  };
}
/** Tamanho do conjunto (a cama com os baús; para os outros móveis, as próprias medidas). */
export function tam(m: Medidas): { larg: number; prof: number } {
  if (m.tipo !== 'cama' || (!m.bauCab && !m.bauPe)) return { larg: m.larg, prof: m.prof };
  const p = partesCama(m);
  return { larg: p.L, prof: p.P };
}

export function dims(m: Medidas, rot?: number): { w: number; h: number } {
  const r = normRot(rot == null ? m.rot : rot), t = tam(m);
  return r === 90 || r === 270 ? { w: t.prof, h: t.larg } : { w: t.larg, h: t.prof };
}

export function ret(m: Posto, x?: number, y?: number, rot?: number): RetMedida {
  const d = dims(m, rot);
  const X = x == null ? m.x : x;
  const Y = y == null ? m.y : y;
  return { x1: X, y1: Y, x2: X + d.w, y2: Y + d.h, w: d.w, h: d.h };
}

export function sobrepoe(a: Ret, b: Ret): boolean {
  return a.x1 < b.x2 - 0.5 && a.x2 > b.x1 + 0.5 && a.y1 < b.y2 - 0.5 && a.y2 > b.y1 + 0.5;
}

type Caixa = { w: number; h: number };

/** Traz o móvel para dentro do cômodo. */
export function prender(q: Caixa, m: Medidas, x: number, y: number, rot?: number): { x: number; y: number } {
  const d = dims(m, rot);
  return {
    x: Math.round(Math.min(Math.max(0, x), Math.max(0, q.w - d.w))),
    y: Math.round(Math.min(Math.max(0, y), Math.max(0, q.h - d.h)))
  };
}

/** Mantém o centro do móvel quando muda medida ou giro. */
export function centrar(q: Caixa, m: Posto, novo: Posto): { x: number; y: number } {
  const r0 = ret(m);
  const d = dims(novo);
  return prender(q, novo, r0.x1 + r0.w / 2 - d.w / 2, r0.y1 + r0.h / 2 - d.h / 2, novo.rot);
}

export const compParede = (q: Caixa, parede: Parede): number => (horizontal(parede) ? q.w : q.h);

/** Coordenadas "da parede": u ao longo dela, v entrando no cômodo. */
export function uv2xy(q: Caixa, parede: Parede, u: number, v: number): [number, number] {
  if (parede === 'cima') return [u, v];
  if (parede === 'baixo') return [u, q.h - v];
  if (parede === 'esquerda') return [v, u];
  return [q.w - v, u];
}

export function rectUV(q: Caixa, parede: Parede, r: Ret): { u1: number; u2: number; v1: number; v2: number } {
  if (parede === 'cima') return { u1: r.x1, u2: r.x2, v1: r.y1, v2: r.y2 };
  if (parede === 'baixo') return { u1: r.x1, u2: r.x2, v1: q.h - r.y2, v2: q.h - r.y1 };
  if (parede === 'esquerda') return { u1: r.y1, u2: r.y2, v1: r.x1, v2: r.x2 };
  return { u1: r.y1, u2: r.y2, v1: q.w - r.x2, v2: q.w - r.x1 };
}

export const uDaParede = (parede: Parede, p: { x: number; y: number }): number => (horizontal(parede) ? p.x : p.y);

/** Item de parede: trecho [a, b] ao longo da parede de comprimento L. */
export function geoEl(q: Caixa, el: Pick<ElParede, 'parede' | 'inicio' | 'largura'>): { a: number; b: number; L: number } {
  const L = compParede(q, el.parede);
  const w = Math.min(el.largura, L);
  const a = Math.min(Math.max(0, el.inicio), L - w);
  return { a, b: a + w, L };
}

export function geoPorta(q: Caixa, p: ElParede): { a: number; b: number; hu: number; du: number; sv: number; r: number } {
  const g = geoEl(q, p);
  return { a: g.a, b: g.b, hu: p.dobradica === 'a' ? g.a : g.b, du: p.dobradica === 'a' ? 1 : -1, sv: p.abre === 'dentro' ? 1 : -1, r: g.b - g.a };
}

/** O retângulo entra no quarto de círculo que a folha da porta varre? */
export function bloqueiaPorta(q: Caixa, p: ElParede, r: Ret): boolean {
  if (p.abre !== 'dentro') return false;
  const g = geoPorta(q, p);
  const R = rectUV(q, p.parede, r);
  const su1 = Math.min(g.hu, g.hu + g.du * g.r);
  const su2 = Math.max(g.hu, g.hu + g.du * g.r);
  const iu1 = Math.max(R.u1, su1);
  const iu2 = Math.min(R.u2, su2);
  const iv1 = Math.max(R.v1, 0);
  const iv2 = Math.min(R.v2, g.r);
  if (iu2 - iu1 <= 0.5 || iv2 - iv1 <= 0.5) return false;
  const cu = Math.min(Math.max(g.hu, iu1), iu2);
  const cv = Math.min(Math.max(0, iv1), iv2);
  return Math.hypot(cu - g.hu, cv) < g.r - 1;
}

export function naFrentePorta(q: Caixa, p: ElParede, r: Ret): boolean {
  const g = geoPorta(q, p);
  const R = rectUV(q, p.parede, r);
  return R.v1 < 40 && R.u1 < g.b - 0.5 && R.u2 > g.a + 0.5;
}

/** Área do ar onde não pode móvel alto: o aparelho mais a folga de cada lado. */
export function zonaAr(q: Caixa, el: ElParede): { a: number; b: number } {
  const g = geoEl(q, el);
  const f = Math.max(0, el.folga || 0);
  return { a: Math.max(0, g.a - f), b: Math.min(g.L, g.b + f) };
}

/** Retângulo a menos de "prof" cm da parede, dentro do trecho [a, b]. */
export function noTrecho(q: Caixa, parede: Parede, a: number, b: number, r: Ret, prof: number): boolean {
  const R = rectUV(q, parede, r);
  return R.v1 < prof && R.u1 < b - 0.5 && R.u2 > a + 0.5;
}

export const folhaDe = (q: Caixa, j: ElParede): number => {
  const g = geoEl(q, j);
  return Math.round((g.b - g.a) / (j.folhas === 1 ? 1 : 2));
};

export function janelaRuim(q: Caixa, j: ElParede, r: Ret): '' | 'tapa' | 'abre' {
  const g = geoEl(q, j);
  if (noTrecho(q, j.parede, g.a, g.b, r, 40)) return 'tapa';
  if (j.abertura === 'abrir' && noTrecho(q, j.parede, g.a, g.b, r, folhaDe(q, j) + 5)) return 'abre';
  return '';
}

export const naAreaDoAr = (q: Caixa, a: ElParede, r: Ret): boolean => {
  const z = zonaAr(q, a);
  return noTrecho(q, a.parede, z.a, z.b, r, 40);
};

/** O móvel atrapalha o interruptor ou a tomada? Interruptor precisa de 30 cm livres na frente;
 *  tomada sozinha pode ficar atrás de móvel baixo (cama, sofá, rack), mas não de móvel alto encostado nela. */
export const cobreInterruptor = (q: Caixa, i: ElParede, r: Ret, alto = true): boolean => {
  const g = geoEl(q, i);
  if (i.ponto === 'tomada') return alto && noTrecho(q, i.parede, g.a - 2, g.b + 2, r, 15);
  return noTrecho(q, i.parede, g.a - 5, g.b + 5, r, 30);
};

/* ---------- portas, gavetas e o que precisa de espaço na frente ---------- */
type ComAbertura = Pick<Movel, 'tipo' | 'abertura' | 'larg' | 'prof' | 'nPortas'> & { frente?: number | null };

export const nPortasDe = (m: Pick<Movel, 'nPortas' | 'larg'>): number => (m.nPortas >= 1 ? m.nPortas : Math.max(1, Math.round(m.larg / 50)));

function frentePorAbertura(m: ComAbertura): number {
  if (m.abertura === 'abrir') return Math.max(70, Math.round(m.larg / nPortasDe(m)) + 20);
  if (m.abertura === 'correr') return 60;
  if (m.abertura === 'gavetas') return Math.max(55, Math.round(m.prof * 0.75) + 20);
  return 0;
}

/** Espaço livre que o móvel precisa na frente (portas, gavetas, forno, sofá…). As cadeiras da mesa contam à parte. */
export function precisaFrente(m: ComAbertura): number {
  if (m.frente != null && Number.isFinite(m.frente)) return Math.max(0, m.frente);
  return frenteAutomatica(m);
}
/** O espaço da frente que o Cabeaí calcula sozinho (quando a pessoa não escolhe outro). */
export function frenteAutomatica(m: ComAbertura): number {
  const t = TIPOS[m.tipo];
  return Math.max(frentePorAbertura(m), (t && t.frente) || 0);
}

/** "abrir as portas", "sentar", "abrir o forno"… */
export function motivoFrente(m: ComAbertura): string {
  const pa = frentePorAbertura(m);
  const t = TIPOS[m.tipo];
  if (pa && pa >= ((t && t.frente) || 0)) return VERBO_AB[m.abertura];
  return (t && t.uso) || tx('usar', 'use it');
}

/** Retângulo na frente do móvel (a frente é o lado oposto às costas). */
export function zonaFrente(m: Medidas, x: number, y: number, rot: number, prof: number): Ret {
  const d = dims(m, rot);
  const r = normRot(rot);
  if (r === 0) return { x1: x, y1: y + d.h, x2: x + d.w, y2: y + d.h + prof };
  if (r === 180) return { x1: x, y1: y - prof, x2: x + d.w, y2: y };
  if (r === 90) return { x1: x - prof, y1: y, x2: x, y2: y + d.h };
  return { x1: x + d.w, y1: y, x2: x + d.w + prof, y2: y + d.h };
}

/* ---------- cadeiras que vêm com a mesa ---------- */
type ComCadeiras = Pick<Movel, 'tipo' | 'larg' | 'prof' | 'cadeiras' | 'ladoCadeiras' | 'cadLarg' | 'cadProf'>;

export const temCadeiras = (m: Pick<Movel, 'tipo' | 'cadeiras'>): boolean => m.tipo === 'mesa' && m.cadeiras > 0;

/** Quantas cadeiras ficam em cada lado da mesa (lados do próprio móvel, antes de girar). */
export function cadeirasPorLado(m: ComCadeiras): Record<LadoLocal, number> {
  const out: Record<LadoLocal, number> = { frente: 0, tras: 0, esq: 0, dir: 0 };
  if (!temCadeiras(m)) return out;
  const n = m.cadeiras;
  if (m.ladoCadeiras === 'frente') out.frente = n;
  else if (m.ladoCadeiras === 'volta' && n >= 4) {
    out.esq = 1; out.dir = 1;
    out.frente = Math.ceil((n - 2) / 2); out.tras = Math.floor((n - 2) / 2);
  } else {
    out.frente = Math.ceil(n / 2); out.tras = Math.floor(n / 2);
  }
  return out;
}

export const precisaCadeira = (m: Pick<Movel, 'cadProf'>): number => Math.round(m.cadProf + PUXAR_CADEIRA);

export interface CadeiraLocal { x: number; y: number; w: number; h: number; lado: LadoLocal }

/** Cadeiras no desenho da mesa (coordenadas do próprio móvel: largura em x, profundidade em y, frente embaixo). */
export function cadeirasLocais(m: ComCadeiras): CadeiraLocal[] {
  const A = m.larg, B = m.prof, cl = m.cadLarg, cp = m.cadProf, out: CadeiraLocal[] = [];
  const por = cadeirasPorLado(m);
  const longo = (n: number, lado: 'frente' | 'tras') => {
    for (let k = 0; k < n; k++) {
      const c = ((k + 0.5) * A) / n;
      out.push({ x: c - cl / 2, y: lado === 'frente' ? B : -cp, w: cl, h: cp, lado });
    }
  };
  longo(por.frente, 'frente');
  longo(por.tras, 'tras');
  if (por.esq) out.push({ x: -cp, y: B / 2 - cl / 2, w: cp, h: cl, lado: 'esq' });
  if (por.dir) out.push({ x: A, y: B / 2 - cl / 2, w: cp, h: cl, lado: 'dir' });
  return out;
}

/** Área que cada lado com cadeiras ocupa quando estão em uso (cadeira + espaço para puxar). */
export function zonasCadeirasLocais(m: ComCadeiras): { lado: LadoLocal; r: Ret }[] {
  const A = m.larg, B = m.prof, cl = m.cadLarg, need = precisaCadeira(m), out: { lado: LadoLocal; r: Ret }[] = [];
  const por = cadeirasPorLado(m);
  // da primeira à última cadeira, com 5 cm de cada lado (pode passar da mesa se as cadeiras não couberem nela)
  const faixa = (n: number): [number, number] => {
    const c1 = (0.5 * A) / n, cN = ((n - 0.5) * A) / n;
    return [c1 - cl / 2 - 5, cN + cl / 2 + 5];
  };
  if (por.frente) { const [u1, u2] = faixa(por.frente); out.push({ lado: 'frente', r: { x1: u1, y1: B, x2: u2, y2: B + need } }); }
  if (por.tras) { const [u1, u2] = faixa(por.tras); out.push({ lado: 'tras', r: { x1: u1, y1: -need, x2: u2, y2: 0 } }); }
  if (por.esq) out.push({ lado: 'esq', r: { x1: -need, y1: B / 2 - cl / 2 - 5, x2: 0, y2: B / 2 + cl / 2 + 5 } });
  if (por.dir) out.push({ lado: 'dir', r: { x1: A, y1: B / 2 - cl / 2 - 5, x2: A + need, y2: B / 2 + cl / 2 + 5 } });
  return out;
}

const VET: Record<LadoLocal, [number, number]> = { frente: [0, 1], tras: [0, -1], esq: [-1, 0], dir: [1, 0] };

/** Lado do cômodo para onde aponta um lado do móvel, depois de girar. */
export function ladoNaSala(rot: number, lado: LadoLocal): Lado {
  const r = (normRot(rot) * Math.PI) / 180, [x, y] = VET[lado];
  const X = Math.round(x * Math.cos(r) - y * Math.sin(r)), Y = Math.round(x * Math.sin(r) + y * Math.cos(r));
  if (X === -1) return 'esq';
  if (X === 1) return 'dir';
  return Y === -1 ? 'cima' : 'baixo';
}

/** Leva um retângulo das coordenadas do móvel para as do cômodo. */
export function localParaSala(m: Posto, r: Ret, x?: number, y?: number, rot?: number): Ret {
  const R = ret(m, x, y, rot), ang = (normRot(rot == null ? m.rot : rot) * Math.PI) / 180;
  const cx = R.x1 + R.w / 2, cy = R.y1 + R.h / 2, c = Math.round(Math.cos(ang)), s = Math.round(Math.sin(ang));
  const t = tam(m);
  const pt = (u: number, v: number): [number, number] => {
    const lx = u - t.larg / 2, ly = v - t.prof / 2;
    return [cx + lx * c - ly * s, cy + lx * s + ly * c];
  };
  const a = pt(r.x1, r.y1), b = pt(r.x2, r.y2);
  return { x1: Math.min(a[0], b[0]), y1: Math.min(a[1], b[1]), x2: Math.max(a[0], b[0]), y2: Math.max(a[1], b[1]) };
}

type Completo = Posto & ComCadeiras;
export function zonasCadeiras(m: Completo, x?: number, y?: number, rot?: number): { lado: LadoLocal; r: Ret }[] {
  return zonasCadeirasLocais(m).map((z) => ({ lado: z.lado, r: localParaSala(m, z.r, x, y, rot) }));
}

/* ---------- espaço em volta ---------- */
export const distRet = (a: Ret, b: Ret): number => Math.hypot(Math.max(0, a.x1 - b.x2, b.x1 - a.x2), Math.max(0, a.y1 - b.y2, b.y1 - a.y2));

export interface Folga { gap: number; eixo: 'x' | 'y'; de: number; ate: number; em: number }

/** Espaço livre de cada lado até a parede ou o móvel mais próximo; um móvel sobreposto conta como encostado (0). */
export function folgasRet(q: Caixa, r: Ret, rs: Ret[]): Record<Lado, Folga> {
  let edge = 0, mid = (r.y1 + r.y2) / 2;
  for (const s of rs) { const a = Math.max(r.y1, s.y1), b = Math.min(r.y2, s.y2); if (b - a > 0.5 && s.x1 < r.x1 - 0.5) { const c = Math.min(s.x2, r.x1); if (c > edge) { edge = c; mid = (a + b) / 2; } } }
  const esq: Folga = { gap: r.x1 - edge, eixo: 'x', de: edge, ate: r.x1, em: mid };
  edge = q.w; mid = (r.y1 + r.y2) / 2;
  for (const s of rs) { const a = Math.max(r.y1, s.y1), b = Math.min(r.y2, s.y2); if (b - a > 0.5 && s.x2 > r.x2 + 0.5) { const c = Math.max(s.x1, r.x2); if (c < edge) { edge = c; mid = (a + b) / 2; } } }
  const dir: Folga = { gap: edge - r.x2, eixo: 'x', de: r.x2, ate: edge, em: mid };
  edge = 0; mid = (r.x1 + r.x2) / 2;
  for (const s of rs) { const a = Math.max(r.x1, s.x1), b = Math.min(r.x2, s.x2); if (b - a > 0.5 && s.y1 < r.y1 - 0.5) { const c = Math.min(s.y2, r.y1); if (c > edge) { edge = c; mid = (a + b) / 2; } } }
  const cima: Folga = { gap: r.y1 - edge, eixo: 'y', de: edge, ate: r.y1, em: mid };
  edge = q.h; mid = (r.x1 + r.x2) / 2;
  for (const s of rs) { const a = Math.max(r.x1, s.x1), b = Math.min(r.x2, s.x2); if (b - a > 0.5 && s.y2 > r.y2 + 0.5) { const c = Math.max(s.y1, r.y2); if (c < edge) { edge = c; mid = (a + b) / 2; } } }
  const baixo: Folga = { gap: edge - r.y2, eixo: 'y', de: r.y2, ate: edge, em: mid };
  return { esq, dir, cima, baixo };
}

export const folgas = (q: Caixa, m: Posto, outros: Posto[]): Record<Lado, Folga> => folgasRet(q, ret(m), outros.map((o) => ret(o)));

export const COSTAS: Record<Parede, number> = { cima: 0, esquerda: 270, baixo: 180, direita: 90 };
export const FRENTE: Record<number, Lado> = { 0: 'baixo', 90: 'esq', 180: 'cima', 270: 'dir' };

/** Lados compridos da cama (por onde se deita e levanta). */
export const ladosCama = (m: Pick<Movel, 'rot'>, f: Record<Lado, Folga>): [number, number] =>
  normRot(m.rot) % 180 === 0 ? [f.esq.gap, f.dir.gap] : [f.cima.gap, f.baixo.gap];

export function nivel(g: number): 'folga' | 'nao' | 'apertado' | 'ok' {
  if (g < 20) return 'folga';
  if (g < 60) return 'nao';
  if (g < 80) return 'apertado';
  return 'ok';
}

/** Parede em que as costas do móvel encostam (ou "" se está solto). */
export function paredeDe(q: Caixa, m: Posto): Parede | '' {
  const r = ret(m), rot = normRot(m.rot);
  const enc: Record<Parede, boolean> = { cima: r.y1 < 1, baixo: r.y2 > q.h - 1, esquerda: r.x1 < 1, direita: r.x2 > q.w - 1 };
  const costas = ({ 0: 'cima', 90: 'direita', 180: 'baixo', 270: 'esquerda' } as Record<number, Parede>)[rot];
  if (enc[costas]) return costas;
  for (const p of PAREDES) if (enc[p]) return p;
  return '';
}

/* ---------- problemas de uma arrumação ---------- */
export function avaliar(q: ComodoCompleto, lista: Movel[]): Avaliacao {
  const itens: Problema[] = [], conflitos = new Set<string>(), portasBloq = new Set<string>(), elsRuins = new Set<string>();
  const anota = (t: string, mid?: string | null, eid?: string | null) => {
    itens.push({ t, mid: mid || null, eid: eid || null });
    if (mid) conflitos.add(mid);
    if (eid) elsRuins.add(eid);
  };
  for (const m of lista) {
    const r = ret(m);
    if (r.x1 < -0.5 || r.y1 < -0.5 || r.x2 > q.w + 0.5 || r.y2 > q.h + 0.5) anota(tx(`${m.nome} está saindo do cômodo.`, `${m.nome} is sticking out of the room.`), m.id);
    for (const p of q.portas) {
      if (p.abre === 'dentro' && bloqueiaPorta(q, p, r)) { anota(tx(`${m.nome} atrapalha a abertura de “${p.nome}”.`, `${m.nome} blocks “${p.nome}” from opening.`), m.id, p.id); portasBloq.add(p.id); }
      else if (p.abre === 'fora' && naFrentePorta(q, p, r)) { anota(tx(`${m.nome} fica na frente de “${p.nome}”.`, `${m.nome} is in front of “${p.nome}”.`), m.id, p.id); portasBloq.add(p.id); }
    }
    for (const i of q.interruptores) if (cobreInterruptor(q, i, r, m.alto)) anota(i.ponto === 'tomada'
      ? tx(`${m.nome} tapa “${i.nome}”: móvel alto encostado na tomada.`, `${m.nome} covers “${i.nome}”: tall furniture against the outlet.`)
      : tx(`${m.nome} fica na frente de “${i.nome}”.`, `${m.nome} blocks “${i.nome}”.`), m.id, i.id);
    if (m.alto) {
      for (const a of q.ares) if (naAreaDoAr(q, a, r)) anota(tx(`${m.nome} é alto e está na área do ${a.nome.toLowerCase()}.`, `${m.nome} is tall and too close to “${a.nome}”.`), m.id, a.id);
      for (const j of q.janelas) {
        const k = janelaRuim(q, j, r);
        if (k === 'tapa') anota(tx(`${m.nome} é alto e tapa a ${j.nome.toLowerCase()}.`, `${m.nome} is tall and covers “${j.nome}”.`), m.id, j.id);
        else if (k === 'abre') anota(tx(`${m.nome} é alto e fica no caminho da ${j.nome.toLowerCase()} abrir.`, `${m.nome} is tall and blocks “${j.nome}” from opening.`), m.id, j.id);
      }
    }
    const outros = lista.filter((o) => o.id !== m.id);
    const need = precisaFrente(m);
    if (need) {
      const f = folgas(q, m, outros)[FRENTE[normRot(m.rot)]];
      if (f.gap < need - 0.5) anota(tx(`${m.nome} precisa de ${need} cm livres na frente para ${motivoFrente(m)} (tem ${Math.max(0, Math.round(f.gap))} cm).`, `${m.nome} needs ${need} cm free in front to ${motivoFrente(m)} (has ${Math.max(0, Math.round(f.gap))} cm).`), m.id);
    }
    if (temCadeiras(m)) {
      const nc = precisaCadeira(m), f = folgas(q, m, outros);
      let falta = Infinity;
      for (const z of zonasCadeiras(m)) {
        const g = f[ladoNaSala(m.rot, z.lado)].gap;
        if (g < nc - 0.5) falta = Math.min(falta, g);
        for (const p of q.portas) if (p.abre === 'dentro' && bloqueiaPorta(q, p, z.r)) { anota(tx(`As cadeiras de ${m.nome} atrapalham a abertura de “${p.nome}”.`, `The chairs at ${m.nome} block “${p.nome}” from opening.`), m.id, p.id); portasBloq.add(p.id); }
      }
      if (falta < Infinity) anota(tx(`As cadeiras de ${m.nome} precisam de ${nc} cm livres para puxar e sentar (tem ${Math.max(0, Math.round(falta))} cm).`, `The chairs at ${m.nome} need ${nc} cm free to pull out and sit (have ${Math.max(0, Math.round(falta))} cm).`), m.id);
    }
  }
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) {
    if (sobrepoe(ret(lista[i]), ret(lista[j]))) { anota(tx(`${lista[i].nome} e ${lista[j].nome} estão um em cima do outro.`, `${lista[i].nome} and ${lista[j].nome} overlap.`), lista[i].id); conflitos.add(lista[j].id); }
  }
  const vaos = q.portas.concat(q.janelas);
  for (let i = 0; i < vaos.length; i++) for (let j = i + 1; j < vaos.length; j++) {
    const A = vaos[i], B = vaos[j];
    if (A.parede !== B.parede) continue;
    const ga = geoEl(q, A), gb = geoEl(q, B);
    if (ga.a < gb.b - 0.5 && ga.b > gb.a + 0.5) { anota(tx(`${A.nome} e ${B.nome} estão no mesmo lugar da parede. Arraste um deles.`, `${A.nome} and ${B.nome} are in the same spot on the wall. Drag one of them.`), null, A.id); elsRuins.add(B.id); }
  }
  for (const it of q.interruptores) for (const v of vaos) {
    if (v.parede !== it.parede) continue;
    const gi = geoEl(q, it), gv = geoEl(q, v);
    if (gi.a < gv.b - 0.5 && gi.b > gv.a + 0.5) anota(tx(`“${it.nome}” está no vão de “${v.nome}”.`, `“${it.nome}” is inside the opening of “${v.nome}”.`), null, it.id);
  }
  return { problemas: itens.map((i) => i.t), itens, conflitos, portasBloq, elsRuins };
}

/** Ímã: gruda o móvel nas paredes e nos outros móveis quando chega perto. */
export function ima(q: Caixa, m: Medidas, x: number, y: number, outros: Posto[], ligado: boolean): { x: number; y: number } {
  if (!ligado) return { x, y };
  const d = dims(m), LIM = 6;
  const cx = [0, q.w - d.w], cy = [0, q.h - d.h];
  for (const o of outros) { const r = ret(o); cx.push(r.x2, r.x1 - d.w); cy.push(r.y2, r.y1 - d.h); }
  let bx = x, by = y, mx = LIM + 1, my = LIM + 1;
  for (const c of cx) { const dd = Math.abs(c - x); if (dd < mx) { mx = dd; bx = c; } }
  for (const c of cy) { const dd = Math.abs(c - y); if (dd < my) { my = dd; by = c; } }
  return { x: mx <= LIM ? bx : x, y: my <= LIM ? by : y };
}

/** Lugar sem conflito com portas, interruptores, ar, janelas (para móvel alto) e outros móveis. */
export function posValida(q: ComodoCompleto, m: Movel, x: number, y: number, rot: number, outros: Posto[], exigirFrente: boolean): boolean {
  const d = dims(m, rot), r = { x1: x, y1: y, x2: x + d.w, y2: y + d.h };
  if (x < 0 || y < 0 || r.x2 > q.w || r.y2 > q.h) return false;
  if (outros.some((o) => sobrepoe(r, ret(o)))) return false;
  if (q.portas.some((p) => bloqueiaPorta(q, p, r) || (p.abre === 'fora' && naFrentePorta(q, p, r)))) return false;
  if (q.interruptores.some((i) => cobreInterruptor(q, i, r, m.alto))) return false;
  if (m.alto && (q.ares.some((a) => naAreaDoAr(q, a, r)) || q.janelas.some((j) => janelaRuim(q, j, r)))) return false;
  if (exigirFrente) {
    const need = precisaFrente(m);
    const pos = { ...m, x, y, rot };
    if (need && folgas(q, pos, outros)[FRENTE[rot]].gap < need) return false;
    if (temCadeiras(m)) {
      const f = folgas(q, pos, outros), nc = precisaCadeira(m);
      for (const z of zonasCadeiras(pos)) if (f[ladoNaSala(rot, z.lado)].gap < nc) return false;
    }
  }
  return true;
}

/** As cadeiras da mesa (sem o espaço para puxar) ficam dentro do cômodo e sem bater em outro móvel. */
export function cadeirasCabem(q: Caixa, m: Movel, x: number, y: number, rot: number, outros: Posto[]): boolean {
  if (!temCadeiras(m)) return true;
  for (const c of cadeirasLocais(m)) {
    const r = localParaSala(m, { x1: c.x, y1: c.y, x2: c.x + c.w, y2: c.y + c.h }, x, y, rot);
    if (r.x1 < -0.5 || r.y1 < -0.5 || r.x2 > q.w + 0.5 || r.y2 > q.h + 0.5) return false;
    if (outros.some((o) => sobrepoe(r, ret(o)))) return false;
  }
  return true;
}

/** Lugar para um móvel novo: primeiro com as costas numa parede (e espaço na frente), depois qualquer lugar livre. */
export function lugarLivre(q: ComodoCompleto, m: Movel, outros: Posto[]): { x: number; y: number; rot: number } {
  const cad = temCadeiras(m);
  const grade = (passo: number, ok: (x: number, y: number, rot: number) => boolean) => {
    for (const rot of [0, 90]) {
      const d = dims(m, rot);
      for (let y = 0; y <= q.h - d.h; y += passo) for (let x = 0; x <= q.w - d.w; x += passo) if (ok(x, y, rot)) return { x, y, rot };
    }
    return null;
  };
  for (const exigir of [true, false]) {
    for (const parede of ['cima', 'esquerda', 'baixo', 'direita'] as Parede[]) {
      const rot = COSTAS[parede], d = dims(m, rot);
      if (d.w > q.w || d.h > q.h) continue;
      const horiz = horizontal(parede), L = horiz ? q.w - d.w : q.h - d.h, us: number[] = [];
      for (let u = 0; u < L; u += 5) us.push(u);
      us.push(L);
      for (const u of us) {
        const x = horiz ? u : parede === 'esquerda' ? 0 : q.w - d.w;
        const y = horiz ? (parede === 'cima' ? 0 : q.h - d.h) : u;
        if (posValida(q, m, x, y, rot, outros, exigir) && (exigir || cadeirasCabem(q, m, x, y, rot, outros))) return { x, y, rot };
      }
    }
    if (cad) {
      // mesa com cadeiras também pode ficar no meio do cômodo
      const g = grade(exigir ? 10 : 5, (x, y, rot) => posValida(q, m, x, y, rot, outros, exigir) && cadeirasCabem(q, m, x, y, rot, outros));
      if (g) return g;
    }
  }
  const g = grade(5, (x, y, rot) => posValida(q, m, x, y, rot, outros, false) && cadeirasCabem(q, m, x, y, rot, outros));
  if (g) return g;
  if (cad) {
    // não cabe sem bater: as cadeiras ao menos ficam dentro do cômodo, onde a sobreposição for menor
    const area = (a: Ret, b: Ret) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
    let melhor: { x: number; y: number; rot: number; v: number } | null = null;
    for (const rot of [0, 90]) {
      const d = dims(m, rot);
      for (let y = 0; y <= q.h - d.h; y += 10) for (let x = 0; x <= q.w - d.w; x += 10) {
        const dentro = cadeirasLocais(m).every((c) => { const r = localParaSala(m, { x1: c.x, y1: c.y, x2: c.x + c.w, y2: c.y + c.h }, x, y, rot); return r.x1 >= -0.5 && r.y1 >= -0.5 && r.x2 <= q.w + 0.5 && r.y2 <= q.h + 0.5; });
        if (!dentro) continue;
        const partes = [ret(m, x, y, rot), ...cadeirasLocais(m).map((c) => localParaSala(m, { x1: c.x, y1: c.y, x2: c.x + c.w, y2: c.y + c.h }, x, y, rot))];
        const v = outros.reduce((t, o) => { const ro = ret(o); return t + partes.reduce((u, pr) => u + area(pr, ro), 0); }, 0);
        if (!melhor || v < melhor.v) melhor = { x, y, rot, v };
      }
    }
    if (melhor) return { x: melhor.x, y: melhor.y, rot: melhor.rot };
  }
  const g2 = grade(5, (x, y, rot) => posValida(q, m, x, y, rot, outros, false));
  if (g2) return g2;
  const d = dims(m, 0);
  return { x: Math.max(0, Math.round((q.w - d.w) / 2)), y: Math.max(0, Math.round((q.h - d.h) / 2)), rot: 0 };
}

export function paredePerto(q: Caixa, x: number, y: number): { parede: Parede; u: number; dist: number } {
  const X = clamp(x, 0, q.w), Y = clamp(y, 0, q.h);
  const d: Record<Parede, number> = { cima: Y, baixo: q.h - Y, esquerda: X, direita: q.w - X };
  let parede: Parede = 'cima';
  for (const k of PAREDES) if (d[k] < d[parede]) parede = k;
  return { parede, u: Math.round(horizontal(parede) ? X : Y), dist: d[parede] };
}

/** Móvel posto num ponto escolhido: perto de uma parede, já vira com as costas para ela. */
export function posNoPonto(q: Caixa, m: Medidas, px: number, py: number): { x: number; y: number; rot: number } {
  const pp = paredePerto(q, px, py), perto = pp.dist < 70;
  const rot = perto ? COSTAS[pp.parede] : 0, d = dims(m, rot);
  let x = clamp(px, 0, q.w) - d.w / 2, y = clamp(py, 0, q.h) - d.h / 2;
  if (perto) {
    if (pp.parede === 'cima') y = 0;
    else if (pp.parede === 'baixo') y = q.h - d.h;
    else if (pp.parede === 'esquerda') x = 0;
    else x = q.w - d.w;
  }
  const c = prender(q, m, x, y, rot);
  return { x: c.x, y: c.y, rot };
}

export const descParede = (p: Parede): string => tx('parede ' + NOME_PAREDE[p], NOME_PAREDE[p] + ' wall');
