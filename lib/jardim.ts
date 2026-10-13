// O terreno desenhado em volta da casa: a calçada e a rua do lado da frente, o caminho da calçada até a porta da
// rua e as árvores do jardim, nos cantos mais livres. Tudo em cm, na planta do andar de baixo.
import { caixa } from './casa';
import { T } from './catalogo';
import { parteDividida } from './edicao';
import { geoEl } from './geometria';
import type { Comodo, ElParede, Ret, Terreno } from './tipos';

type TerrenoPos = Omit<Terreno, 'andar'>;
/** Largura da calçada e da rua (cm): o bastante para mostrar onde fica a frente. */
export const CALCADA = 120, RUA = 360;
const SOBRA = 160;

/** A faixa da calçada e a da rua, do lado da frente do terreno. */
export function faixasDaRua(t: TerrenoPos): { calcada: Ret; rua: Ret } {
  const { x, y, w, h } = t;
  if (t.rua === 'baixo') return { calcada: { x1: x - SOBRA, y1: y + h, x2: x + w + SOBRA, y2: y + h + CALCADA }, rua: { x1: x - SOBRA, y1: y + h + CALCADA, x2: x + w + SOBRA, y2: y + h + CALCADA + RUA } };
  if (t.rua === 'cima') return { calcada: { x1: x - SOBRA, y1: y - CALCADA, x2: x + w + SOBRA, y2: y }, rua: { x1: x - SOBRA, y1: y - CALCADA - RUA, x2: x + w + SOBRA, y2: y - CALCADA } };
  if (t.rua === 'esquerda') return { calcada: { x1: x - CALCADA, y1: y - SOBRA, x2: x, y2: y + h + SOBRA }, rua: { x1: x - CALCADA - RUA, y1: y - SOBRA, x2: x - CALCADA, y2: y + h + SOBRA } };
  return { calcada: { x1: x + w, y1: y - SOBRA, x2: x + w + CALCADA, y2: y + h + SOBRA }, rua: { x1: x + w + CALCADA, y1: y - SOBRA, x2: x + w + CALCADA + RUA, y2: y + h + SOBRA } };
}

/** Tudo o que o desenho do terreno ocupa (com a rua, a calçada e as cotas de fora). */
export function extensaoTerreno(t: TerrenoPos): Ret {
  const f = faixasDaRua(t), m = 70;
  return {
    x1: Math.min(t.x - m, f.rua.x1), y1: Math.min(t.y - m, f.rua.y1),
    x2: Math.max(t.x + t.w + 20, f.rua.x2), y2: Math.max(t.y + t.h + 20, f.rua.y2)
  };
}

/** As portas de fora que dão para a rua (sem ligar a outro cômodo, na parede de fora do lado da frente). */
export function portasDaRua(t: TerrenoPos, cs: Comodo[], els: ElParede[]): { c: Comodo; e: ElParede }[] {
  const out: { c: Comodo; e: ElParede }[] = [];
  for (const c of cs) {
    if (parteDividida(c, t.rua, cs) >= 0.5) continue;
    for (const e of els) if (e.comodo === c.id && e.tipo === 'porta' && e.parede === t.rua && !e.liga && !e.herdada && !e.semParede) out.push({ c, e });
  }
  return out;
}

/** O caminho da calçada até cada porta da rua: uma faixa um pouco mais larga que a porta, até a divisa da frente. */
export function caminhos(t: TerrenoPos, cs: Comodo[], els: ElParede[]): Ret[] {
  const out: Ret[] = [];
  for (const { c, e } of portasDaRua(t, cs, els)) {
    const g = geoEl(c, e), largura = Math.max(110, g.b - g.a + 30);
    if (t.rua === 'baixo' || t.rua === 'cima') {
      const meio = c.x + (g.a + g.b) / 2, x1 = Math.max(t.x, meio - largura / 2), x2 = Math.min(t.x + t.w, meio + largura / 2);
      const r = t.rua === 'baixo' ? { x1, y1: c.y + c.h + T, x2, y2: t.y + t.h } : { x1, y1: t.y, x2, y2: c.y - T };
      if (r.y2 - r.y1 >= 20) out.push(r);
    } else {
      const meio = c.y + (g.a + g.b) / 2, y1 = Math.max(t.y, meio - largura / 2), y2 = Math.min(t.y + t.h, meio + largura / 2);
      const r = t.rua === 'esquerda' ? { x1: t.x, y1, x2: c.x - T, y2 } : { x1: c.x + c.w + T, y1, x2: t.x + t.w, y2 };
      if (r.x2 - r.x1 >= 20) out.push(r);
    }
  }
  return out;
}

const distRet = (x: number, y: number, r: Ret) => Math.hypot(Math.max(r.x1 - x, 0, x - r.x2), Math.max(r.y1 - y, 0, y - r.y2));

/** Árvores do jardim, nos lugares mais livres do terreno: longe da casa (com espaço para as cotas), do caminho e
 *  umas das outras. Uma para cada 30 m² livres, no máximo "max". Sempre as mesmas para o mesmo terreno e casa. */
export function arvores(t: TerrenoPos, cs: Comodo[], caminhosRet: Ret[], max = 6): { x: number; y: number; r: number }[] {
  const ocupados: Ret[] = [
    ...cs.map((c) => { const b = caixa(c); return { x1: b.x1 - 90, y1: b.y1 - 90, x2: b.x2 + 90, y2: b.y2 + 90 }; }),
    ...caminhosRet.map((r) => ({ x1: r.x1 - 30, y1: r.y1 - 30, x2: r.x2 + 30, y2: r.y2 + 30 }))
  ];
  const areaCasa = cs.reduce((s, c) => { const b = caixa(c); return s + (b.x2 - b.x1) * (b.y2 - b.y1); }, 0);
  const livre = Math.max(0, t.w * t.h - areaCasa) / 10000;
  const n = Math.min(max, Math.floor(livre / 30));
  if (n <= 0) return [];
  const passo = Math.max(40, Math.sqrt(t.w * t.h) / 40), out: { x: number; y: number; r: number }[] = [];
  const cands: { x: number; y: number }[] = [];
  for (let y = t.y + passo / 2; y < t.y + t.h; y += passo) for (let x = t.x + passo / 2; x < t.x + t.w; x += passo) cands.push({ x, y });
  for (let k = 0; k < n; k++) {
    let melhor: { x: number; y: number; r: number } | null = null;
    for (const p of cands) {
      let r = Math.min(p.x - t.x, t.x + t.w - p.x, p.y - t.y, t.y + t.h - p.y) + 20;
      for (const o of ocupados) { r = Math.min(r, distRet(p.x, p.y, o)); if (r < 60) break; }
      for (const a of out) r = Math.min(r, Math.hypot(p.x - a.x, p.y - a.y) - a.r - 40);
      if (r >= 60 && (!melhor || r > melhor.r + 0.5)) melhor = { x: p.x, y: p.y, r };
    }
    if (!melhor) break;
    out.push({ x: Math.round(melhor.x), y: Math.round(melhor.y), r: Math.round(Math.min(170, melhor.r - 10)) });
  }
  return out;
}
