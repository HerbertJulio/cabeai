// Dados: normalização, arquivo (exportar/importar), leitura do formato antigo (versão 1) e o exemplo.
import { LIM_BAU, LIM_CADEIRA, LIM_COMODO, LIM_MOVEL, MAX_CADEIRAS, PAREDES, TIPOS, TIPOS_PAREDE, tipoMovel } from './catalogo';
import { ordenarAndares, portasVizinhas, posicaoNova } from './casa';
import { normRot } from './geometria';
import { tx } from './i18n';
import type { AlinhaBau, Andar, Cenario, Comodo, ComodoCompleto, Dados, ElParede, ItemCenario, LadoCadeiras, Movel, TipoParede } from './tipos';
import { vazio } from './tipos';
import { clamp, num } from './util';

export const CHAVE = 'cabeai:dados';
export const VERSAO = 2;
const ID_OK = /^[A-Za-z0-9_-]{1,80}$/;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const txt = (v: unknown, d: string, max: number) => String(v == null || v === '' ? d : v).slice(0, max);

/* ---------- normalização (tudo o que entra passa por aqui) ---------- */
export function normalizarAndar(id: string, v: Record<string, unknown>): Andar {
  return { id, nome: txt(v.nome, tx('Térreo', 'Ground floor'), 30), ordem: num(v.ordem, 0), criado: num(v.criado, 0) };
}

export function normalizarComodo(id: string, v: Record<string, unknown>, andar: string): Comodo {
  return {
    id, nome: txt(v.nome, tx('Cômodo', 'Room'), 30),
    w: clamp(Math.round(num(v.w, 300)), LIM_COMODO.min, LIM_COMODO.max), h: clamp(Math.round(num(v.h, 300)), LIM_COMODO.min, LIM_COMODO.max),
    andar: typeof v.andar === 'string' && v.andar ? v.andar : andar,
    x: Math.round(num(v.x, 0)), y: Math.round(num(v.y, 0)), criado: num(v.criado, 0)
  };
}

export function normalizarMovel(id: string, v: Record<string, unknown>): Movel {
  const tipo = typeof v.tipo === 'string' && tipoMovel(v.tipo) ? v.tipo : 'outro', t = TIPOS[tipo];
  const ab = t.ab ? (t.ab.includes(v.abertura as never) ? (v.abertura as Movel['abertura']) : t.ab[0]) : 'nenhuma';
  const np = Math.round(num(v.nPortas, 0));
  const lado: LadoCadeiras = v.ladoCadeiras === 'dois' || v.ladoCadeiras === 'volta' ? v.ladoCadeiras : 'frente';
  const larg = clamp(num(v.larg, 100), LIM_MOVEL.min, LIM_MOVEL.max), cama = tipo === 'cama';
  const al = (x: unknown): AlinhaBau => (x === 'esq' || x === 'dir' ? x : 'centro');
  const prof = (x: unknown) => { const n = Math.round(num(x, 0)); return cama && n >= LIM_BAU.min ? Math.min(n, LIM_BAU.max) : 0; };
  const largB = (x: unknown) => clamp(Math.round(num(x, larg)), LIM_MOVEL.min, LIM_MOVEL.max);
  const dx = (x: unknown) => clamp(Math.round(num(x, 0)), -200, 200);
  return {
    id, tipo, nome: txt(v.nome, t.rot, 30),
    larg, prof: clamp(num(v.prof, 50), LIM_MOVEL.min, LIM_MOVEL.max),
    alto: !!v.alto, comodo: String(v.comodo || v.quarto || ''), x: num(v.x, 0), y: num(v.y, 0), rot: normRot(v.rot), criado: num(v.criado, 0),
    fixo: !!v.fixo, abertura: ab, nPortas: np >= 1 ? Math.min(8, np) : 0,
    frente: v.frente == null || v.frente === '' || !Number.isFinite(Number(v.frente)) ? null : clamp(Math.round(Number(v.frente)), 0, 300),
    cadeiras: tipo === 'mesa' ? clamp(Math.round(num(v.cadeiras, 0)), 0, MAX_CADEIRAS) : 0, ladoCadeiras: lado,
    cadLarg: clamp(num(v.cadLarg, 45), LIM_CADEIRA.min, LIM_CADEIRA.max), cadProf: clamp(num(v.cadProf, 50), LIM_CADEIRA.min, LIM_CADEIRA.max),
    bauCab: prof(v.bauCab), bauCabLarg: largB(v.bauCabLarg), bauCabAl: al(v.bauCabAl), bauCabDx: dx(v.bauCabDx),
    bauPe: prof(v.bauPe), bauPeLarg: largB(v.bauPeLarg), bauPeAl: al(v.bauPeAl), bauPeDx: dx(v.bauPeDx)
  };
}

export function normalizarEl(tipo: TipoParede, id: string, v: Record<string, unknown>): ElParede {
  const tp = TIPOS_PAREDE[tipo];
  const e: ElParede = {
    id, tipo, nome: txt(v.nome, tp.rot, 30), comodo: String(v.comodo || v.quarto || ''),
    parede: PAREDES.includes(v.parede as never) ? (v.parede as ElParede['parede']) : tp.parede,
    inicio: Math.max(0, num(v.inicio, 0)), largura: clamp(num(v.largura, tp.larg), tp.min, tp.max), criado: num(v.criado, 0)
  };
  if (tipo === 'porta') { e.dobradica = v.dobradica === 'b' ? 'b' : 'a'; e.abre = v.abre === 'fora' ? 'fora' : 'dentro'; }
  if (tipo === 'janela') { e.abertura = v.abertura === 'abrir' ? 'abrir' : 'correr'; e.folhas = num(v.folhas, 2) === 1 ? 1 : 2; }
  if (tipo === 'ar') e.folga = clamp(num(v.folga, 30), 0, 200);
  if (tipo === 'interruptor') e.ponto = v.ponto === 'tomada' || v.ponto === 'ambos' ? v.ponto : 'interruptor';
  return e;
}

export function normalizarCenario(id: string, v: Record<string, unknown>): Cenario {
  const escopo = v.escopo === 'casa' || v.escopo === 'todos' ? 'casa' : 'comodo';
  const qc = String(v.comodo || v.quarto || ''), itens: Record<string, ItemCenario> = {};
  if (obj(v.itens)) for (const [k, p] of Object.entries(v.itens)) {
    if (!obj(p) || !ID_OK.test(k)) continue;
    const qq = escopo === 'casa' ? String(p.comodo || p.quarto || qc || '') : qc;
    if (qq) itens[k] = { comodo: qq, x: num(p.x, 0), y: num(p.y, 0), rot: normRot(p.rot) };
  }
  return {
    id, nome: txt(v.nome, tx('Cenário', 'Scenario'), 48), escopo, comodo: escopo === 'casa' ? null : qc, criado: num(v.criado, 0), itens,
    sugestao: !!(v.sugestao || v.ia), origem: v.origem === 'ia' || v.ia ? 'ia' : 'auto',
    explicacao: typeof v.explicacao === 'string' ? v.explicacao.slice(0, 1200) : ''
  };
}

const COLS_EL: Record<string, TipoParede> = { portas: 'porta', janelas: 'janela', ares: 'ar', interruptores: 'interruptor' };

/** Confere tudo o que veio de fora (arquivo ou navegador) e amarra as referências. */
export function normalizarDados(bruto: unknown): Dados {
  const d = vazio();
  if (!obj(bruto)) return d;
  const pega = (k: string) => (obj(bruto[k]) ? (bruto[k] as Record<string, unknown>) : {});
  for (const [id, v] of Object.entries(pega('andares'))) if (ID_OK.test(id) && obj(v)) d.andares[id] = normalizarAndar(id, v);
  const primeiro = () => {
    const as = ordenarAndares(Object.values(d.andares));
    if (as.length) return as[0].id;
    d.andares.terreo = { id: 'terreo', nome: tx('Térreo', 'Ground floor'), ordem: 0, criado: 1 };
    return 'terreo';
  };
  for (const [id, v] of Object.entries(pega('comodos'))) {
    if (!ID_OK.test(id) || !obj(v)) continue;
    const c = normalizarComodo(id, v, '');
    if (!c.andar || !d.andares[c.andar]) c.andar = primeiro();
    d.comodos[id] = c;
  }
  for (const [id, v] of Object.entries(pega('moveis'))) {
    if (!ID_OK.test(id) || !obj(v)) continue;
    const m = normalizarMovel(id, v);
    if (d.comodos[m.comodo]) d.moveis[id] = m;
  }
  for (const [id, v] of Object.entries(pega('els'))) {
    if (!ID_OK.test(id) || !obj(v) || typeof v.tipo !== 'string' || !(v.tipo in TIPOS_PAREDE)) continue;
    const e = normalizarEl(v.tipo as TipoParede, id, v);
    if (d.comodos[e.comodo]) d.els[id] = e;
  }
  for (const [id, v] of Object.entries(pega('cenarios'))) {
    if (!ID_OK.test(id) || !obj(v)) continue;
    const c = normalizarCenario(id, v);
    if (c.escopo === 'comodo' && !d.comodos[c.comodo || '']) continue;
    for (const k of Object.keys(c.itens)) if (!d.moveis[k] || !d.comodos[c.itens[k].comodo]) delete c.itens[k];
    d.cenarios[id] = c;
  }
  return d;
}

/* ---------- formato antigo (versão 1, só quartos): quartos lado a lado no térreo ---------- */
const quartosV1 = (): Record<string, Record<string, unknown>> => ({
  q1: { nome: tx('Quarto 1', 'Bedroom 1'), w: 300, h: 300, criado: 1 },
  q2: { nome: tx('Quarto 2', 'Bedroom 2'), w: 300, h: 400, criado: 2 }
});

export function migrarV1(docs: Record<string, unknown>): Dados {
  const quartos: Record<string, Record<string, unknown>> = {}, moveis: Record<string, unknown> = {}, els: Record<string, unknown> = {}, cenarios: Record<string, unknown> = {};
  const usados = new Set<string>();
  for (const [p, v] of Object.entries(docs)) {
    const [col, id, resto] = String(p).split('/');
    if (resto !== undefined || !id || !ID_OK.test(id) || !obj(v)) continue;
    if (col === 'quartos') quartos[id] = v;
    else if (col === 'moveis') { moveis[id] = { ...v, comodo: v.quarto }; usados.add(String(v.quarto || '')); }
    else if (col === 'cenarios') cenarios[id] = v;
    else if (COLS_EL[col]) { els[id] = { ...v, tipo: COLS_EL[col], comodo: v.quarto }; usados.add(String(v.quarto || '')); }
  }
  const v1 = quartosV1();
  for (const q of usados) if (q && !quartos[q] && v1[q]) quartos[q] = v1[q];
  const comodos: Record<string, unknown> = {}, postos: Comodo[] = [];
  const ordem = Object.entries(quartos).sort((a, b) => num(a[1].criado, 0) - num(b[1].criado, 0));
  for (const [id, v] of ordem) {
    const c = normalizarComodo(id, v, 'terreo');
    const p = posicaoNova(postos, c.w, c.h);
    c.x = p.x; c.y = p.y; c.andar = 'terreo';
    postos.push(c);
    comodos[id] = c;
  }
  return normalizarDados({ andares: { terreo: { nome: tx('Térreo', 'Ground floor'), ordem: 0, criado: 1 } }, comodos, moveis, els, cenarios });
}

/* ---------- arquivo ---------- */
export function paraArquivo(d: Dados): string {
  return JSON.stringify({ app: 'cabeai', versao: VERSAO, exportado: new Date().toISOString(), dados: d }, null, 1);
}

export interface Contagem { andares: number; comodos: number; itens: number; cenarios: number }
export const contar = (d: Dados): Contagem => ({
  andares: Object.keys(d.andares).length, comodos: Object.keys(d.comodos).length,
  itens: Object.keys(d.moveis).length + Object.keys(d.els).length, cenarios: Object.keys(d.cenarios).length
});

/** Lê um arquivo do Cabeaí (o atual ou o da versão 1). */
export function lerArquivo(texto: string): { dados: Dados; cont: Contagem } | { erro: string } {
  let o: unknown;
  try { o = JSON.parse(texto); } catch { return { erro: tx('Esse arquivo não é do Cabeaí (JSON inválido).', 'This file isn’t from Cabeaí (invalid JSON).') }; }
  if (!obj(o)) return { erro: tx('Esse arquivo não é do Cabeaí.', 'This file isn’t from Cabeaí.') };
  let dados: Dados;
  if (o.app === 'cabeai' && obj(o.dados)) dados = normalizarDados(o.dados);
  else if (o.versao === 1 && obj(o.docs)) dados = migrarV1(o.docs);
  else return { erro: tx('Esse arquivo não é do Cabeaí.', 'This file isn’t from Cabeaí.') };
  const cont = contar(dados);
  if (!cont.comodos) return { erro: tx('O arquivo não tem nenhum cômodo.', 'The file doesn’t have any rooms.') };
  return { dados, cont };
}

/** O que estava salvo neste navegador. */
export function lerSalvo(bruto: string | null): Dados | null {
  try {
    if (bruto) { const o = JSON.parse(bruto); if (obj(o) && obj(o.dados)) return normalizarDados(o.dados); }
  } catch { /* nada salvo */ }
  return null;
}

export const paraSalvar = (d: Dados): string => JSON.stringify({ app: 'cabeai', versao: VERSAO, dados: d });

/* ---------- consultas ---------- */
const porCriado = <T extends { criado: number }>(a: T, b: T) => (a.criado || 0) - (b.criado || 0);

export function completo(d: Dados, id: string | null | undefined): ComodoCompleto | null {
  const c = id ? d.comodos[id] : null;
  if (!c) return null;
  const els = Object.values(d.els).filter((e) => e.comodo === id).sort(porCriado);
  return {
    ...c, els, portas: els.filter((e) => e.tipo === 'porta'), janelas: els.filter((e) => e.tipo === 'janela'),
    ares: els.filter((e) => e.tipo === 'ar'), interruptores: els.filter((e) => e.tipo === 'interruptor')
  };
}

/** O cômodo com as portas dos vizinhos que ficam nas paredes divididas. */
export function completoNaCasa(d: Dados, id: string | null | undefined): ComodoCompleto | null {
  const q = completo(d, id);
  if (!q) return null;
  const viz = portasVizinhas(q, Object.values(d.comodos), Object.values(d.els));
  if (!viz.length) return q;
  return { ...q, els: q.els.concat(viz), portas: q.portas.concat(viz) };
}

export const moveisDo = (d: Dados, id: string): Movel[] => Object.values(d.moveis).filter((m) => m.comodo === id).sort(porCriado);

/* ---------- exemplo: uma casa de dois andares ---------- */
export function exemplo(): Dados {
  const c = 1;
  return normalizarDados({
    andares: { terreo: { nome: tx('Térreo', 'Ground floor'), ordem: 0, criado: c }, a1: { nome: tx('1º andar', '1st floor'), ordem: 1, criado: c + 1 } },
    comodos: {
      sala: { nome: tx('Sala', 'Living room'), w: 420, h: 380, andar: 'terreo', x: 0, y: 0, criado: 1 },
      cozinha: { nome: tx('Cozinha', 'Kitchen'), w: 280, h: 380, andar: 'terreo', x: 435, y: 0, criado: 2 },
      q1: { nome: tx('Quarto 1', 'Bedroom 1'), w: 300, h: 300, andar: 'a1', x: 0, y: 0, criado: 3 },
      q2: { nome: tx('Quarto 2', 'Bedroom 2'), w: 300, h: 400, andar: 'a1', x: 315, y: 0, criado: 4 }
    },
    els: {
      'p-entrada': { tipo: 'porta', nome: tx('Entrada', 'Entrance'), comodo: 'sala', parede: 'baixo', inicio: 40, largura: 90, dobradica: 'a', abre: 'dentro', criado: 1 },
      'p-coz': { tipo: 'porta', nome: tx('Porta', 'Door'), comodo: 'cozinha', parede: 'esquerda', inicio: 280, largura: 80, dobradica: 'b', abre: 'dentro', criado: 2 },
      'j-sala': { tipo: 'janela', nome: tx('Janela 1', 'Window 1'), comodo: 'sala', parede: 'cima', inicio: 120, largura: 180, abertura: 'correr', folhas: 2, criado: 3 },
      'j-coz': { tipo: 'janela', nome: tx('Janela 1', 'Window 1'), comodo: 'cozinha', parede: 'cima', inicio: 60, largura: 120, abertura: 'correr', folhas: 2, criado: 4 },
      'p-q1': { tipo: 'porta', nome: tx('Porta', 'Door'), comodo: 'q1', parede: 'baixo', inicio: 200, largura: 80, dobradica: 'b', abre: 'dentro', criado: 5 },
      'j-q1': { tipo: 'janela', nome: tx('Janela 1', 'Window 1'), comodo: 'q1', parede: 'cima', inicio: 90, largura: 120, abertura: 'correr', folhas: 2, criado: 6 },
      'p-q2': { tipo: 'porta', nome: tx('Porta', 'Door'), comodo: 'q2', parede: 'baixo', inicio: 20, largura: 80, dobradica: 'a', abre: 'dentro', criado: 7 },
      'i-q2': { tipo: 'interruptor', nome: tx('Interruptor', 'Switch'), comodo: 'q2', parede: 'baixo', inicio: 110, largura: 10, criado: 8 },
      'ar-q2': { tipo: 'ar', nome: tx('Ar-condicionado', 'Air conditioner'), comodo: 'q2', parede: 'direita', inicio: 150, largura: 85, folga: 30, criado: 9 }
    },
    moveis: {
      'm-sofa': { tipo: 'sofa', nome: tx('Sofá', 'Sofa'), larg: 210, prof: 90, comodo: 'sala', x: 0, y: 60, rot: 270, criado: 10 },
      'm-rack': { tipo: 'rack', nome: tx('Rack', 'TV stand'), larg: 180, prof: 45, comodo: 'sala', x: 375, y: 100, rot: 90, criado: 11 },
      'm-mesa': { tipo: 'mesa', nome: tx('Mesa de jantar', 'Dining table'), larg: 120, prof: 80, comodo: 'sala', x: 150, y: 230, rot: 0, criado: 12, cadeiras: 4, ladoCadeiras: 'dois', cadLarg: 45, cadProf: 45 },
      'm-pia': { tipo: 'pia', nome: tx('Pia', 'Sink'), larg: 150, prof: 55, comodo: 'cozinha', x: 0, y: 0, rot: 0, criado: 13 },
      'm-fogao': { tipo: 'fogao', nome: tx('Fogão', 'Stove'), larg: 76, prof: 60, comodo: 'cozinha', x: 150, y: 0, rot: 0, criado: 14 },
      'm-gel': { tipo: 'geladeira', nome: tx('Geladeira', 'Fridge'), larg: 70, prof: 75, alto: true, comodo: 'cozinha', x: 205, y: 160, rot: 90, criado: 15, abertura: 'abrir', nPortas: 1 },
      'm-cama2': { tipo: 'cama', nome: tx('Cama de solteiro', 'Single bed'), larg: 90, prof: 190, comodo: 'q1', x: 0, y: 0, rot: 270, criado: 16 },
      'm-gr1': { tipo: 'guarda-roupa', nome: tx('Guarda-roupa', 'Wardrobe'), larg: 120, prof: 55, alto: true, comodo: 'q1', x: 245, y: 95, rot: 90, criado: 17, abertura: 'correr' },
      'm-cama': { tipo: 'cama', nome: tx('Cama', 'Bed'), larg: 162, prof: 202, comodo: 'q2', x: 138, y: 0, rot: 0, criado: 18 },
      'm-gr2': { tipo: 'guarda-roupa', nome: tx('Guarda-roupa', 'Wardrobe'), larg: 188, prof: 55, alto: true, comodo: 'q2', x: 0, y: 0, rot: 270, criado: 19, abertura: 'abrir' },
      'm-berco': { tipo: 'berco', nome: tx('Berço', 'Crib'), larg: 70, prof: 130, comodo: 'q2', x: 230, y: 220, rot: 0, criado: 20 },
      'm-mesa2': { tipo: 'mesa', nome: tx('Escrivaninha', 'Desk'), larg: 100, prof: 50, comodo: 'q2', x: 0, y: 210, rot: 270, criado: 21, cadeiras: 1, ladoCadeiras: 'frente', cadLarg: 45, cadProf: 50 }
    },
    cenarios: {}
  });
}
