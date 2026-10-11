// Consultas sobre os dados (sem mudar nada). Resultados caros ficam guardados enquanto os dados não mudam.
import { ordenarAndares, ordenarComodos } from './casa';
import { completoNaCasa, moveisDo } from './dados';
import { avaliar, normRot } from './geometria';
import { idioma, tx } from './i18n';
import type { Andar, Avaliacao, Cenario, Comodo, ComodoCompleto, Dados, ElParede, Movel, Vista } from './tipos';

export const andaresOrdem = (d: Dados): Andar[] => ordenarAndares(Object.values(d.andares));

/** Cômodos na ordem dos andares e, dentro de cada andar, na ordem em que foram criados. */
export function comodosOrdem(d: Dados): Comodo[] {
  const ordem = new Map(andaresOrdem(d).map((a, i) => [a.id, i]));
  return ordenarComodos(Object.values(d.comodos)).sort((a, b) => (ordem.get(a.andar) ?? 99) - (ordem.get(b.andar) ?? 99));
}
export const comodosDoAndar = (d: Dados, andar: string): Comodo[] => ordenarComodos(Object.values(d.comodos).filter((c) => c.andar === andar));

const cacheQ = new WeakMap<Dados, Map<string, ComodoCompleto | null>>();
export function cq(d: Dados, id: string | null | undefined): ComodoCompleto | null {
  if (!id) return null;
  let m = cacheQ.get(d);
  if (!m) { m = new Map(); cacheQ.set(d, m); }
  if (!m.has(id)) m.set(id, completoNaCasa(d, id));
  return m.get(id) || null;
}

export const cenariosLista = (d: Dados): Cenario[] => Object.values(d.cenarios).sort((a, b) => (a.criado || 0) - (b.criado || 0));
export const cobre = (c: Cenario, comodo: string | null): boolean => c.escopo === 'casa' || c.comodo === comodo;
export const comodosDoCenario = (d: Dados, c: Cenario): string[] =>
  c.escopo === 'casa' ? comodosOrdem(d).map((q) => q.id) : d.comodos[c.comodo || ''] ? [c.comodo as string] : [];

/** Os móveis de um cômodo como estão no cenário. */
export function listaDoCenario(d: Dados, c: Cenario, comodo: string): Movel[] {
  const out: Movel[] = [];
  for (const [id, p] of Object.entries(c.itens || {})) {
    if (p.comodo !== comodo) continue;
    const m = d.moveis[id];
    if (m) out.push({ ...m, comodo, x: p.x, y: p.y, rot: normRot(p.rot) });
  }
  return out.sort((a, b) => (a.criado || 0) - (b.criado || 0));
}

const cacheL = new WeakMap<Dados, Map<string, Movel[]>>();
/** Móveis de um cômodo: os de agora, ou os do cenário que está sendo comparado. */
export function listaAtiva(d: Dados, verCen: string | null, comodo: string): Movel[] {
  let m = cacheL.get(d);
  if (!m) { m = new Map(); cacheL.set(d, m); }
  const k = (verCen || '') + '|' + comodo;
  let v = m.get(k);
  if (!v) {
    const c = verCen ? d.cenarios[verCen] : null;
    v = c && cobre(c, comodo) ? listaDoCenario(d, c, comodo) : moveisDo(d, comodo);
    m.set(k, v);
  }
  return v;
}

const cacheA = new WeakMap<Dados, Map<string, Avaliacao>>();
export function avaliacao(d: Dados, verCen: string | null, comodo: string): Avaliacao | null {
  const q = cq(d, comodo);
  if (!q) return null;
  let m = cacheA.get(d);
  if (!m) { m = new Map(); cacheA.set(d, m); }
  const k = idioma() + '|' + (verCen || '') + '|' + comodo;
  let v = m.get(k);
  if (!v) { v = avaliar(q, listaAtiva(d, verCen, comodo)); m.set(k, v); }
  return v;
}
export const problemasDe = (d: Dados, verCen: string | null, ids: string[]): number => ids.reduce((n, id) => n + (avaliacao(d, verCen, id)?.itens.length || 0), 0);

export function idsVisiveis(d: Dados, vista: Vista, comodo: string | null): string[] {
  if (vista === 'um') return comodo && d.comodos[comodo] ? [comodo] : [];
  return comodosOrdem(d).map((c) => c.id);
}

export function cenariosVisiveis(d: Dados, vista: Vista, comodo: string | null): Cenario[] {
  return cenariosLista(d).filter((c) => (c.escopo === 'casa' || d.comodos[c.comodo || '']) && (vista !== 'um' || cobre(c, comodo)));
}

export type Alvo = { tipo: 'movel'; obj: Movel } | { tipo: 'parede'; obj: ElParede } | null;
export function alvoSel(d: Dados, sel: string | null, selEl: string | null): Alvo {
  if (sel) { const m = d.moveis[sel]; if (m && d.comodos[m.comodo]) return { tipo: 'movel', obj: m }; }
  if (selEl) { const e = d.els[selEl]; if (e && d.comodos[e.comodo]) return { tipo: 'parede', obj: e }; }
  return null;
}

export const nomeComodo = (d: Dados, id: string | null | undefined): string => (id && d.comodos[id] ? d.comodos[id].nome : tx('cômodo', 'room'));
