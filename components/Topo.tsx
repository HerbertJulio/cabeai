'use client';
import { andaresOrdem, comodosOrdem } from '@/lib/consultas';
import { abrirDialogo, abrirMenu, atualizar, desfazer, estreito, fecharMenu, mudarModo, mudarVista, refazer, useApp } from '@/lib/store';
import { tx } from '@/lib/i18n';
import { areaDaCasa, areaM2, fmtArea } from '@/lib/resumo';
import type { Vista } from '@/lib/tipos';
import { fmtM, pl } from '@/lib/util';
import { Icone, Logo } from './icones';

export function abrirMenuEmBotao(b: HTMLElement, tipo: string, extra: Record<string, unknown> = {}) {
  const s = useApp.getState();
  if (s.menu && s.menu.btn === b.id && b.id) { fecharMenu(); return; }
  const r = b.getBoundingClientRect();
  abrirMenu({ x: r.left, y: r.bottom, tipo, btn: b.id || undefined, ...extra });
}

const vistas = (): [Vista, string][] => [['um', tx('Cômodo', 'Room')], ['lado', tx('Lado a lado', 'Side by side')], ['casa', tx('Casa', 'Home')]];

export default function Topo() {
  const dados = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  const vista = useApp((s) => s.vista);
  const modo = useApp((s) => s.modo);
  const lateral = useApp((s) => s.lateral);
  const latAberta = useApp((s) => s.latAberta);
  const inspetor = useApp((s) => s.inspetor);
  const ehEstreito = useApp((s) => s.estreito);
  const hist = useApp((s) => s.hist);
  const q = comodo ? dados.comodos[comodo] : null;
  const nc = Object.keys(dados.comodos).length, na = andaresOrdem(dados).filter((a) => comodosOrdem(dados).some((c) => c.andar === a.id)).length;
  let titulo;
  if (!nc) titulo = <><b>{tx('Sua casa', 'Your home')}</b></>;
  else if (vista === 'casa') titulo = <><b>{tx('Casa', 'Home')}</b><span>{na > 1 ? tx(`${na} andares · `, `${na} floors · `) : ''}{pl(nc, tx('cômodo', 'room'), tx('cômodos', 'rooms'))} · {fmtArea(areaDaCasa(dados))}</span></>;
  else if (vista === 'lado') titulo = <><b>{tx('Lado a lado', 'Side by side')}</b><span>{pl(nc, tx('cômodo', 'room'), tx('cômodos', 'rooms'))} · {fmtArea(areaDaCasa(dados))}</span></>;
  else titulo = q ? <><b>{q.nome}</b><span>{fmtM(q.w)} × {fmtM(q.h)} m · {fmtArea(areaM2(q))}</span></> : <b>{tx('Sua casa', 'Your home')}</b>;
  return (
    <header className="topo">
      <button type="button" className="ico-btn" id="b-lateral" aria-label={tx('Mostrar ou esconder cômodos e itens', 'Show or hide rooms and items')} aria-controls="lateral" aria-expanded={ehEstreito ? latAberta : lateral}
        onClick={() => atualizar((s) => { if (estreito()) s.latAberta = !s.latAberta; else s.lateral = !s.lateral; })}>
        <Icone n="painel" />
      </button>
      <span className="marca" id="marca"><Logo /><span className="marca-t">Cabeaí</span></span>
      <div className="topo-quarto" id="topo-titulo">{titulo}</div>
      <div className="topo-ctrl">
        <div className="seg" id="vista" role="group" aria-label={tx('Vista', 'View')}>
          {vistas().map(([v, t]) => <button key={v} type="button" data-vista={v} aria-pressed={vista === v} onClick={() => mudarVista(v)}>{t}</button>)}
        </div>
        <div className="seg" id="modo" role="group" aria-label={tx('Modo', 'Mode')}>
          <button type="button" data-modo="simples" aria-pressed={modo === 'simples'} onClick={() => mudarModo('simples')}>{tx('Simples', 'Simple')}</button>
          <button type="button" data-modo="avancado" aria-pressed={modo === 'avancado'} onClick={() => mudarModo('avancado')}>{tx('Avançado', 'Advanced')}</button>
        </div>
        {modo === 'avancado' && (
          <button type="button" className="ico-btn" id="b-inspetor" aria-label={tx('Mostrar ou esconder o painel de propriedades', 'Show or hide the properties panel')} aria-controls="inspetor" aria-pressed={inspetor}
            onClick={() => atualizar((s) => { s.inspetor = !s.inspetor; })}><Icone n="inspetor" /></button>
        )}
      </div>
      <div className="topo-hist" role="group" aria-label={tx('Desfazer e histórico', 'Undo and history')}>
        <button type="button" className="ico-btn" id="b-desfazer" aria-label={tx('Desfazer (Ctrl+Z)', 'Undo (Ctrl+Z)')} title={tx('Desfazer (Ctrl+Z)', 'Undo (Ctrl+Z)')} disabled={!hist.desfazer} onClick={desfazer}><Icone n="desfazer" /></button>
        <button type="button" className="ico-btn" id="b-refazer" aria-label={tx('Refazer (Ctrl+Shift+Z)', 'Redo (Ctrl+Shift+Z)')} title={tx('Refazer (Ctrl+Shift+Z)', 'Redo (Ctrl+Shift+Z)')} disabled={!hist.refazer} onClick={refazer}><Icone n="refazer" /></button>
        <button type="button" className="ico-btn" id="b-historico" aria-label={tx('Histórico e pontos de restauração', 'History and restore points')} title={tx('Histórico e pontos de restauração', 'History and restore points')} onClick={() => abrirDialogo('historico')}><Icone n="historico" /></button>
      </div>
      <button type="button" className="ico-btn" id="b-mais" aria-label={tx('Mais opções', 'More options')} aria-haspopup="menu" onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'mais')}><Icone n="mais" /></button>
    </header>
  );
}
