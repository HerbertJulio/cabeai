'use client';
// Painel de baixo do modo simples: as opções do item (ou do cômodo) e a edição.
import { useCallback, useState } from 'react';
import { alvoSel, andaresOrdem, comodosOrdem, cq } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { valsMovel, valsParede, validarMovel, validarParede } from '@/lib/formularios';
import { centrar } from '@/lib/geometria';
import {
  abrirDialogo, alternar, atualizar, duplicar, editarItem, focarComodo, girar, girarComodo, iniciarAdd, levar, pedirRemover, salvarEl, salvarMovel, travar, useApp
} from '@/lib/store';
import type { ElParede, Movel } from '@/lib/tipos';
import { tx } from '@/lib/i18n';
import { fmtM } from '@/lib/util';
import { CamposMovel, CamposParede, useValores } from './campos';
import { descEl } from './Faixa';
import { Icone } from './icones';
import { ChipsEl, ChipsFolga } from './Inspetor';

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
  const ini = useCallback(() => valsParede(dados.comodos[e.comodo], e), [dados, e]);
  const [v, set] = useValores(ini, e.id);
  const [erro, setErro] = useState('');
  const enviar = (ev: React.FormEvent) => {
    ev.preventDefault();
    const s = useApp.getState(), atual = s.dados.els[e.id]; if (!atual) return;
    const r = validarParede(v, atual.tipo, s.dados.comodos[atual.comodo], atual);
    if (r.erro) { setErro(r.erro); return; }
    salvarEl(e.id, r.campos!);
    voltar();
  };
  return (
    <form data-form="editar" noValidate onSubmit={enviar}>
      <CamposParede px="fs" tipo={e.tipo} v={v} set={set} />
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
  if (!folha || verCen || arrastando || modo !== 'simples') return null;
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
  } else if (alvo?.tipo === 'parede') {
    const e = alvo.obj, q = dados.comodos[e.comodo];
    corpo = <>
      <Topo t={e.nome} sub={descEl(q, e)} />
      {folhaModo === 'editar' ? <EditarEl key={e.id} e={e} /> : <>
        <ChipsEl q={q} el={e} />
        <div className="grade-acoes">
          <button className="btn prim" type="button" data-f="editar" onClick={editarItem}>{tx('Editar', 'Edit')}</button>
          {e.tipo === 'porta' && e.abre !== 'vao' && <>
            <button className="btn" type="button" data-f="dob" onClick={() => alternar('dob')}>{tx('Trocar lado da dobradiça', 'Switch hinge side')}</button>
            <button className="btn" type="button" data-f="abre" onClick={() => alternar('abre')}>{e.abre === 'dentro' ? tx('Abrir para fora', 'Open outward') : tx('Abrir para dentro', 'Open inward')}</button>
          </>}
          {e.tipo === 'janela' && <button className="btn" type="button" data-f="jan" onClick={() => alternar('jan')}>{e.abertura === 'abrir' ? tx('Mudar para de correr', 'Change to sliding') : tx('Mudar para de abrir', 'Change to hinged')}</button>}
          <button className="btn" type="button" data-f="duplicar" onClick={duplicar}>{tx('Duplicar', 'Duplicate')}</button>
          <button className="btn perigo" type="button" data-f="remover" onClick={pedirRemover}>{tx('Remover', 'Remove')}</button>
        </div>
        <p className="nota">{tx('Para mudar de lugar, arraste pela parede. Dois toques abrem a edição.', 'To move it, drag it along the wall. Double-tap to edit it.')}</p>
      </>}
    </>;
  } else if (selComodo && dados.comodos[selComodo]) {
    const c = dados.comodos[selComodo], as = andaresOrdem(dados);
    corpo = <>
      <Topo t={c.nome} sub={`${fmtM(c.w)} × ${fmtM(c.h)} m${as.length > 1 ? ' · ' + (dados.andares[c.andar]?.nome || '') : ''}`} />
      <div className="grade-acoes">
        <button className="btn prim" type="button" data-f="q-editar" onClick={() => abrirDialogo('comodo', { id: c.id })}>{tx('Editar medidas', 'Edit measurements')}</button>
        <button className="btn" type="button" data-f="q-girar" onClick={() => girarComodo(c.id)}>{tx('Girar 90°', 'Rotate 90°')}</button>
        <button className="btn" type="button" data-f="q-ver" onClick={() => focarComodo(c.id, true)}>{tx('Ver só este cômodo', 'View only this room')}</button>
        <button className="btn" type="button" data-f="q-add" onClick={() => iniciarAdd('movel', { comodo: c.id })}>{tx('Adicionar um item', 'Add an item')}</button>
        {Object.keys(dados.comodos).length > 1 && <button className="btn" type="button" data-f="q-lado" onClick={() => abrirDialogo('comodo', { id: c.id, onde: 'direita' })}>{tx('Ao lado de outro…', 'Next to another…')}</button>}
        <button className="btn" type="button" data-f="q-corredor" onClick={() => abrirDialogo('corredor', { a: c.id })}>{tx('Ligar por corredor…', 'Connect with hallway…')}</button>
        {as.length > 1 && <button className="btn" type="button" data-f="q-andar" onClick={() => abrirDialogo('andar-comodo', { id: c.id })}>{tx('Mudar de andar…', 'Move to another floor…')}</button>}
        <button className="btn perigo" type="button" data-f="q-remover" onClick={() => abrirDialogo('remover-comodo', { id: c.id })}>{tx('Remover cômodo', 'Remove room')}</button>
      </div>
      <p className="nota">{tx('Arraste o cômodo pelo piso ou pelo nome para mudar o lugar dele, e as alças azuis das paredes para esticar. Perto de outro cômodo, o ímã encosta as paredes.', 'Drag the room by its floor or its name to move it, and the blue handles on the walls to stretch it. Near another room, snap pulls the walls together.')}</p>
    </>;
  } else return null;
  return (
    <div className="folha" id="folha">
      <div className="folha-in" id="folha-in" role="dialog" aria-modal="false" aria-labelledby="folha-t">{corpo}</div>
    </div>
  );
}
