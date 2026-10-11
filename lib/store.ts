// Estado do app (Zustand + Immer): os dados da casa e o estado da tela.
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PONTO_BASE, T, TIPOS, TIPOS_PAREDE, ehParede, nomePadraoPonto, pontoDe, tipoMovel } from './catalogo';
import { nomeAndarNovo, planoCorredor, posicaoAoLado, posicaoNova, type Alinhar, type Lado4 } from './casa';
import { alvoSel, andaresOrdem, cenariosLista, comodosDoAndar, comodosOrdem, cq, idsVisiveis } from './consultas';
import { exemplo, moveisDo } from './dados';
import { centrar, geoEl, lugarLivre, normRot, posNoPonto, posValida, prender } from './geometria';
import { sugerirCasa, sugerirComodo, type Opcao } from './motor';
import type { Andar, Cenario, Comodo, Dados, ElParede, Escopo, Modo, Movel, Parede, Ponto, TipoMovel, TipoParede, Vista } from './tipos';
import { vazio } from './tipos';
import { definirIdioma, idioma, tx, type Idioma } from './i18n';
import { novoId, pl } from './util';

export interface CtxAdd { comodo?: string; x?: number; y?: number; parede?: Parede; u?: number }
export interface Dialogo { tipo: string; dados: Record<string, unknown> }
export interface InfoMenu { x: number; y: number; tipo: string; id?: string; eid?: string; comodo?: string; andar?: string; cen?: string; px?: number; py?: number; parede?: Parede; u?: number; btn?: string; teclado?: boolean }

export interface Estado {
  dados: Dados;
  carregado: boolean;
  persistente: boolean;
  erroDb: string;
  comodo: string | null;
  sel: string | null;
  selEl: string | null;
  selComodo: string | null;
  vista: Vista;
  modo: Modo;
  lateral: boolean;
  inspetor: boolean;
  latAberta: boolean;
  setasTodos: boolean;
  imaOn: boolean;
  cam: { z: number; cx: number | null; cy: number | null };
  camBase: { cx: number; cy: number };
  verCen: string | null;
  /** Cenário de onde veio a arrumação atual (usado, salvo ou atualizado por último). */
  cenBase: string | null;
  /** Idioma da interface. */
  idioma: Idioma;
  folha: boolean;
  folhaModo: 'acoes' | 'editar';
  dlg: Dialogo | null;
  avisosAbertos: boolean;
  add: { tipo: string; ctx: CtxAdd | null; rascunho: Record<string, string | boolean> };
  sug: { busy: boolean; msg: string };
  ia: { busy: boolean; msg: string };
  iaCtl: AbortController | null;
  menu: InfoMenu | null;
  toast: { msg: string; tipo: '' | 'erro'; n: number } | null;
  arrastando: boolean;
  /** Tela estreita (celular): painéis viram gaveta e folha. */
  estreito: boolean;
}

export const estreito = (): boolean => {
  try { return matchMedia('(max-width: 899px)').matches; } catch { return false; }
};

const inicial = (): Estado => ({
  dados: vazio(), carregado: false, persistente: true, erroDb: '',
  comodo: null, sel: null, selEl: null, selComodo: null,
  vista: 'casa', modo: 'simples', lateral: true, inspetor: true, latAberta: false, setasTodos: false, imaOn: true,
  cam: { z: 1, cx: null, cy: null }, camBase: { cx: 0, cy: 0 },
  verCen: null, cenBase: null, idioma: 'pt', folha: false, folhaModo: 'acoes', dlg: null, avisosAbertos: false,
  add: { tipo: 'guarda-roupa', ctx: null, rascunho: {} },
  sug: { busy: false, msg: '' }, ia: { busy: false, msg: '' }, iaCtl: null,
  menu: null, toast: null, arrastando: false, estreito: false
});

export const useApp = create<Estado>()(immer(() => inicial()));
const set = useApp.setState as (f: (s: Estado) => void) => void;
const get = useApp.getState;

/* ---------- avisos rápidos ---------- */
export function toast(msg: string, tipo: '' | 'erro' = '') { set((s) => { s.toast = { msg, tipo, n: Date.now() }; }); }

/* ---------- seleção e foco ---------- */
export function garantirComodo() {
  const s = get();
  if (s.comodo && s.dados.comodos[s.comodo]) return;
  const ids = comodosOrdem(s.dados);
  set((e) => { e.comodo = ids.length ? ids[0].id : null; });
}

export function limparSel() { set((s) => { s.sel = null; s.selEl = null; s.selComodo = null; s.folha = false; s.folhaModo = 'acoes'; }); }

/** Seleciona um móvel ({id}) ou item de parede ({eid}); o cômodo em foco passa a ser o dele. */
export function selecionar(alvo: { id?: string; eid?: string }, o: { abrir?: boolean; painel?: boolean } = {}) {
  set((s) => {
    const mudou = alvo.id ? s.sel !== alvo.id : s.selEl !== alvo.eid;
    if (alvo.id) { const m = s.dados.moveis[alvo.id]; if (!m) return; s.sel = alvo.id; s.selEl = null; s.comodo = m.comodo; }
    else if (alvo.eid) { const e = s.dados.els[alvo.eid]; if (!e) return; s.selEl = alvo.eid; s.sel = null; s.comodo = e.comodo; }
    s.selComodo = null;
    s.verCen = null;
    if (mudou) s.folhaModo = 'acoes';
    if (s.modo === 'avancado') { s.folha = false; if (o.painel !== false && !estreito()) s.inspetor = true; }
    else s.folha = !!o.abrir;
  });
}

/** Seleciona o cômodo inteiro (na planta da casa): dá para mover, editar e ver as distâncias. */
export function selecionarComodo(id: string, abrir = false) {
  set((s) => {
    if (!s.dados.comodos[id]) return;
    s.selComodo = id; s.comodo = id; s.sel = null; s.selEl = null; s.folhaModo = 'acoes';
    s.folha = s.modo === 'simples' && abrir;
    if (s.modo === 'avancado' && !estreito()) s.inspetor = true;
  });
}

/** Muda o cômodo em foco; com "mostrar", passa para a vista de um cômodo. */
export function focarComodo(id: string, mostrar = false) {
  const s0 = get();
  if (!s0.dados.comodos[id]) return;
  const mudou = s0.comodo !== id;
  set((s) => {
    s.comodo = id;
    if (mudou) {
      s.sel = null; s.selEl = null; s.selComodo = null; s.folha = false; s.folhaModo = 'acoes';
      const c = s.verCen ? s.dados.cenarios[s.verCen] : null;
      if (c && c.escopo === 'comodo' && c.comodo !== id && (s.vista === 'um' || mostrar)) s.verCen = null;
    }
    if (mostrar) s.vista = 'um';
    s.latAberta = false;
  });
  if ((mudou && get().vista === 'um') || mostrar) enquadrar();
}

export function mudarVista(v: Vista) {
  set((s) => {
    s.vista = v; s.selComodo = v === 'casa' ? s.selComodo : null;
    const c = s.verCen ? s.dados.cenarios[s.verCen] : null;
    if (v === 'um' && c && c.escopo === 'comodo' && c.comodo !== s.comodo) s.verCen = null;
  });
  enquadrar();
}

export function mudarModo(m: Modo) { set((s) => { s.modo = m; s.folha = false; s.folhaModo = 'acoes'; }); }

/* ---------- câmera ---------- */
export function enquadrar() { set((s) => { s.cam = { z: 1, cx: null, cy: null }; }); }
export function zoomEm(fator: number, px?: number, py?: number) {
  set((s) => {
    const z0 = s.cam.z, z = Math.min(Math.max(z0 * fator, 0.3), 8);
    if (z === z0) return;
    const cx = s.cam.cx == null ? s.camBase.cx : s.cam.cx, cy = s.cam.cy == null ? s.camBase.cy : s.cam.cy;
    if (px == null || py == null) s.cam = { z, cx, cy };
    else s.cam = { z, cx: px + (cx - px) * (z0 / z), cy: py + (cy - py) * (z0 / z) };
  });
}

/* ---------- diálogos e menus ---------- */
export function abrirDialogo(tipo: string, dados: Record<string, unknown> = {}) { set((s) => { s.menu = null; s.dlg = { tipo, dados }; }); }
export function fecharDialogo() { if (get().sug.busy) return; set((s) => { s.dlg = null; }); }
export function abrirMenu(info: InfoMenu) { set((s) => { s.menu = info; }); }
export function fecharMenu() { if (get().menu) set((s) => { s.menu = null; }); }

/* ---------- nomes ---------- */
export function nomeComodoNovo(d: Dados): string {
  const nomes = new Set(Object.values(d.comodos).map((q) => q.nome));
  const palavra = tx('Cômodo', 'Room');
  let k = Object.keys(d.comodos).length + 1;
  while (nomes.has(palavra + ' ' + k)) k++;
  return palavra + ' ' + k;
}
export function nomeUnicoCenario(d: Dados, base?: string): string {
  const nomes = new Set(cenariosLista(d).map((c) => c.nome));
  if (base) { if (!nomes.has(base)) return base; let k = 2; while (nomes.has(base + ' ' + k)) k++; return base + ' ' + k; }
  const palavra = tx('Cenário', 'Scenario'), re = new RegExp('^' + palavra + ' (\\d+)$');
  const nums = cenariosLista(d).map((c) => Number((re.exec(c.nome) || [])[1]) || 0);
  return palavra + ' ' + (Math.max(0, ...nums) + 1);
}
export function nomeLivre(lista: { nome: string }[], nome: string): string {
  const usados = new Set(lista.map((m) => m.nome));
  if (!usados.has(nome)) return nome;
  const base = nome.replace(/\s+\d+$/, '');
  let k = 2;
  while (usados.has(base + ' ' + k)) k++;
  return (base + ' ' + k).slice(0, 30);
}
export function proximoNomeEl(d: Dados, comodo: string, tipo: TipoParede, ponto?: Ponto): string {
  const p = ponto || 'interruptor';
  const base = tipo === 'interruptor' ? PONTO_BASE[p] : TIPOS_PAREDE[tipo].rot;
  const arr = Object.values(d.els).filter((e) => e.comodo === comodo && e.tipo === tipo && (tipo !== 'interruptor' || pontoDe(e) === p));
  if (!arr.length) return tipo === 'janela' ? base + ' 1' : base;
  const nums = arr.map((e) => Number((/(\d+)\s*$/.exec(e.nome) || [])[1]) || 1);
  return base + ' ' + (Math.max(...nums) + 1);
}

/* ---------- andares ---------- */
export function criarAndar(nome?: string): string {
  const id = novoId('a');
  set((s) => {
    const as = Object.values(s.dados.andares);
    s.dados.andares[id] = { id, nome: (nome || nomeAndarNovo(as)).slice(0, 30), ordem: as.reduce((m, a) => Math.max(m, a.ordem), -1) + 1, criado: Date.now() };
  });
  return id;
}
export function salvarAndar(id: string, campos: Partial<Andar>) { set((s) => { const a = s.dados.andares[id]; if (a) Object.assign(a, campos); }); }
export function removerAndar(id: string) {
  for (const c of comodosDoAndar(get().dados, id)) removerComodo(c.id);
  set((s) => {
    delete s.dados.andares[id];
    if (!Object.keys(s.dados.andares).length && Object.keys(s.dados.comodos).length) s.dados.andares.terreo = { id: 'terreo', nome: tx('Térreo', 'Ground floor'), ordem: 0, criado: Date.now() };
  });
}
function andarPadrao(): string {
  const s = get();
  const atual = s.comodo ? s.dados.comodos[s.comodo]?.andar : null;
  if (atual && s.dados.andares[atual]) return atual;
  const as = andaresOrdem(s.dados);
  return as.length ? as[0].id : criarAndar(tx('Térreo', 'Ground floor'));
}

/* ---------- cômodos ---------- */
/** Onde pôr um cômodo: encostado num lado de outro, com alinhamento e espaço opcional entre as paredes. */
export interface Junto { ref: string; lado: Lado4; alinhar: Alinhar; espaco?: number }

export function criarComodo(v: { nome: string; w: number; h: number; andar?: string; junto?: Junto | null }): string {
  const ref0 = v.junto ? get().dados.comodos[v.junto.ref] : null;
  const andar = ref0 ? ref0.andar : v.andar && get().dados.andares[v.andar] ? v.andar : andarPadrao();
  const id = novoId('c');
  set((s) => {
    const ref = v.junto ? s.dados.comodos[v.junto.ref] : null;
    const p = ref && v.junto ? posicaoAoLado({ w: v.w, h: v.h }, ref, v.junto.lado, v.junto.alinhar, v.junto.espaco || 0) : posicaoNova(comodosDoAndar(s.dados, andar), v.w, v.h);
    s.dados.comodos[id] = { id, nome: v.nome.slice(0, 30), w: v.w, h: v.h, andar, x: p.x, y: p.y, criado: Date.now() };
    s.comodo = id; s.sel = null; s.selEl = null; s.selComodo = null; s.verCen = null; s.latAberta = false; s.folha = false;
  });
  return id;
}

/** Leva um cômodo para o lado de outro (no andar dele). */
export function posicionarComodo(id: string, j: Junto) {
  set((s) => {
    const c = s.dados.comodos[id], ref = s.dados.comodos[j.ref];
    if (!c || !ref || c.id === ref.id) return;
    c.andar = ref.andar;
    const p = posicaoAoLado(c, ref, j.lado, j.alinhar, j.espaco || 0);
    c.x = p.x; c.y = p.y;
  });
}

export function nomeCorredorNovo(d: Dados): string {
  const base = tx('Corredor', 'Hallway'), nomes = new Set(Object.values(d.comodos).map((c) => c.nome));
  if (!nomes.has(base)) return base;
  let k = 2;
  while (nomes.has(`${base} ${k}`)) k++;
  return `${base} ${k}`;
}

const OPOSTA: Record<Parede, Parede> = { cima: 'baixo', baixo: 'cima', esquerda: 'direita', direita: 'esquerda' };
/** Parede do corredor que encosta no cômodo de onde ele sai. */
const PAREDE_DE_SAIDA: Record<Lado4, Parede> = { direita: 'esquerda', esquerda: 'direita', abaixo: 'cima', acima: 'baixo' };

/** Cria um corredor saindo de "a" (e chegando em "b", se houver), com portas nas pontas. */
export function criarCorredor(o: { nome: string; a: string; b: string | null; lado: Lado4; comprimento: number | null; largura: number; alinhar: Alinhar; portas: boolean }): { id: string } | { erro: string } {
  const d = get().dados, A = d.comodos[o.a], B = o.b ? d.comodos[o.b] : null;
  if (!A) return { erro: tx('Escolha de qual cômodo o corredor sai.', 'Choose the room the hallway starts from.') };
  if (B && (B.id === A.id || B.andar !== A.andar)) return { erro: tx('O corredor liga dois cômodos diferentes do mesmo andar.', 'A hallway connects two different rooms on the same floor.') };
  const plano = planoCorredor(A, o.lado, o.largura, o.alinhar, B, o.comprimento);
  if ('erro' in plano) {
    return { erro: plano.erro === 'sem-vao' && B
      ? tx(`Não há espaço entre ${A.nome} e ${B.nome} desse lado. Escreva o comprimento do corredor que eu levo ${B.nome} para a outra ponta.`, `There is no gap between ${A.nome} and ${B.nome} on that side. Type the hallway length and I will move ${B.nome} to the other end.`)
      : tx('Escreva o comprimento do corredor.', 'Type the hallway length.') };
  }
  const id = novoId('c');
  set((s) => {
    const c = plano.corredor;
    s.dados.comodos[id] = { id, nome: (o.nome || nomeCorredorNovo(s.dados)).slice(0, 30), w: c.w, h: c.h, andar: A.andar, x: c.x, y: c.y, criado: Date.now(), corredor: true };
    if (B && plano.b) { const bb = s.dados.comodos[B.id]; bb.x = plano.b.x; bb.y = plano.b.y; }
    if (o.portas) {
      const larg = Math.max(40, Math.min(80, o.largura - 10)), inicio = Math.round((o.largura - larg) / 2), pa = PAREDE_DE_SAIDA[o.lado];
      const porta = (parede: Parede, k: number) => {
        const eid = novoId('e');
        s.dados.els[eid] = { id: eid, tipo: 'porta', nome: k === 1 ? tx('Porta', 'Door') : tx(`Porta ${k}`, `Door ${k}`), comodo: id, parede, inicio, largura: larg, criado: Date.now() + k, dobradica: 'a', abre: 'fora' };
      };
      porta(pa, 1);
      if (B) porta(OPOSTA[pa], 2);
    }
    s.comodo = id; s.sel = null; s.selEl = null; s.selComodo = id; s.verCen = null; s.latAberta = false; s.folha = false;
  });
  return { id };
}

/** Muda nome, medidas, posição ou andar; o que ficou fora do cômodo volta para dentro. */
export function salvarComodo(id: string, campos: Partial<Comodo>) {
  set((s) => {
    const c = s.dados.comodos[id]; if (!c) return;
    if (campos.andar && campos.andar !== c.andar && s.dados.andares[campos.andar] && campos.x == null) {
      const p = posicaoNova(comodosDoAndar(s.dados, campos.andar), campos.w ?? c.w, campos.h ?? c.h);
      campos = { ...campos, x: p.x, y: p.y };
    }
    Object.assign(c, campos);
    for (const m of Object.values(s.dados.moveis)) if (m.comodo === id) { const p = prender(c, m, m.x, m.y); m.x = p.x; m.y = p.y; }
    for (const e of Object.values(s.dados.els)) if (e.comodo === id) { const g = geoEl(c, e); if (e.largura > g.L) e.largura = g.L; e.inicio = Math.round(g.a); }
  });
}
export function moverComodo(id: string, x: number, y: number) { set((s) => { const c = s.dados.comodos[id]; if (c) { c.x = Math.round(x); c.y = Math.round(y); } }); }

export function removerComodo(id: string) {
  set((s) => {
    const d = s.dados;
    for (const m of Object.values(d.moveis)) if (m.comodo === id) delete d.moveis[m.id];
    for (const e of Object.values(d.els)) if (e.comodo === id) delete d.els[e.id];
    for (const c of Object.values(d.cenarios)) {
      if (c.escopo === 'comodo') { if (c.comodo === id) delete d.cenarios[c.id]; continue; }
      for (const [k, p] of Object.entries(c.itens)) if (p.comodo === id) delete c.itens[k];
    }
    delete d.comodos[id];
    if (s.comodo === id) s.comodo = null;
    s.sel = null; s.selEl = null; s.selComodo = null; s.verCen = null; s.folha = false;
  });
  garantirComodo();
}

/* ---------- móveis e itens de parede ---------- */
export function criarMovel(dados: Omit<Movel, 'id'>): string { const id = novoId('m'); set((s) => { s.dados.moveis[id] = { ...dados, id }; }); return id; }
export function salvarMovel(id: string, campos: Partial<Movel>) { set((s) => { const m = s.dados.moveis[id]; if (m) Object.assign(m, campos); }); }
export function criarEl(dados: Omit<ElParede, 'id'>): string { const id = novoId('e'); set((s) => { s.dados.els[id] = { ...dados, id }; }); return id; }
export function salvarEl(id: string, campos: Partial<ElParede>) {
  set((s) => {
    const e = s.dados.els[id];
    if (!e) return;
    // trocou o tipo de ponto e o nome ainda é o padrão ("Tomada 2")? O nome acompanha ("Ponto de TV").
    const antes = pontoDe(e);
    if (e.tipo === 'interruptor' && campos.ponto && campos.ponto !== antes && (campos.nome == null || campos.nome === e.nome) && nomePadraoPonto(e.nome, antes)) {
      campos = { ...campos, nome: proximoNomeEl(s.dados, e.comodo, 'interruptor', campos.ponto) };
    }
    Object.assign(e, campos);
  });
}
export function removerAlvo() {
  const s = get(), a = alvoSel(s.dados, s.sel, s.selEl);
  if (!a) return;
  set((e) => { if (a.tipo === 'movel') delete e.dados.moveis[a.obj.id]; else delete e.dados.els[a.obj.id]; });
  limparSel();
}

export function girar() {
  const s = get(), m = s.sel ? s.dados.moveis[s.sel] : null, q = m ? s.dados.comodos[m.comodo] : null;
  if (!m || !q) return;
  const rot = normRot(m.rot + 90), c = centrar(q, m, { ...m, rot });
  salvarMovel(m.id, { rot, x: c.x, y: c.y });
}
export function travar() {
  const s = get(), m = s.sel ? s.dados.moveis[s.sel] : null;
  if (!m) return;
  salvarMovel(m.id, { fixo: !m.fixo });
  toast(!m.fixo ? tx(`${m.nome} travado: as sugestões não mexem nele.`, `${m.nome} locked: suggestions won’t move it.`) : tx(`${m.nome} destravado.`, `${m.nome} unlocked.`));
}
export function alternar(a: 'dob' | 'abre' | 'jan') {
  const s = get(), e = s.selEl ? s.dados.els[s.selEl] : null;
  if (!e) return;
  if (a === 'dob') salvarEl(e.id, { dobradica: e.dobradica === 'a' ? 'b' : 'a' });
  else if (a === 'abre') salvarEl(e.id, { abre: e.abre === 'dentro' ? 'fora' : 'dentro' });
  else salvarEl(e.id, { abertura: e.abertura === 'abrir' ? 'correr' : 'abrir' });
}
export function levarPara(destino: string) {
  const s = get(), m = s.sel ? s.dados.moveis[s.sel] : null, qd = cq(s.dados, destino);
  if (!m || !qd || destino === m.comodo) return;
  const p = lugarLivre(qd, m, moveisDo(s.dados, destino));
  salvarMovel(m.id, { comodo: destino, x: p.x, y: p.y, rot: p.rot });
  set((e) => { e.comodo = destino; e.verCen = null; e.folhaModo = 'acoes'; });
  if (get().vista === 'um') enquadrar();
  toast(tx(`${m.nome} foi para ${qd.nome}.`, `${m.nome} moved to ${qd.nome}.`));
}
export function levar() {
  const s = get(), m = s.sel ? s.dados.moveis[s.sel] : null;
  if (!m) return;
  const outros = comodosOrdem(s.dados).filter((c) => c.id !== m.comodo);
  if (outros.length === 1) levarPara(outros[0].id);
  else if (outros.length) abrirDialogo('levar');
}
export function duplicar() {
  const s = get(), a = alvoSel(s.dados, s.sel, s.selEl);
  if (!a) return;
  if (a.tipo === 'movel') {
    const m = a.obj, q = cq(s.dados, m.comodo); if (!q) return;
    const outros = moveisDo(s.dados, m.comodo);
    const novo: Movel = { ...m, id: '', nome: nomeLivre(outros, m.nome), fixo: false, criado: Date.now() };
    const p = prender(q, m, m.x + 20, m.y + 20);
    if (posValida(q, novo, p.x, p.y, novo.rot, outros, false)) { novo.x = p.x; novo.y = p.y; }
    else { const l = lugarLivre(q, novo, outros); if (posValida(q, novo, l.x, l.y, l.rot, outros, false)) Object.assign(novo, l); else { novo.x = p.x; novo.y = p.y; } }
    const { id: _id, ...dados } = novo; void _id;
    selecionar({ id: criarMovel(dados) });
  } else {
    const e = a.obj, q = s.dados.comodos[e.comodo]; if (!q) return;
    const g = geoEl(q, e), w = g.b - g.a, inicio = g.b + 10 + w <= g.L ? g.b + 10 : Math.max(0, g.a - 10 - w);
    const { id: _id, ...dados } = { ...e, nome: proximoNomeEl(s.dados, e.comodo, e.tipo), inicio: Math.round(inicio), criado: Date.now() }; void _id;
    selecionar({ eid: criarEl(dados) });
  }
}

/* ---------- adicionar ---------- */
export function iniciarAdd(tipo: string, ctx: CtxAdd | null = null) {
  const s = get();
  if (!Object.keys(s.dados.comodos).length) { abrirDialogo('comodo'); return; }
  if (tipo === 'movel') tipo = ehParede(s.add.tipo) ? 'guarda-roupa' : s.add.tipo;
  if (!tipoMovel(tipo) && !ehParede(tipo)) tipo = 'guarda-roupa';
  set((e) => {
    e.add = { tipo, ctx, rascunho: {} };
    e.sel = null; e.selEl = null; e.selComodo = null; e.verCen = null; e.folha = false; e.latAberta = false;
    if (ctx && ctx.comodo && e.dados.comodos[ctx.comodo]) e.comodo = ctx.comodo;
  });
  abrirDialogo('add');
}

/** Coloca o móvel (num lugar livre ou no ponto escolhido) ou o item de parede. Os campos já vêm validados. */
export function adicionarMovel(tipo: TipoMovel, campos: Partial<Movel>, ctx: CtxAdd | null): { id: string; nome: string } | null {
  const s = get(), cid = ctx && ctx.comodo && s.dados.comodos[ctx.comodo] ? ctx.comodo : s.comodo, q = cq(s.dados, cid);
  if (!q || !cid) return null;
  const t = TIPOS[tipo], outros = moveisDo(s.dados, cid);
  const base: Movel = {
    id: '', tipo, nome: '', larg: 100, prof: 50, alto: t.alto, comodo: cid, x: 0, y: 0, rot: 0, criado: Date.now(), fixo: tipo === 'escada',
    abertura: t.ab ? t.ab[0] : 'nenhuma', nPortas: 0, frente: null, cadeiras: tipo === 'mesa' ? 1 : 0, ladoCadeiras: 'frente', cadLarg: 45, cadProf: 50,
    bauCab: 0, bauCabLarg: 0, bauCabAl: 'centro', bauCabDx: 0, bauPe: 0, bauPeLarg: 0, bauPeAl: 'centro', bauPeDx: 0, ...campos
  };
  if (!base.bauCabLarg) base.bauCabLarg = base.larg;
  if (!base.bauPeLarg) base.bauPeLarg = base.larg;
  if (!base.nome) base.nome = nomeLivre(outros, t.rot);
  Object.assign(base, ctx && ctx.x != null && ctx.y != null ? posNoPonto(q, base, ctx.x, ctx.y) : lugarLivre(q, base, outros));
  const { id: _id, ...dados } = base; void _id;
  const id = criarMovel(dados);
  selecionar({ id }, { painel: false });
  return { id, nome: base.nome };
}
export function adicionarEl(tipo: TipoParede, campos: Partial<ElParede>, ctx: CtxAdd | null): { id: string; nome: string } | null {
  const s = get(), cid = ctx && ctx.comodo && s.dados.comodos[ctx.comodo] ? ctx.comodo : s.comodo;
  if (!cid || !s.dados.comodos[cid]) return null;
  const tp = TIPOS_PAREDE[tipo];
  const dados: Omit<ElParede, 'id'> = { tipo, nome: '', comodo: cid, parede: tp.parede, inicio: 0, largura: tp.larg, criado: Date.now(), ...campos };
  if (tipo === 'interruptor') dados.ponto = dados.ponto || 'interruptor';
  if (!dados.nome) dados.nome = proximoNomeEl(s.dados, cid, tipo, dados.ponto);
  if (tipo === 'porta') { dados.dobradica = dados.dobradica || 'a'; dados.abre = dados.abre || 'dentro'; }
  if (tipo === 'janela') { dados.abertura = dados.abertura || 'correr'; dados.folhas = dados.folhas || 2; }
  if (tipo === 'ar' && dados.folga == null) dados.folga = 30;
  const id = criarEl(dados);
  selecionar({ eid: id }, { painel: false });
  return { id, nome: dados.nome };
}

/* ---------- cenários ---------- */
function itensAtuais(d: Dados, escopo: Escopo, comodo: string | null): Cenario['itens'] {
  const itens: Cenario['itens'] = {};
  for (const m of Object.values(d.moveis)) {
    if (!d.comodos[m.comodo] || (escopo !== 'casa' && m.comodo !== comodo)) continue;
    itens[m.id] = { comodo: m.comodo, x: m.x, y: m.y, rot: normRot(m.rot) };
  }
  return itens;
}
export function salvarCenario(nome: string, escopo: Escopo, comodo: string | null): string {
  const id = novoId('s');
  set((s) => {
    s.dados.cenarios[id] = { id, nome: nomeUnicoCenario(s.dados, nome || undefined), escopo, comodo: escopo === 'casa' ? null : comodo, criado: Date.now(), itens: itensAtuais(s.dados, escopo, comodo), sugestao: false, origem: 'auto', explicacao: '' };
    s.cenBase = id;
  });
  return id;
}
/** Outro cenário com o mesmo nome (sem diferenciar maiúsculas e espaços). */
export function cenarioComNome(d: Dados, nome: string, exceto: string | null = null): Cenario | null {
  const k = nome.trim().toLowerCase();
  return cenariosLista(d).find((c) => c.id !== exceto && c.nome.trim().toLowerCase() === k) || null;
}
/** "Quarto 1" → "Quarto 1-1" (ou -2, -3… se já existir). */
export function nomeComTraco(d: Dados, nome: string): string {
  const base = nome.trim().slice(0, 36);
  let k = 1;
  while (cenarioComNome(d, `${base}-${k}`)) k++;
  return `${base}-${k}`;
}
/** Troca o conteúdo de um cenário pela arrumação de agora (e pelo alcance escolhido). */
export function substituirCenario(id: string, escopo: Escopo, comodo: string | null, nome?: string) {
  set((s) => {
    const c = s.dados.cenarios[id]; if (!c) return;
    Object.assign(c, { escopo, comodo: escopo === 'casa' ? null : comodo, itens: itensAtuais(s.dados, escopo, comodo), sugestao: false, origem: 'auto', explicacao: '', ...(nome ? { nome } : {}) });
    s.cenBase = id;
  });
}
export function abrirCenario(id: string) {
  const s = get(), c = s.dados.cenarios[id];
  if (!c) return;
  set((e) => {
    e.sel = null; e.selEl = null; e.selComodo = null; e.folha = false; e.verCen = id; e.avisosAbertos = true;
    if (c.escopo === 'comodo' && c.comodo && e.dados.comodos[c.comodo] && c.comodo !== e.comodo) e.comodo = c.comodo;
  });
  if (c.escopo === 'comodo' && get().vista === 'um') enquadrar();
}
export function sairCenario() { set((s) => { s.verCen = null; }); }
export function usarCenario(id: string) {
  set((s) => {
    const c = s.dados.cenarios[id]; if (!c) return;
    for (const [mid, p] of Object.entries(c.itens)) {
      const m = s.dados.moveis[mid], q = s.dados.comodos[p.comodo]; if (!m || !q) continue;
      const rot = normRot(p.rot), pos = prender(q, m, p.x, p.y, rot);
      Object.assign(m, { comodo: p.comodo, x: pos.x, y: pos.y, rot });
    }
    s.verCen = null; s.folha = false; s.folhaModo = 'acoes'; s.cenBase = id;
  });
}
export function sobrescreverCenario(id: string) {
  set((s) => { const c = s.dados.cenarios[id]; if (!c) return; c.itens = itensAtuais(s.dados, c.escopo, c.comodo); c.sugestao = false; c.explicacao = ''; s.cenBase = id; });
}
export function atualizarCenario(id: string, campos: Partial<Cenario>) { set((s) => { const c = s.dados.cenarios[id]; if (c) Object.assign(c, campos); }); }
export function removerCenario(id: string) { set((s) => { delete s.dados.cenarios[id]; if (s.verCen === id) s.verCen = null; if (s.cenBase === id) s.cenBase = null; }); }

/** Troca as sugestões antigas (não guardadas) do mesmo alcance e da mesma origem pelas novas. */
export function guardarSugestoes(ops: { itens: Cenario['itens']; titulo: string; explicacao: string }[], escopo: Escopo, comodo: string | null, origem: 'auto' | 'ia'): string | null {
  let primeiro: string | null = null;
  set((s) => {
    for (const c of Object.values(s.dados.cenarios)) if (c.sugestao && c.origem === origem && c.escopo === escopo && (escopo === 'casa' || c.comodo === comodo)) delete s.dados.cenarios[c.id];
    const lote = Date.now();
    ops.forEach((o, k) => {
      const id = novoId('s');
      const nome = nomeUnicoCenario(s.dados, ((origem === 'ia' ? tx('IA ', 'AI ') : tx('Sugestão ', 'Suggestion ')) + (k + 1) + ' · ' + o.titulo).slice(0, 48));
      s.dados.cenarios[id] = { id, nome, escopo, comodo: escopo === 'casa' ? null : comodo, criado: lote + k, itens: o.itens, explicacao: o.explicacao, sugestao: true, origem };
      if (!primeiro) primeiro = id;
    });
  });
  return primeiro;
}

function erroNoDialogo(erro: string) { set((s) => { if (s.dlg) s.dlg.dados.erro = erro; }); }

export async function gerarSugestoes(escopo: Escopo) {
  const s0 = get();
  if (s0.sug.busy || s0.ia.busy) return;
  const cid = s0.comodo;
  set((s) => { s.sug = { busy: true, msg: tx('Testando arrumações…', 'Trying layouts…') }; if (s.dlg) s.dlg.dados.erro = ''; });
  try {
    const aviso = (n: number) => set((s) => { s.sug.msg = tx(`Testando arrumações… (${n})`, `Trying layouts… (${n})`); });
    const d = get().dados;
    let ops: Opcao[];
    if (escopo === 'casa') ops = await sugerirCasa(comodosOrdem(d).map((c) => cq(d, c.id)!).filter(Boolean), (id) => moveisDo(d, id), aviso);
    else { const q = cq(d, cid); ops = q ? await sugerirComodo(q, moveisDo(d, q.id), aviso) : []; }
    set((s) => { s.sug = { busy: false, msg: '' }; });
    if (!ops.length) { erroNoDialogo(tx('Não achei arrumações: confira se há móveis destravados.', 'Couldn’t find any layouts: check that some furniture is unlocked.')); return; }
    const primeiro = guardarSugestoes(ops, escopo, escopo === 'casa' ? null : cid, 'auto');
    set((s) => { s.dlg = null; if (escopo === 'casa' && s.vista === 'um') s.vista = 'casa'; });
    if (primeiro) abrirCenario(primeiro);
    enquadrar();
    toast(ops.length >= 3
      ? tx('3 sugestões prontas. Toque nelas na faixa de cima para comparar.', '3 suggestions ready. Tap them in the top bar to compare.')
      : tx(`Só deu para montar ${pl(ops.length, 'arrumação diferente', 'arrumações diferentes')} com esses móveis.`, `Could only put together ${pl(ops.length, 'different layout', 'different layouts')} with this furniture.`));
  } catch {
    set((s) => { s.sug = { busy: false, msg: '' }; });
    erroNoDialogo(tx('Algo deu errado ao calcular. Tente de novo.', 'Something went wrong while calculating. Try again.'));
  }
}

/* ---------- arquivo e começo ---------- */
export function trocarDados(d: Dados, comodo?: string | null) {
  set((s) => {
    s.dados = d; s.sel = null; s.selEl = null; s.selComodo = null; s.verCen = null; s.cenBase = null; s.folha = false; s.comodo = comodo || null;
  });
  garantirComodo();
  enquadrar();
}
export function criarExemplo() {
  trocarDados(exemplo(), 'q2');
  set((s) => { s.vista = 'casa'; });
  enquadrar();
  toast(tx('Exemplo pronto: uma casa de dois andares. Arraste os móveis ou toque em ✦ Sugestões.', 'Example ready: a two-story home. Drag the furniture or tap ✦ Suggestions.'));
}

/* ---------- idioma ---------- */
export function aplicarIdioma(i: Idioma) {
  definirIdioma(i);
  try {
    document.documentElement.lang = i === 'en' ? 'en' : 'pt-BR';
    document.title = tx('Cabeaí · será que cabe? A planta da sua casa, em escala', 'Cabeaí · will it fit? Your home floor plan, to scale');
  } catch { /* fora do navegador */ }
}
export function mudarIdioma(i: Idioma) {
  aplicarIdioma(i);
  set((s) => { s.idioma = i; s.menu = null; });
}

/* ---------- utilidades para os componentes ---------- */
export const estadoAtual = get;
export const atualizar = set;
export const visiveis = (s: Estado) => idsVisiveis(s.dados, s.vista, s.comodo);
export const ESPESSURA = T;

/* ---------- editar e remover ---------- */
export function editarItem() {
  const s = get();
  if (!alvoSel(s.dados, s.sel, s.selEl)) return;
  if (s.modo === 'avancado') {
    set((e) => { e.folha = false; e.inspetor = true; });
    setTimeout(() => (document.querySelector('#p-prop [data-k]') as HTMLElement | null)?.focus({ preventScroll: true }), 30);
  } else {
    set((e) => { e.folha = true; e.folhaModo = 'editar'; });
    setTimeout(() => (document.querySelector('#folha-in [data-k="larg"], #folha-in [data-k="largura"], #folha-in input') as HTMLElement | null)?.focus({ preventScroll: true }), 30);
  }
}
export function pedirRemover() { const s = get(); if (alvoSel(s.dados, s.sel, s.selEl)) abrirDialogo('remover-item'); }

/* ---------- IA (online grátis ou a do navegador) ---------- */
function msgErroIA(codigo: string, msg?: string): string {
  const m: Record<string, string> = {
    limite: tx('A IA grátis está no limite de uso agora. Tente daqui a pouco ou use as sugestões automáticas.', 'The free AI has hit its usage limit for now. Try again in a little while or use the automatic suggestions.'),
    'sem-ia': tx('A IA online não está disponível neste site agora. As sugestões automáticas continuam funcionando.', 'The online AI isn’t available on this site right now. The automatic suggestions still work.'),
    invalido: tx('A IA respondeu fora do formato esperado. Tente de novo.', 'The AI replied in an unexpected format. Try again.'),
    vazio: tx('A IA não mandou nenhuma arrumação. Tente de novo.', 'The AI didn’t send any layouts. Try again.'),
    rede: tx('Não deu para falar com a IA agora. Confira a internet e tente de novo.', 'Couldn’t reach the AI right now. Check your internet connection and try again.'),
    indisponivel: tx('Este navegador não tem IA embutida. Ela existe no Google Chrome do computador (versão nova).', 'This browser doesn’t have built-in AI. It’s available in Google Chrome on a computer (recent version).'),
    grande: tx('Móveis demais de uma vez para a IA. Tente com menos.', 'Too much furniture at once for the AI. Try with fewer items.')
  };
  return m[codigo] || msg || tx('Não deu para falar com a IA agora. Tente de novo em instantes.', 'Couldn’t reach the AI right now. Try again in a moment.');
}

export async function pedirIA(origem: 'online' | 'navegador') {
  const s0 = get();
  if (s0.ia.busy || s0.sug.busy) return;
  const q = cq(s0.dados, s0.comodo);
  if (!q) return;
  const todos = moveisDo(s0.dados, q.id);
  if (!todos.some((m) => !m.fixo)) return;
  const ctl = new AbortController();
  set((s) => {
    s.ia = { busy: true, msg: origem === 'online' ? tx(`A IA está pensando em 3 arrumações para ${q.nome}… pode levar até um minuto.`, `The AI is coming up with 3 layouts for ${q.nome}… this can take up to a minute.`) : tx('A IA do navegador está pensando…', 'The browser AI is thinking…') };
    s.iaCtl = ctl;
    if (s.dlg) s.dlg.dados.erro = '';
  });
  try {
    const { lerOpcoesIA } = await import('./ia');
    let ops;
    if (origem === 'online') {
      let r: Response;
      try {
        r = await fetch('/api/ia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ comodo: q, moveis: todos, idioma: idioma() }), signal: ctl.signal });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        throw { codigo: 'rede' };
      }
      const j = (await r.json().catch(() => ({}))) as { bruto?: unknown; codigo?: string; erro?: string };
      if (!r.ok || !j.bruto) throw { codigo: j.codigo || 'erro', msg: j.erro };
      ops = lerOpcoesIA(q, todos, j.bruto);
    } else {
      const { pedirIANavegador } = await import('./iaNavegador');
      ops = await pedirIANavegador(q, todos, { signal: ctl.signal, progresso: (p) => set((s) => { s.ia.msg = tx(`Baixando a IA do navegador (só na primeira vez)… ${Math.round(p * 100)}%`, `Downloading the browser AI (first time only)… ${Math.round(p * 100)}%`); }) });
    }
    if (!ops.length) throw { codigo: 'vazio' };
    set((s) => { s.ia = { busy: false, msg: '' }; s.iaCtl = null; s.dlg = null; });
    const primeiro = guardarSugestoes(ops, 'comodo', q.id, 'ia');
    if (primeiro) abrirCenario(primeiro);
    toast(tx(`A IA mandou ${pl(ops.length, 'opção', 'opções')}. Toque nelas na faixa de cima para comparar.`, `The AI sent ${pl(ops.length, 'option', 'options')}. Tap them in the top bar to compare.`));
  } catch (e) {
    const err = e as { name?: string; codigo?: string; msg?: string };
    const parou = err?.name === 'AbortError';
    set((s) => { s.ia = { busy: false, msg: '' }; s.iaCtl = null; if (s.dlg && !parou) s.dlg.dados.erro = msgErroIA(err?.codigo || '', err?.msg); });
  }
}
export function pararIA() { const c = get().iaCtl; if (c) c.abort(); }
