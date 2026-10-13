'use client';
// A planta: desenho em escala + mouse, toque, pinça e teclado.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { espacos, imaBorda, imaComodo, retDesenhado } from '@/lib/casa';
import { COMODO_NOME, T, horizontal } from '@/lib/catalogo';
import type { Borda } from '@/lib/edicao';
import { comodosDoAndar, avaliacao, cq, elVisto, idsVisiveis, listaAtiva, vizinhosDeParede, type ParedeVizinha } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { dims, folhasPorta, geoEl, ima, paredePerto, prender, ret, temGiro, uDaParede, uv2xy } from '@/lib/geometria';
import { tx } from '@/lib/i18n';
import { registrarPlanta } from '@/lib/exportar';
import { areaDoAndar, fmtArea } from '@/lib/resumo';
import {
  abrirMenu, alternarParede, atualizar, avisarLigacoes, conectarComodo, desenharComodo, editarItem, estadoAtual, esticar, fecharMenu, fimEsticar, focarComodo, girarComodo,
  limparSel, moverComodo, porNaParede, salvarElVisto, salvarMovel, selecionar, selecionarComodo, toast, useApp, zoomEm
} from '@/lib/store';
import type { Comodo, Dados, Parede, Vista } from '@/lib/tipos';
import { fmtM, n1 } from '@/lib/util';
import { layoutDe, vbAtual, vbBase, type Layout } from '@/lib/vista';
import BarraContexto, { type AlvoTela } from './Contexto';
import { DefsPlanta, PortasPorCima, RotulosSala, Sala, Seta } from './desenho/Sala';

const ALVOS = '.mv, .jan, .arel, .porta-el, .interr-el';
type Pt = { x: number; y: number };
interface Congelado { andar: string; ox: number; oy: number; off: Record<string, Pt>; vb: Layout['vb']; andares: Layout['andares'] }
/** Retângulo sendo desenhado (coordenadas do andar) e o deslocamento do andar na tela. */
interface Risco { andar: string | null; ox: number; oy: number; x: number; y: number; w: number; h: number }
const BORDAS: Borda[] = ['esq', 'dir', 'cima', 'baixo'];
/** Planta vazia no modo de desenhar: uns 13 × 9 m para começar. */
const VB_VAZIO: Layout['vb'] = [-50, -50, 1300, 900];
/** Medida da trena, em coordenadas da planta (cm). */
interface Trena { a: Pt; b: Pt }
/** O item tocado na planta: móvel ({id}) ou item de parede ({eid}); a porta tocada pelo lado do vizinho traz "via". */
function alvoDoEl(el: Element): { id?: string; eid?: string; via?: string } {
  if (!el.hasAttribute('data-eid')) return { id: el.getAttribute('data-id')! };
  const via = el.getAttribute('data-via');
  return via ? { eid: el.getAttribute('data-eid')!, via } : { eid: el.getAttribute('data-eid')! };
}
/** Onde fica, no desenho do cômodo, um ponto da linha do meio da parede (v = deslocamento para dentro). */
function naParede(c: Comodo, p: ParedeVizinha['parede'], u: number, v = 0): Pt {
  if (p === 'cima') return { x: u, y: -T / 2 + v };
  if (p === 'baixo') return { x: u, y: c.h + T / 2 - v };
  if (p === 'esquerda') return { x: -T / 2 + v, y: u };
  return { x: c.w + T / 2 - v, y: u };
}

export default function Planta() {
  const dados = useApp((s) => s.dados);
  const vista = useApp((s) => s.vista);
  const comodo = useApp((s) => s.comodo);
  const sel = useApp((s) => s.sel);
  const selEl = useApp((s) => s.selEl);
  const selComodo = useApp((s) => s.selComodo);
  const verCen = useApp((s) => s.verCen);
  const cam = useApp((s) => s.cam);
  const setasTodos = useApp((s) => s.setasTodos);
  const modo = useApp((s) => s.modo);
  const arrastando = useApp((s) => s.arrastando);
  const desenho = useApp((s) => s.desenho);
  const medir = useApp((s) => s.medir);
  const camadas = useApp((s) => s.camadas);
  const folha = useApp((s) => s.folha);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tela, setTela] = useState({ w: 800, h: 600 });
  const [congelado, setCongelado] = useState<Congelado | null>(null);
  const [risco, setRisco] = useState<Risco | null>(null);
  const [trena, setTrena] = useState<Trena | null>(null);
  /** Cômodo sendo arrastado ou esticado: as paredes que ele divide com os vizinhos ficam acesas ("grudou"). */
  const [juntaQ, setJuntaQ] = useState<string | null>(null);
  const espaco = useRef(false);
  /** No modo de desenhar, a barra de ações vai para o painel de baixo (não cobre as paredes onde se toca). */
  const [doca, setDoca] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setDoca(desenho.ativo ? document.getElementById('ctx-doca') : null); }, [desenho.ativo]);
  useEffect(() => { if (!medir) setTrena(null); }, [medir]);
  // espaço segurado: arrastar move a planta (como nos programas de desenho)
  useEffect(() => {
    // (no campo de texto, num botão ou num item da planta com o foco, o espaço continua sendo do item)
    const campo = (t: EventTarget | null) => {
      const el = t as HTMLElement | null, tag = (el && el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || !!(el && el.isContentEditable) || !!(el && el.closest && el.closest(`${ALVOS}, [data-qt]`));
    };
    const desce = (e: KeyboardEvent) => { if (e.code === 'Space' && !campo(e.target) && !estadoAtual().dlg) { if (!espaco.current) { espaco.current = true; svgRef.current?.classList.add('pan-espaco'); } e.preventDefault(); } };
    const sobe = (e: KeyboardEvent) => { if (e.code === 'Space') { espaco.current = false; svgRef.current?.classList.remove('pan-espaco'); } };
    const sai = () => { espaco.current = false; svgRef.current?.classList.remove('pan-espaco'); };
    window.addEventListener('keydown', desce); window.addEventListener('keyup', sobe); window.addEventListener('blur', sai);
    return () => { window.removeEventListener('keydown', desce); window.removeEventListener('keyup', sobe); window.removeEventListener('blur', sai); };
  }, []);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setTela({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ids = useMemo(() => idsVisiveis(dados, vista, comodo), [dados, vista, comodo]);
  const lay0 = useMemo(() => layoutDe(dados, vista, ids, tela), [dados, vista, ids, tela]);
  // enquanto um cômodo é arrastado, a planta do andar não "pula" quando o contorno da casa muda
  const lay: Layout = useMemo(() => {
    if (!lay0.ids.length && desenho.ativo) return { ...lay0, vb: VB_VAZIO };
    if (!congelado || vista !== 'casa') return lay0;
    const off: Record<string, Pt> = { ...lay0.off };
    for (const id of lay0.ids) { const c = dados.comodos[id]; if (c && c.andar === congelado.andar) off[id] = { x: congelado.ox + c.x, y: congelado.oy + c.y }; else if (congelado.off[id]) off[id] = congelado.off[id]; }
    return { ...lay0, off, vb: congelado.vb, andares: congelado.andares };
  }, [lay0, congelado, dados, vista, desenho.ativo]);
  // desenhando, a barra do desenho fica embaixo: a planta se enquadra acima dela
  const base = useMemo(() => vbBase(lay, tela.w, tela.h, tela.w < 900, desenho.ativo ? (desenho.item ? 125 : 175) : 0), [lay, tela, desenho.ativo, desenho.item]);
  const vb = vbAtual(base, cam);
  useEffect(() => { const s = estadoAtual(); if (s.camBase.cx !== base.cx || s.camBase.cy !== base.cy) atualizar((e) => { e.camBase = { cx: base.cx, cy: base.cy }; }); }, [base]);

  // estado dos gestos (fora do React para não redesenhar à toa)
  const g = useRef({
    ptrs: new Map<number, Pt>(),
    drag: null as null | { id: string; dx: number; dy: number; pid: number; moveu: boolean; ativo: boolean; cx: number; cy: number },
    dragEl: null as null | { id: string; du: number; via: string | null; pid: number; moveu: boolean; ativo: boolean; cx: number; cy: number },
    dragQ: null as null | { id: string; dx: number; dy: number; ox: number; oy: number; pid: number; moveu: boolean; ativo: boolean; cx: number; cy: number; offAntes: Pt },
    pan: null as null | { pid: number; x: number; y: number; cx0: number; cy0: number; esc: number; moveu: boolean; qid: string | null; tit: boolean; so?: boolean; por?: Pt },
    risco: null as null | { pid: number; andar: string | null; ox: number; oy: number; p0: Pt; r?: { x: number; y: number; w: number; h: number } },
    trena: null as null | { pid: number; a: Pt; cx: number; cy: number },
    estica: null as null | { pid: number; id: string; borda: Borda; ox: number; oy: number; moveu: boolean },
    pinca: null as null | { d0: number; z0: number; esc0: number; rc: Pt; m0: Pt; c0: Pt },
    lp: null as null | { pid: number; x: number; y: number; timer: number },
    toque: null as null | { chave: string; t: number },
    toqueT: 0,
    toqueTit: null as null | { qid: string; t: number },
    menuToque: 0
  }).current;
  const layRef = useRef(lay); layRef.current = lay;
  // para salvar a planta como imagem
  useEffect(() => { registrarPlanta(() => (svgRef.current ? { svg: svgRef.current, vb: layRef.current.vb } : null)); return () => registrarPlanta(null); }, []);
  const vbRef = useRef(vb); vbRef.current = vb;
  const baseRef = useRef(base); baseRef.current = base;

  function ptSvg(cx: number, cy: number): Pt {
    const svg = svgRef.current, ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }
  function escalaTela(): number {
    const r = svgRef.current?.getBoundingClientRect(), v = vbRef.current;
    return Math.min((r?.width || 1) / v[2], (r?.height || 1) / v[3]) || 1;
  }
  const offDe = (id: string): Pt => layRef.current.off[id] || { x: 0, y: 0 };
  const localDe = (id: string, p: Pt): Pt => { const o = offDe(id); return { x: p.x - o.x, y: p.y - o.y }; };
  function salaNoPonto(p: Pt, soDentro: boolean): string | null {
    const d = estadoAtual().dados;
    let melhor: string | null = null, md = Infinity;
    for (const id of layRef.current.ids) {
      const o = offDe(id), c = d.comodos[id]; if (!c) continue;
      const dx = Math.max(o.x - p.x, 0, p.x - (o.x + c.w)), dy = Math.max(o.y - p.y, 0, p.y - (o.y + c.h)), dd = Math.hypot(dx, dy);
      if (dd < md) { md = dd; melhor = id; }
    }
    return soDentro ? (md < 1 ? melhor : null) : melhor;
  }
  function infoAlvo(target: EventTarget | null, cx: number, cy: number): { id?: string; eid?: string; via?: string; qid?: string; x?: number; y?: number; tit?: string } {
    const el = target instanceof Element ? target.closest(ALVOS) : null;
    if (el && svgRef.current?.contains(el)) return alvoDoEl(el);
    const tit = target instanceof Element ? target.closest('[data-qt]') : null;
    const p = ptSvg(cx, cy), qid = tit ? tit.getAttribute('data-qt') : salaNoPonto(p, false);
    if (!qid) return {};
    const l = localDe(qid, p);
    return { qid, x: l.x, y: l.y, tit: tit ? qid : undefined };
  }

  /** Andar onde o ponto caiu (ou o do cômodo em foco) e o deslocamento dele na tela. */
  function andarNoPonto(p: Pt): { andar: string | null; ox: number; oy: number } {
    const s = estadoAtual(), d = s.dados, L = layRef.current;
    let andar: string | null = null;
    for (const a of L.andares) if (p.x >= a.x - 80 && p.x <= a.x + a.w + 80 && p.y >= a.y - 80 && p.y <= a.y + a.h + 80) { andar = a.id; break; }
    if (!andar) { const c = s.comodo ? d.comodos[s.comodo] : null; andar = c ? c.andar : L.andares[0]?.id ?? null; }
    const c0 = andar ? comodosDoAndar(d, andar).find((c) => L.off[c.id]) : null;
    if (c0) return { andar, ox: L.off[c0.id].x - c0.x, oy: L.off[c0.id].y - c0.y };
    return { andar, ox: 0, oy: 0 };
  }
  /** Depois de criar, girar ou esticar um cômodo a planta do andar se reajusta; a câmera acompanha o deslocamento do
   *  andar (ox0, oy0 = onde o canto do andar estava na tela) para nada "pular", e a escala fica a mesma. */
  function manterVista(id: string, ox0: number, oy0: number) {
    const v0 = vbRef.current;
    requestAnimationFrame(() => {
      const o1 = layRef.current.off[id], c1 = estadoAtual().dados.comodos[id], B1 = baseRef.current;
      if (!o1 || !c1) return;
      const z = Math.min(Math.max(B1.w / v0[2], 0.3), 8);
      atualizar((x) => { x.cam = { z, cx: v0[0] + v0[2] / 2 + (o1.x - c1.x - ox0), cy: v0[1] + v0[3] / 2 + (o1.y - c1.y - oy0) }; });
    });
  }
  /** Onde o canto do andar do cômodo está na tela agora. */
  const andarDe = (id: string): Pt => { const c = estadoAtual().dados.comodos[id], o = offDe(id); return c ? { x: o.x - c.x, y: o.y - c.y } : o; };

  function abrirMenuNaPlanta(cx: number, cy: number, info: ReturnType<typeof infoAlvo>, teclado = false) {
    const s = estadoAtual();
    if (s.verCen) { abrirMenu({ x: cx, y: cy, tipo: 'cen-planta', cen: s.verCen, teclado }); return; }
    if (info.id && s.dados.moveis[info.id]) { selecionar({ id: info.id }, { painel: false }); atualizar((e) => { e.folha = false; }); abrirMenu({ x: cx, y: cy, tipo: 'item', id: info.id, teclado }); return; }
    if (info.eid && s.dados.els[info.eid]) { selecionar({ eid: info.eid }, { painel: false, via: info.via }); atualizar((e) => { e.folha = false; }); abrirMenu({ x: cx, y: cy, tipo: 'item', eid: info.eid, teclado }); return; }
    if (info.qid && s.dados.comodos[info.qid]) {
      if (info.tit && s.vista === 'casa') { selecionarComodo(info.qid); abrirMenu({ x: cx, y: cy, tipo: 'comodo', comodo: info.qid, teclado }); return; }
      const q = s.dados.comodos[info.qid], pp = paredePerto(q, info.x || 0, info.y || 0);
      if (s.sel || s.selEl || s.comodo !== info.qid) { limparSel(); atualizar((e) => { e.comodo = info.qid!; }); }
      abrirMenu({ x: cx, y: cy, tipo: 'ponto', comodo: info.qid, px: info.x, py: info.y, parede: pp.parede, u: pp.u, teclado });
    }
  }

  function cancelarLongo() { if (g.lp) { clearTimeout(g.lp.timer); g.lp = null; } }
  function iniciarLongo(e: RPointerEvent) {
    cancelarLongo();
    const x = e.clientX, y = e.clientY, info = infoAlvo(e.target, x, y);
    g.lp = {
      pid: e.pointerId, x, y, timer: window.setTimeout(() => {
        g.lp = null;
        if (g.drag?.moveu || g.dragEl?.moveu || g.dragQ?.moveu || g.pan?.moveu || g.pinca) return;
        for (const d of [g.drag, g.dragEl, g.dragQ, g.pan]) if (d) { try { svgRef.current?.releasePointerCapture(d.pid); } catch { /* ok */ } }
        g.drag = null; g.dragEl = null; g.dragQ = null; g.pan = null;
        g.menuToque = Date.now();
        abrirMenuNaPlanta(x, y, info);
        try { navigator.vibrate?.(12); } catch { /* ok */ }
      }, 550)
    };
  }

  function iniciarPinca() {
    cancelarLongo();
    const dq = g.dragQ;
    if (dq && dq.ativo) { if (dq.moveu) avisarLigacoes(dq.id, conectarComodo(dq.id)); setCongelado(null); }
    g.drag = null; g.dragEl = null; g.dragQ = null; g.pan = null; g.risco = null; g.trena = null;
    if (g.estica) { fimEsticar(g.estica.id); g.estica = null; setCongelado(null); }
    setRisco(null); setJuntaQ(null);
    const [a, b] = Array.from(g.ptrs.values()), v = vbRef.current, R = svgRef.current!.getBoundingClientRect();
    g.pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: estadoAtual().cam.z, esc0: escalaTela(), rc: { x: R.left + R.width / 2, y: R.top + R.height / 2 }, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c0: { x: v[0] + v[2] / 2, y: v[1] + v[3] / 2 } };
  }
  function moverPinca() {
    const pts = Array.from(g.ptrs.values()); if (pts.length < 2 || !g.pinca) return;
    const [a, b] = pts, P = g.pinca, d = Math.hypot(a.x - b.x, a.y - b.y) || 1, z = Math.min(Math.max((P.z0 * d) / P.d0, 0.3), 8);
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, sc = (P.esc0 * z) / P.z0;
    const W = { x: P.c0.x + (P.m0.x - P.rc.x) / P.esc0, y: P.c0.y + (P.m0.y - P.rc.y) / P.esc0 };
    atualizar((s) => { s.cam = { z, cx: W.x - (m.x - P.rc.x) / sc, cy: W.y - (m.y - P.rc.y) / sc }; });
  }

  /** Começa a arrastar a planta (com "so", só arrasta: soltar sem mexer não seleciona nada). */
  function iniciarPan(e: RPointerEvent<SVGSVGElement>, tit: Element | null, so = false) {
    const p = ptSvg(e.clientX, e.clientY), v = vbRef.current;
    g.pan = { pid: e.pointerId, x: e.clientX, y: e.clientY, cx0: v[0] + v[2] / 2, cy0: v[1] + v[3] / 2, esc: escalaTela(), moveu: false, qid: so ? null : tit ? tit.getAttribute('data-qt') : salaNoPonto(p, true), tit: !!tit, so };
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
  }
  /** Começa a arrastar um cômodo (pelo nome ou pelo piso). */
  function arrastarComodo(id: string, e: RPointerEvent<SVGSVGElement>): boolean {
    const c = estadoAtual().dados.comodos[id]; if (!c) return false;
    e.preventDefault();
    const p = ptSvg(e.clientX, e.clientY), o = offDe(id);
    g.dragQ = { id, dx: p.x - o.x, dy: p.y - o.y, ox: o.x - c.x, oy: o.y - c.y, pid: e.pointerId, moveu: false, ativo: false, cx: e.clientX, cy: e.clientY, offAntes: o };
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
    return true;
  }
  /** Trena: a ponta gruda nas paredes e nos móveis por perto e, quase reta, fica reta. */
  function imantarTrena(p: Pt, a?: Pt): Pt {
    const s = estadoAtual(), L = layRef.current, lim = 10 / escalaTela(), xs: number[] = [], ys: number[] = [];
    for (const id of L.ids) {
      const c = s.dados.comodos[id], o = L.off[id]; if (!c || !o) continue;
      xs.push(o.x, o.x + c.w, o.x - T, o.x + c.w + T); ys.push(o.y, o.y + c.h, o.y - T, o.y + c.h + T);
      for (const m of listaAtiva(s.dados, s.verCen, id)) { const r = ret(m); xs.push(o.x + r.x1, o.x + r.x2); ys.push(o.y + r.y1, o.y + r.y2); }
    }
    const gruda = (v: number, cs: number[]) => { let b = v, md = lim; for (const c of cs) { const d = Math.abs(c - v); if (d < md) { md = d; b = c; } } return b; };
    let x = gruda(p.x, xs), y = gruda(p.y, ys);
    if (a) { if (Math.abs(y - a.y) < lim * 0.8) y = a.y; if (Math.abs(x - a.x) < lim * 0.8) x = a.x; }
    return { x: Math.round(x), y: Math.round(y) };
  }

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    // botão do meio do mouse, ou espaço segurado: só arrasta a planta
    const soPan = e.button === 1 || (espaco.current && e.pointerType === 'mouse');
    if (e.button != null && e.button > 0 && !soPan) return;
    g.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.ptrs.size === 2) { iniciarPinca(); return; }
    if (g.ptrs.size > 2) return;
    fecharMenu();
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae.closest && ae.closest('#p-prop') && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT')) ae.blur();
    const s = estadoAtual(), target = e.target as Element, perto = (sel: string) => (target.closest ? target.closest(sel) : null);
    if (soPan) { e.preventDefault(); iniciarPan(e, null, true); return; }
    // botões desenhados na planta: tirar ou pôr parede, e as alças para esticar as paredes (girar fica na barra de ações)
    const pv = perto('[data-parede-viz]');
    if (pv && s.selComodo) { e.preventDefault(); alternarParede(s.selComodo, pv.getAttribute('data-parede-viz')!); return; }
    const alca = perto('[data-alca]');
    if (alca && s.selComodo && s.dados.comodos[s.selComodo] && s.vista === 'casa') {
      e.preventDefault();
      const c = s.dados.comodos[s.selComodo], o = offDe(c.id);
      g.estica = { pid: e.pointerId, id: c.id, borda: alca.getAttribute('data-alca') as Borda, ox: o.x - c.x, oy: o.y - c.y, moveu: false };
      setCongelado({ andar: c.andar, ox: o.x - c.x, oy: o.y - c.y, off: { ...layRef.current.off }, vb: layRef.current.vb, andares: layRef.current.andares });
      atualizar((x) => { x.arrastando = true; });
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
      return;
    }
    // trena: arrastar mede de um ponto ao outro
    if (s.medir) {
      e.preventDefault();
      const a = imantarTrena(ptSvg(e.clientX, e.clientY));
      g.trena = { pid: e.pointerId, a, cx: e.clientX, cy: e.clientY };
      setTrena({ a, b: a });
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
      return;
    }
    const tit = perto('[data-qt]');
    // modo de desenhar com a ferramenta de porta ou janela: tocar numa porta ou janela pega ela (seleciona e arrasta
    // pela parede, como fora do modo); tocar na parede põe a peça ali; arrastar move a planta
    if (s.desenho.ativo && !s.verCen && s.desenho.item && !perto('.porta-el, .jan')) {
      e.preventDefault();
      iniciarPan(e, null, true);
      if (g.pan) g.pan.por = ptSvg(e.clientX, e.clientY);
      return;
    }
    // modo de desenhar: o cômodo (pelo nome ou pelo piso) se arrasta; fora dele, o arraste desenha um cômodo novo
    if (s.desenho.ativo && !s.verCen && !s.desenho.item) {
      const p = ptSvg(e.clientX, e.clientY), qid = tit ? tit.getAttribute('data-qt') : salaNoPonto(p, true);
      if (qid && arrastarComodo(qid, e)) return;
      e.preventDefault();
      const A = andarNoPonto(p), outros = A.andar ? comodosDoAndar(s.dados, A.andar) : [], lim = 18 / escalaTela();
      const p0 = { x: imaBorda(p.x - A.ox, 'x', outros, lim), y: imaBorda(p.y - A.oy, 'y', outros, lim) };
      g.risco = { pid: e.pointerId, andar: A.andar, ox: A.ox, oy: A.oy, p0 };
      setRisco({ andar: A.andar, ox: A.ox, oy: A.oy, x: p0.x, y: p0.y, w: 0, h: 0 });
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
      return;
    }
    if (e.pointerType !== 'mouse') iniciarLongo(e);
    if (tit && s.vista === 'casa' && !s.verCen && arrastarComodo(tit.getAttribute('data-qt')!, e)) return;
    const alvo = !s.verCen && target.closest ? target.closest(ALVOS) : null;
    // na planta da casa, o cômodo selecionado também se arrasta pelo piso
    const qSel = s.selComodo, salaG = !alvo && s.vista === 'casa' && !s.verCen && qSel ? perto('g.sala[data-q]') : null;
    if (qSel && salaG && salaG.getAttribute('data-q') === qSel && arrastarComodo(qSel, e)) return;
    if (!alvo) { iniciarPan(e, tit); return; }
    e.preventDefault();
    const eid = alvo.getAttribute('data-eid'), mid = alvo.getAttribute('data-id');
    if (eid ? !s.dados.els[eid] : !mid || !s.dados.moveis[mid]) return;
    // porta da parede dividida tocada pelo lado do vizinho: é a mesma porta, medida na parede de lá
    const via = eid ? alvo.getAttribute('data-via') : null;
    const ja = eid ? s.selEl === eid && (!via || s.comodo === via) : s.sel === mid;
    if (!ja) selecionar(eid ? { eid } : { id: mid! }, via ? { via } : {});
    atualizar((x) => { x.folha = false; });
    const p = ptSvg(e.clientX, e.clientY);
    if (eid) {
      const f = quadroDoItem(s.dados, eid, via, p);
      if (f) g.dragEl = { id: eid, du: f.u - f.a, via, pid: e.pointerId, moveu: false, ativo: false, cx: e.clientX, cy: e.clientY };
    } else {
      const m = s.dados.moveis[mid!], l = localDe(m.comodo, p);
      g.drag = { id: mid!, dx: l.x - m.x, dy: l.y - m.y, pid: e.pointerId, moveu: false, ativo: false, cx: e.clientX, cy: e.clientY };
    }
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
  }

  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    if (g.ptrs.has(e.pointerId)) g.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinca) { moverPinca(); return; }
    if (g.lp && e.pointerId === g.lp.pid && Math.hypot(e.clientX - g.lp.x, e.clientY - g.lp.y) > 8) cancelarLongo();
    const tr = g.trena;
    if (tr && e.pointerId === tr.pid) { setTrena({ a: tr.a, b: imantarTrena(ptSvg(e.clientX, e.clientY), tr.a) }); return; }
    const rc = g.risco;
    if (rc && e.pointerId === rc.pid) {
      const s0 = estadoAtual(), p = ptSvg(e.clientX, e.clientY), outros = rc.andar ? comodosDoAndar(s0.dados, rc.andar) : [];
      const r = retDesenhado(rc.p0, { x: p.x - rc.ox, y: p.y - rc.oy }, outros, 18 / escalaTela());
      rc.r = r; // o último retângulo fica aqui também: o dedo pode soltar antes da tela redesenhar
      setRisco({ andar: rc.andar, ox: rc.ox, oy: rc.oy, ...r });
      return;
    }
    const es = g.estica;
    if (es && e.pointerId === es.pid) {
      const s0 = estadoAtual(), c = s0.dados.comodos[es.id]; if (!c) return;
      const p = ptSvg(e.clientX, e.clientY), horiz = es.borda === 'esq' || es.borda === 'dir';
      const outros = comodosDoAndar(s0.dados, c.andar).filter((o) => o.id !== c.id);
      const v = imaBorda(horiz ? p.x - es.ox : p.y - es.oy, horiz ? 'x' : 'y', outros, 18 / escalaTela(), es.borda === 'esq' || es.borda === 'cima' ? 'ini' : 'fim');
      if (!es.moveu) setJuntaQ(es.id);
      es.moveu = true;
      esticar(es.id, es.borda, v);
      return;
    }
    const pan = g.pan;
    if (pan && e.pointerId === pan.pid) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moveu && Math.hypot(dx, dy) < 5) return;
      if (!pan.moveu) { pan.moveu = true; atualizar((s) => { s.arrastando = true; }); }
      atualizar((s) => { s.cam = { z: s.cam.z, cx: pan.cx0 - dx / pan.esc, cy: pan.cy0 - dy / pan.esc }; });
      return;
    }
    const s = estadoAtual();
    const dq = g.dragQ;
    if (dq && e.pointerId === dq.pid) {
      if (!dq.ativo) {
        if (Math.hypot(e.clientX - dq.cx, e.clientY - dq.cy) < 5) return;
        const c = s.dados.comodos[dq.id];
        if (!c) { g.dragQ = null; return; }
        dq.ativo = true;
        setCongelado({ andar: c.andar, ox: dq.ox, oy: dq.oy, off: { ...layRef.current.off }, vb: layRef.current.vb, andares: layRef.current.andares });
        setJuntaQ(dq.id);
        atualizar((x) => { x.arrastando = true; x.selComodo = dq.id; x.comodo = dq.id; x.folha = false; });
      }
      const c = s.dados.comodos[dq.id]; if (!c) return;
      const p = ptSvg(e.clientX, e.clientY);
      let nx = p.x - dq.dx - dq.ox, ny = p.y - dq.dy - dq.oy;
      // o ímã puxa de uns 22 px da tela: perto de outro cômodo, as paredes "grudam"
      if (s.imaOn) { const o = imaComodo(c, nx, ny, comodosDoAndar(s.dados, c.andar).filter((x) => x.id !== c.id), Math.max(12, 22 / escalaTela())); nx = o.x; ny = o.y; }
      nx = Math.round(nx); ny = Math.round(ny);
      if (nx !== c.x || ny !== c.y) { dq.moveu = true; moverComodo(c.id, nx, ny); }
      return;
    }
    const de = g.dragEl;
    if (de && e.pointerId === de.pid) {
      if (!de.ativo) { if (Math.hypot(e.clientX - de.cx, e.clientY - de.cy) < 5) return; de.ativo = true; atualizar((x) => { x.arrastando = true; }); }
      const f = quadroDoItem(estadoAtual().dados, de.id, de.via, ptSvg(e.clientX, e.clientY)); if (!f) return;
      let a = Math.min(Math.max(0, f.u - de.du), f.L - f.w);
      if (s.imaOn) { if (a < 6) a = 0; if (f.L - f.w - a < 6) a = f.L - f.w; }
      a = Math.round(a);
      // pela parede do vizinho, a porta corre por ela inteira (se sair da parede dividida, passa a ser dele)
      if (a !== Math.round(f.a)) { de.moveu = true; salvarElVisto(de.id, f.pelaVia ? de.via : null, { inicio: a }); }
      return;
    }
    const d = g.drag; if (!d || e.pointerId !== d.pid) return;
    if (!d.ativo) { if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 5) return; d.ativo = true; atualizar((x) => { x.arrastando = true; }); }
    const m = s.dados.moveis[d.id]; if (!m) return;
    const p = ptSvg(e.clientX, e.clientY);
    let qid = m.comodo;
    const L = layRef.current;
    if (L.ids.length > 1) { // vendo vários cômodos, o móvel pode passar de um para o outro
      const dd = dims(m), cx = p.x - d.dx + dd.w / 2, cy = p.y - d.dy + dd.h / 2;
      for (const id of L.ids) { const o = offDe(id), b = s.dados.comodos[id]; if (b && cx >= o.x && cx <= o.x + b.w && cy >= o.y && cy <= o.y + b.h) { qid = id; break; } }
    }
    const q = s.dados.comodos[qid], l = localDe(qid, p);
    const sn = ima(q, m, l.x - d.dx, l.y - d.dy, moveisDo(s.dados, qid).filter((o) => o.id !== m.id), s.imaOn);
    const c = prender(q, m, sn.x, sn.y);
    if (c.x !== m.x || c.y !== m.y || qid !== m.comodo) {
      d.moveu = true;
      salvarMovel(m.id, { x: c.x, y: c.y, comodo: qid });
      if (qid !== s.comodo) atualizar((x) => { x.comodo = qid; });
    }
  }

  /** O item de parede no quadro em que ele é arrastado: pela parede do vizinho "via" (a porta inteira na parede que os
   *  dois dividem: é a mesma porta, medida de lá) ou pela do cômodo dela (com o ponto do dedo levado pela planta do
   *  andar, se ela foi pega pelo vizinho). "u" é o dedo ao longo da parede, "a" o começo do item, "w" a largura. */
  function quadroDoItem(d: Dados, eid: string, via: string | null, pt: Pt): { u: number; a: number; L: number; w: number; pelaVia: boolean } | null {
    const e = d.els[eid]; if (!e || !d.comodos[e.comodo]) return null;
    const vis = via && via !== e.comodo ? elVisto(d, eid, via) : null;
    if (vis && !vis.dono) { const gg = geoEl(vis.q, vis.e); return { u: uDaParede(vis.e.parede, localDe(vis.q.id, pt)), a: gg.a, L: gg.L, w: gg.b - gg.a, pelaVia: true }; }
    const q = d.comodos[e.comodo], gg = geoEl(q, e), viz = via && via !== e.comodo ? d.comodos[via] : null, lv = viz ? localDe(viz.id, pt) : null;
    const l = viz && lv ? { x: lv.x + viz.x - q.x, y: lv.y + viz.y - q.y } : localDe(q.id, pt);
    return { u: uDaParede(e.parede, l), a: gg.a, L: gg.L, w: gg.b - gg.a, pelaVia: false };
  }

  /** Ferramenta de parede: a parede mais perto do toque, no cômodo do lado em que o dedo caiu (a metade da espessura
   *  da parede de cada lado é do cômodo daquele lado). Longe de qualquer parede, null. */
  function paredeNoPonto(p: Pt): { qid: string; parede: Parede; u: number } | null {
    const s = estadoAtual(), L = layRef.current, lim = Math.max(45, 28 / escalaTela());
    let melhor: { qid: string; parede: Parede; u: number; fora: number } | null = null;
    for (const id of L.ids) {
      const c = s.dados.comodos[id], o = L.off[id]; if (!c || !o) continue;
      const l = { x: p.x - o.x, y: p.y - o.y };
      const fora = Math.hypot(Math.max(-l.x, 0, l.x - c.w), Math.max(-l.y, 0, l.y - c.h));
      if (fora > T + lim || (melhor && fora >= melhor.fora)) continue;
      const pp = paredePerto(c, l.x, l.y);
      if ((fora > 0 ? fora : pp.dist) > lim) continue;
      melhor = { qid: id, parede: pp.parede, u: pp.u, fora };
    }
    return melhor;
  }
  /** Põe a porta, a passagem ou a janela da ferramenta na parede tocada. */
  function colocarPeca(p: Pt) {
    const item = estadoAtual().desenho.item; if (!item) return;
    const w = paredeNoPonto(p);
    if (!w) { toast(tx('Toque em cima de uma parede (ou bem perto dela) para pôr ali.', 'Tap on a wall (or right next to it) to put it there.'), 'erro'); return; }
    const r = porNaParede(item, w.qid, w.parede, w.u);
    if ('erro' in r) { toast(r.erro, 'erro'); return; }
    const q = estadoAtual().dados.comodos[w.qid];
    toast(item === 'porta'
      ? tx(`${r.nome} em ${q.nome}, abrindo para dentro dele. A barra de baixo vira a porta; toque em outra parede para pôr mais.`, `${r.nome} added to ${q.nome}, opening into it. The bar at the bottom flips the door; tap another wall to add more.`)
      : item === 'correr'
      ? tx(`${r.nome} em ${q.nome}. A barra de baixo troca o lado para onde ela corre; toque em outra parede para pôr mais.`, `${r.nome} added to ${q.nome}. The bar at the bottom switches the side it slides to; tap another wall to add more.`)
      : tx(`${r.nome} em ${q.nome}. Arraste pela parede para ajustar; toque em outra parede para pôr mais.`, `${r.nome} added to ${q.nome}. Drag it along the wall to adjust; tap another wall to add more.`), '', 'desfazer');
  }

  // Toque sem arrastar: seleciona (a barra de ações aparece ao lado); dois toques seguidos editam.
  function toque(chave: string) {
    const agora = Date.now(), duplo = g.toque && g.toque.chave === chave && agora - g.toque.t < 400;
    clearTimeout(g.toqueT);
    if (duplo) { g.toque = null; editarItem(); return; }
    g.toque = { chave, t: agora };
  }
  function toqueVazio(pan: NonNullable<typeof g.pan>) {
    const s = estadoAtual();
    if (s.sel || s.selEl || s.selComodo) limparSel();
    if (!pan.qid) return;
    if (pan.tit) {
      const agora = Date.now(), duplo = g.toqueTit && g.toqueTit.qid === pan.qid && agora - g.toqueTit.t < 420;
      g.toqueTit = duplo ? null : { qid: pan.qid, t: agora };
      focarComodo(pan.qid, !!duplo);
      return;
    }
    // na planta da casa, tocar no piso seleciona o cômodo (aí dá para arrastar, esticar e girar)
    if (s.vista === 'casa' && !s.verCen) { selecionarComodo(pan.qid, false); return; }
    if (pan.qid !== s.comodo) focarComodo(pan.qid, false);
  }
  function toqueComodo(id: string) {
    // no modo de desenhar, tocar no cômodo só o seleciona (aparecem as alças); fora dele, dois toques abrem o cômodo
    if (estadoAtual().desenho.ativo) { selecionarComodo(id, false); return; }
    const agora = Date.now(), duplo = g.toqueTit && g.toqueTit.qid === id && agora - g.toqueTit.t < 420;
    g.toqueTit = duplo ? null : { qid: id, t: agora };
    if (duplo) { focarComodo(id, true); return; }
    selecionarComodo(id, false);
  }
  function fim(e: RPointerEvent<SVGSVGElement>, cancelou: boolean) {
    g.ptrs.delete(e.pointerId);
    if (estadoAtual().arrastando) atualizar((s) => { s.arrastando = false; });
    if (g.pinca) { if (g.ptrs.size < 2) g.pinca = null; return; }
    if (g.lp && e.pointerId === g.lp.pid) cancelarLongo();
    const solta = (pid: number) => { try { svgRef.current?.releasePointerCapture(pid); } catch { /* ok */ } };
    const tr = g.trena;
    if (tr && e.pointerId === tr.pid) {
      g.trena = null; solta(tr.pid);
      // um toque sem arrastar apaga a medida
      if (cancelou || Math.hypot(e.clientX - tr.cx, e.clientY - tr.cy) < 4) setTrena(null);
      return;
    }
    const rc = g.risco;
    if (rc && e.pointerId === rc.pid) {
      g.risco = null; solta(rc.pid);
      const r = rc.r || null; setRisco(null);
      if (cancelou || !r || r.w < 30 || r.h < 30) return;
      const tipo = estadoAtual().desenho.tipo;
      const novo = desenharComodo({ andar: rc.andar, x: r.x, y: r.y, w: r.w, h: r.h, tipo });
      manterVista(novo.id, rc.ox, rc.oy);
      const med = `${fmtM(Math.max(60, r.w))} × ${fmtM(Math.max(60, r.h))} m`, lig = novo.ligados.length ? tx(` Ligado a ${novo.ligados.join(', ')}.`, ` Connected to ${novo.ligados.join(', ')}.`) : '';
      toast(tx(`${novo.nome} desenhado (${med}).${lig} Desenhe o próximo ou toque em Pronto.`, `${novo.nome} drawn (${med}).${lig} Draw the next one or tap Done.`));
      return;
    }
    const es = g.estica;
    if (es && e.pointerId === es.pid) {
      g.estica = null; solta(es.pid);
      avisarLigacoes(es.id, fimEsticar(es.id));
      setCongelado(null); setJuntaQ(null);
      if (es.moveu) manterVista(es.id, es.ox, es.oy);
      return;
    }
    const pan = g.pan;
    if (pan && e.pointerId === pan.pid) {
      g.pan = null; solta(pan.pid);
      if (!pan.moveu && !cancelou) { if (pan.por) colocarPeca(pan.por); else if (!pan.so) toqueVazio(pan); }
      return;
    }
    const dq = g.dragQ;
    if (dq && e.pointerId === dq.pid) {
      g.dragQ = null; solta(dq.pid); setJuntaQ(null);
      if (dq.moveu) {
        // encostou em outro cômodo? A porta (ou passagem) entra sozinha
        avisarLigacoes(dq.id, conectarComodo(dq.id));
        // a planta volta a se ajustar; a câmera acompanha para o cômodo não "pular"
        const antes = offDe(dq.id);
        setCongelado(null);
        requestAnimationFrame(() => {
          const depois = layRef.current.off[dq.id];
          const sc = estadoAtual();
          if (depois && sc.cam.cx != null && sc.cam.cy != null) atualizar((x) => { x.cam = { z: x.cam.z, cx: (x.cam.cx as number) + depois.x - antes.x, cy: (x.cam.cy as number) + depois.y - antes.y }; });
        });
      } else {
        if (dq.ativo || cancelou) setCongelado(null);
        if (!cancelou && !dq.ativo) toqueComodo(dq.id);
      }
      return;
    }
    const de = g.dragEl;
    if (de && e.pointerId === de.pid) { g.dragEl = null; solta(de.pid); if (!de.moveu && !cancelou) toque(de.id); return; }
    const d = g.drag;
    if (d && e.pointerId === d.pid) { g.drag = null; solta(d.pid); if (!d.moveu && !cancelou) toque(d.id); }
  }

  // roda do mouse: zoom no ponto; botão direito / tecla de menu: opções
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const roda = (e: WheelEvent) => {
      if (!Object.keys(estadoAtual().dados.comodos).length) return;
      e.preventDefault();
      const p = ptSvg(e.clientX, e.clientY), f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
      zoomEm(f, p.x, p.y);
    };
    svg.addEventListener('wheel', roda, { passive: false });
    return () => svg.removeEventListener('wheel', roda);
  });

  function onContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    cancelarLongo();
    if (Date.now() - g.menuToque < 900) return; // o dedo segurado já abriu
    let x = e.clientX, y = e.clientY;
    const el = (e.target as Element).closest ? (e.target as Element).closest(ALVOS) : null, teclado = !x && !y;
    if (teclado && el) { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    for (const d of [g.drag, g.dragEl, g.dragQ, g.pan]) if (d && !d.moveu) { try { svgRef.current?.releasePointerCapture(d.pid); } catch { /* ok */ } }
    if (g.drag && !g.drag.moveu) g.drag = null;
    if (g.dragEl && !g.dragEl.moveu) g.dragEl = null;
    if (g.dragQ && !g.dragQ.moveu) { g.dragQ = null; setCongelado(null); }
    if (g.pan && !g.pan.moveu) g.pan = null;
    abrirMenuNaPlanta(x, y, teclado && el ? alvoDoEl(el) : infoAlvo(e.target, x, y), teclado);
  }
  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as Element, gEl = t.closest ? t.closest(ALVOS) : null, s = estadoAtual();
    if (s.verCen) return;
    if (!gEl) {
      const tit = t.closest ? t.closest('[data-qt]') : null;
      if (tit) { e.preventDefault(); selecionarComodo(tit.getAttribute('data-qt')!, true); }
      return;
    }
    e.preventDefault();
    const a = alvoDoEl(gEl);
    selecionar(a.id ? { id: a.id } : { eid: a.eid }, { abrir: s.modo === 'simples' && !s.desenho.ativo, via: a.via });
    if (s.modo === 'simples') setTimeout(() => (document.querySelector('#folha-in button') as HTMLElement | null)?.focus({ preventScroll: true }), 30);
  }

  // distâncias entre o cômodo selecionado e os vizinhos (planta da casa)
  const espacosSel = useMemo(() => {
    if (vista !== 'casa' || !selComodo) return null;
    const c = dados.comodos[selComodo]; if (!c) return null;
    const o = lay.off[selComodo]; if (!o) return null;
    return { ox: o.x - c.x, oy: o.y - c.y, es: espacos(c, comodosDoAndar(dados, c.andar).filter((x) => x.id !== c.id)) };
  }, [vista, selComodo, dados, lay]);

  // alças, botões e o retângulo do desenho têm tamanho fixo na tela: "upx" é quanto vale um pixel no desenho
  const upx = Math.max(vb[2] / Math.max(1, tela.w), vb[3] / Math.max(1, tela.h));
  const f3 = (v: number) => Math.round(v * 1000) / 1000;
  const origem = (() => {
    const ref = comodo && lay.off[comodo] ? comodo : lay.ids[0], c = ref ? dados.comodos[ref] : null;
    return c && ref && lay.off[ref] ? { x: lay.off[ref].x - c.x, y: lay.off[ref].y - c.y } : { x: 0, y: 0 };
  })();
  const alcas = (() => {
    if (vista !== 'casa' || !selComodo || verCen || medir) return null;
    const c = dados.comodos[selComodo], o = lay.off[selComodo];
    if (!c || !o) return null;
    const th = Math.max(T, 14 * upx), lh = Math.min(c.h * 0.6, 48 * upx), lw = Math.min(c.w * 0.6, 48 * upx);
    const al: Record<Borda, [number, number, number, number]> = {
      esq: [o.x - T / 2 - th / 2, o.y + c.h / 2 - lh / 2, th, lh], dir: [o.x + c.w + T / 2 - th / 2, o.y + c.h / 2 - lh / 2, th, lh],
      cima: [o.x + c.w / 2 - lw / 2, o.y - T / 2 - th / 2, lw, th], baixo: [o.x + c.w / 2 - lw / 2, o.y + c.h + T / 2 - th / 2, lw, th]
    };
    const nomeBorda: Record<Borda, string> = { esq: tx('da esquerda', 'left'), dir: tx('da direita', 'right'), cima: tx('de cima', 'top'), baixo: tx('de baixo', 'bottom') };
    return (
      <g className="alcas">
        {BORDAS.map((b) => <rect key={b} className={`alca alca-${b}`} data-alca={b} x={n1(al[b][0])} y={n1(al[b][1])} width={f3(al[b][2])} height={f3(al[b][3])} rx={f3(Math.min(al[b][2], al[b][3]) / 2)}
          role="button" aria-label={tx(`Arraste para esticar a parede ${nomeBorda[b]} de ${c.nome}`, `Drag to stretch the ${nomeBorda[b]} wall of ${c.nome}`)} />)}
      </g>
    );
  })();
  // botões nas paredes que o cômodo selecionado divide com os vizinhos: tesoura tira a parede, tijolos põem de volta
  const paredeBtns = (() => {
    if (vista !== 'casa' || !selComodo || verCen || arrastando || medir) return null;
    const c = dados.comodos[selComodo], o = lay.off[selComodo];
    if (!c || !o) return null;
    const vs = vizinhosDeParede(dados, selComodo), qc = cq(dados, selComodo);
    if (!vs.length || !qc) return null;
    const r = 12 * upx;
    return (
      <g className="paredes-btns" transform={`translate(${n1(o.x)} ${n1(o.y)})`}>
        {vs.map((v) => {
          const hz = horizontal(v.parede), L = hz ? c.w : c.h, al = Math.min((hz ? c.w : c.h) * 0.6, 48 * upx) / 2;
          // o botão fica no trecho dividido, longe da alça de esticar (no meio da parede) e das portas;
          // se não sobrar lugar na parede, ele entra um pouco no cômodo
          const ocupado: [number, number][] = [[L / 2 - al - r - 4 * upx, L / 2 + al + r + 4 * upx]];
          for (const p of qc.portas) if (p.parede === v.parede && !p.semParede) { const g = geoEl(qc, p); ocupado.push([g.a - r, g.b + r]); }
          const livre = (u: number) => u >= v.u1 + r * 0.6 && u <= v.u2 - r * 0.6 && !ocupado.some(([a, b]) => u > a && u < b);
          const meio = (v.u1 + v.u2) / 2;
          let u = meio, dv = 0;
          if (!livre(meio)) {
            let achou = false;
            for (let d = 5; d <= (v.u2 - v.u1) / 2 && !achou; d += 5) { if (livre(meio + d)) { u = meio + d; achou = true; } else if (livre(meio - d)) { u = meio - d; achou = true; } }
            if (!achou) dv = T / 2 + r + 8 * upx;
          }
          const pt = naParede(c, v.parede, u, dv);
          const rot = v.tirada ? tx(`Pôr de volta a parede entre ${c.nome} e ${v.viz.nome}`, `Put back the wall between ${c.nome} and ${v.viz.nome}`) : tx(`Tirar a parede entre ${c.nome} e ${v.viz.nome}`, `Remove the wall between ${c.nome} and ${v.viz.nome}`);
          return (
            <g key={v.viz.id} className={`parede-btn${v.tirada ? ' tirada' : ''}`} data-parede-viz={v.viz.id} role="button" aria-label={rot} transform={`translate(${n1(pt.x)} ${n1(pt.y)})`}>
              <title>{rot}</title>
              <circle r={f3(r)} />
              <g transform={`scale(${f3(r / 15)}) translate(-12 -12)`}>{v.tirada ? <path d="M3 7h18v10H3zM3 12h18M9 7v5M15 12v5" /> : <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.1 8.1 20 20M8.1 15.9 20 4" /></>}</g>
            </g>
          );
        })}
      </g>
    );
  })();
  // enquanto arrasta ou estica: as paredes que o cômodo já divide com os vizinhos acendem
  const juntas = (() => {
    if (!juntaQ || vista !== 'casa') return null;
    const c = dados.comodos[juntaQ], o = lay.off[juntaQ];
    if (!c || !o) return null;
    return (
      <g className="juntas" aria-hidden="true" transform={`translate(${n1(o.x)} ${n1(o.y)})`}>
        {vizinhosDeParede(dados, juntaQ).map((v) => { const a = naParede(c, v.parede, v.u1), b = naParede(c, v.parede, v.u2); return <line key={v.viz.id} className="junta" x1={n1(a.x)} y1={n1(a.y)} x2={n1(b.x)} y2={n1(b.y)} strokeWidth={T} />; })}
      </g>
    );
  })();
  const trenaG = (() => {
    if (!trena) return null;
    const { a, b } = trena, dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
    if (dist < 1) return <circle className="trena-p" cx={n1(a.x)} cy={n1(a.y)} r={f3(4 * upx)} />;
    const nx = -dy / dist, ny = dx / dist, tk = 7 * upx, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const txt = `${fmtM(dist)} m`, fs = 13 * upx, pw = txt.length * 7.2 * upx + 16 * upx, ph = 22 * upx;
    const diag = Math.abs(dx) >= 1 && Math.abs(dy) >= 1;
    return (
      <g className="trena-g" aria-hidden="true">
        <line className="trena-l" x1={n1(a.x)} y1={n1(a.y)} x2={n1(b.x)} y2={n1(b.y)} />
        <line className="trena-l" x1={n1(a.x - nx * tk)} y1={n1(a.y - ny * tk)} x2={n1(a.x + nx * tk)} y2={n1(a.y + ny * tk)} />
        <line className="trena-l" x1={n1(b.x - nx * tk)} y1={n1(b.y - ny * tk)} x2={n1(b.x + nx * tk)} y2={n1(b.y + ny * tk)} />
        <g transform={`translate(${n1(mx)} ${n1(my)})`}>
          <rect className="trena-pill" x={f3(-pw / 2)} y={f3(-ph / 2)} width={f3(pw)} height={f3(ph)} rx={f3(ph / 2)} />
          <text className="trena-t" fontSize={f3(fs)} textAnchor="middle" dy=".36em">{txt}</text>
          {diag && <text className="trena-sub" y={f3(ph * 0.95)} fontSize={f3(fs * 0.82)} textAnchor="middle" dy=".36em">↔ {fmtM(Math.abs(dx))} · ↕ {fmtM(Math.abs(dy))}</text>}
        </g>
      </g>
    );
  })();
  // portas atrapalhadas em qualquer cômodo visível: a porta é dos dois lados da parede
  const bloqueadas = useMemo(() => {
    const b = new Set<string>();
    for (const id of lay.ids) { const av = avaliacao(dados, verCen, id); if (av) for (const x of av.portasBloq) b.add(x); }
    return b;
  }, [dados, verCen, lay.ids]);
  // a barra de ações fica ao lado do que está selecionado: a caixa dele, em pixels da tela da planta
  const docada = !!(desenho.ativo && doca && doca.isConnected);
  const alvoTela = ((): AlvoTela | null => {
    if (verCen || arrastando || medir || risco || trena || folha) return null;
    const sc = Math.min(tela.w / vb[2], tela.h / vb[3]) || 1, ox = (tela.w - vb[2] * sc) / 2, oy = (tela.h - vb[3] * sc) / 2;
    const caixa = (x1: number, y1: number, x2: number, y2: number) => ({ x1: ox + (x1 - vb[0]) * sc, y1: oy + (y1 - vb[1]) * sc, x2: ox + (x2 - vb[0]) * sc, y2: oy + (y2 - vb[1]) * sc });
    let a: AlvoTela | null = null;
    if (sel) {
      const m = dados.moveis[sel], o = m ? lay.off[m.comodo] : null;
      if (m && o) { const r = ret(m); a = { tipo: 'movel', id: sel, ...caixa(o.x + r.x1, o.y + r.y1, o.x + r.x2, o.y + r.y2) }; }
    } else if (selEl) {
      // o cômodo onde o item está desenhado: o dele, ou o vizinho que mostra a porta (vendo só ele)
      const e0 = dados.els[selEl], qid = e0 ? (lay.off[e0.comodo] ? e0.comodo : comodo && lay.off[comodo] ? comodo : null) : null;
      const q = qid ? cq(dados, qid) : null, p = q ? q.els.find((x) => x.id === selEl) : null;
      if (qid && q && p) {
        const o = lay.off[qid], gg = geoEl(q, p), ext = p.tipo === 'porta' && temGiro(p) ? Math.max(...folhasPorta(q, p).map((f) => f.r)) : 24;
        const pa = uv2xy(q, p.parede, gg.a, -Math.max(T, ext)), pb = uv2xy(q, p.parede, gg.b, ext);
        a = { tipo: 'el', id: selEl, ...caixa(o.x + Math.min(pa[0], pb[0]), o.y + Math.min(pa[1], pb[1]), o.x + Math.max(pa[0], pb[0]), o.y + Math.max(pa[1], pb[1])) };
      }
    } else if (selComodo && vista === 'casa') {
      const c = dados.comodos[selComodo], o = lay.off[selComodo];
      if (c && o) a = { tipo: 'comodo', id: selComodo, ...caixa(o.x - T, o.y - T, o.x + c.w + T, o.y + c.h + T) };
    }
    // fora da tela, sem barra (a do painel de baixo continua)
    return a && (docada || (a.x2 > 0 && a.x1 < tela.w && a.y2 > 0 && a.y1 < tela.h)) ? a : null;
  })();
  const girarQ = (id: string) => { const a0 = andarDe(id); avisarLigacoes(id, girarComodo(id)); manterVista(id, a0.x, a0.y); };
  const barra = alvoTela && <BarraContexto alvo={alvoTela} tela={tela} girarComodo={girarQ} docada={docada} />;

  // camadas escondidas (móveis, portas e janelas, ar, pontos, nomes, grade) viram classes da planta
  const semCamadas = (Object.keys(camadas) as (keyof typeof camadas)[]).filter((k) => !camadas[k]).map((k) => ' sem-' + k).join('');
  // nomes de portas, janelas e pontos: um pouco maiores quando a planta está longe, para dar para ler
  const kRot = Math.min(1.6, Math.max(1, (7.5 * upx) / 8.5));
  const b0 = ids.length ? dados.comodos[ids[0]] : null;
  const rotulo = !b0 ? tx('Planta vazia', 'Empty floor plan') : vista === 'casa' ? tx('Planta da casa', 'Home floor plan') : ids.length > 1 ? tx('Todos os cômodos lado a lado', 'All rooms side by side') : tx(`Planta de ${b0.nome}, ${fmtM(b0.w)} por ${fmtM(b0.h)} metros`, `Floor plan of ${b0.nome}, ${fmtM(b0.w)} by ${fmtM(b0.h)} meters`);
  return (<>
    <svg id="planta" ref={svgRef} xmlns="http://www.w3.org/2000/svg" role="group" aria-label={rotulo} viewBox={vb.map(n1).join(' ')}
      className={`${arrastando ? 'arrastando' : ''} vista-${vista}${desenho.ativo ? ' desenhando' : ''}${desenho.ativo && desenho.item ? ' ferr-parede' : ''}${medir ? ' medindo' : ''}${semCamadas}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={(e) => fim(e, false)} onPointerCancel={(e) => fim(e, true)}
      onLostPointerCapture={(e) => { if (g.ptrs.has(e.pointerId) && !g.drag && !g.dragEl && !g.dragQ && !g.pan) g.ptrs.delete(e.pointerId); }}
      onContextMenu={onContextMenu} onKeyDown={onKeyDown}>
      <defs>
        <DefsPlanta />
        <pattern id="hach" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect className="hach-bg" width="6" height="6" /><line className="hach-l" x1="0" y1="0" x2="0" y2="6" /></pattern>
        {desenho.ativo && <pattern id="grade-desenho" patternUnits="userSpaceOnUse" width="100" height="100" patternTransform={`translate(${n1(origem.x)} ${n1(origem.y)})`}><path className="gd-m" d="M50 0V100M0 50H100" /><path className="gd-g" d="M100 0H0V100" /></pattern>}
      </defs>
      {desenho.ativo && <rect className="grade-desenho" x={n1(vb[0])} y={n1(vb[1])} width={n1(vb[2])} height={n1(vb[3])} fill="url(#grade-desenho)" />}
      {lay.andares.map((a) => (
        <g key={a.id} className="andar" aria-hidden="true">
          <text className="andar-t" x={a.x} y={a.ty}>{a.nome}<tspan className="andar-area" dx={10}>{fmtArea(areaDoAndar(dados, a.id))}</tspan></text>
        </g>
      ))}
      {lay.ids.map((id) => {
        const q = cq(dados, id), av = avaliacao(dados, verCen, id); if (!q || !av) return null;
        const o = lay.off[id] || { x: 0, y: 0 };
        return (
          <g key={id} className={`sala${selComodo === id ? ' sel-q' : ''}`} data-q={id} transform={`translate(${n1(o.x)} ${n1(o.y)})`}>
            <Sala q={q} lista={listaAtiva(dados, verCen, id)} av={av} sel={sel} selEl={selEl} foco={id === comodo && ids.length > 1} vista={vista as Vista}
              ty={lay.ex[id]?.ty ?? null} setasTodos={modo === 'avancado' && setasTodos} selComodo={selComodo === id} bloqueadas={bloqueadas} />
          </g>
        );
      })}
      {/* planta da casa: as portas que abrem para o vizinho ficam por cima do piso dele */}
      {vista === 'casa' && lay.ids.map((id) => {
        const q = cq(dados, id); if (!q) return null;
        const o = lay.off[id] || { x: 0, y: 0 };
        return <g key={'pc' + id} transform={`translate(${n1(o.x)} ${n1(o.y)})`}><PortasPorCima q={q} selEl={selEl} bloqueadas={bloqueadas} /></g>;
      })}
      {/* nomes de portas, janelas e pontos por cima de tudo (móveis e cômodos vizinhos) */}
      {lay.ids.map((id) => {
        const q = cq(dados, id); if (!q) return null;
        const o = lay.off[id] || { x: 0, y: 0 };
        return <g key={'r' + id} transform={`translate(${n1(o.x)} ${n1(o.y)})`}><RotulosSala q={q} vista={vista as Vista} k={kRot} /></g>;
      })}
      {juntas}
      {alcas}
      {paredeBtns}
      {risco && risco.w > 0 && risco.h > 0 && (
        <g className="risco-g" aria-hidden="true">
          <rect className="risco-parede" x={n1(risco.ox + risco.x - T)} y={n1(risco.oy + risco.y - T)} width={n1(risco.w + 2 * T)} height={n1(risco.h + 2 * T)} />
          <rect className="risco" x={n1(risco.ox + risco.x)} y={n1(risco.oy + risco.y)} width={n1(risco.w)} height={n1(risco.h)} />
          <text className="risco-t" x={n1(risco.ox + risco.x + risco.w / 2)} y={n1(risco.oy + risco.y + risco.h / 2)} fontSize={f3(14 * upx)} textAnchor="middle" dy=".35em">{COMODO_NOME[desenho.tipo]} · {fmtM(risco.w)} × {fmtM(risco.h)}</text>
        </g>
      )}
      {espacosSel && (
        <g transform={`translate(${n1(espacosSel.ox)} ${n1(espacosSel.oy)})`}>
          {espacosSel.es.map((e) => <Seta key={e.lado} f={{ gap: e.gap, eixo: e.eixo, de: e.de, ate: e.ate, em: e.em }} rotulo={`${fmtM(e.gap)} m`} />)}
        </g>
      )}
      {trenaG}
    </svg>
    {barra && (docada ? createPortal(barra, doca!) : barra)}
    </>
  );
}

