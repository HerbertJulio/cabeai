// Onde cada cômodo aparece na tela: um só, lado a lado (grade) ou montados na planta da casa (andares lado a lado).
import { T } from './catalogo';
import { andaresOrdem, comodosDoAndar, cq } from './consultas';
import { geoPorta } from './geometria';
import type { ComodoCompleto, Dados, Vista } from './tipos';

export interface Extensao { x: number; y: number; w: number; h: number; ty: number | null }
export interface CaixaAndar { id: string; nome: string; x: number; y: number; w: number; h: number; ty: number; vazio: boolean }
export interface Layout {
  vista: Vista;
  ids: string[];
  off: Record<string, { x: number; y: number }>;
  ex: Record<string, Extensao>;
  vb: [number, number, number, number];
  andares: CaixaAndar[];
}

/** Espaço que o desenho do cômodo ocupa em volta dele (paredes, medidas, portas que abrem para fora, título). */
export function extensao(q: ComodoCompleto, titulo: boolean, cotas = true): Extensao {
  let top = cotas ? -(T + 42) : -(T + 4), left = cotas ? -(T + 42) : -(T + 4), right = q.w + T + (cotas ? 22 : 4), bottom = q.h + T + (cotas ? 16 : 4);
  for (const p of q.portas) if (p.abre === 'fora' && !p.herdada) {
    const r = geoPorta(q, p).r;
    if (p.parede === 'cima') top = Math.min(top, -r - 8);
    if (p.parede === 'baixo') bottom = Math.max(bottom, q.h + r + 8);
    if (p.parede === 'esquerda') left = Math.min(left, -r - 8);
    if (p.parede === 'direita') right = Math.max(right, q.w + r + 8);
  }
  let ty: number | null = null;
  if (titulo) { ty = top - 6; top -= 30; }
  return { x: left, y: top, w: right - left, h: bottom - top, ty };
}

const vazioLayout = (vista: Vista): Layout => ({ vista, ids: [], off: {}, ex: {}, vb: [0, 0, 300, 300], andares: [] });

export function layoutDe(d: Dados, vista: Vista, ids: string[], tela: { w: number; h: number }): Layout {
  if (!ids.length) return vazioLayout(vista);
  if (vista === 'casa') return layoutCasa(d, tela);
  const ex: Record<string, Extensao> = {}, off: Record<string, { x: number; y: number }> = {};
  const varios = vista === 'lado';
  for (const id of ids) { const q = cq(d, id); if (q) ex[id] = extensao(q, varios); }
  const ok = ids.filter((id) => ex[id]);
  if (!ok.length) return vazioLayout(vista);
  if (ok.length === 1) { const e = ex[ok[0]]; off[ok[0]] = { x: 0, y: 0 }; return { vista, ids: ok, ex, off, vb: [e.x, e.y, e.w, e.h], andares: [] }; }
  // grade: escolhe o número de colunas que deixa o desenho maior na tela
  const cw = Math.max(200, tela.w || 800), ch = Math.max(200, tela.h || 600), gap = 34;
  let melhor: { esc: number; o: typeof off; W: number; H: number } | null = null;
  for (let cols = 1; cols <= ok.length; cols++) {
    const o: typeof off = {};
    let y = 0, W = 0;
    for (let r = 0; r * cols < ok.length; r++) {
      let x = 0, H = 0;
      for (const id of ok.slice(r * cols, (r + 1) * cols)) { const e = ex[id]; o[id] = { x: x - e.x, y: y - e.y }; x += e.w + gap; H = Math.max(H, e.h); }
      W = Math.max(W, x - gap);
      y += H + gap;
    }
    const Ht = y - gap, esc = Math.min(cw / W, ch / Ht);
    if (!melhor || esc > melhor.esc + 1e-9) melhor = { esc, o, W, H: Ht };
  }
  return { vista, ids: ok, ex, off: melhor!.o, vb: [0, 0, melhor!.W, melhor!.H], andares: [] };
}

/** Planta da casa: cada andar com os cômodos nas posições deles; os andares ficam lado a lado. */
function layoutCasa(d: Dados, tela: { w: number; h: number }): Layout {
  const ids: string[] = [], ex: Record<string, Extensao> = {}, off: Record<string, { x: number; y: number }> = {}, andares: CaixaAndar[] = [];
  const as = andaresOrdem(d).filter((a) => comodosDoAndar(d, a.id).length);
  const gap = 160, tituloH = 46;
  const caixas = as.map((a) => {
    const cs = comodosDoAndar(d, a.id).map((c) => cq(d, c.id)!).filter(Boolean);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const q of cs) {
      const e = extensao(q, false, false);
      ex[q.id] = e;
      x1 = Math.min(x1, q.x + e.x); y1 = Math.min(y1, q.y + e.y); x2 = Math.max(x2, q.x + e.x + e.w); y2 = Math.max(y2, q.y + e.y + e.h);
    }
    return { a, cs, x1, y1, x2, y2 };
  });
  // lado a lado quando a tela é larga; um embaixo do outro quando é alta
  const larguraTotal = caixas.reduce((t, c) => t + (c.x2 - c.x1), 0) + gap * Math.max(0, caixas.length - 1);
  const alturaMax = Math.max(1, ...caixas.map((c) => c.y2 - c.y1 + tituloH));
  const alturaTotal = caixas.reduce((t, c) => t + (c.y2 - c.y1) + tituloH, 0) + gap * Math.max(0, caixas.length - 1);
  const larguraMax = Math.max(1, ...caixas.map((c) => c.x2 - c.x1));
  const cw = Math.max(200, tela.w || 800), ch = Math.max(200, tela.h || 600);
  const empilhar = caixas.length > 1 && Math.min(cw / larguraMax, ch / alturaTotal) > Math.min(cw / larguraTotal, ch / alturaMax) * 1.15;
  let cursor = 0;
  for (const c of caixas) {
    const w = c.x2 - c.x1, h = c.y2 - c.y1;
    const bx = empilhar ? 0 : cursor, by = empilhar ? cursor : 0;
    const ox = bx - c.x1, oy = by + tituloH - c.y1;
    for (const q of c.cs) { ids.push(q.id); off[q.id] = { x: ox + q.x, y: oy + q.y }; }
    andares.push({ id: c.a.id, nome: c.a.nome, x: bx, y: by, w, h: h + tituloH, ty: by + 24, vazio: false });
    cursor += (empilhar ? h + tituloH : w) + gap;
  }
  if (!ids.length) return vazioLayout('casa');
  const W = Math.max(...andares.map((a) => a.x + a.w)), H = Math.max(...andares.map((a) => a.y + a.h));
  return { vista: 'casa', ids, ex, off, vb: [0, 0, W, H], andares };
}

/* ---------- câmera ---------- */
export interface Base { cx: number; cy: number; w: number; h: number }
/** Enquadramento: o desenho todo cabe na tela, longe dos botões que ficam por cima. */
export function vbBase(lay: Layout, W: number, H: number, estreito: boolean): Base {
  const [bx, by, bw, bh] = lay.vb;
  const ins = { t: 54, b: 74, l: 10, r: estreito ? 10 : 64 };
  const uw = Math.max(80, W - ins.l - ins.r), uh = Math.max(80, H - ins.t - ins.b), s = Math.min(uw / bw, uh / bh) || 1;
  return { cx: bx + bw / 2 - (ins.l + uw / 2 - W / 2) / s, cy: by + bh / 2 - (ins.t + uh / 2 - H / 2) / s, w: W / s, h: H / s };
}
export function vbAtual(B: Base, cam: { z: number; cx: number | null; cy: number | null }): [number, number, number, number] {
  const cx = cam.cx == null ? B.cx : cam.cx, cy = cam.cy == null ? B.cy : cam.cy, w = B.w / cam.z, h = B.h / cam.z;
  return [cx - w / 2, cy - h / 2, w, h];
}
