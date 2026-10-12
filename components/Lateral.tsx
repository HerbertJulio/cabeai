'use client';
import { PAREDE_CURTA, pontoDe } from '@/lib/catalogo';
import { andaresOrdem, avaliacao, comodosDoAndar, cq } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { geoEl } from '@/lib/geometria';
import { abrirDialogo, atualizar, criarAndar, focarComodo, iniciarAdd, modoDesenho, selecionar, toast, useApp } from '@/lib/store';
import { tx } from '@/lib/i18n';
import { fmtM } from '@/lib/util';
import { Icone } from './icones';
import { abrirMenuEmBotao } from './Topo';

export default function Lateral() {
  const dados = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  const sel = useApp((s) => s.sel);
  const selEl = useApp((s) => s.selEl);
  const carregado = useApp((s) => s.carregado);
  const erroDb = useApp((s) => s.erroDb);
  const persistente = useApp((s) => s.persistente);
  const as = andaresOrdem(dados);
  const varios = as.length > 1;
  const q = cq(dados, comodo), lista = q ? moveisDo(dados, q.id) : [], av = q ? avaliacao(dados, null, q.id) : null;

  const fecharGaveta = () => atualizar((s) => { s.latAberta = false; });
  const grupos = q ? ([
    [tx('Portas', 'Doors'), 'porta', 'porta', q.portas.filter((p) => !p.herdada), tx('Nenhuma porta.', 'No doors.'), tx('porta', 'door')],
    [tx('Janelas', 'Windows'), 'janela', 'jan', q.janelas, tx('Nenhuma janela.', 'No windows.'), tx('janela', 'window')],
    [tx('Ar-condicionado', 'Air conditioners'), 'ar', 'ar', q.ares, tx('Nenhum.', 'None.'), tx('ar-condicionado', 'air conditioner')],
    [tx('Tomadas e outros pontos', 'Outlets and hookups'), 'interruptor', 'interruptor', q.interruptores, tx('Nenhum.', 'None.'), tx('tomada, interruptor, ponto de TV, água ou gás', 'outlet, switch, TV, water or gas hookup')]
  ] as const) : [];
  const herdadas = q ? q.portas.filter((p) => p.herdada) : [];

  return (
    <aside className="lateral" id="lateral" aria-label={tx('Cômodos e itens', 'Rooms and items')}>
      <section className="lat-sec" aria-labelledby="t-casa">
        <div className="lat-cab">
          <h2 className="lat-t" id="t-casa">{tx('Casa', 'Home')}</h2>
          <button type="button" className="btn peq" id="b-novo-comodo" onClick={() => { fecharGaveta(); abrirDialogo('comodo'); }}>{tx('+ Novo cômodo', '+ New room')}</button>
        </div>
        {!as.length && <p className="nota">{carregado ? tx('Nenhum cômodo ainda. Toque em “+ Novo cômodo”.', 'No rooms yet. Tap “+ New room”.') : tx('Carregando…', 'Loading…')}</p>}
        {as.map((a) => {
          const cs = comodosDoAndar(dados, a.id);
          return (
            <div key={a.id} className="andar-bloco" data-andar={a.id}>
              {(varios || cs.length === 0) && (
                <div className="andar-cab">
                  <span className="andar-nome">{a.nome}</span>
                  <button type="button" className="ico-btn peq" id={`am-${a.id}`} aria-label={tx(`Opções do ${a.nome}`, `Options for ${a.nome}`)} aria-haspopup="menu" onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'andar', { andar: a.id })}><Icone n="mais" /></button>
                </div>
              )}
              <ul className="lista" id={a.id === as[0].id ? 'lista-comodos' : undefined}>
                {cs.map((c) => {
                  const n = avaliacao(dados, null, c.id)?.itens.length || 0;
                  return (
                    <li key={c.id}>
                      <button type="button" className="item sala-item" data-q={c.id} aria-current={c.id === comodo} onClick={() => focarComodo(c.id, false)}>
                        <span className={`dot${n ? ' bad' : ''}`} aria-hidden="true" /><span className="nm">{c.nome}</span><span className="med">{fmtM(c.w)} × {fmtM(c.h)}</span>
                      </button>
                      <button type="button" className="ico-btn peq" id={`qm-${c.id}`} data-qmenu={c.id} aria-label={tx(`Opções de ${c.nome}`, `Options for ${c.nome}`)} aria-haspopup="menu" onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'comodo', { comodo: c.id })}><Icone n="mais" /></button>
                    </li>
                  );
                })}
                {!cs.length && <li><p className="nota">{tx('Nenhum cômodo neste andar.', 'No rooms on this floor.')}</p></li>}
              </ul>
            </div>
          );
        })}
        {as.length > 0 && <div className="acoes">
          <button type="button" className="btn peq andar-novo" id="b-novo-andar" onClick={() => { const id = criarAndar(), nome = useApp.getState().dados.andares[id].nome; toast(tx(`${nome} criado. Agora crie os cômodos dele.`, `${nome} created. Now add its rooms.`)); abrirDialogo('comodo', { andar: id }); }}>{tx('+ Novo andar', '+ New floor')}</button>
          {Object.keys(dados.comodos).length > 0 && <button type="button" className="btn peq andar-novo" id="b-novo-corredor" onClick={() => { fecharGaveta(); abrirDialogo('corredor'); }}>{tx('+ Corredor', '+ Hallway')}</button>}
          <button type="button" className="btn peq andar-novo" id="b-lat-desenhar" onClick={() => { fecharGaveta(); modoDesenho(true); }}><Icone n="lapis" />{tx('Desenhar', 'Draw')}</button>
          <button type="button" className="btn peq andar-novo" id="b-lat-foto" onClick={() => { fecharGaveta(); abrirDialogo('foto-desenho'); }}><Icone n="camera" />{tx('Foto do desenho', 'Sketch photo')}</button>
        </div>}
      </section>
      <section className="lat-sec" id="lat-itens" aria-label={tx('Itens do cômodo', 'Room items')}>
        {q && av && <>
          <div className="lat-cab"><h2 className="lat-t">{tx(`Em ${q.nome}`, `In ${q.nome}`)}</h2></div>
          <div className="grupo-cab"><p className="grupo-t">{tx('Móveis', 'Furniture')} · {lista.length}</p><button type="button" className="mini-add" data-add="movel" aria-label={tx(`Adicionar móvel em ${q.nome}`, `Add furniture to ${q.nome}`)} onClick={() => iniciarAdd('movel', { comodo: q.id })}>+</button></div>
          {lista.length ? (
            <ul className="lista">
              {lista.map((m) => (
                <li key={m.id}><button type="button" className="item" data-sel={m.id} aria-current={sel === m.id} onClick={() => { fecharGaveta(); selecionar({ id: m.id }, { abrir: true }); }}>
                  <span className={`dot${av.conflitos.has(m.id) ? ' bad' : ''}`} aria-hidden="true" /><span className="nm">{m.nome}</span>{m.fixo && <Icone n="cadeado" className="trava" />}<span className="med">{fmtM(m.larg)} × {fmtM(m.prof)}</span>
                </button></li>
              ))}
            </ul>
          ) : <p className="nota">{carregado ? tx('Nenhum móvel ainda.', 'No furniture yet.') : tx('Carregando…', 'Loading…')}</p>}
          {grupos.map(([tit, tipo, dot, arr, vazio, rotAdd]) => (
            <div key={tipo}>
              <div className="grupo-cab"><p className="grupo-t">{tit} · {arr.length}</p><button type="button" className="mini-add" data-add={tipo} aria-label={tx(`Adicionar ${rotAdd} em ${q.nome}`, `Add ${rotAdd} to ${q.nome}`)} onClick={() => iniciarAdd(tipo, { comodo: q.id })}>+</button></div>
              {arr.length ? (
                <ul className="lista">
                  {arr.map((e) => { const g = geoEl(q, e); return (
                    <li key={e.id}><button type="button" className="item" data-esel={e.id} aria-current={selEl === e.id} onClick={() => { fecharGaveta(); selecionar({ eid: e.id }, { abrir: true }); }}>
                      <span className={`dot ${av.elsRuins.has(e.id) ? 'bad' : e.tipo === 'interruptor' ? 'interruptor pt-' + pontoDe(e) : dot}`} aria-hidden="true" /><span className="nm">{e.nome}</span><span className="med">{e.tipo === 'interruptor' ? '' : fmtM(g.b - g.a) + ' m · '}{PAREDE_CURTA[e.parede]}</span>
                    </button></li>
                  ); })}
                </ul>
              ) : <p className="nota">{vazio}</p>}
              {tipo === 'porta' && herdadas.length > 0 && <p className="nota">{tx('Na parede dividida:', 'On the shared wall:')} {herdadas.map((p) => p.nome).join(', ')}.</p>}
            </div>
          ))}
        </>}
      </section>
      <p className="lat-apoio"><button type="button" data-acao="apoiar" onClick={() => { fecharGaveta(); abrirDialogo('apoiar'); }}>{tx('♥ Apoie o Cabeaí', '♥ Support Cabeaí')}</button></p>
      <p className={`lat-status${erroDb ? ' erro' : ''}`} id="status" aria-live="polite">
        {erroDb || (!carregado ? tx('Abrindo…', 'Loading…') : persistente ? tx('Tudo fica salvo neste navegador. Para levar a outro aparelho, use Exportar no menu ⋯.', 'Everything is saved in this browser. To move it to another device, use Export in the ⋯ menu.') : tx('Este navegador não deixa salvar. Use Exportar no menu ⋯ para guardar um arquivo.', 'This browser won’t let you save. Use Export in the ⋯ menu to keep a file.'))}
      </p>
    </aside>
  );
}
