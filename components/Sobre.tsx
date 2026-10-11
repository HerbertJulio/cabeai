'use client';
// O que fica por cima da planta: avisos, botões de adicionar e sugestões, zoom e a tela vazia.
import { useEffect, useRef } from 'react';
import { sobreposicoes } from '@/lib/casa';
import { andaresOrdem, avaliacao, comodosDoAndar, comodosDoCenario, idsVisiveis, listaAtiva, nomeComodo } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { tx } from '@/lib/i18n';
import {
  abrirDialogo, abrirMenu, atualizar, atualizarCenario, criarExemplo, enquadrar, iniciarAdd, sairCenario, selecionar, selecionarComodo, toast, useApp, usarCenario, zoomEm
} from '@/lib/store';
import type { Problema } from '@/lib/tipos';
import { pl } from '@/lib/util';
import { Icone, Logo } from './icones';

export function Avisos() {
  const dados = useApp((s) => s.dados);
  const vista = useApp((s) => s.vista);
  const comodo = useApp((s) => s.comodo);
  const verCen = useApp((s) => s.verCen);
  const abertos = useApp((s) => s.avisosAbertos);
  const ultimo = useRef<string | null>(null);
  useEffect(() => { if (!verCen && ultimo.current) atualizar((s) => { s.avisosAbertos = false; }); ultimo.current = verCen; }, [verCen]);
  const ids = idsVisiveis(dados, vista, comodo);
  if (!ids.length) return <div className="flut flut-ce" id="avisos" />;
  const cv = verCen ? dados.cenarios[verCen] : null;
  const grupos: { qid: string; itens: Problema[] }[] = [];
  let total = 0, temAlgo = false;
  // vendo um cenário, contam só os cômodos dele
  for (const qid of cv ? comodosDoCenario(dados, cv) : ids) {
    const av = avaliacao(dados, verCen, qid); if (!av) continue;
    if (listaAtiva(dados, verCen, qid).length || Object.values(dados.els).some((e) => e.comodo === qid)) temAlgo = true;
    total += av.itens.length;
    if (av.itens.length) grupos.push({ qid, itens: av.itens });
  }
  // na planta da casa: cômodos que se invadem
  const invasoes: string[] = [];
  if (vista === 'casa' && (!cv || cv.escopo === 'casa')) for (const a of andaresOrdem(dados)) for (const [x, y] of sobreposicoes(comodosDoAndar(dados, a.id))) invasoes.push(tx(`${x.nome} e ${y.nome} estão um em cima do outro na planta. Arraste um deles pelo nome.`, `${x.nome} and ${y.nome} overlap on the floor plan. Drag one of them by its name.`));
  total += invasoes.length;
  const abrir = (v: boolean) => atualizar((s) => { s.avisosAbertos = v; });
  const lista = (clicavel: boolean) => <>
    {invasoes.length > 0 && <><p className="sub">{tx('Planta da casa', 'Home floor plan')}</p><ul>{invasoes.map((t) => <li key={t}>{t}</li>)}</ul></>}
    {grupos.map((g) => (
      <div key={g.qid}>
        {(grupos.length > 1 || invasoes.length > 0) && <p className="sub">{nomeComodo(dados, g.qid)}</p>}
        <ul>{g.itens.map((i, k) => <li key={k}>{clicavel && (i.mid || i.eid)
          ? <button type="button" onClick={() => { if (i.mid) selecionar({ id: i.mid }, { abrir: true }); else if (i.eid && dados.els[i.eid]) selecionar({ eid: i.eid }, { abrir: true }); }}>{i.t}</button>
          : i.t}</li>)}</ul>
      </div>
    ))}
  </>;
  if (cv) {
    const tit = <>{cv.sugestao && <Icone n="estrela" />}{cv.nome}</>;
    if (!abertos) return <div className="flut flut-ce" id="avisos"><button type="button" className={`aviso-chip${total ? ' ruim' : ''}`} aria-expanded={false} onClick={() => abrir(true)}><i />{tit}</button></div>;
    const fora: string[] = [];
    for (const qid of comodosDoCenario(dados, cv)) for (const m of moveisDo(dados, qid)) if (!(m.id in cv.itens)) fora.push(m.nome);
    return (
      <div className="flut flut-ce" id="avisos">
        <div className={`aviso-card ${cv.sugestao ? 'sug' : total ? 'ruim' : 'bom'}`}>
          <div className="aviso-cab"><strong>{tit}</strong><button type="button" className="ico-btn peq" aria-label={tx('Recolher', 'Collapse')} onClick={() => abrir(false)}><Icone n="x" /></button></div>
          <p className="nota">{cv.escopo === 'casa' ? tx('Casa toda', 'Whole home') : nomeComodo(dados, cv.comodo)} · {total ? pl(total, tx('problema', 'problem'), tx('problemas', 'problems')) : tx('nenhum problema', 'no problems')} · {tx('só para comparar, nada mudou ainda.', 'just for comparison, nothing changed yet.')}</p>
          {cv.explicacao && <p>{cv.explicacao}</p>}
          {lista(false)}
          {fora.length > 0 && <p className="nota">{tx('Não estava neste cenário:', 'Not in this scenario:')} {fora.join(', ')}.</p>}
          <div className="acoes">
            <button className="btn prim peq" type="button" data-acao="cen-usar" onClick={() => { usarCenario(cv.id); toast(tx(`“${cv.nome}” está valendo agora.`, `Now using “${cv.nome}”.`)); }}>{tx('Usar este', 'Use this')}</button>
            {cv.sugestao && <button className="btn peq" type="button" data-acao="cen-guardar" onClick={() => { atualizarCenario(cv.id, { sugestao: false }); toast(tx(`“${cv.nome}” foi guardado nos seus cenários.`, `“${cv.nome}” was saved to your scenarios.`)); }}>{tx('Guardar', 'Keep')}</button>}
            <button className="btn peq" type="button" data-acao="cen-mais" aria-haspopup="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); abrirMenu({ x: r.left, y: r.bottom, tipo: 'cenario', cen: cv.id }); }}>{tx('Mais…', 'More…')}</button>
            <button className="btn peq" type="button" data-acao="cen-sair" onClick={sairCenario}>{tx('Voltar ao atual', 'Back to current')}</button>
          </div>
        </div>
      </div>
    );
  }
  if (!temAlgo && !invasoes.length) return <div className="flut flut-ce" id="avisos" />;
  if (!abertos) return <div className="flut flut-ce" id="avisos"><button type="button" className={`aviso-chip${total ? ' ruim' : ''}`} aria-expanded={false} onClick={() => abrir(true)}><i />{total ? pl(total, tx('problema', 'problem'), tx('problemas', 'problems')) + tx(' — ver', ' — view') : tx('Tudo certo', 'All good')}</button></div>;
  return (
    <div className="flut flut-ce" id="avisos">
      <div className={`aviso-card ${total ? 'ruim' : 'bom'}`}>
        <div className="aviso-cab"><strong>{total ? pl(total, tx('problema', 'problem'), tx('problemas', 'problems')) : tx('Tudo certo', 'All good')}</strong><button type="button" className="ico-btn peq" aria-label={tx('Recolher', 'Collapse')} onClick={() => abrir(false)}><Icone n="x" /></button></div>
        {total ? <>{lista(true)}<p className="nota">{tx('Toque num problema para ver o item.', 'Tap a problem to see the item.')}</p></> : <p className="nota">{tx('Nenhuma porta, janela, ar-condicionado, interruptor, tomada ou outro ponto atrapalhado, e nada sobreposto.', 'No door, window, air conditioner, switch, outlet or hookup is blocked, and nothing overlaps.')}</p>}
      </div>
    </div>
  );
}

export function Botoes() {
  const n = useApp((s) => Object.keys(s.dados.comodos).length);
  const vista = useApp((s) => s.vista);
  if (!n) return null;
  return (
    <div className="flut flut-be">
      <button type="button" className="fab prim" id="b-add" onClick={() => { const s = useApp.getState(); iniciarAdd(s.add.tipo || 'guarda-roupa', { comodo: s.comodo || undefined }); }}><Icone n="add" /><span>{tx('Adicionar', 'Add')}</span></button>
      <button type="button" className="fab" id="b-sug" onClick={() => abrirDialogo('sugestoes', { escopo: vista !== 'um' && n > 1 ? 'casa' : 'comodo' })}><Icone n="estrela" /><span>{tx('Sugestões', 'Suggestions')}</span></button>
    </div>
  );
}

export function Controles() {
  const n = useApp((s) => Object.keys(s.dados.comodos).length);
  const modo = useApp((s) => s.modo);
  const setas = useApp((s) => s.setasTodos);
  const imaOn = useApp((s) => s.imaOn);
  const z = useApp((s) => s.cam.z);
  if (!n) return <div className="flut flut-bd" id="controles" />;
  return (
    <div className="flut flut-bd" id="controles">
      {modo === 'avancado' && (
        <div className="ctrl-grupo">
          <button type="button" data-t="setas" aria-pressed={setas} aria-label={tx('Medidas em todos os móveis', 'Measurements on all furniture')} title={tx('Medidas em todos os móveis', 'Measurements on all furniture')} onClick={() => atualizar((s) => { s.setasTodos = !s.setasTodos; })}><Icone n="regua" /></button>
          <button type="button" data-t="ima" aria-pressed={imaOn} aria-label={tx('Ímã nas paredes', 'Snap to walls')} title={tx('Ímã nas paredes', 'Snap to walls')} onClick={() => atualizar((s) => { s.imaOn = !s.imaOn; })}><Icone n="ima" /></button>
        </div>
      )}
      <div className="ctrl-grupo">
        <button type="button" data-z="mais" aria-label={tx('Aproximar', 'Zoom in')} title={tx('Aproximar', 'Zoom in')} onClick={() => zoomEm(1.25)}><Icone n="add" /></button>
        <button type="button" className="pct" id="zoom-pct" aria-label={tx('Zoom atual; toque para enquadrar', 'Current zoom; tap to fit to screen')} onClick={enquadrar}>{Math.round(z * 100)}%</button>
        <button type="button" data-z="menos" aria-label={tx('Afastar', 'Zoom out')} title={tx('Afastar', 'Zoom out')} onClick={() => zoomEm(0.8)}><Icone n="menos" /></button>
        <button type="button" data-z="fit" aria-label={tx('Enquadrar a planta', 'Fit the floor plan to screen')} title={tx('Enquadrar', 'Fit to screen')} onClick={enquadrar}><Icone n="enquadrar" /></button>
      </div>
    </div>
  );
}

export function Vazio() {
  const carregado = useApp((s) => s.carregado);
  const n = useApp((s) => Object.keys(s.dados.comodos).length);
  if (!carregado || n) return null;
  return (
    <div className="vazio" id="vazio">
      <div className="vazio-in">
        <Logo />
        <h2>{tx('Será que cabe? Monte a planta e veja.', 'Will it fit? Draw your floor plan and see.')}</h2>
        <p>{tx('Crie os cômodos com as medidas de dentro, monte a casa (com andares, se tiver), coloque portas, janelas e os móveis em escala, e veja se dá para passar. Grátis, com IA.', 'Create your rooms with their inside measurements, put the home together (with floors, if it has them), add doors, windows and furniture to scale, and see if there’s room to get through. Free, with AI.')}</p>
        <div className="acoes">
          <button className="btn prim" type="button" data-acao="novo-comodo" onClick={() => abrirDialogo('comodo')}>{tx('+ Criar o primeiro cômodo', '+ Create your first room')}</button>
          <button className="btn" type="button" data-acao="exemplo" onClick={criarExemplo}>{tx('Ver um exemplo', 'See an example')}</button>
        </div>
        <p className="nota">{tx('Já tem um arquivo do Cabeaí?', 'Already have a Cabeaí file?')} <button className="btn peq" type="button" data-acao="importar" onClick={() => document.getElementById('arquivo')?.click()}>{tx('Importar arquivo', 'Import file')}</button></p>
      </div>
    </div>
  );
}

export { selecionarComodo };
