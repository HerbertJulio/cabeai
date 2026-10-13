// Consultas sobre os dados (sem mudar nada). Resultados caros ficam guardados enquanto os dados não mudam.
import { ordenarAndares, ordenarComodos, paredeDividida, portaVistaDe } from './casa';
import { completoNaCasa, moveisDo } from './dados';
import { semParedeEntre } from './edicao';
import { avaliar, geoEl, normRot } from './geometria';
import { idioma, tx } from './i18n';
import type { Andar, Avaliacao, Cenario, Comodo, ComodoCompleto, Dados, ElParede, Movel, Parede, Vista } from './tipos';

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

/** Vizinhos que dividem parede com o cômodo (o trecho, na parede dele) e se a parede entre os dois foi tirada. */
export interface ParedeVizinha { viz: Comodo; parede: Parede; u1: number; u2: number; tirada: boolean }
export function vizinhosDeParede(d: Dados, id: string): ParedeVizinha[] {
  const c = d.comodos[id]; if (!c) return [];
  const els = Object.values(d.els), out: ParedeVizinha[] = [];
  for (const o of comodosDoAndar(d, c.andar)) {
    if (o.id === c.id) continue;
    const pd = paredeDividida(c, o);
    if (pd && pd.u2 - pd.u1 >= 10) out.push({ viz: o, ...pd, tirada: !!semParedeEntre(c.id, o.id, els) });
  }
  return out;
}

/** O cômodo do outro lado de um item de parede: o vizinho que divide aquela parede no trecho dele (o de maior
 *  trecho, se a porta pegar dois). Sem vizinho ali, null (a parede é de fora). */
export function vizinhoDaPorta(d: Dados, e: Pick<ElParede, 'comodo' | 'parede' | 'inicio' | 'largura'>): Comodo | null {
  const c = d.comodos[e.comodo]; if (!c) return null;
  const g = geoEl(c, e);
  let melhor: Comodo | null = null, mais = 9.5;
  for (const o of comodosDoAndar(d, c.andar)) {
    if (o.id === c.id) continue;
    const pd = paredeDividida(c, o);
    if (!pd || pd.parede !== e.parede) continue;
    const junto = Math.min(g.b, pd.u2) - Math.max(g.a, pd.u1);
    if (junto > mais) { mais = junto; melhor = o; }
  }
  return melhor;
}

/** Os dois lados de uma porta, pelo nome: o cômodo dela ("dentro") e o do outro lado ("fora": o vizinho ou a rua). */
export function ladosDaPorta(d: Dados, e: Pick<ElParede, 'comodo' | 'parede' | 'inicio' | 'largura'>): { dentro: string; fora: string; viz: Comodo | null } {
  const viz = vizinhoDaPorta(d, e);
  return { dentro: d.comodos[e.comodo]?.nome || tx('cômodo', 'room'), fora: viz ? viz.nome : tx('Lado de fora', 'Outside'), viz };
}

/** O botão de virar a porta para o outro lado: "Abrir para Corredor" (ou "Abrir para fora", na parede de fora). */
export function rotuloVirar(d: Dados, e: ElParede, curto = false): string {
  const l = ladosDaPorta(d, e);
  if (e.abre === 'fora') return curto ? tx(`Para ${l.dentro}`, `Into ${l.dentro}`) : tx(`Abrir para ${l.dentro}`, `Open into ${l.dentro}`);
  if (!l.viz) return curto ? tx('Para fora', 'Outward') : tx('Abrir para fora', 'Open outward');
  return curto ? tx(`Para ${l.viz.nome}`, `Into ${l.viz.nome}`) : tx(`Abrir para ${l.viz.nome}`, `Open into ${l.viz.nome}`);
}

/** Para onde a porta abre, pelo nome do cômodo ("Quarto 1", "Corredor", "Lado de fora"). */
export function abrePara(d: Dados, e: ElParede): string {
  const l = ladosDaPorta(d, e);
  return e.abre === 'fora' ? l.fora : l.dentro;
}

/** O item de parede como ele aparece no cômodo "via": uma porta da parede dividida, vista pelo lado do vizinho,
 *  vem medida na parede dele (é a mesma porta; "dono" diz se ela é guardada nesse cômodo mesmo). Nos outros casos,
 *  o próprio item, no cômodo dele. */
export function elVisto(d: Dados, eid: string, via: string | null | undefined): { e: ElParede; q: Comodo; dono: boolean } | null {
  const e = d.els[eid], q = e ? d.comodos[e.comodo] : null;
  if (!e || !q) return null;
  if (!via || via === e.comodo || e.tipo !== 'porta' || e.semParede || !d.comodos[via]) return { e, q, dono: true };
  const v = portaVistaDe(q, d.comodos[via], e);
  if (!v) return { e, q, dono: true };
  const liga = e.liga === via ? q.id : e.liga;
  const visto: ElParede = { ...e, comodo: via, ...v };
  if (liga) visto.liga = liga; else delete visto.liga;
  return { e: visto, q: d.comodos[via], dono: false };
}

/** Os cômodos que formam um espaço só com este (paredes tiradas entre eles, em cadeia), ele incluído. */
export function espacoAberto(d: Dados, id: string): string[] {
  const ids = new Set([id]), fila = [id];
  const abertas = Object.values(d.els).filter((e) => e.semParede && e.liga && d.comodos[e.comodo] && d.comodos[e.liga]);
  while (fila.length) {
    const a = fila.pop()!;
    for (const e of abertas) { const b = e.comodo === a ? e.liga! : e.liga === a ? e.comodo : null; if (b && !ids.has(b)) { ids.add(b); fila.push(b); } }
  }
  return [...ids];
}
