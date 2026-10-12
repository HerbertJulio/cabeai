// Áreas (m²) e o resumo da casa: cômodos com medidas e área, total de cada andar e a lista de móveis.
import { TIPOS } from './catalogo';
import { andaresOrdem, comodosDoAndar } from './consultas';
import { moveisDo } from './dados';
import { ret } from './geometria';
import { idioma, tx } from './i18n';
import type { Comodo, Dados, Movel } from './tipos';
import { fmtM, pl } from './util';

/** Área de dentro do cômodo, em m². */
export const areaM2 = (c: { w: number; h: number }): number => (c.w * c.h) / 10000;

/** "10,5 m²" (uma casa decimal; a partir de 100 m², inteiro). */
export function fmtArea(m2: number): string {
  const v = m2 >= 100 ? String(Math.round(m2)) : (Math.round(m2 * 10) / 10).toFixed(1);
  return (idioma() === 'en' ? v : v.replace('.', ',')) + ' m²';
}

/** Chão livre do cômodo, sem os móveis (onde eles se sobrepõem conta uma vez só), em m² e em %. */
export function areaLivre(c: { w: number; h: number }, moveis: Movel[]): { m2: number; pct: number } {
  const g = 5, cols = Math.max(1, Math.ceil(c.w / g)), rows = Math.max(1, Math.ceil(c.h / g)), oc = new Uint8Array(cols * rows);
  const cl = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  for (const m of moveis) {
    const r = ret(m), i1 = cl(Math.floor(r.x1 / g), cols), i2 = cl(Math.ceil(r.x2 / g), cols), j1 = cl(Math.floor(r.y1 / g), rows), j2 = cl(Math.ceil(r.y2 / g), rows);
    for (let j = j1; j < j2; j++) for (let i = i1; i < i2; i++) oc[j * cols + i] = 1;
  }
  let ocupadas = 0;
  for (let k = 0; k < oc.length; k++) ocupadas += oc[k];
  const total = areaM2(c), ocupado = Math.min(total, (ocupadas * g * g) / 10000);
  return { m2: Math.max(0, total - ocupado), pct: total > 0 ? Math.round(((total - ocupado) / total) * 100) : 0 };
}

export const areaDe = (cs: Comodo[]): number => cs.reduce((t, c) => t + areaM2(c), 0);
export const areaDoAndar = (d: Dados, andar: string): number => areaDe(comodosDoAndar(d, andar));
export const areaDaCasa = (d: Dados): number => areaDe(Object.values(d.comodos));

const medidas = (m: Movel) => `${fmtM(m.larg)} × ${fmtM(m.prof)} m`;

/** O resumo da casa em texto simples (para copiar e mandar a alguém ou levar na loja). */
export function textoResumo(d: Dados): string {
  const L: string[] = [];
  const cs = Object.values(d.comodos), nm = Object.keys(d.moveis).length;
  L.push(`${tx('Casa', 'Home')} · ${fmtArea(areaDaCasa(d))} · ${pl(cs.length, tx('cômodo', 'room'), tx('cômodos', 'rooms'))} · ${pl(nm, tx('móvel', 'piece of furniture'), tx('móveis', 'pieces of furniture'))}`);
  const as = andaresOrdem(d).filter((a) => comodosDoAndar(d, a.id).length);
  for (const a of as) {
    L.push('', `${a.nome.toUpperCase()} · ${fmtArea(areaDoAndar(d, a.id))}`);
    for (const c of comodosDoAndar(d, a.id)) {
      L.push(`- ${c.nome}: ${fmtM(c.w)} × ${fmtM(c.h)} m (${fmtArea(areaM2(c))})`);
      for (const m of moveisDo(d, c.id)) L.push(`    · ${m.nome}${m.nome !== TIPOS[m.tipo].rot ? ` (${TIPOS[m.tipo].rot})` : ''}: ${medidas(m)}`);
    }
  }
  L.push('', tx('Feito no Cabeaí · cabeai.howlks.com', 'Made with Cabeaí · cabeai.howlks.com'));
  return L.join('\n');
}
