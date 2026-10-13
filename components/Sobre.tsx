'use client';
// O que fica por cima da planta: avisos, botões de adicionar e sugestões, zoom e a tela vazia.
import { useEffect, useRef } from 'react';
import { sobreposicoes } from '@/lib/casa';
import { COMODO_NOME, TIPOS_COMODO } from '@/lib/catalogo';
import { andaresOrdem, avaliacao, comodosDoAndar, comodosDoCenario, idsVisiveis, listaAtiva, nomeComodo } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { tx } from '@/lib/i18n';
import {
  abrirDialogo, abrirMenu, abrirPassos, verEm3D, alternarCamada, atualizar, atualizarCenario, criarExemplo, enquadrar, ferramentaDesenho, ferramentaDividir, iniciarAdd, modoDesenho, modoMedir, sairCenario, selecionar, selecionarComodo, toast, useApp, usarCenario, zoomEm, type PecaParede
} from '@/lib/store';
import { abrirMenuEmBotao } from './Topo';
import type { Problema } from '@/lib/tipos';
import { pl } from '@/lib/util';
import { Icone, Logo } from './icones';

export function Avisos() {
  const dados = useApp((s) => s.dados);
  const vista = useApp((s) => s.vista);
  const comodo = useApp((s) => s.comodo);
  const verCen = useApp((s) => s.verCen);
  const abertos = useApp((s) => s.avisosAbertos);
  const tres = useApp((s) => s.tres.ativo);
  const ultimo = useRef<string | null>(null);
  useEffect(() => { if (!verCen && ultimo.current) atualizar((s) => { s.avisosAbertos = false; }); ultimo.current = verCen; }, [verCen]);
  const ids = idsVisiveis(dados, vista, comodo);
  if (!ids.length || tres) return <div className="flut flut-ce" id="avisos" />;
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
          ? <button type="button" onClick={() => { if (i.mid) selecionar({ id: i.mid }, { abrir: true }); else if (i.eid && dados.els[i.eid]) selecionar({ eid: i.eid }, { abrir: true, via: g.qid }); }}>{i.t}</button>
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
  const desenhando = useApp((s) => s.desenho.ativo);
  const passos = useApp((s) => s.passo.ativo);
  const tres = useApp((s) => s.tres.ativo);
  if (!n || desenhando || passos || tres) return null;
  return (
    <div className="flut dock" id="dock" role="toolbar" aria-label={tx('Ações da planta', 'Plan actions')}>
      <button type="button" className="dock-b prim" id="b-add" onClick={() => { const s = useApp.getState(); iniciarAdd(s.add.tipo || 'guarda-roupa', { comodo: s.comodo || undefined }); }}><Icone n="add" /><span>{tx('Adicionar', 'Add')}</span></button>
      <button type="button" className="dock-b" id="b-desenhar" aria-label={tx('Desenhar cômodos, portas e janelas na planta', 'Draw rooms, doors and windows on the plan')} onClick={() => modoDesenho(true)}><Icone n="lapis" /><span>{tx('Desenhar', 'Draw')}</span></button>
      <button type="button" className="dock-b" id="b-sug" aria-label={tx('Sugestões de arrumação', 'Layout suggestions')} onClick={() => abrirDialogo('sugestoes', { escopo: vista !== 'um' && n > 1 ? 'casa' : 'comodo' })}><Icone n="estrela" /><span>{tx('Sugestões', 'Suggestions')}</span></button>
    </div>
  );
}

const PECAS = (): [PecaParede, string, string][] => [['porta', tx('Porta', 'Door'), 'porta'], ['correr', tx('De correr', 'Sliding'), 'correr'], ['vao', tx('Passagem', 'Opening'), 'passagem'], ['janela', tx('Janela', 'Window'), 'janela']];

/** Modo de desenhar: a dica do que fazer, os tipos de cômodo (para desenhar cômodo) e as ferramentas, num dock embaixo. */
export function BarraDesenho() {
  const d = useApp((s) => s.desenho);
  const passos = useApp((s) => s.passo.ativo);
  const temComodo = useApp((s) => Object.keys(s.dados.comodos).length > 0);
  if (!d.ativo || passos) return null;
  const peca = d.item ? PECAS().find(([k]) => k === d.item) : null, dividir = d.dividir && !d.item;
  return (
    <div className="flut flut-desenho" id="barra-desenho" role="group" aria-label={tx('Desenhar a planta', 'Draw the plan')}>
      {/* a barra de ações do que está selecionado entra aqui (a planta põe), no lugar da dica */}
      <div id="ctx-doca" className="ctx-doca" />
      <p className="desenho-t" aria-live="polite"><Icone n={peca ? peca[2] : dividir ? 'parede' : 'lapis'} />{d.item
        ? tx(`Toque numa parede para pôr ${d.item === 'janela' ? 'a janela' : d.item === 'vao' ? 'a passagem' : 'a porta'}`, `Tap a wall to add the ${d.item === 'janela' ? 'window' : d.item === 'vao' ? 'opening' : 'door'}`)
        : dividir ? tx('Arraste de uma parede até a outra, dentro do cômodo, para pôr uma parede nova', 'Drag from one wall to the other, inside the room, to add a new wall')
        : tx(`Arraste na planta para desenhar: ${COMODO_NOME[d.tipo]}`, `Drag on the plan to draw: ${COMODO_NOME[d.tipo]}`)}</p>
      {!d.item && !dividir && (
        <div className="tipos tipos-desenho" role="group" aria-label={tx('Que cômodo desenhar', 'Which room to draw')}>
          {TIPOS_COMODO.map((t) => <button key={t} type="button" className="tipo" data-tipo-comodo={t} aria-pressed={d.tipo === t} onClick={() => modoDesenho(true, t)}>{COMODO_NOME[t]}</button>)}
        </div>
      )}
      <div className="dock dock-desenho" role="toolbar" aria-label={tx('Ferramentas de desenho', 'Drawing tools')}>
        <button type="button" className="dock-b" data-ferramenta="comodo" aria-pressed={!d.item && !dividir} title={tx('Desenhar cômodo', 'Draw a room')} onClick={() => ferramentaDesenho(null)}><Icone n="lapis" /><span>{tx('Cômodo', 'Room')}</span></button>
        {temComodo && <button type="button" className="dock-b" data-ferramenta="dividir" aria-pressed={dividir} title={tx('Pôr uma parede nova dentro de um cômodo (divide em dois)', 'Add a new wall inside a room (splits it in two)')} onClick={() => (dividir ? ferramentaDesenho(null) : ferramentaDividir())}><Icone n="parede" /><span>{tx('Parede', 'Wall')}</span></button>}
        {PECAS().map(([k, rot, ico]) => <button key={k} type="button" className="dock-b" data-peca={k} aria-pressed={d.item === k} title={rot} onClick={() => ferramentaDesenho(d.item === k ? null : k)}><Icone n={ico} /><span>{rot}</span></button>)}
        <span className="dock-sep" aria-hidden="true" />
        <button type="button" className="dock-b prim" data-acao="desenho-pronto" onClick={() => modoDesenho(false)}><Icone n="ok" /><span>{tx('Pronto', 'Done')}</span></button>
      </div>
    </div>
  );
}

export function Controles() {
  const n = useApp((s) => Object.keys(s.dados.comodos).length);
  const tres = useApp((s) => s.tres.ativo);
  const passos = useApp((s) => s.passo.ativo);
  const modo = useApp((s) => s.modo);
  const setas = useApp((s) => s.setasTodos);
  const imaOn = useApp((s) => s.imaOn);
  const z = useApp((s) => s.cam.z);
  const camadas = useApp((s) => s.camadas);
  const medir = useApp((s) => s.medir);
  if (!n || tres) return <div className="flut flut-bd" id="controles" />;
  const escondidas = Object.values(camadas).filter((v) => !v).length;
  const moveis = () => {
    alternarCamada('moveis');
    toast(useApp.getState().camadas.moveis ? tx('Móveis de volta na planta.', 'Furniture is back on the plan.') : tx('Móveis escondidos: agora dá para mexer nas portas, janelas, no ar e nas tomadas sem esbarrar neles. Toque de novo para mostrar.', 'Furniture hidden: now you can work on doors, windows, the AC and outlets without bumping into it. Tap again to show it.'));
  };
  const trena = () => {
    const ativo = !useApp.getState().medir;
    modoMedir(ativo);
    if (ativo) toast(tx('Trena: arraste na planta de um ponto ao outro. A ponta gruda nas paredes e nos móveis; toque em ✕ ou Esc para sair.', 'Tape measure: drag on the plan from one point to another. The ends snap to walls and furniture; tap ✕ or Esc to exit.'));
  };
  return (
    <div className="flut flut-bd" id="controles">
      <div className="ctrl-grupo">
        <button type="button" data-t="3d" disabled={passos} aria-label={tx('Ver a casa em 3D', 'See the home in 3D')} title={tx('Ver a casa em 3D', 'See the home in 3D')} onClick={() => verEm3D(true)}><Icone n="cubo" /></button>
      </div>
      <div className="ctrl-grupo">
        <button type="button" data-t="moveis" aria-pressed={!camadas.moveis} aria-label={camadas.moveis ? tx('Esconder os móveis', 'Hide the furniture') : tx('Mostrar os móveis', 'Show the furniture')} title={camadas.moveis ? tx('Esconder os móveis', 'Hide the furniture') : tx('Mostrar os móveis', 'Show the furniture')} onClick={moveis}><Icone n="sofa" />{!camadas.moveis && <i className="risco-ico" aria-hidden="true" />}</button>
        <button type="button" id="b-camadas" data-t="camadas" aria-haspopup="menu" aria-label={tx('O que aparece na planta', 'What shows on the plan')} title={tx('O que aparece na planta', 'What shows on the plan')} onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'camadas')}><Icone n="camadas" />{escondidas > 0 && <span className="ponto-aviso" aria-hidden="true" />}</button>
        <button type="button" data-t="trena" aria-pressed={medir} aria-label={medir ? tx('Sair da trena', 'Exit the tape measure') : tx('Trena: medir na planta', 'Tape measure: measure on the plan')} title={tx('Trena: medir na planta', 'Tape measure: measure on the plan')} onClick={trena}>{medir ? <Icone n="x" /> : <Icone n="trena" />}</button>
      </div>
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
  const terreno = useApp((s) => !!s.dados.terreno);
  const desenhando = useApp((s) => s.desenho.ativo);
  const passos = useApp((s) => s.passo.ativo);
  if (!carregado || n || desenhando || passos) return null;
  return (
    <div className="vazio" id="vazio">
      <div className="vazio-in">
        <Logo />
        <h2>{tx('Será que cabe? Monte a planta e veja.', 'Will it fit? Draw your floor plan and see.')}</h2>
        <p>{tx('Do terreno aos móveis, em escala: veja se dá para passar, abrir as portas e sentar à mesa. Grátis, com IA.', 'From the plot to the furniture, to scale: see whether you can walk through, open the doors and sit at the table. Free, with AI.')}</p>
        <div className="vazio-escolhas">
          <button type="button" className="vazio-escolha prim" data-acao="passos-casa" onClick={() => abrirPassos('casa')}>
            <Icone n="casa" />
            <span><b>{terreno ? tx('Continuar a casa', 'Continue the house') : tx('A casa toda', 'The whole house')}</b><small>{tx('Passo a passo: terreno, casa, cômodos, portas e janelas e, por último, os móveis. Dá para pular o que não souber.', 'Step by step: plot, house, rooms, doors and windows and, last, the furniture. Skip whatever you don’t know.')}</small></span>
          </button>
          <button type="button" className="vazio-escolha" data-acao="passos-comodo" onClick={() => abrirPassos('comodo')}>
            <Icone n="comodo" />
            <span><b>{tx('Só um cômodo', 'Just one room')}</b><small>{tx('Um quarto, a sala… as medidas, a porta e a janela e os móveis.', 'A bedroom, the living room… its size, the door and window and the furniture.')}</small></span>
          </button>
        </div>
        <p className="vazio-outros">
          {tx('Ou ', 'Or ')}<button type="button" data-acao="foto-desenho" onClick={() => abrirDialogo('foto-desenho')}>{tx('mande a foto de um desenho em papel', 'send a photo of a paper sketch')}</button>
          {', '}<button type="button" data-acao="desenhar" onClick={() => modoDesenho(true)}>{tx('desenhe à mão livre', 'draw it freehand')}</button>
          {', '}<button type="button" data-acao="novo-comodo" onClick={() => abrirDialogo('comodo')}>{tx('crie pelas medidas', 'create it by its measurements')}</button>
          {', '}<button type="button" data-acao="exemplo" onClick={criarExemplo}>{tx('veja um exemplo', 'see an example')}</button>
          {tx(' ou ', ' or ')}<button type="button" data-acao="importar" onClick={() => document.getElementById('arquivo')?.click()}>{tx('importe um arquivo', 'import a file')}</button>.
        </p>
      </div>
    </div>
  );
}

export { selecionarComodo };
