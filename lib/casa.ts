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

/* ---------- um cômodo ao lado de outro, e corredores ---------- */
export type Lado4 = 'direita' | 'esquerda' | 'acima' | 'abaixo';
export type Alinhar = 'inicio' | 'meio' | 'fim';
export const LADOS4: Lado4[] = ['direita', 'esquerda', 'acima', 'abaixo'];
const horizontalCasa = (l: Lado4) => l === 'direita' || l === 'esquerda';

/** Onde fica um cômodo encostado num lado de outro: dividindo a parede (espaço 0) ou com um espaço entre as paredes.
 *  "inicio" alinha pelo topo (à direita/esquerda) ou pela esquerda (acima/abaixo); "fim" pelo outro lado. */
export function posicaoAoLado(c: { w: number; h: number }, ref: Pos, lado: Lado4, alinhar: Alinhar = 'inicio', espaco = 0): { x: number; y: number } {
  const passo = T + (espaco > 0 ? espaco + T : 0);
  const al = (tam: number, ini: number, total: number) => Math.round(alinhar === 'meio' ? ini + (total - tam) / 2 : alinhar === 'fim' ? ini + total - tam : ini);
  if (lado === 'direita') return { x: ref.x + ref.w + passo, y: al(c.h, ref.y, ref.h) };
  if (lado === 'esquerda') return { x: ref.x - passo - c.w, y: al(c.h, ref.y, ref.h) };
  if (lado === 'abaixo') return { x: al(c.w, ref.x, ref.w), y: ref.y + ref.h + passo };
  return { x: al(c.w, ref.x, ref.w), y: ref.y - passo - c.h };
}

/** Espaço livre entre as paredes de "a" e "b" no lado escolhido (para um corredor caber), ou null se "b" não está desse lado. */
export function vaoEntre(a: Pos, b: Pos, lado: Lado4): number | null {
  const g = lado === 'direita' ? b.x - (a.x + a.w) - 2 * T : lado === 'esquerda' ? a.x - (b.x + b.w) - 2 * T
    : lado === 'abaixo' ? b.y - (a.y + a.h) - 2 * T : a.y - (b.y + b.h) - 2 * T;
  return g > 0 ? Math.round(g) : null;
}

export interface PlanoCorredor { corredor: { x: number; y: number; w: number; h: number }; b?: { x: number; y: number }; comprimento: number }

/** Corredor saindo de "a" pelo lado escolhido. Sem comprimento, usa o espaço que já existe até "b" (e "b" fica onde está);
 *  com comprimento, "b" vai para a outra ponta do corredor. */
export function planoCorredor(a: Pos, lado: Lado4, largura: number, alinhar: Alinhar, b: Pos | null, comprimento: number | null): PlanoCorredor | { erro: 'sem-vao' | 'sem-medida' } {
  const hz = horizontalCasa(lado);
  let comp = comprimento, moverB = true;
  if (comp == null) {
    if (!b) return { erro: 'sem-medida' };
    const v = vaoEntre(a, b, lado);
    if (v == null) return { erro: 'sem-vao' };
    comp = v; moverB = false;
  }
  const dim = hz ? { w: comp, h: largura } : { w: largura, h: comp };
  let p = posicaoAoLado(dim, a, lado, alinhar);
  if (b && !moverB) {
    // o corredor fica na faixa onde os dois cômodos se encaram
    const ini = hz ? Math.max(a.y, b.y) : Math.max(a.x, b.x), fim = hz ? Math.min(a.y + a.h, b.y + b.h) : Math.min(a.x + a.w, b.x + b.w);
    if (fim - ini >= largura) {
      const meio = Math.round(alinhar === 'inicio' ? ini : alinhar === 'fim' ? fim - largura : ini + (fim - ini - largura) / 2);
      p = hz ? { ...p, y: meio } : { ...p, x: meio };
    }
  }
  const corredor = { ...p, ...dim };
  if (!b || !moverB) return { corredor, comprimento: comp };
  let pb = posicaoAoLado(b, corredor, lado, 'meio');
  // se "b" já cobre a largura do corredor nessa direção, só anda no comprimento
  if (hz && b.y <= corredor.y && b.y + b.h >= corredor.y + corredor.h) pb = { ...pb, y: b.y };
  if (!hz && b.x <= corredor.x && b.x + b.w >= corredor.x + corredor.w) pb = { ...pb, x: b.x };
  return { corredor, b: pb, comprimento: comp };
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

/** Ímã dos cômodos: encosta paredes (dividindo a parede) e alinha cantos quando chega perto. Encostar no vizinho que
 *  está de frente (os dois se encaram) puxa de mais longe ("gruda"); só alinhar com um cômodo distante puxa de perto. */
export function imaComodo(c: Pos, x: number, y: number, outros: Pos[], lim: number, limAlinhar = lim * 0.75): { x: number; y: number } {
  const cx: [number, number][] = [[0, limAlinhar]], cy: [number, number][] = [[0, limAlinhar]];
  for (const o of outros) {
    const deFrenteY = Math.min(y + c.h, o.y + o.h) - Math.max(y, o.y) > -lim, deFrenteX = Math.min(x + c.w, o.x + o.w) - Math.max(x, o.x) > -lim;
    cx.push([o.x + o.w + T, deFrenteY ? lim : limAlinhar], [o.x - T - c.w, deFrenteY ? lim : limAlinhar], [o.x, limAlinhar], [o.x + o.w - c.w, limAlinhar]);
    cy.push([o.y + o.h + T, deFrenteX ? lim : limAlinhar], [o.y - T - c.h, deFrenteX ? lim : limAlinhar], [o.y, limAlinhar], [o.y + o.h - c.h, limAlinhar]);
  }
  const melhor = (v0: number, cands: [number, number][]) => {
    let b = v0, md = Infinity;
    for (const [v, l] of cands) { const d = Math.abs(v - v0); if (d <= l && d < md) { md = d; b = v; } }
    return b;
  };
  return { x: Math.round(melhor(x, cx)), y: Math.round(melhor(y, cy)) };
}

/* ---------- desenhar e esticar cômodos na planta ---------- */
/** Ímã de uma borda: encosta na parede do vizinho (dividindo a parede), alinha com as bordas dele ou arredonda de 5 em 5 cm.
 *  "v" é a coordenada de dentro do cômodo; "ini" é a borda da esquerda (ou de cima), "fim" a da direita (ou de baixo). */
export function imaBorda(v: number, eixo: 'x' | 'y', outros: Pos[], lim: number, lado?: 'ini' | 'fim'): number {
  let melhor = Math.round(v / 5) * 5, md = lim + 1e-9;
  for (const o of outros) {
    const a = eixo === 'x' ? o.x : o.y, t = eixo === 'x' ? o.w : o.h;
    const cands = lado === 'ini' ? [a + t + T, a] : lado === 'fim' ? [a - T, a + t] : [a - T, a, a + t, a + t + T];
    for (const c of cands) { const d = Math.abs(c - v); if (d < md) { md = d; melhor = c; } }
  }
  return Math.round(melhor);
}

/** O retângulo desenhado de "p0" até "p1", com o ímã em cada borda. */
export function retDesenhado(p0: { x: number; y: number }, p1: { x: number; y: number }, outros: Pos[], lim: number): Pos {
  const x1 = imaBorda(Math.min(p0.x, p1.x), 'x', outros, lim, 'ini'), x2 = imaBorda(Math.max(p0.x, p1.x), 'x', outros, lim, 'fim');
  const y1 = imaBorda(Math.min(p0.y, p1.y), 'y', outros, lim, 'ini'), y2 = imaBorda(Math.max(p0.y, p1.y), 'y', outros, lim, 'fim');
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

/* ---------- a parede reta da planta (para mover de uma vez, com os cômodos dos dois lados) ---------- */
export interface LinhaParede {
  /** x: parede em pé (anda para os lados); y: parede deitada (anda para cima e para baixo). */
  eixo: 'x' | 'y';
  /** Onde termina, por dentro, quem fica antes da parede (x + w ou y + h); quem fica depois começa em v + T. */
  v: number;
  antes: string[];
  depois: string[];
  /** Trecho da parede ao longo dela (de uma ponta à outra, com as paredes das pontas). */
  de: number;
  ate: number;
}
type PosId = Pos & { id: string };
const fimDe = (c: Pos, eixo: 'x' | 'y') => (eixo === 'x' ? c.x + c.w : c.y + c.h);
const iniDe = (c: Pos, eixo: 'x' | 'y') => (eixo === 'x' ? c.x : c.y);
const trechoDe = (c: Pos, eixo: 'x' | 'y'): [number, number] => (eixo === 'x' ? [c.y, c.y + c.h] : [c.x, c.x + c.w]);

/** A parede reta em "v" (veja LinhaParede) que passa por "ponto" (ao longo dela): os cômodos que encostam nela dos
 *  dois lados e seguem em linha, um depois do outro (só com uma parede no meio). Uma parede de fora vale pela fachada
 *  inteira daquele lado. */
export function linhaDaParede(cs: PosId[], eixo: 'x' | 'y', v: number, ponto: number): LinhaParede {
  const antes = cs.filter((c) => Math.abs(fimDe(c, eixo) - v) < 1), depois = cs.filter((c) => Math.abs(iniDe(c, eixo) - (v + T)) < 1);
  const dentro = new Set<string>();
  let lo = ponto, hi = ponto, mudou = true;
  while (mudou) {
    mudou = false;
    for (const c of [...antes, ...depois]) {
      if (dentro.has(c.id)) continue;
      const [a, b] = trechoDe(c, eixo);
      if (b >= lo - T - 1 && a <= hi + T + 1) { dentro.add(c.id); lo = Math.min(lo, a); hi = Math.max(hi, b); mudou = true; }
    }
  }
  return { eixo, v, antes: antes.filter((c) => dentro.has(c.id)).map((c) => c.id), depois: depois.filter((c) => dentro.has(c.id)).map((c) => c.id), de: lo - T, ate: hi + T };
}

/** A parede (de qualquer cômodo do andar) mais perto do ponto, a até "tol" do meio dela, como LinhaParede; null longe. */
export function paredeNoPontoDaCasa(cs: PosId[], p: { x: number; y: number }, tol: number): LinhaParede | null {
  let melhor: { eixo: 'x' | 'y'; v: number; d: number; ao: number } | null = null;
  for (const c of cs) {
    const ps: { eixo: 'x' | 'y'; meio: number; v: number; a: number; b: number }[] = [
      { eixo: 'x', meio: c.x + c.w + T / 2, v: c.x + c.w, a: c.y - T, b: c.y + c.h + T },
      { eixo: 'x', meio: c.x - T / 2, v: c.x - T, a: c.y - T, b: c.y + c.h + T },
      { eixo: 'y', meio: c.y + c.h + T / 2, v: c.y + c.h, a: c.x - T, b: c.x + c.w + T },
      { eixo: 'y', meio: c.y - T / 2, v: c.y - T, a: c.x - T, b: c.x + c.w + T }
    ];
    for (const k of ps) {
      const ao = k.eixo === 'x' ? p.y : p.x, d = Math.abs((k.eixo === 'x' ? p.x : p.y) - k.meio);
      if (ao < k.a || ao > k.b || d > tol) continue;
      if (!melhor || d < melhor.d - 0.01) melhor = { eixo: k.eixo, v: k.v, d, ao };
    }
  }
  return melhor ? linhaDaParede(cs, melhor.eixo, melhor.v, melhor.ao) : null;
}

/** Até onde a parede reta pode ir sem deixar nenhum cômodo dos dois lados menor que "min" (por dentro). */
export function limitesDaLinha(cs: Record<string, Pos>, l: LinhaParede, min: number): { de: number; ate: number } {
  let de = -Infinity, ate = Infinity;
  for (const id of l.antes) { const c = cs[id]; if (c) de = Math.max(de, iniDe(c, l.eixo) + min); }
  for (const id of l.depois) { const c = cs[id]; if (c) ate = Math.min(ate, fimDe(c, l.eixo) - T - min); }
  return { de, ate };
}

/** Trecho da parede de "a" que ele divide com "b" (cm ao longo da parede de "a", como o "inicio" das portas), ou null. */
export function paredeDividida(a: Pos, b: Pos): { parede: Parede; u1: number; u2: number } | null {
  const perto = (p: number, q: number) => Math.abs(p - q) < 1;
  const trecho = (parede: Parede, i1: number, i2: number, j1: number, j2: number, base: number) => {
    const u1 = Math.max(i1, j1) - base, u2 = Math.min(i2, j2) - base;
    return u2 - u1 > 0.5 ? { parede, u1: Math.round(u1), u2: Math.round(u2) } : null;
  };
  if (perto(b.x, a.x + a.w + T)) return trecho('direita', a.y, a.y + a.h, b.y, b.y + b.h, a.y);
  if (perto(a.x, b.x + b.w + T)) return trecho('esquerda', a.y, a.y + a.h, b.y, b.y + b.h, a.y);
  if (perto(b.y, a.y + a.h + T)) return trecho('baixo', a.x, a.x + a.w, b.x, b.x + b.w, a.x);
  if (perto(a.y, b.y + b.h + T)) return trecho('cima', a.x, a.x + a.w, b.x, b.x + b.w, a.x);
  return null;
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
      // (a parede tirada vale sempre: se houver porta ou janela neste lado do trecho, o aviso de "mesmo lugar" aparece)
      if (!e.semParede && minhas.some((m) => m.parede === minha && m.inicio < u2 - 0.5 && m.inicio + m.largura > u1 + 0.5)) continue;
      out.push({
        id: e.id, tipo: 'porta', nome: `${e.nome} (${o.nome})`, comodo: c.id, parede: minha, inicio: Math.round(u1), largura: Math.round(u2 - u1),
        criado: e.criado, dobradica: e.dobradica, abre: abreDoOutroLado(e.abre), herdada: true, origem: e.id, origemComodo: o.id,
        ...(e.estilo ? { estilo: e.estilo } : {}), ...(e.semParede ? { semParede: true } : {}), ...(e.auto ? { auto: true } : {}), liga: o.id
      });
    }
  }
  return out;
}

/** Para onde a porta abre, visto do outro lado da parede. */
export const abreDoOutroLado = (abre: ElParede['abre']): ElParede['abre'] => (abre === 'vao' ? 'vao' : abre === 'fora' ? 'dentro' : 'fora');
export const PAREDE_OPOSTA: Record<Parede, Parede> = { cima: 'baixo', baixo: 'cima', esquerda: 'direita', direita: 'esquerda' };

/** A mesma porta medida pelo lado do vizinho: a parede dele, a distância do canto dele e para onde ela abre vista de lá.
 *  Só quando a porta está inteira no trecho de parede que os dois dividem (senão parte dela ficaria fora da parede dele).
 *  As duas paredes correm no mesmo sentido, então a dobradiça não muda. */
export function portaVistaDe(dono: Pos & { andar: string }, viz: Pos & { andar: string }, e: Pick<ElParede, 'parede' | 'inicio' | 'largura' | 'abre'>): { parede: Parede; inicio: number; largura: number; abre: ElParede['abre'] } | null {
  if (dono.andar !== viz.andar) return null;
  const pd = paredeDividida(dono, viz);
  if (!pd || pd.parede !== e.parede) return null;
  const vert = e.parede === 'direita' || e.parede === 'esquerda', L = vert ? dono.h : dono.w;
  const w = Math.min(e.largura, L), a = Math.min(Math.max(0, e.inicio), L - w);
  if (a < pd.u1 - 0.5 || a + w > pd.u2 + 0.5) return null;
  const base = vert ? dono.y - viz.y : dono.x - viz.x;
  return { parede: PAREDE_OPOSTA[e.parede], inicio: Math.round(base + a), largura: Math.round(w), abre: abreDoOutroLado(e.abre) };
}
