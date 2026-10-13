'use client';
import { useEffect, useRef } from 'react';
import { NOME_PAREDE } from '@/lib/catalogo';
import { alvoSel, cenariosVisiveis, comodosDoCenario, espacoAberto, idsVisiveis, ladosDaPorta, nomeComodo, problemasDe, vizinhosDeParede } from '@/lib/consultas';
import { geoEl, jeitoDaPorta } from '@/lib/geometria';
import { areaM2, fmtArea } from '@/lib/resumo';
import { abrirCenario, abrirDialogo, avisarLigacoes, editarItem, girar, girarComodo, limparSel, sairCenario, useApp } from '@/lib/store';
import type { Dados, ElParede } from '@/lib/tipos';
import { tx } from '@/lib/i18n';
import { fmtM, pl } from '@/lib/util';
import { Icone } from './icones';
import { abrirMenuEmBotao } from './Topo';

/** "0,80 m · Quarto 1 ↔ Corredor · abre para Quarto 1": a porta é da parede entre os dois cômodos. */
export function descEl(d: Dados, e: ElParede): string {
  const q = d.comodos[e.comodo]; if (!q) return '';
  const g = geoEl(q, e), w = fmtM(g.b - g.a), par = tx('parede ' + NOME_PAREDE[e.parede], NOME_PAREDE[e.parede] + ' wall');
  if (e.tipo === 'porta') {
    const l = ladosDaPorta(d, e), onde = l.viz ? `${q.nome} ↔ ${l.viz.nome}` : tx(`${par} de ${q.nome}`, `${q.nome}’s ${par}`);
    if (e.semParede) return `${w} m · ${onde} · ${tx('sem parede', 'no wall')}`;
    const j = jeitoDaPorta(e);
    const para = e.abre === 'fora' ? (l.viz ? tx(`abre para ${l.viz.nome}`, `opens into ${l.viz.nome}`) : tx('abre para fora', 'opens outward')) : tx(`abre para ${q.nome}`, `opens into ${q.nome}`);
    const como = j === 'vao' ? tx('passagem sem porta', 'opening, no door') : j === 'correr' ? tx('de correr', 'sliding') : j === 'dupla' ? tx(`dupla, ${para}`, `double, ${para}`) : para;
    return `${w} m · ${onde} · ${como}`;
  }
  if (e.tipo === 'janela') return `${w} m · ${par} · ${e.abertura === 'abrir' ? tx('de abrir', 'hinged') : tx('de correr', 'sliding')}`;
  if (e.tipo === 'ar') return tx(`aparelho de ${w} m · ${par}`, `${w} m unit · ${par}`);
  return par;
}

const Cnt = ({ n }: { n: number }) => (n ? <span className="cnt bad">{pl(n, tx('problema', 'problem'), tx('problemas', 'problems'))}</span> : <span className="cnt">ok</span>);

export default function Faixa() {
  const dados = useApp((s) => s.dados);
  const vista = useApp((s) => s.vista);
  const comodo = useApp((s) => s.comodo);
  const sel = useApp((s) => s.sel);
  const selEl = useApp((s) => s.selEl);
  const selComodo = useApp((s) => s.selComodo);
  const verCen = useApp((s) => s.verCen);
  const cenBase = useApp((s) => s.cenBase);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!verCen) return;
    const b = ref.current?.querySelector('[aria-pressed="true"]') as HTMLElement | null;
    b?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [verCen]);

  if (!Object.keys(dados.comodos).length) return <div className="faixa" id="faixa"><p className="nota">{tx('Crie um cômodo para começar.', 'Create a room to get started.')}</p></div>;
  const alvo = verCen ? null : alvoSel(dados, sel, selEl);
  if (alvo) {
    const o = alvo.obj;
    const med = alvo.tipo === 'movel' ? `${fmtM(alvo.obj.larg)} × ${fmtM(alvo.obj.prof)} m` : descEl(dados, alvo.obj);
    return (
      <div className="faixa" id="faixa">
        <div className="barra-txt"><span className="barra-nome">{o.nome}</span> <span className="barra-med">{med}</span></div>
        <div className="acoes">
          {alvo.tipo === 'movel' && <button className="btn prim" type="button" data-acao="girar" aria-label={tx('Girar 90 graus', 'Rotate 90 degrees')} onClick={girar}><Icone n="girar" /><span className="rot-longo">{tx('Girar', 'Rotate')}</span></button>}
          <button className="btn" type="button" data-acao="editar" onClick={editarItem}>{tx('Editar', 'Edit')}</button>
          <button className="ico-btn" type="button" id="b-item-mais" data-acao="item-mais" aria-label={tx('Mais opções do item', 'More options for this item')} aria-haspopup="menu"
            onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'item', alvo.tipo === 'movel' ? { id: o.id } : { eid: o.id })}><Icone n="mais" /></button>
          <button className="ico-btn" type="button" data-acao="desmarcar" aria-label={tx('Tirar a seleção', 'Clear selection')} onClick={limparSel}><Icone n="x" /></button>
        </div>
      </div>
    );
  }
  if (selComodo && dados.comodos[selComodo] && !verCen) {
    const c = dados.comodos[selComodo], a = dados.andares[c.andar], temViz = vista === 'casa' && vizinhosDeParede(dados, c.id).length > 0;
    // sem parede com os vizinhos: a área do espaço todo (um L, por exemplo)
    const junto = espacoAberto(dados, c.id), aberto = junto.length > 1 ? ` · ${tx('espaço aberto', 'open space')} ${fmtArea(junto.reduce((t, id) => t + areaM2(dados.comodos[id]), 0))}` : '';
    return (
      <div className="faixa" id="faixa">
        <div className="barra-txt"><span className="barra-nome">{c.nome}</span> <span className="barra-med">{fmtM(c.w)} × {fmtM(c.h)} m · {fmtArea(areaM2(c))}{aberto}{a && Object.keys(dados.andares).length > 1 ? ` · ${a.nome}` : ''}</span></div>
        <div className="acoes">
          <button className="btn" type="button" data-acao="q-girar" aria-label={tx(`Girar ${c.nome} 90 graus`, `Rotate ${c.nome} 90 degrees`)} onClick={() => avisarLigacoes(c.id, girarComodo(c.id))}><Icone n="girar" /><span className="rot-longo">{tx('Girar', 'Rotate')}</span></button>
          {temViz && <button className="btn" type="button" id="b-paredes" data-acao="q-paredes" aria-haspopup="menu" aria-label={tx(`Paredes de ${c.nome} com os vizinhos`, `${c.nome}’s walls with its neighbors`)} onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'paredes', { comodo: c.id })}><Icone n="tesoura" /><span className="rot-longo">{tx('Paredes', 'Walls')}</span></button>}
          <button className="btn" type="button" data-acao="q-editar" onClick={() => abrirDialogo('comodo', { id: c.id })}>{tx('Editar', 'Edit')}</button>
          <button className="ico-btn" type="button" id="b-comodo-mais" aria-label={tx(`Mais opções de ${c.nome}`, `More options for ${c.nome}`)} aria-haspopup="menu" onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'comodo', { comodo: c.id })}><Icone n="mais" /></button>
          <button className="ico-btn" type="button" data-acao="desmarcar" aria-label={tx('Tirar a seleção', 'Clear selection')} onClick={limparSel}><Icone n="x" /></button>
        </div>
      </div>
    );
  }
  const ids = idsVisiveis(dados, vista, comodo);
  return (
    <div className="faixa" id="faixa" ref={ref}>
      <div className="cenarios" role="group" aria-label={tx('Cenários para comparar', 'Scenarios to compare')}>
        <button type="button" className="cen" data-cen="atual" aria-pressed={!verCen} onClick={sairCenario}>{tx('Atual', 'Current')}{cenBase && dados.cenarios[cenBase] ? <> <small>({dados.cenarios[cenBase].nome})</small></> : null} <Cnt n={problemasDe(dados, null, ids)} /></button>
        {cenariosVisiveis(dados, vista, comodo).map((c) => {
          const onde = (vista !== 'um' || c.escopo === 'casa') && !(c.sugestao && c.escopo === 'casa') ? <> <small>{c.escopo === 'casa' ? tx('casa toda', 'whole home') : nomeComodo(dados, c.comodo)}</small></> : null;
          return (
            <button key={c.id} type="button" className={`cen${c.sugestao ? ' sug' : ''}`} data-cen={c.id} aria-pressed={verCen === c.id}
              onClick={() => (verCen === c.id ? sairCenario() : abrirCenario(c.id))}>
              {c.sugestao && <Icone n="estrela" />}{c.nome}{onde} <Cnt n={problemasDe(dados, c.id, comodosDoCenario(dados, c))} />
            </button>
          );
        })}
        <button type="button" className="cen novo" data-cen="novo" onClick={() => abrirDialogo('cenario', { escopo: 'casa' })}>{tx('+ Salvar cenário', '+ Save scenario')}</button>
      </div>
    </div>
  );
}
