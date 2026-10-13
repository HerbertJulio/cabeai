'use client';
// Painel de propriedades do modo avançado: cada campo vale ao sair dele (ou com Enter).
import { useEffect, useState } from 'react';
import { AB_NOME, JEITOS_PORTA, JEITO_NOME, LIM_COMODO, PAREDES, PONTO_NOME, TIPOS, TIPOS_PAREDE, ehTipoComodo, horizontal, pontoDe, tipoMovel } from '@/lib/catalogo';
import { alvoSel, andaresOrdem, comodosOrdem, cq } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { valsMovel, valsParede, validarMovel, validarParede, type Valores } from '@/lib/formularios';
import { centrar, folgas, folhaDe, geoEl, jeitoDaPorta, lugarLivre, nivel, normRot, precisaCadeira, precisaFrente, prender, tam, temCadeiras, temGiro, zonaAr, compParede } from '@/lib/geometria';
import { tx } from '@/lib/i18n';
import {
  abrirDialogo, abrirPortaPara, atualizar, duplicar, duplicarComodo, estreito, focarComodo, girar, levar, limparSel, mudarJeitoPorta, pedirRemover, salvarComodo, salvarElVisto, salvarMovel, toast, useApp, virarDobradica
} from '@/lib/store';
import { areaLivre, areaM2, fmtArea } from '@/lib/resumo';
import { abrirMenuEmBotao } from './Topo';
import { elVisto, espacoAberto, ladosDaPorta, vizinhosDeParede } from '@/lib/consultas';
import type { Comodo, ComodoCompleto, ElParede, Movel, TipoComodo } from '@/lib/tipos';
import { descEl } from './Faixa';
import { clamp, fmtM, parseCm, parseMedida, pl } from '@/lib/util';
import { CamposMovel, CamposParede, Texto, Escolha, opcoesTipoComodo } from './campos';
import { Icone } from './icones';

export function ChipsFolga({ q, m, outros }: { q: ComodoCompleto; m: Movel; outros: Movel[] }) {
  const f = folgas(q, m, outros), t = tam(m);
  const need = precisaFrente(m);
  return (
    <div className="folgas" aria-label={tx('Espaço em volta', 'Space around it')}>
      {([['esq', tx('Esquerda', 'Left')], ['dir', tx('Direita', 'Right')], ['cima', tx('Em cima', 'Top')], ['baixo', tx('Embaixo', 'Bottom')]] as const).map(([k, rot]) => {
        const g = Math.max(0, Math.round(f[k].gap)), n = g < 1 ? 'encostado' : nivel(g);
        return <span key={k} className="fchip"><i className={`c-${n}`} />{rot}: {g < 1 ? tx('encostado', 'touching') : g + ' cm'}</span>;
      })}
      {need > 0 && <span className="fchip">{m.abertura !== 'nenhuma' ? AB_NOME[m.abertura] : TIPOS[m.tipo].rot}: {tx(`precisa de ${need} cm na frente`, `needs ${need} cm in front`)}</span>}
      {temCadeiras(m) && <span className="fchip">{tx(`Cadeiras: precisam de ${precisaCadeira(m)} cm para puxar`, `Chairs: need ${precisaCadeira(m)} cm to pull out`)}</span>}
      {(t.larg !== m.larg || t.prof !== m.prof) && <span className="fchip">{tx(`Com os baús: ${fmtM(t.larg)} × ${fmtM(t.prof)} m`, `With the chests: ${fmtM(t.larg)} × ${fmtM(t.prof)} m`)}</span>}
    </div>
  );
}

export function ChipsEl({ q, el }: { q: Comodo; el: ElParede }) {
  const g = geoEl(q, el), h = horizontal(el.parede);
  return (
    <div className="folgas">
      <span className="fchip">{h ? tx('Do canto esquerdo', 'From the left corner') : tx('Do canto de cima', 'From the top corner')}: {Math.round(g.a)} cm</span>
      <span className="fchip">{h ? tx('Do canto direito', 'From the right corner') : tx('Do canto de baixo', 'From the bottom corner')}: {Math.round(g.L - g.b)} cm</span>
      {el.tipo === 'ar' && (() => { const z = zonaAr(q, el); return <span className="fchip"><i className="c-nao" />{tx(`Sem móvel alto: de ${fmtM(z.a)} a ${fmtM(z.b)} m`, `No tall furniture: from ${fmtM(z.a)} to ${fmtM(z.b)} m`)}</span>; })()}
      {el.tipo === 'janela' && el.abertura === 'abrir' && <span className="fchip">{tx(`Folha de ${folhaDe(q, el)} cm abrindo para dentro`, `${folhaDe(q, el)} cm panel opening inward`)}</span>}
    </div>
  );
}

/** A porta é da parede: o jeito dela, para que lado (cômodo) abre, pelo nome, e o lado da dobradiça. */
export function ControlesPorta({ e }: { e: ElParede }) {
  const dados = useApp((s) => s.dados);
  const j = jeitoDaPorta(e), l = ladosDaPorta(dados, e);
  return (
    <div className="porta-ctrl">
      <div className="tipos" role="group" aria-label={tx('Tipo de porta', 'Door type')}>
        {JEITOS_PORTA.map((k) => <button key={k} type="button" className="tipo" data-jeito={k} aria-pressed={j === k} onClick={() => mudarJeitoPorta(e.id, k)}>{JEITO_NOME[k]}</button>)}
      </div>
      {temGiro(e) && <div className="porta-lado">
        <span className="porta-rot" id={`abre-${e.id}`}>{tx('Abre para', 'Opens into')}</span>
        <div className="seg" role="group" aria-labelledby={`abre-${e.id}`}>
          <button type="button" data-abre="dentro" aria-pressed={e.abre !== 'fora'} onClick={() => abrirPortaPara(e.id, 'dentro')}>{l.dentro}</button>
          <button type="button" data-abre="fora" aria-pressed={e.abre === 'fora'} onClick={() => abrirPortaPara(e.id, 'fora')}>{l.fora}</button>
        </div>
      </div>}
      {(j === 'abrir' || j === 'correr') && <button className="btn" type="button" data-f="dob" onClick={() => virarDobradica(e.id)}><Icone n="virar" />{j === 'correr' ? tx('Correr para o outro lado', 'Slide the other way') : tx('Virar a dobradiça', 'Flip the hinge')}</button>}
    </div>
  );
}

/** Mantém os campos em dia com o item, sem apagar o que está sendo digitado. */
function useCampos(base: Valores, chave: string): [Valores, (k: string, v: string | boolean) => void] {
  const [v, setV] = useState<Valores>(base);
  const [ch, setCh] = useState(chave);
  const json = JSON.stringify(base);
  useEffect(() => {
    setV((old) => {
      if (ch !== chave) return base;
      const ae = document.activeElement as HTMLElement | null, k = ae && ae.closest && ae.closest('#p-prop') ? ae.getAttribute('data-k') : null;
      const novo = { ...base };
      if (k && k in old) novo[k] = old[k];
      return novo;
    });
    setCh(chave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, chave]);
  return [v, (k, val) => setV((o) => ({ ...o, [k]: val }))];
}

function Fechar() {
  const est = useApp((s) => s.estreito);
  return <button type="button" className="ico-btn peq" data-p="fechar" aria-label={est ? tx('Tirar a seleção', 'Clear selection') : tx('Esconder o painel', 'Hide the panel')} onClick={() => { if (estreito()) limparSel(); else atualizar((s) => { s.inspetor = false; }); }}><Icone n="x" /></button>;
}

function PropMovel({ m }: { m: Movel }) {
  const dados = useApp((s) => s.dados);
  const q = cq(dados, m.comodo)!;
  const [erro, setErro] = useState('');
  const [v, set] = useCampos(valsMovel(m), m.id);
  const comodos = comodosOrdem(dados).map((c) => [c.id, c.nome] as [string, string]);
  const commit = (k: string, val: string | boolean) => {
    setErro('');
    const atual = useApp.getState().dados.moveis[m.id]; if (!atual) return;
    const qq = cq(useApp.getState().dados, atual.comodo)!;
    if (k === 'x' || k === 'y') {
      const n = parseCm(val);
      if (n == null || Number.isNaN(n)) { setErro(tx('Posição em cm, por exemplo 120.', 'Position in cm, for example 120.')); return; }
      const c = prender(qq, atual, k === 'x' ? n : atual.x, k === 'y' ? n : atual.y); salvarMovel(m.id, { x: c.x, y: c.y }); return;
    }
    if (k === 'rot') { const rot = normRot(val), c = centrar(qq, atual, { ...atual, rot }); salvarMovel(m.id, { rot, x: c.x, y: c.y }); return; }
    if (k === 'comodo') {
      const dest = cq(useApp.getState().dados, String(val));
      if (!dest || dest.id === atual.comodo) return;
      const p = lugarLivre(dest, atual, moveisDo(useApp.getState().dados, dest.id));
      salvarMovel(m.id, { comodo: dest.id, x: p.x, y: p.y, rot: p.rot });
      atualizar((s) => { s.comodo = dest.id; });
      return;
    }
    if (k === 'tipo') {
      const t = String(val); if (!tipoMovel(t) || t === atual.tipo) return;
      const nt = TIPOS[t], campos: Partial<Movel> = { tipo: t };
      if (nt.ab) campos.abertura = nt.ab.includes(atual.abertura) ? atual.abertura : nt.ab[0]; else campos.abertura = 'nenhuma';
      if (atual.nome === TIPOS[atual.tipo].rot) campos.nome = nt.rot;
      if (t !== 'mesa') campos.cadeiras = 0;
      if (t !== 'cama') { campos.bauCab = 0; campos.bauPe = 0; }
      salvarMovel(m.id, campos); return;
    }
    if (k === 'fixo') { salvarMovel(m.id, { fixo: !!val }); return; }
    const r = validarMovel({ ...v, [k]: val }, atual.tipo, atual);
    if (r.erro) { setErro(r.erro); return; }
    const campos = r.campos!, novo = { ...atual, ...campos }, c = centrar(qq, atual, novo);
    salvarMovel(m.id, { ...campos, x: c.x, y: c.y });
  };
  const outros = moveisDo(dados, m.comodo).filter((o) => o.id !== m.id);
  return <>
    <div className="insp-cab"><div><h2 className="sec-t">{m.nome}</h2><div className="sub">{TIPOS[m.tipo].rot} · {q.nome}</div></div><Fechar /></div>
    <CamposMovel px="fp" tipo={m.tipo} v={v} set={set} commit={commit} avancado comodos={comodos} />
    {erro && <p className="erro" id="fp-erro">{erro}</p>}
    <ChipsFolga q={q} m={m} outros={outros} />
    <div className="grade-acoes">
      <button className="btn" type="button" data-p="girar" onClick={girar}><Icone n="girar" />{tx('Girar 90°', 'Rotate 90°')}</button>
      <button className="btn" type="button" data-p="duplicar" onClick={duplicar}>{tx('Duplicar', 'Duplicate')}</button>
      {comodos.length > 1 && <button className="btn" type="button" data-p="levar" onClick={levar}>{tx('Levar para…', 'Move to…')}</button>}
      <button className="btn perigo" type="button" data-p="remover" onClick={pedirRemover}>{tx('Remover', 'Remove')}</button>
    </div>
    <p className="nota">{tx('Cada campo vale ao sair dele ou apertar Enter.', 'Each field applies when you leave it or press Enter.')}</p>
  </>;
}

function PropEl({ e }: { e: ElParede }) {
  const dados = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  // a porta da parede dividida, vista pelo vizinho em foco, vem medida na parede dele
  const vis = elVisto(dados, e.id, comodo), ev = vis ? vis.e : e, q = vis ? vis.q : dados.comodos[e.comodo];
  const [erro, setErro] = useState('');
  const [v, set] = useCampos(valsParede(q, ev), e.id);
  const commit = (k: string, val: string | boolean) => {
    setErro('');
    const s = useApp.getState(), vv = elVisto(s.dados, e.id, s.comodo); if (!vv) return;
    const atual = vv.e, qq = vv.q, via = vv.dono ? null : qq.id, g = geoEl(qq, atual), w = g.b - g.a;
    if (k === 'inicioCm') {
      const d = parseCm(val);
      if (d == null || Number.isNaN(d)) { setErro(tx('Distância em cm, por exemplo 80.', 'Distance in cm, for example 80.')); return; }
      const inicio = Math.round(clamp(d, 0, g.L - w));
      if (inicio !== Math.round(g.a)) salvarElVisto(e.id, via, { inicio });
      return;
    }
    if (k === 'parede') {
      const p = String(val) as ElParede['parede']; if (!PAREDES.includes(p) || p === atual.parede) return;
      const L = compParede(qq, p), nw = Math.min(w, L);
      salvarElVisto(e.id, via, { parede: p, largura: nw, inicio: Math.round(clamp(g.a, 0, L - nw)) }); return;
    }
    const r = validarParede({ ...v, dist: fmtM(g.a), [k]: val }, atual.tipo, qq, atual);
    if (r.erro) { setErro(r.erro); return; }
    // (nada mudou: não mexe, para não virar um passo do histórico à toa)
    if (Object.entries(r.campos!).every(([kk, x]) => (atual as unknown as Record<string, unknown>)[kk] === x)) return;
    salvarElVisto(e.id, via, r.campos!);
  };
  return <>
    <div className="insp-cab"><div><h2 className="sec-t">{e.nome}</h2><div className="sub">{e.tipo === 'interruptor' ? PONTO_NOME[pontoDe(e)] : TIPOS_PAREDE[e.tipo].rot} · {e.tipo === 'porta' ? descEl(dados, e) : q.nome}</div></div><Fechar /></div>
    <CamposParede px="fp" tipo={e.tipo} v={v} set={set} commit={commit} avancado />
    {e.tipo === 'porta' && !e.semParede && <ControlesPorta e={e} />}
    {erro && <p className="erro" id="fp-erro">{erro}</p>}
    <ChipsEl q={q} el={ev} />
    <div className="grade-acoes">
      <button className="btn" type="button" data-p="duplicar" onClick={duplicar}>{tx('Duplicar', 'Duplicate')}</button>
      <button className="btn perigo" type="button" data-p="remover" onClick={pedirRemover}>{tx('Remover', 'Remove')}</button>
    </div>
    <p className="nota">{tx('Cada campo vale ao sair dele ou apertar Enter. Também dá para arrastar pela parede.', 'Each field applies when you leave it or press Enter. You can also drag it along the wall.')}</p>
  </>;
}

function PropComodo({ c }: { c: Comodo }) {
  const dados = useApp((s) => s.dados);
  const [erro, setErro] = useState('');
  const q = cq(dados, c.id)!;
  const as = andaresOrdem(dados);
  const [v, set] = useCampos({ 'q-nome': c.nome, 'q-tipo': c.tipo || (c.corredor ? 'corredor' : ''), 'q-w': fmtM(c.w), 'q-h': fmtM(c.h), 'q-x': String(c.x), 'q-y': String(c.y), 'q-andar': c.andar }, c.id);
  const commit = (k: string, val: string | boolean) => {
    setErro('');
    const t = String(val);
    if (k === 'q-nome') { const n = t.trim().slice(0, 30); if (n) salvarComodo(c.id, { nome: n }); else setErro(tx('O nome não pode ficar vazio.', 'The name can’t be empty.')); return; }
    if (k === 'q-w' || k === 'q-h') {
      const n = parseMedida(t);
      if (n >= LIM_COMODO.min && n <= LIM_COMODO.max) salvarComodo(c.id, { [k === 'q-w' ? 'w' : 'h']: n }); else setErro(tx(`Use uma medida entre ${fmtM(LIM_COMODO.min)} e ${fmtM(LIM_COMODO.max)} m.`, `Use a measurement between ${fmtM(LIM_COMODO.min)} and ${fmtM(LIM_COMODO.max)} m.`));
      return;
    }
    if (k === 'q-x' || k === 'q-y') { const n = parseCm(t, true); if (n == null || Number.isNaN(n)) { setErro(tx('Posição em cm, por exemplo 315.', 'Position in cm, for example 315.')); return; } salvarComodo(c.id, { [k === 'q-x' ? 'x' : 'y']: n }); return; }
    if (k === 'q-andar' && t !== c.andar && dados.andares[t]) salvarComodo(c.id, { andar: t });
    if (k === 'q-tipo' && t !== (c.tipo || (c.corredor ? 'corredor' : '')) && (t === '' || ehTipoComodo(t))) salvarComodo(c.id, { tipo: t as TipoComodo | '' });
  };
  const n = moveisDo(dados, c.id).length, livre = areaLivre(c, moveisDo(dados, c.id)), temViz = vizinhosDeParede(dados, c.id).length > 0;
  const junto = espacoAberto(dados, c.id);
  return <>
    <div className="insp-cab"><div><h2 className="sec-t">{c.nome}</h2><div className="sub">{tx('Cômodo', 'Room')} · {dados.andares[c.andar]?.nome || ''}</div></div><Fechar /></div>
    <div className="campos">
      <Texto px="fq" k="q-nome" rot={tx('Nome do cômodo', 'Room name')} v={v} set={set} commit={commit} full max={30} />
      <Escolha px="fq" k="q-tipo" rot={tx('O que é', 'What it is')} v={v} set={set} commit={commit} full opts={opcoesTipoComodo(c.nome)} />
      <Texto px="fq" k="q-w" rot={tx('Largura (esquerda → direita)', 'Width (left → right)')} v={v} set={set} commit={commit} num />
      <Texto px="fq" k="q-h" rot={tx('Comprimento (cima → baixo)', 'Length (top → bottom)')} v={v} set={set} commit={commit} num />
      <Texto px="fq" k="q-x" rot={tx('Na planta: da esquerda (cm)', 'On the floor plan: from the left (cm)')} v={v} set={set} commit={commit} num />
      <Texto px="fq" k="q-y" rot={tx('Na planta: de cima (cm)', 'On the floor plan: from the top (cm)')} v={v} set={set} commit={commit} num />
      {as.length > 1 && <Escolha px="fq" k="q-andar" rot={tx('Andar', 'Floor')} v={v} set={set} commit={commit} full opts={as.map((a) => [a.id, a.nome])} />}
    </div>
    {erro && <p className="erro" id="fp-erro">{erro}</p>}
    <div className="folgas">
      <span className="fchip">{tx('Área', 'Area')}: {fmtArea(areaM2(c))}</span><span className="fchip">{tx('Chão livre', 'Free floor')}: {fmtArea(livre.m2)} ({livre.pct}%)</span>
      {junto.length > 1 && <span className="fchip">{tx('Espaço aberto com', 'Open space with')} {junto.filter((id) => id !== c.id).map((id) => dados.comodos[id].nome).join(', ')}: {fmtArea(junto.reduce((t, id) => t + areaM2(dados.comodos[id]), 0))}</span>}
      <span className="fchip">{pl(n, tx('móvel', 'item'), tx('móveis', 'items'))}</span><span className="fchip">{pl(q.portas.filter((p) => !p.semParede).length, tx('porta', 'door'), tx('portas', 'doors'))}</span>
      <span className="fchip">{pl(q.janelas.length, tx('janela', 'window'), tx('janelas', 'windows'))}</span><span className="fchip">{pl(q.ares.length, tx('ar-condicionado', 'air conditioner'), tx('ares-condicionados', 'air conditioners'))}</span>
    </div>
    <div className="grade-acoes">
      <button className="btn" type="button" data-p="q-ver" onClick={() => focarComodo(c.id, true)}>{tx('Ver só este cômodo', 'Show only this room')}</button>
      <button className="btn" type="button" data-p="q-duplicar" onClick={() => { const nid = duplicarComodo(c.id), nv = nid ? useApp.getState().dados.comodos[nid] : null; if (nv) toast(tx(`${nv.nome} criado ao lado, com tudo o que tinha dentro.`, `${nv.nome} created next to it, with everything inside.`), '', 'desfazer'); }}>{tx('Duplicar cômodo', 'Duplicate room')}</button>
      {temViz && <button className="btn" type="button" id="p-paredes" data-p="q-paredes" aria-haspopup="menu" onClick={(e) => abrirMenuEmBotao(e.currentTarget, 'paredes', { comodo: c.id })}><Icone n="tesoura" />{tx('Paredes…', 'Walls…')}</button>}
      <button className="btn perigo" type="button" data-p="q-remover" onClick={() => abrirDialogo('remover-comodo', { id: c.id })}>{tx('Remover cômodo', 'Remove room')}</button>
    </div>
    <hr className="divisor" />
    <p className="grupo-t">{tx('Atalhos', 'Shortcuts')}</p>
    <ul className="atalhos">
      <li>{tx('Botão direito ou dedo segurado: menu', 'Right-click or press and hold: menu')}</li><li>{tx('Duplo clique: editar', 'Double-click: edit')}</li>
      <li><kbd>Ctrl</kbd>+<kbd>Z</kbd>{tx(' desfazer · ', ' undo · ')}<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>{tx(' refazer', ' redo')}</li>
      <li><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd>{tx(' mover 1 cm (', ' move 1 cm (')}<kbd>Shift</kbd> 10 cm)</li>
      <li><kbd>R</kbd>{tx(' girar · ', ' rotate · ')}<kbd>Ctrl</kbd>+<kbd>D</kbd>{tx(' duplicar · ', ' duplicate · ')}<kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>V</kbd>{tx(' copiar e colar · ', ' copy and paste · ')}<kbd>Delete</kbd>{tx(' remover', ' remove')}</li>
      <li><kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>0</kbd>{tx(' enquadrar · ', ' fit to screen · ')}<kbd>{tx('Espaço', 'Space')}</kbd>{tx(' segurado: mover a planta · ', ' held: move the plan · ')}<kbd>Esc</kbd>{tx(' tirar a seleção', ' clear selection')}</li>
      <li><kbd>M</kbd>{tx(' trena · ', ' tape measure · ')}<kbd>?</kbd>{tx(' ajuda e atalhos', ' help and shortcuts')}</li>
      <li>{tx('Na vista Casa: arraste o cômodo pelo nome para montar a planta', 'In the Home view: drag a room by its name to build the floor plan')}</li>
    </ul>
  </>;
}

export default function Inspetor() {
  const modo = useApp((s) => s.modo);
  const inspetor = useApp((s) => s.inspetor);
  const est = useApp((s) => s.estreito);
  const dados = useApp((s) => s.dados);
  const sel = useApp((s) => s.sel);
  const selEl = useApp((s) => s.selEl);
  const verCen = useApp((s) => s.verCen);
  const comodo = useApp((s) => s.comodo);
  const alvo = verCen ? null : alvoSel(dados, sel, selEl);
  const mostrar = modo === 'avancado' && Object.keys(dados.comodos).length > 0 && (est ? !!alvo : inspetor);
  if (!mostrar) return null;
  const c = comodo ? dados.comodos[comodo] : null;
  return (
    <aside className="inspetor" id="inspetor" aria-label={tx('Propriedades', 'Properties')}>
      <div className="insp-in" id="p-prop">
        {alvo?.tipo === 'movel' ? <PropMovel key={alvo.obj.id} m={alvo.obj} /> : alvo?.tipo === 'parede' ? <PropEl key={alvo.obj.id} e={alvo.obj} /> : c ? <PropComodo key={c.id} c={c} /> : <p className="nota">{tx('Crie um cômodo para começar.', 'Create a room to get started.')}</p>}
      </div>
    </aside>
  );
}
