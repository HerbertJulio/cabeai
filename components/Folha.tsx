'use client';
// Painel de baixo do modo simples: as opções do item (ou do cômodo) e a edição.
import { useCallback, useState } from 'react';
import { alvoSel, andaresOrdem, comodosOrdem, cq, elVisto, ladosDaPorta } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { valsMovel, valsParede, validarMovel, validarParede } from '@/lib/formularios';
import { centrar } from '@/lib/geometria';
import {
  abrirDialogo, abrirMenu, alternar, atualizar, avisarLigacoes, cortarParedeToda, duplicar, duplicarComodo, editarItem, focarComodo, girar, girarComodo, iniciarAdd, levar, pedirRemover, porParede, salvarElVisto, salvarMovel, toast, travar, useApp
} from '@/lib/store';
import { vizinhosDeParede } from '@/lib/consultas';
import { areaLivre, areaM2, fmtArea } from '@/lib/resumo';
import type { ElParede, Movel } from '@/lib/tipos';
import { tx } from '@/lib/i18n';
import { fmtM } from '@/lib/util';
import { CamposMovel, CamposParede, useValores } from './campos';
import { descEl } from './Faixa';
import { Icone } from './icones';
import { ChipsEl, ChipsFolga, ControlesPorta } from './Inspetor';

const fechar = () => atualizar((s) => { s.folha = false; s.folhaModo = 'acoes'; });
const voltar = () => atualizar((s) => { s.folhaModo = 'acoes'; });

function Topo({ t, sub }: { t: string; sub?: string }) {
  return (
    <div className="folha-topo">
      <div><div className="barra-nome" id="folha-t">{t}</div>{sub && <div className="barra-med">{sub}</div>}</div>
      <button className="folha-x" type="button" data-f="fechar" aria-label={tx('Fechar', 'Close')} onClick={fechar}><Icone n="x" /></button>
    </div>
  );
}

function EditarMovel({ m }: { m: Movel }) {
  const ini = useCallback(() => valsMovel(m), [m]);
  const [v, set] = useValores(ini, m.id);
  const [erro, setErro] = useState('');
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const s = useApp.getState(), atual = s.dados.moveis[m.id]; if (!atual) return;
    const r = validarMovel(v, atual.tipo, atual);
    if (r.erro) { setErro(r.erro); return; }
    const q = cq(s.dados, atual.comodo)!, c = centrar(q, atual, { ...atual, ...r.campos });
    salvarMovel(m.id, { ...r.campos, x: c.x, y: c.y });
    voltar();
  };
  return (
    <form data-form="editar" noValidate onSubmit={enviar}>
      <CamposMovel px="fs" tipo={m.tipo} v={v} set={set} />
      <p className="nota">{tx('Em metros (1,62) ou centímetros (162).', 'In meters (1.62) or centimeters (162).')}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{tx('Salvar', 'Save')}</button><button className="btn" type="button" data-f="voltar" onClick={voltar}>{tx('Voltar', 'Back')}</button></div>
    </form>
  );
}

function EditarEl({ e }: { e: ElParede }) {
  const dados = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  // a porta da parede dividida, vista pelo vizinho em foco, vem medida na parede dele
  const ini = useCallback(() => { const v = elVisto(dados, e.id, comodo); return valsParede(v ? v.q : dados.comodos[e.comodo], v ? v.e : e); }, [dados, e, comodo]);
  const [v, set] = useValores(ini, e.id);
  const [erro, setErro] = useState('');
  const vis = elVisto(dados, e.id, comodo), lados = e.tipo === 'porta' && vis ? ladosDaPorta(dados, vis.e) : undefined;
  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const s = useApp.getState(), vv = elVisto(s.dados, e.id, s.comodo); if (!vv) return;
    const r = validarParede(v, vv.e.tipo, vv.q, vv.e);
    if (r.erro) { setErro(r.erro); return; }
    // (sem mudança nenhuma, não vira passo do histórico)
    if (!Object.entries(r.campos!).every(([k, x]) => (vv.e as unknown as Record<string, unknown>)[k] === x)) salvarElVisto(e.id, vv.dono ? null : vv.q.id, r.campos!);
    voltar();
  };
  return (
    <form data-form="editar" noValidate onSubmit={enviar}>
      <CamposParede px="fs" tipo={e.tipo} v={v} set={set} lados={lados} />
      <p className="nota">{tx('Em metros (0,80) ou centímetros (80).', 'In meters (0.80) or centimeters (80).')}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{tx('Salvar', 'Save')}</button><button className="btn" type="button" data-f="voltar" onClick={voltar}>{tx('Voltar', 'Back')}</button></div>
    </form>
  );
}

export default function Folha() {
  const dados = useApp((s) => s.dados);
  const folha = useApp((s) => s.folha);
  const folhaModo = useApp((s) => s.folhaModo);
  const modo = useApp((s) => s.modo);
  const sel = useApp((s) => s.sel);
  const selEl = useApp((s) => s.selEl);
  const selComodo = useApp((s) => s.selComodo);
  const verCen = useApp((s) => s.verCen);
  const arrastando = useApp((s) => s.arrastando);
  const comodo = useApp((s) => s.comodo);
  const desenhando = useApp((s) => s.desenho.ativo);
  // (no modo de desenhar, só quando a pessoa pede para editar: as opções ficam na barra de ações e no menu ⋯)
  if (!folha || verCen || arrastando || modo !== 'simples' || (desenhando && folhaModo !== 'editar')) return null;
  const alvo = alvoSel(dados, sel, selEl);
  const varios = comodosOrdem(dados).length > 1;
  let corpo: React.ReactNode = null;
  if (alvo?.tipo === 'movel') {
    const m = alvo.obj, q = cq(dados, m.comodo)!;
    corpo = <>
      <Topo t={m.nome} sub={`${fmtM(m.larg)} × ${fmtM(m.prof)} m · ${q.nome}`} />
      {folhaModo === 'editar' ? <EditarMovel key={m.id} m={m} /> : <>
        <ChipsFolga q={q} m={m} outros={moveisDo(dados, m.comodo).filter((o) => o.id !== m.id)} />
        <div className="grade-acoes">
          <button className="btn prim" type="button" data-f="girar" onClick={girar}><Icone n="girar" />{tx('Girar 90°', 'Rotate 90°')}</button>
          <button className="btn" type="button" data-f="editar" onClick={editarItem}>{tx('Editar', 'Edit')}</button>
          <button className="btn" type="button" data-f="duplicar" onClick={duplicar}>{tx('Duplicar', 'Duplicate')}</button>
          {varios && <button className="btn" type="button" data-f="levar" onClick={levar}>{tx('Levar para…', 'Move to…')}</button>}
          <button className="btn" type="button" data-f="travar" onClick={travar}>{m.fixo ? tx('Destravar', 'Unlock') : tx('Travar no lugar', 'Lock in place')}</button>
          <button className="btn perigo" type="button" data-f="remover" onClick={pedirRemover}>{tx('Remover', 'Remove')}</button>
        </div>
        <p className="nota">{tx('Arraste na planta para mudar de lugar. Dois toques no móvel abrem a edição.', 'Drag it on the floor plan to move it. Double-tap the item to edit it.')}{m.fixo ? tx(' Travado: as sugestões não mexem nele.', ' Locked: suggestions won’t move it.') : ''}</p>
      </>}
    </>;
  } else if (alvo?.tipo === 'parede' && alvo.obj.semParede) {
    // o corte da parede: o tamanho se acerta pelas pontas, na planta
    const e = alvo.obj, dono = dados.comodos[e.comodo], viz = e.liga ? dados.comodos[e.liga] : null;
    corpo = <>
      <Topo t={tx('Parede cortada', 'Wall cut')} sub={descEl(dados, e)} />
      <div className="grade-acoes">
        {e.parcial && dono && viz && <button className="btn" type="button" data-f="corte-toda" onClick={() => cortarParedeToda(e.id)}><Icone n="tesoura" />{tx('Tirar a parede toda', 'Remove the whole wall')}</button>}
        {dono && viz && <button className="btn prim" type="button" data-f="por-parede" onClick={() => porParede(dono.id, viz.id)}><Icone n="parede" />{tx('Pôr a parede de volta', 'Put the wall back')}</button>}
      </div>
      <p className="nota">{tx('Arraste as pontas azuis na planta para acertar de onde até onde a parede fica cortada, ou o corte inteiro para levar pela parede.', 'Drag the blue ends on the plan to set where the cut starts and ends, or drag the whole cut to move it along the wall.')}</p>
    </>;
  } else if (alvo?.tipo === 'parede') {
    const e = alvo.obj, vis = elVisto(dados, e.id, comodo), q = vis ? vis.q : dados.comodos[e.comodo];
    corpo = <>
      <Topo t={e.nome} sub={descEl(dados, e)} />
      {folhaModo === 'editar' ? <EditarEl key={e.id} e={e} /> : <>
        <ChipsEl q={q} el={vis ? vis.e : e} />
        {e.tipo === 'porta' && !e.semParede && <ControlesPorta e={e} />}
        <div className="grade-acoes">
          <button className="btn prim" type="button" data-f="editar" onClick={editarItem}>{tx('Editar', 'Edit')}</button>
          {e.tipo === 'janela' && <button className="btn" type="button" data-f="jan" onClick={() => alternar('jan')}>{e.abertura === 'abrir' ? tx('Mudar para de correr', 'Change to sliding') : tx('Mudar para de abrir', 'Change to hinged')}</button>}
          <button className="btn" type="button" data-f="duplicar" onClick={duplicar}>{tx('Duplicar', 'Duplicate')}</button>
          <button className="btn perigo" type="button" data-f="remover" onClick={pedirRemover}>{tx('Remover', 'Remove')}</button>
        </div>
        <p className="nota">{e.tipo === 'porta' && !e.semParede
          ? tx('A porta é da parede: dá para tocar nela pelos dois cômodos. Arraste pela parede para mudar de lugar.', 'The door belongs to the wall: you can tap it from either room. Drag it along the wall to move it.')
          : tx('Para mudar de lugar, arraste pela parede. Dois toques abrem a edição.', 'To move it, drag it along the wall. Double-tap to edit it.')}</p>
      </>}
    </>;
  } else if (selComodo && dados.comodos[selComodo]) {
    const c = dados.comodos[selComodo], as = andaresOrdem(dados), livre = areaLivre(c, moveisDo(dados, c.id)), temViz = vizinhosDeParede(dados, c.id).length > 0;
    corpo = <>
      <Topo t={c.nome} sub={`${fmtM(c.w)} × ${fmtM(c.h)} m · ${fmtArea(areaM2(c))} · ${tx('livre', 'free')} ${fmtArea(livre.m2)}${as.length > 1 ? ' · ' + (dados.andares[c.andar]?.nome || '') : ''}`} />
      <div className="grade-acoes">
        <button className="btn prim" type="button" data-f="q-editar" onClick={() => abrirDialogo('comodo', { id: c.id })}>{tx('Editar medidas', 'Edit measurements')}</button>
        <button className="btn" type="button" data-f="q-girar" onClick={() => avisarLigacoes(c.id, girarComodo(c.id))}>{tx('Girar 90°', 'Rotate 90°')}</button>
        {temViz && <button className="btn" type="button" id="f-paredes" data-f="q-paredes" aria-haspopup="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); abrirMenu({ x: r.left, y: r.top - 8, tipo: 'paredes', comodo: c.id, btn: 'f-paredes' }); }}><Icone n="tesoura" />{tx('Paredes…', 'Walls…')}</button>}
        <button className="btn" type="button" data-f="q-duplicar" onClick={() => { const nid = duplicarComodo(c.id), n = nid ? useApp.getState().dados.comodos[nid] : null; if (n) toast(tx(`${n.nome} criado ao lado, com tudo o que tinha dentro.`, `${n.nome} created next to it, with everything inside.`), '', 'desfazer'); }}><Icone n="duplicar" />{tx('Duplicar', 'Duplicate')}</button>
        <button className="btn" type="button" data-f="q-ver" onClick={() => focarComodo(c.id, true)}>{tx('Ver só este cômodo', 'View only this room')}</button>
        <button className="btn" type="button" data-f="q-add" onClick={() => iniciarAdd('movel', { comodo: c.id })}>{tx('Adicionar um item', 'Add an item')}</button>
        {Object.keys(dados.comodos).length > 1 && <button className="btn" type="button" data-f="q-lado" onClick={() => abrirDialogo('comodo', { id: c.id, onde: 'direita' })}>{tx('Ao lado de outro…', 'Next to another…')}</button>}
        <button className="btn" type="button" data-f="q-corredor" onClick={() => abrirDialogo('corredor', { a: c.id })}>{tx('Ligar por corredor…', 'Connect with hallway…')}</button>
        {as.length > 1 && <button className="btn" type="button" data-f="q-andar" onClick={() => abrirDialogo('andar-comodo', { id: c.id })}>{tx('Mudar de andar…', 'Move to another floor…')}</button>}
        <button className="btn perigo" type="button" data-f="q-remover" onClick={() => abrirDialogo('remover-comodo', { id: c.id })}>{tx('Remover cômodo', 'Remove room')}</button>
      </div>
      <p className="nota">{tx('Arraste o cômodo pelo piso ou pelo nome para mudar o lugar dele, e as alças azuis das paredes para esticar. Perto de outro cômodo, as paredes grudam; a tesoura na parede corta o trecho que você marcar (ou a parede toda).', 'Drag the room by its floor or its name to move it, and the blue handles on the walls to stretch it. Near another room, the walls snap together; the scissors on a wall cut the stretch you mark (or the whole wall).')}</p>
    </>;
  } else return null;
  return (
    <div className="folha" id="folha">
      <div className="folha-in" id="folha-in" role="dialog" aria-modal="false" aria-labelledby="folha-t">{corpo}</div>
    </div>
  );
}
