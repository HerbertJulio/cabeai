// A casa montada: cômodos posicionados na planta de cada andar (cm, canto interno de cima à esquerda).
import { T } from './catalogo';
import { tx } from './i18n';
import type { Andar, Comodo, ElParede, Parede, Ret } from './tipos';

type Pos = Pick<Comodo, 'x' | 'y' | 'w' | 'h'>;

/** Retângulo do cômodo por fora, com as paredes. */
export const caixa = (c: Pos): Ret => ({ x1: c.x - T, y1: c.y - T, x2: c.x + c.w + T, y2: c.y + c.h + T });
/** Retângulo de dentro do cômodo. */
export const dentro = (c: Pos): Ret => ({ x1: c.x, y1: c.y, x2: c.x + c.w, y2: c.y + c.h });

export function caixaDe(cs: Pos[]): Ret | null {
  if (!cs.length) return null;
  const r = caixa(cs[0]);
  for (const c of cs.slice(1)) { const b = caixa(c); r.x1 = Math.min(r.x1, b.x1); r.y1 = Math.min(r.y1, b.y1); r.x2 = Math.max(r.x2, b.x2); r.y2 = Math.max(r.y2, b.y2); }
  return r;
}

/** Lugar para um cômodo novo: à direita do que já existe no andar, dividindo a parede. */
export function posicaoNova(cs: Pos[], w: number, h: number): { x: number; y: number } {
  if (!cs.length) return { x: 0, y: 0 };
  // tenta encostar à direita de cada cômodo, de cima para baixo, sem invadir ninguém
  const ordem = cs.slice().sort((a, b) => a.y - b.y || b.x + b.w - (a.x + a.w));
  for (const c of ordem) {
    const p = { x: c.x + c.w + T, y: c.y };
    if (!cs.some((o) => invade({ ...p, w, h }, o))) return p;
  }
  const b = caixaDe(cs)!;
  return { x: b.x2, y: b.y1 + T };
}

/** As paredes de "a" entram no espaço de dentro de "b" (ou vice-versa)? Dividir a mesma parede é permitido. */
export function invade(a: Pos, b: Pos): boolean {
  const A = caixa(a), B = dentro(b), A2 = dentro(a), B2 = caixa(b);
  const corta = (p: Ret, q: Ret) => p.x1 < q.x2 - 0.5 && p.x2 > q.x1 + 0.5 && p.y1 < q.y2 - 0.5 && p.y2 > q.y1 + 0.5;
  return corta(A, B) || corta(B2, A2);
}

/** Pares de cômodos que se invadem num andar. */
export function sobreposicoes(cs: Comodo[]): [Comodo, Comodo][] {
  const out: [Comodo, Comodo][] = [];
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) if (invade(cs[i], cs[j])) out.push([cs[i], cs[j]]);
  return out;
}

/** Ímã dos cômodos: encosta paredes (dividindo a parede) e alinha cantos quando chega perto. */
export function imaComodo(c: Pos, x: number, y: number, outros: Pos[], lim: number): { x: number; y: number } {
  const cx: number[] = [0], cy: number[] = [0];
  for (const o of outros) {
    cx.push(o.x + o.w + T, o.x - T - c.w, o.x, o.x + o.w - c.w);
    cy.push(o.y + o.h + T, o.y - T - c.h, o.y, o.y + o.h - c.h);
  }
  let bx = x, by = y, mx = lim + 1, my = lim + 1;
  for (const v of cx) { const d = Math.abs(v - x); if (d < mx) { mx = d; bx = v; } }
  for (const v of cy) { const d = Math.abs(v - y); if (d < my) { my = d; by = v; } }
  return { x: Math.round(mx <= lim ? bx : x), y: Math.round(my <= lim ? by : y) };
}

export type LadoCasa = 'esq' | 'dir' | 'cima' | 'baixo';
export interface Espaco { lado: LadoCasa; gap: number; de: number; ate: number; em: number; eixo: 'x' | 'y'; vizinho: string }

/** Espaço entre as paredes de fora do cômodo e o vizinho mais próximo de cada lado (só quando há espaço de verdade). */
export function espacos(c: Comodo, outros: Comodo[]): Espaco[] {
  const A = caixa(c), out: Espaco[] = [];
  const melhor: Partial<Record<LadoCasa, Espaco>> = {};
  // o vizinho mais perto de cada lado; se ele divide a parede (ou invade), aquele lado fica sem seta
  const pega = (lado: LadoCasa, e: Espaco) => { const m = melhor[lado]; if (!m || e.gap < m.gap) melhor[lado] = e; };
  for (const o of outros) {
    const B = caixa(o);
    const sobV = Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1), sobH = Math.min(A.x2, B.x2) - Math.max(A.x1, B.x1);
    if (sobV > 1) {
      const emY = (Math.max(A.y1, B.y1) + Math.min(A.y2, B.y2)) / 2;
      if (B.x2 > A.x2 + 0.5) pega('dir', { lado: 'dir', gap: B.x1 - A.x2, de: A.x2, ate: B.x1, em: emY, eixo: 'x', vizinho: o.id });
      if (B.x1 < A.x1 - 0.5) pega('esq', { lado: 'esq', gap: A.x1 - B.x2, de: B.x2, ate: A.x1, em: emY, eixo: 'x', vizinho: o.id });
    }
    if (sobH > 1) {
      const emX = (Math.max(A.x1, B.x1) + Math.min(A.x2, B.x2)) / 2;
      if (B.y2 > A.y2 + 0.5) pega('baixo', { lado: 'baixo', gap: B.y1 - A.y2, de: A.y2, ate: B.y1, em: emX, eixo: 'y', vizinho: o.id });
      if (B.y1 < A.y1 - 0.5) pega('cima', { lado: 'cima', gap: A.y1 - B.y2, de: B.y2, ate: A.y1, em: emX, eixo: 'y', vizinho: o.id });
    }
  }
  for (const k of ['esq', 'dir', 'cima', 'baixo'] as LadoCasa[]) { const e = melhor[k]; if (e && e.gap >= 1) out.push(e); }
  return out;
}

/** Paredes que o cômodo divide com vizinhos (para não desenhar duas vezes e para saber o que é parede de dentro). */
export function vizinhosColados(c: Comodo, outros: Comodo[]): string[] {
  const A = caixa(c);
  return outros.filter((o) => {
    const B = caixa(o);
    const tocaX = Math.abs(B.x1 - (A.x2 - T)) < 1 || Math.abs(A.x1 - (B.x2 - T)) < 1;
    const tocaY = Math.abs(B.y1 - (A.y2 - T)) < 1 || Math.abs(A.y1 - (B.y2 - T)) < 1;
    const sobV = Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1) > 1, sobH = Math.min(A.x2, B.x2) - Math.max(A.x1, B.x1) > 1;
    return (tocaX && sobV) || (tocaY && sobH);
  }).map((o) => o.id);
}

/** Ordinal em inglês: 1st, 2nd, 3rd, 4th… 11th, 12th, 13th… 21st. */
const ordinalEn = (n: number): string => {
  const d = n % 100, u = n % 10;
  return n + (d >= 11 && d <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
};
const nomeAndar = (k: number): string => tx(`${k}º andar`, `${ordinalEn(k)} floor`);

/** Nome do próximo andar: Térreo, 1º andar, 2º andar… */
export function nomeAndarNovo(andares: Andar[]): string {
  const nomes = new Set(andares.map((a) => a.nome));
  const terreo = tx('Térreo', 'Ground floor');
  if (!nomes.has(terreo)) return terreo;
  let k = 1;
  while (nomes.has(nomeAndar(k))) k++;
  return nomeAndar(k);
}

export const ordenarAndares = (as: Andar[]): Andar[] => as.slice().sort((a, b) => a.ordem - b.ordem || a.criado - b.criado);
export const ordenarComodos = (cs: Comodo[]): Comodo[] => cs.slice().sort((a, b) => (a.criado || 0) - (b.criado || 0) || a.nome.localeCompare(b.nome));

/* ---------- portas na parede dividida ---------- */
// Uma porta cadastrada num cômodo também é um vão na parede do vizinho que divide aquela parede.
// Ela entra no vizinho como "herdada": abre para o lado contrário, conta para conferir e corta a parede no desenho.
type ComodoEls = Comodo & { id: string };
export function portasVizinhas(c: ComodoEls, outros: ComodoEls[], els: ElParede[]): ElParede[] {
  const out: ElParede[] = [];
  const minhas = els.filter((e) => e.comodo === c.id && (e.tipo === 'porta' || e.tipo === 'janela'));
  const perto = (a: number, b: number) => Math.abs(a - b) < 1;
  for (const o of outros) {
    if (o.id === c.id || o.andar !== c.andar) continue;
    let par: [Parede, Parede] | null = null;
    if (perto(o.x, c.x + c.w + T)) par = ['direita', 'esquerda'];
    else if (perto(c.x, o.x + o.w + T)) par = ['esquerda', 'direita'];
    else if (perto(o.y, c.y + c.h + T)) par = ['baixo', 'cima'];
    else if (perto(c.y, o.y + o.h + T)) par = ['cima', 'baixo'];
    if (!par) continue;
    const [minha, dela] = par, vert = minha === 'direita' || minha === 'esquerda';
    for (const e of els) {
      if (e.comodo !== o.id || e.tipo !== 'porta' || e.parede !== dela) continue;
      const L = vert ? o.h : o.w, w = Math.min(e.largura, L), a = Math.min(Math.max(0, e.inicio), L - w);
      const base = vert ? o.y - c.y : o.x - c.x, C = vert ? c.h : c.w;
      const u1 = Math.max(0, base + a), u2 = Math.min(C, base + a + w);
      if (u2 - u1 < 10) continue;
      if (minhas.some((m) => m.parede === minha && m.inicio < u2 - 0.5 && m.inicio + m.largura > u1 + 0.5)) continue;
      out.push({
        id: e.id, tipo: 'porta', nome: `${e.nome} (${o.nome})`, comodo: c.id, parede: minha, inicio: Math.round(u1), largura: Math.round(u2 - u1),
        criado: e.criado, dobradica: e.dobradica, abre: e.abre === 'dentro' ? 'fora' : 'dentro', herdada: true, origem: e.id, origemComodo: o.id
      });
    }
  }
  return out;
}
