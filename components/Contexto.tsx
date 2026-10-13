'use client';
// Barra de ações ao lado do que está selecionado na planta (móvel, porta, item de parede ou cômodo): o que mais se
// faz com ele fica à mão, sem abrir painel. "Mais" abre o painel de baixo (modo simples) ou o menu (modo avançado).
// No modo de desenhar ela fica no painel de baixo ("docada"), para não cobrir as paredes onde se toca.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { rotuloVirar, vizinhosDeParede } from '@/lib/consultas';
import { jeitoDaPorta, temGiro } from '@/lib/geometria';
import { tx } from '@/lib/i18n';
import { abrirDialogo, atualizar, cancelarCorte, cortarParedeToda, duplicar, editarItem, girar, porParede, tirarParede, useApp, virarAbertura, virarDobradica } from '@/lib/store';
import { Icone } from './icones';
import { abrirMenuEmBotao } from './Topo';

/** O item selecionado, em pixels da tela da planta. */
export interface AlvoTela { tipo: 'movel' | 'el' | 'comodo'; id: string; x1: number; y1: number; x2: number; y2: number }

const ALTURA = 46;

export default function BarraContexto({ alvo, tela, girarComodo, docada = false }: { alvo: AlvoTela; tela: { w: number; h: number }; girarComodo: (id: string) => void; docada?: boolean }) {
  const dados = useApp((s) => s.dados);
  const corte = useApp((s) => s.corte);
  const ref = useRef<HTMLDivElement>(null);
  const cx = (alvo.x1 + alvo.x2) / 2;
  // acima do item; sem espaço ali, embaixo dele
  const emCima = alvo.y1 - 10 - ALTURA >= 6 || alvo.y2 + 10 + ALTURA > tela.h - 6;
  const top = emCima ? Math.min(Math.max(alvo.y1 - 10, ALTURA + 6), tela.h - 6) : Math.max(alvo.y2 + 10, 6);
  // sem sair dos lados da tela (a largura só se sabe depois de desenhar)
  useLayoutEffect(() => {
    const el = ref.current; if (!el || docada) return;
    const w = el.offsetWidth;
    el.style.left = `${Math.round(Math.min(Math.max(cx, w / 2 + 8), tela.w - w / 2 - 8))}px`;
  });
  const curto = tela.w < 560;
  const mais = (b: HTMLElement) => {
    const s = useApp.getState();
    if (s.modo === 'simples' && !s.desenho.ativo) { atualizar((x) => { x.folha = true; x.folhaModo = 'acoes'; }); return; }
    abrirMenuEmBotao(b, alvo.tipo === 'comodo' ? 'comodo' : 'item', alvo.tipo === 'comodo' ? { comodo: alvo.id } : alvo.tipo === 'movel' ? { id: alvo.id } : { eid: alvo.id });
  };
  const bt = (k: string, ico: string, rot: string, fazer: (b: HTMLElement) => void, extra: Record<string, string> = {}, titulo?: string) => (
    <button key={k} type="button" data-ctx={k} {...extra} title={titulo || rot} aria-label={titulo || rot} onClick={(e) => fazer(e.currentTarget)}><Icone n={ico} /><span>{rot}</span></button>
  );
  const botoes: ReactNode[] = [];
  let nome = '';
  if (alvo.tipo === 'movel') {
    const m = dados.moveis[alvo.id]; if (!m) return null;
    nome = m.nome;
    botoes.push(bt('girar', 'girar', tx('Girar', 'Rotate'), () => girar(), { 'data-girar-m': m.id }, tx(`Girar ${m.nome} 90°`, `Rotate ${m.nome} 90°`)),
      bt('duplicar', 'duplicar', tx('Duplicar', 'Duplicate'), () => duplicar()), bt('editar', 'lapis', tx('Editar', 'Edit'), () => editarItem()));
  } else if (alvo.tipo === 'el' && dados.els[alvo.id]?.semParede) {
    // o corte da parede: tirar a parede toda ou pôr ela de volta (as pontas, na planta, acertam o tamanho)
    const e = dados.els[alvo.id], viz = e.liga ? dados.comodos[e.liga] : null, dono = dados.comodos[e.comodo];
    nome = tx('Parede cortada', 'Wall cut');
    if (e.parcial && viz && dono) botoes.push(bt('corte-toda', 'tesoura', tx('Parede toda', 'Whole wall'), () => cortarParedeToda(e.id), {}, tx(`Tirar a parede toda entre ${dono.nome} e ${viz.nome}`, `Remove the whole wall between ${dono.nome} and ${viz.nome}`)));
    if (viz && dono) botoes.push(bt('por-parede', 'parede', tx('Pôr parede', 'Put wall'), () => porParede(dono.id, viz.id), {}, tx(`Pôr de volta a parede entre ${dono.nome} e ${viz.nome}`, `Put back the wall between ${dono.nome} and ${viz.nome}`)));
  } else if (alvo.tipo === 'el') {
    const e = dados.els[alvo.id]; if (!e) return null;
    nome = e.nome;
    if (e.tipo === 'porta' && !e.semParede) {
      // a porta é da parede: para que cômodo ela abre e o lado da dobradiça, pelo nome
      const j = jeitoDaPorta(e);
      if (temGiro(e)) botoes.push(bt('abre', 'abre-para', rotuloVirar(dados, e, curto), () => virarAbertura(e.id), { 'data-virar-porta': 'abre' }, rotuloVirar(dados, e)));
      if (j === 'abrir') botoes.push(bt('dob', 'virar', tx('Dobradiça', 'Hinge'), () => virarDobradica(e.id), { 'data-virar-porta': 'dob' }, tx('Virar a dobradiça para o outro lado', 'Flip the hinge to the other side')));
      if (j === 'correr') botoes.push(bt('dob', 'virar', tx('Correr', 'Slide'), () => virarDobradica(e.id), { 'data-virar-porta': 'dob' }, tx('Correr para o outro lado', 'Slide to the other side')));
    }
    if (e.tipo !== 'porta' || jeitoDaPorta(e) === 'vao') botoes.push(bt('duplicar', 'duplicar', tx('Duplicar', 'Duplicate'), () => duplicar()));
    botoes.push(bt('editar', 'lapis', tx('Editar', 'Edit'), () => editarItem()));
  } else if (corte && corte.a === alvo.id && dados.comodos[corte.a] && dados.comodos[corte.b]) {
    // tesoura na mão: marcar o trecho na planta, tirar a parede toda ou desistir
    const a = dados.comodos[corte.a], b = dados.comodos[corte.b];
    nome = tx(`Cortar a parede com ${b.nome}`, `Cut the wall with ${b.nome}`);
    botoes.push(bt('corte-toda', 'tesoura', tx('Parede toda', 'Whole wall'), () => { cancelarCorte(); tirarParede(a.id, b.id); }, {}, tx(`Tirar a parede toda entre ${a.nome} e ${b.nome}`, `Remove the whole wall between ${a.nome} and ${b.nome}`)),
      bt('corte-cancelar', 'x', tx('Cancelar', 'Cancel'), () => cancelarCorte(), {}, tx('Guardar a tesoura sem cortar', 'Put the scissors away without cutting')));
    return (
      <div ref={ref} className={`ctx${docada ? ' doca' : emCima ? '' : ' embaixo'}${curto ? ' curta' : ''}`} id="ctx" role="toolbar" aria-label={nome}
        style={docada ? undefined : { left: Math.round(cx), top: Math.round(top) }}>
        <span className="ctx-nome">{nome}</span>
        {botoes}
      </div>
    );
  } else {
    const c = dados.comodos[alvo.id]; if (!c) return null;
    nome = c.nome;
    botoes.push(bt('girar', 'girar', tx('Girar', 'Rotate'), () => girarComodo(c.id), { 'data-girar-q-ctx': c.id }, tx(`Girar ${c.nome} 90°`, `Rotate ${c.nome} 90°`)));
    if (vizinhosDeParede(dados, c.id).length) botoes.push(bt('paredes', 'tesoura', tx('Paredes', 'Walls'), (b) => abrirMenuEmBotao(b, 'paredes', { comodo: c.id }), { id: 'ctx-paredes', 'aria-haspopup': 'menu' }, tx(`Paredes de ${c.nome} com os vizinhos`, `${c.nome}’s walls with its neighbors`)));
    botoes.push(bt('editar', 'lapis', tx('Editar', 'Edit'), () => abrirDialogo('comodo', { id: c.id })));
  }
  botoes.push(bt('mais', 'mais', tx('Mais', 'More'), mais, { id: 'ctx-mais', 'aria-haspopup': 'true' }, tx(`Mais opções de ${nome}`, `More options for ${nome}`)));
  return (
    <div ref={ref} className={`ctx${docada ? ' doca' : emCima ? '' : ' embaixo'}${curto ? ' curta' : ''}`} id="ctx" role="toolbar" aria-label={tx(`Ações de ${nome}`, `Actions for ${nome}`)}
      style={docada ? undefined : { left: Math.round(cx), top: Math.round(top) }}>
      {docada && !curto && <span className="ctx-nome">{nome}</span>}
      {botoes}
    </div>
  );
}
