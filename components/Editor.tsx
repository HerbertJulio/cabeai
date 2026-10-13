'use client';
// A casca do app: carrega e salva no navegador, atalhos de teclado e a montagem da tela.
import { Fragment, useEffect, useRef } from 'react';
import { horizontal } from '@/lib/catalogo';
import { alvoSel } from '@/lib/consultas';
import { CHAVE, lerArquivo, lerSalvo, normalizarDados, paraSalvar } from '@/lib/dados';
import { CHAVE_PONTOS } from '@/lib/historico';
import { geoEl, prender } from '@/lib/geometria';
import { ehIdioma, idiomaDoNavegador, tx } from '@/lib/i18n';
import {
  CAMADAS_TODAS, abrirDialogo, desfazerDoAviso, aplicarIdioma, aplicarTema, atualizar, avisarLigacoes, carregarPontos, colar, conectarComodo, copiar, desfazer, duplicar, duplicarComodo, enquadrar, estadoAtual, estreito, ferramentaDesenho,
  liberarEspaco,
  cancelarCorte, fecharMenu, garantirComodo, girar, girarComodo, limparSel, modoDesenho, modoMedir, moverComodo, moverCorte, pedirRemover, pontoAutomatico, pontoPeriodico, porParede, refazer, salvarEl, salvarMovel, selecionar,
  temCopia, toast, useApp, zoomEm, type Camadas, type Estado, type Tema
} from '@/lib/store';
import type { Modo, Vista } from '@/lib/tipos';
import Dialogo from './Dialogo';
import Faixa from './Faixa';
import Folha from './Folha';
import Inspetor from './Inspetor';
import Lateral from './Lateral';
import Menu from './Menu';
import Passos from './Passos';
import Planta from './Planta';
import { Avisos, BarraDesenho, Botoes, Controles, Vazio } from './Sobre';
import Topo from './Topo';

const PREFS = 'cabeai:prefs';
type Prefs = Pick<Estado, 'modo' | 'vista' | 'lateral' | 'inspetor' | 'setasTodos' | 'imaOn' | 'comodo' | 'idioma' | 'cenBase' | 'camadas' | 'tema'>;
const ehTema = (v: unknown): v is Tema => v === 'auto' || v === 'claro' || v === 'escuro';

function Toast() {
  const t = useApp((s) => s.toast);
  useApp((s) => s.hist.v); // um passo novo depois do aviso tira o botão de desfazer
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => atualizar((s) => { if (s.toast && s.toast.n === t.n) s.toast = null; }), t.tipo === 'erro' || t.acao ? 6500 : 3400);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <div className={`toast${t.tipo === 'erro' ? ' erro' : ''}${t.acao ? ' com-acao' : ''}`} id="toast" role="status" aria-live="polite">
      <span>{t.msg}</span>
      {t.acao === 'desfazer' && desfazerDoAviso(t.marca) && <button type="button" className="toast-acao" data-acao="toast-desfazer" onClick={() => { atualizar((s) => { s.toast = null; }); if (desfazerDoAviso(t.marca)) desfazer(); }}>{tx('Desfazer', 'Undo')}</button>}
    </div>
  );
}

export default function Editor() {
  const carregado = useApp((s) => s.carregado);
  const modo = useApp((s) => s.modo);
  const vista = useApp((s) => s.vista);
  const lateral = useApp((s) => s.lateral);
  const latAberta = useApp((s) => s.latAberta);
  const est = useApp((s) => s.estreito);
  const lingua = useApp((s) => s.idioma);
  const desenhando = useApp((s) => s.desenho.ativo);
  const passos = useApp((s) => s.passo.ativo);
  const arquivo = useRef<HTMLInputElement>(null);

  // abrir: dados salvos neste navegador e as preferências
  useEffect(() => {
    let bruto: string | null = null, persistente = true, prefs: Partial<Prefs> = {};
    try { bruto = localStorage.getItem(CHAVE); } catch { persistente = false; }
    try { localStorage.setItem(CHAVE + ':teste', '1'); localStorage.removeItem(CHAVE + ':teste'); } catch { persistente = false; }
    try { prefs = JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch { prefs = {}; }
    const dados = lerSalvo(bruto);
    const lingua = ehIdioma(prefs.idioma) ? prefs.idioma : idiomaDoNavegador();
    aplicarIdioma(lingua);
    const tema: Tema = ehTema(prefs.tema) ? prefs.tema : 'auto';
    aplicarTema(tema);
    atualizar((s) => {
      if (dados) s.dados = dados;
      s.idioma = lingua; s.tema = tema;
      if (typeof prefs.cenBase === 'string' && s.dados.cenarios[prefs.cenBase]) s.cenBase = prefs.cenBase;
      s.carregado = true; s.persistente = persistente; s.estreito = estreito();
      if (prefs.modo === 'simples' || prefs.modo === 'avancado') s.modo = prefs.modo as Modo;
      if (prefs.vista === 'um' || prefs.vista === 'lado' || prefs.vista === 'casa') s.vista = prefs.vista as Vista;
      if (typeof prefs.lateral === 'boolean') s.lateral = prefs.lateral;
      if (typeof prefs.inspetor === 'boolean') s.inspetor = prefs.inspetor;
      if (typeof prefs.setasTodos === 'boolean') s.setasTodos = prefs.setasTodos;
      if (typeof prefs.imaOn === 'boolean') s.imaOn = prefs.imaOn;
      if (typeof prefs.comodo === 'string') s.comodo = prefs.comodo;
      if (prefs.camadas && typeof prefs.camadas === 'object') for (const k of Object.keys(CAMADAS_TODAS) as (keyof Camadas)[]) { const v = (prefs.camadas as Partial<Camadas>)[k]; if (typeof v === 'boolean') s.camadas[k] = v; }
    });
    garantirComodo();
    // pontos de restauração: os que estavam guardados, mais um da casa como ela abriu
    carregarPontos();
    pontoAutomatico(tx('Ao abrir o Cabeaí', 'When Cabeaí was opened'));
    const periodico = window.setInterval(pontoPeriodico, 60_000);
    return () => clearInterval(periodico);
  }, []);

  // salvar: um instante depois de cada mudança
  useEffect(() => {
    let t = 0;
    const un = useApp.subscribe((s, p) => {
      if (!s.carregado) return;
      if (s.dados !== p.dados) {
        clearTimeout(t);
        t = window.setTimeout(() => {
          const st = estadoAtual();
          if (!st.persistente) return;
          const gravar = (): boolean => { try { localStorage.setItem(CHAVE, paraSalvar(estadoAtual().dados)); return true; } catch { return false; } };
          // memória cheia: os pontos de restauração mais velhos saem (os automáticos primeiro) até a casa caber
          let ok = gravar();
          while (!ok && liberarEspaco()) ok = gravar();
          if (ok) { if (estadoAtual().erroDb) atualizar((x) => { x.erroDb = ''; }); }
          else atualizar((x) => { x.persistente = false; x.erroDb = tx('O navegador não deixou salvar (memória cheia ou bloqueada). Use "Exportar" para guardar um arquivo.', 'The browser couldn’t save (storage full or blocked). Use "Export" to keep a file.'); });
        }, 350);
      }
      if (s.modo !== p.modo || s.vista !== p.vista || s.lateral !== p.lateral || s.inspetor !== p.inspetor || s.setasTodos !== p.setasTodos || s.imaOn !== p.imaOn || s.comodo !== p.comodo || s.idioma !== p.idioma || s.cenBase !== p.cenBase || s.camadas !== p.camadas || s.tema !== p.tema) {
        const prefs: Prefs = { modo: s.modo, vista: s.vista, lateral: s.lateral, inspetor: s.inspetor, setasTodos: s.setasTodos, imaOn: s.imaOn, comodo: s.comodo, idioma: s.idioma, cenBase: s.cenBase, camadas: s.camadas, tema: s.tema };
        try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* sem armazenamento */ }
      }
    });
    const outraAba = (e: StorageEvent) => {
      if (e.key === CHAVE_PONTOS) { carregarPontos(); return; }
      if (e.key !== CHAVE || !e.newValue) return;
      try { const o = JSON.parse(e.newValue); if (o && o.dados) { atualizar((s) => { s.dados = normalizarDados(o.dados); }); garantirComodo(); } } catch { /* ignora */ }
      return;
    };
    window.addEventListener('storage', outraAba);
    return () => { un(); clearTimeout(t); window.removeEventListener('storage', outraAba); };
  }, []);

  // tela estreita (celular)
  useEffect(() => {
    let t = 0;
    const rz = () => { clearTimeout(t); t = window.setTimeout(() => { const e = estreito(); atualizar((s) => { s.estreito = e; if (!e) s.latAberta = false; }); }, 120); };
    window.addEventListener('resize', rz);
    return () => { window.removeEventListener('resize', rz); clearTimeout(t); };
  }, []);

  // teclado
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const s = estadoAtual();
      if (e.key === 'Escape') {
        if (s.menu) { e.preventDefault(); fecharMenu(); return; }
        if (s.dlg) return;
        if (s.corte) { cancelarCorte(); return; }
        if (s.medir) { modoMedir(false); return; }
        // no passo a passo, o Esc só tira a seleção (a etapa decide a ferramenta)
        if (s.passo.ativo) { if (s.sel || s.selEl || s.selComodo) limparSel(); return; }
        // desenhando: tira a seleção, depois larga a ferramenta de porta ou janela, depois sai do modo
        if (s.desenho.ativo) { if (s.sel || s.selEl || s.selComodo) limparSel(); else if (s.desenho.item) ferramentaDesenho(null); else modoDesenho(false); return; }
        if (s.latAberta) { atualizar((x) => { x.latAberta = false; }); return; }
        if (s.folha) atualizar((x) => { x.folha = false; x.folhaModo = 'acoes'; });
        else if (s.sel || s.selEl || s.selComodo) limparSel();
        else if (s.verCen) atualizar((x) => { x.verCen = null; });
        else if (s.avisosAbertos) atualizar((x) => { x.avisosAbertos = false; });
        return;
      }
      const alvoEl = e.target as Element | null;
      if (s.dlg || (alvoEl && alvoEl.closest && alvoEl.closest('#menu'))) return;
      const tag = (alvoEl && (alvoEl as HTMLElement).tagName || '').toLowerCase();
      const campo = tag === 'input' || tag === 'textarea' || tag === 'select' || !!(alvoEl && (alvoEl as HTMLElement).isContentEditable);
      // desfazer, refazer, copiar e colar valem até com o foco num botão (nos campos de texto, o navegador cuida)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !campo) {
        const k = e.key.toLowerCase(), textoMarcado = !!(window.getSelection && String(window.getSelection() || ''));
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); return; }
        if (k === 'y') { e.preventDefault(); refazer(); return; }
        if (k === 'c' && !textoMarcado && alvoSel(s.dados, s.sel, s.selEl)) { e.preventDefault(); copiar(); return; }
        if (k === 'v' && temCopia()) { e.preventDefault(); colar(); return; }
      }
      if (campo || tag === 'button') return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '?') { e.preventDefault(); abrirDialogo('ajuda'); return; }
        if ((e.key === 'm' || e.key === 'M') && Object.keys(s.dados.comodos).length) { e.preventDefault(); modoMedir(!s.medir); return; }
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomEm(1.25); return; }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomEm(0.8); return; }
        if (e.key === '0') { e.preventDefault(); enquadrar(); return; }
      }
      if (s.verCen) return;
      const gFoco = alvoEl && alvoEl.closest ? alvoEl.closest('.mv, .jan, .arel, .porta-el, .interr-el') : null;
      if (gFoco && /^(Arrow|Delete$|Backspace$|r$|R$|d$|D$)/.test(e.key)) {
        const a = gFoco.hasAttribute('data-eid') ? { eid: gFoco.getAttribute('data-eid')! } : { id: gFoco.getAttribute('data-id')! };
        if (a.id ? s.sel !== a.id : s.selEl !== a.eid) selecionar(a, { painel: false, via: gFoco.getAttribute('data-via') || undefined });
      }
      const s2 = estadoAtual(), item = alvoSel(s2.dados, s2.sel, s2.selEl), qSel = !item && s2.selComodo && s2.dados.comodos[s2.selComodo] ? s2.selComodo : null;
      // (o corte da parede não se remove: a parede volta)
      const elSel = s2.selEl ? s2.dados.els[s2.selEl] : null;
      if ((e.key === 'Delete' || e.key === 'Backspace') && elSel?.semParede && elSel.liga) { e.preventDefault(); porParede(elSel.comodo, elSel.liga); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && item) { e.preventDefault(); pedirRemover(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && qSel) { e.preventDefault(); abrirDialogo('remover-comodo', { id: qSel }); return; }
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && item) { e.preventDefault(); duplicar(); return; }
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && qSel) {
        e.preventDefault();
        const nid = duplicarComodo(qSel), n = nid ? estadoAtual().dados.comodos[nid] : null;
        if (n) toast(tx(`${n.nome} criado ao lado, com tudo o que tinha dentro.`, `${n.nome} created next to it, with everything inside.`), '', 'desfazer');
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const passo = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -passo; else if (e.key === 'ArrowRight') dx = passo; else if (e.key === 'ArrowUp') dy = -passo; else if (e.key === 'ArrowDown') dy = passo;
      if (s2.selEl) {
        const el = s2.dados.els[s2.selEl]; if (!el || (!dx && !dy)) return;
        const h = horizontal(el.parede), dd = h ? dx : dy; if (!dd) return;
        e.preventDefault();
        const g = geoEl(s2.dados.comodos[el.comodo], el);
        if (el.semParede) moverCorte(el.id, g.a + dd);
        else salvarEl(el.id, { inicio: Math.round(Math.min(Math.max(0, g.a + dd), g.L - (g.b - g.a))) });
        return;
      }
      if (s2.sel) {
        const m = s2.dados.moveis[s2.sel]; if (!m) return;
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); girar(); return; }
        if (!dx && !dy) return;
        e.preventDefault();
        const c = prender(s2.dados.comodos[m.comodo], m, m.x + dx, m.y + dy);
        salvarMovel(m.id, { x: c.x, y: c.y });
        return;
      }
      if (s2.selComodo && s2.vista === 'casa' && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); avisarLigacoes(s2.selComodo, girarComodo(s2.selComodo)); return; }
      if (s2.selComodo && s2.vista === 'casa' && (dx || dy)) {
        const c = s2.dados.comodos[s2.selComodo]; if (!c) return;
        e.preventDefault();
        moverComodo(c.id, c.x + dx, c.y + dy);
        // encostou em alguém? a porta entra na hora (e sai, se ele se afastou); tudo no mesmo passo do histórico
        avisarLigacoes(c.id, conectarComodo(c.id));
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  const lerArq = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast(tx('Arquivo grande demais para ser do Cabeaí.', 'This file is too big to be a Cabeaí file.'), 'erro'); return; }
    const r = new FileReader();
    r.onload = () => { const res = lerArquivo(String(r.result || '')); if ('erro' in res) toast(res.erro, 'erro'); else abrirDialogo('importar', { novos: res.dados, cont: res.cont }); };
    r.onerror = () => toast(tx('Não consegui ler o arquivo.', 'Couldn’t read the file.'), 'erro');
    r.readAsText(f);
  };

  const cls = ['app', modo === 'avancado' ? 'avancado' : '', `vista-${vista}`, !lateral ? 'sem-lateral' : '', est && latAberta ? 'lat-aberta' : '', carregado ? 'pronto' : 'abrindo', desenhando ? 'desenhando' : '', passos ? 'com-passos' : ''].filter(Boolean).join(' ');
  // trocar o idioma monta a tela de novo, já com os textos no idioma escolhido
  return (
    <Fragment key={lingua}>
      <div className={cls} id="app">
        <Topo />
        <div className="corpo">
          <Lateral />
          {est && latAberta && <div className="vu" id="vu" onClick={() => atualizar((s) => { s.latAberta = false; })} />}
          <main className="area" id="area">
            <Faixa />
            <div className="tela" id="tela">
              <Planta />
              <Avisos />
              <Botoes />
              <BarraDesenho />
              <Passos />
              <Controles />
              <Vazio />
            </div>
          </main>
          <Inspetor />
        </div>
      </div>
      <Folha />
      <Dialogo />
      <Menu />
      <input type="file" id="arquivo" ref={arquivo} accept=".json,application/json" hidden onChange={lerArq} />
      <Toast />
    </Fragment>
  );
}
