'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GRUPOS_TIPOS, ORDEM_PAREDE, ORDEM_TIPOS, TIPOS, TIPOS_PAREDE, ehParede, tipoMovel } from '@/lib/catalogo';
import { alvoSel, andaresOrdem, comodosDoAndar, comodosOrdem, cq, nomeComodo } from '@/lib/consultas';
import { contar, moveisDo, type Contagem } from '@/lib/dados';
import { valsNovaParede, valsNovoMovel, validarComodo, validarMovel, validarParede, type Valores } from '@/lib/formularios';
import { iaNavegadorDisponivel } from '@/lib/iaNavegador';
import {
  abrirCenario, adicionarEl, adicionarMovel, atualizar, atualizarCenario, cenarioComNome, criarComodo, enquadrar, fecharDialogo, gerarSugestoes, levarPara,
  limparSel, nomeComTraco, nomeComodoNovo, nomeUnicoCenario, pararIA, pedirIA, removerAlvo, removerAndar, removerCenario, removerComodo, salvarAndar, salvarCenario,
  salvarComodo, salvarMovel, sobrescreverCenario, substituirCenario, toast, trocarDados, useApp
} from '@/lib/store';
import type { Dados, Escopo, TipoMovel, TipoParede } from '@/lib/tipos';
import { tx } from '@/lib/i18n';
import { fmtM, pl } from '@/lib/util';
import { CamposMovel, CamposParede, Escolha, Texto, useValores } from './campos';
import { Icone } from './icones';

function Cab({ t, sug }: { t: string; sug?: boolean }) {
  return <div className="dlg-cab"><h2 id="dlg-t">{sug && <Icone n="estrela" />}{t}</h2><button type="button" className="folha-x" data-d="fechar" aria-label={tx('Fechar', 'Close')} onClick={fecharDialogo}><Icone n="x" /></button></div>;
}
function Sim({ rot, cls = 'prim', onSim, d }: { rot: string; cls?: string; onSim: () => void; d: string }) {
  return <div className="grade-acoes"><button className={`btn ${cls}`} type="button" data-d={d} onClick={onSim}>{rot}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>;
}

/* ---------- adicionar móvel ou item de parede ---------- */
function Adicionar() {
  const add = useApp((s) => s.add);
  const dados = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  const tipo = add.tipo, parede = ehParede(tipo);
  const qid = (add.ctx && add.ctx.comodo) || comodo, q = qid ? dados.comodos[qid] : null;
  const ini = useCallback(() => (parede ? valsNovaParede(tipo as TipoParede, q, add.ctx, add.rascunho) : valsNovoMovel(tipo as TipoMovel, add.rascunho)), [parede, tipo, q, add.ctx, add.rascunho]);
  const [v, set] = useValores(ini, tipo);
  const [erro, setErro] = useState('');
  const t = parede ? TIPOS_PAREDE[tipo as TipoParede] : TIPOS[tipo as TipoMovel];
  const trocar = (novo: string) => {
    if (novo === tipo) return;
    const r: Valores = {};
    if (!ehParede(novo) && !parede) for (const k of ['nome', 'larg', 'prof']) if (v[k]) r[k] = v[k];
    const ctx0 = add.ctx, mesmo = ctx0 && (ehParede(novo) === parede || (ctx0.x == null && !ctx0.parede));
    atualizar((s) => { s.add = { tipo: novo, ctx: mesmo ? ctx0 : ctx0 ? { comodo: ctx0.comodo } : null, rascunho: r }; });
    setErro('');
  };
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q) return;
    let r;
    if (parede) {
      const val = validarParede(v, tipo as TipoParede, q, null);
      if (val.erro) { setErro(val.erro); return; }
      r = adicionarEl(tipo as TipoParede, val.campos!, add.ctx);
    } else {
      const val = validarMovel(v, tipo as TipoMovel, null);
      if (val.erro) { setErro(val.erro); return; }
      r = adicionarMovel(tipo as TipoMovel, val.campos!, add.ctx);
    }
    if (!r) { setErro(tx('Crie um cômodo primeiro.', 'Create a room first.')); return; }
    atualizar((s) => { s.add = { tipo, ctx: null, rascunho: {} }; s.dlg = null; });
    toast(tx(`${r.nome} entrou em ${q.nome}. Arraste para ajustar.`, `${r.nome} added to ${q.nome}. Drag it to adjust.`));
  };
  const chip = (k: string, rot: string, cls = '') => <button key={k} type="button" className={`tipo${cls}`} data-tipo={k} aria-pressed={k === tipo} onClick={() => trocar(k)}>{rot}</button>;
  return <>
    <Cab t={t.novo} />
    <p className="nota">{tx('Em', 'In')} <b>{q ? q.nome : ''}</b>{add.ctx && (add.ctx.x != null || add.ctx.parede) ? tx(', no ponto que você escolheu', ', at the spot you picked') : ''}.</p>
    {GRUPOS_TIPOS.map((g) => {
      const ks = ORDEM_TIPOS.filter((k) => TIPOS[k].grupo === g.id);
      return <div key={g.id}><p className="grupo-t">{g.rot}</p><div className="tipos" role="group" aria-label={g.rot}>{ks.map((k) => chip(k, TIPOS[k].chip))}</div></div>;
    })}
    <p className="grupo-t">{tx('Na parede', 'On the wall')}</p>
    <div className="tipos" role="group" aria-label={tx('Itens de parede', 'Wall items')}>{ORDEM_PAREDE.map((k) => chip(k, TIPOS_PAREDE[k].rot, ' parede'))}</div>
    <form data-form="add" noValidate onSubmit={enviar}>
      {parede ? <CamposParede px="fa" tipo={tipo as TipoParede} v={v} set={set} add /> : <CamposMovel px="fa" tipo={tipo as TipoMovel} v={v} set={set} add />}
      <p className="nota">{parede
        ? `${add.ctx && add.ctx.parede ? tx('Já vem na parede e no ponto que você escolheu.', 'It’s already on the wall, at the spot you picked.') : tx('Em branco: largura padrão e no meio da parede.', 'Left blank: default width, centered on the wall.')} ${tx('Depois dá para arrastar pela parede.', 'You can drag it along the wall later.')}`
        : `${tx(`Medidas em metros (${fmtM(162)}) ou centímetros (162).`, `Measurements in meters (${fmtM(162)}) or centimeters (162).`)} ${add.ctx && add.ctx.x != null ? tx('Vai no ponto que você escolheu na planta.', 'It goes at the spot you picked on the floor plan.') : tx('Entra num lugar livre; depois é só arrastar.', 'It goes in a free spot; then just drag it.')}`}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{tx('Adicionar', 'Add')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
    </form>
  </>;
}

/* ---------- cômodo: novo ou editar ---------- */
function FormComodo({ dados: x }: { dados: Record<string, unknown> }) {
  const d = useApp((s) => s.dados);
  const atual = x.id ? d.comodos[String(x.id)] : null;
  const as = andaresOrdem(d);
  const andarIni = String(x.andar || (atual ? atual.andar : (useApp.getState().comodo && d.comodos[useApp.getState().comodo!]?.andar) || (as[0] && as[0].id) || ''));
  const ini = useCallback(() => ({ nome: atual ? atual.nome : nomeComodoNovo(d), w: atual ? fmtM(atual.w) : '', h: atual ? fmtM(atual.h) : '', andar: andarIni }), [atual, d, andarIni]);
  const [v, set] = useValores(ini, String(x.id || 'novo'));
  const [erro, setErro] = useState('');
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const r = validarComodo(v);
    if (r.erro) { setErro(r.erro); return; }
    const { nome, w, h } = r.campos!;
    atualizar((s) => { s.dlg = null; });
    if (atual) { salvarComodo(atual.id, { nome: nome || atual.nome, w, h, ...(v.andar && v.andar !== atual.andar ? { andar: String(v.andar) } : {}) }); toast(tx('Cômodo atualizado.', 'Room updated.')); return; }
    const nm = nome || nomeComodoNovo(useApp.getState().dados);
    criarComodo({ nome: nm, w, h, andar: String(v.andar || '') || undefined });
    enquadrar();
    toast(tx(`${nm} criado. Agora coloque as portas, janelas e os móveis.`, `${nm} created. Now add the doors, windows and furniture.`));
  };
  return <>
    <Cab t={atual ? tx('Editar cômodo', 'Edit room') : tx('Novo cômodo', 'New room')} />
    <form data-form="comodo" noValidate onSubmit={enviar}>
      <div className="campos">
        <Texto px="fq2" k="nome" rot={tx('Nome', 'Name')} v={v} set={set} full max={30} ph={tx('ex.: Quarto 1, Sala, Cozinha', 'e.g. Bedroom 1, Living room, Kitchen')} />
        <Texto px="fq2" k="w" rot={tx('Largura (esquerda → direita)', 'Width (left → right)')} v={v} set={set} num ph={tx(`ex.: ${fmtM(300)}`, `e.g. ${fmtM(300)}`)} foco />
        <Texto px="fq2" k="h" rot={tx('Comprimento (cima → baixo)', 'Length (top → bottom)')} v={v} set={set} num ph={tx(`ex.: ${fmtM(400)}`, `e.g. ${fmtM(400)}`)} />
        {as.length > 1 && <Escolha px="fq2" k="andar" rot={tx('Andar', 'Floor')} v={v} set={set} full opts={as.map((a) => [a.id, a.nome])} />}
      </div>
      <p className="nota">{tx(`Medidas de dentro, de parede a parede, em metros (${fmtM(300)}) ou centímetros (300).`, `Inside measurements, wall to wall, in meters (${fmtM(300)}) or centimeters (300).`)} {atual ? '' : tx('O cômodo entra na planta da casa ao lado dos outros, dividindo a parede; depois é só arrastar pelo nome na vista Casa.', 'The room goes into the home plan next to the others, sharing a wall; then just drag it by its name in the Home view.')}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{atual ? tx('Salvar', 'Save') : tx('Criar cômodo', 'Create room')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
    </form>
  </>;
}

/* ---------- sugestões ---------- */
function Sugestoes({ dados: x }: { dados: Record<string, unknown> }) {
  const d = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  const sug = useApp((s) => s.sug);
  const ia = useApp((s) => s.ia);
  const q = comodo ? d.comodos[comodo] : null;
  const nComodos = Object.keys(d.comodos).length;
  const escopo: Escopo = (x.escopo as Escopo) === 'casa' && nComodos > 1 ? 'casa' : q ? 'comodo' : 'casa';
  const ids = escopo === 'casa' ? comodosOrdem(d).map((c) => c.id) : q ? [q.id] : [];
  const moveis = ids.flatMap((id) => moveisDo(d, id));
  const ocupado = sug.busy || ia.busy;
  const [navegador, setNavegador] = useState<string>('unavailable');
  useEffect(() => { let vivo = true; iaNavegadorDisponivel().then((r) => { if (vivo) setNavegador(r); }); return () => { vivo = false; }; }, []);
  const mudar = (e: Escopo) => atualizar((s) => { if (s.dlg) { s.dlg.dados.escopo = e; s.dlg.dados.erro = ''; } });
  const comIA = escopo === 'comodo' && moveis.some((m) => !m.fixo);
  return <>
    <Cab t={tx('Sugestões', 'Suggestions')} sug />
    <p className="nota">{tx('O Cabeaí testa centenas de arrumações e mostra as', 'Cabeaí tries hundreds of layouts and shows the')} <b>{tx('3 melhores, diferentes entre si', '3 best ones, all different from each other')}</b>{tx(', respeitando portas, janelas, ar-condicionado, interruptores, as portas dos móveis, as cadeiras e a passagem de 60 cm.', ', taking into account doors, windows, the air conditioner, switches, furniture doors, chairs and a 60 cm walkway.')}</p>
    <div className="opcoes-radio" role="radiogroup" aria-label={tx('Para onde', 'Where')}>
      {q && <label className="radio"><input type="radio" name="sug-escopo" value="comodo" checked={escopo === 'comodo'} disabled={ocupado} onChange={() => mudar('comodo')} /><span><b>{tx(`Só ${q.nome}`, `Only ${q.nome}`)}</b><span>{pl(moveisDo(d, q.id).length, tx('móvel', 'item'), tx('móveis', 'items'))}</span></span></label>}
      {nComodos > 1 && <label className="radio"><input type="radio" name="sug-escopo" value="casa" checked={escopo === 'casa'} disabled={ocupado} onChange={() => mudar('casa')} /><span><b>{tx('A casa toda', 'The whole home')}</b><span>{tx('Uma arrumação para cada cômodo, juntas num cenário da casa.', 'One layout for each room, together in one home scenario.')}</span></span></label>}
    </div>
    {moveis.length ? <>
      <p className="grupo-t">{tx('Manter no lugar (não mexer)', 'Keep in place (don’t move)')}</p>
      <div className="checks">{moveis.map((m) => (
        <label key={m.id} className="check" htmlFor={`fx-${m.id}`}>
          <input type="checkbox" id={`fx-${m.id}`} data-fixo={m.id} checked={m.fixo} disabled={ocupado} onChange={(e) => salvarMovel(m.id, { fixo: e.target.checked })} />
          <span>{m.nome}{nComodos > 1 && escopo === 'casa' && <small> · {nomeComodo(d, m.comodo)}</small>}</span>
        </label>
      ))}</div>
    </> : <p className="nota"><b>{tx('Coloque pelo menos um móvel', 'Add at least one piece of furniture')}</b> {tx('para receber sugestões.', 'to get suggestions.')}</p>}
    {ocupado ? <>
      <div className="ia-status" role="status"><span className="spin" aria-hidden="true" />{sug.busy ? sug.msg : ia.msg}</div>
      {ia.busy && <div className="acoes"><button className="btn" type="button" data-d="ia-parar" onClick={pararIA}>{tx('Parar', 'Stop')}</button></div>}
    </> : <>
      {typeof x.erro === 'string' && x.erro && <p className="erro" role="status">{x.erro}</p>}
      <div className="acoes"><button className="btn prim full-w" type="button" data-d="sug-gerar" disabled={!moveis.length} onClick={() => gerarSugestoes(escopo)}><Icone n="estrela" />{tx('Gerar 3 sugestões', 'Make 3 suggestions')}</button></div>
      {comIA && <>
        <p className="grupo-t">{tx('Com inteligência artificial (grátis)', 'With artificial intelligence (free)')}</p>
        <div className={navegador === 'available' || navegador === 'downloadable' ? 'grade-acoes' : 'acoes'}>
          <button className={`btn sug${navegador === 'available' || navegador === 'downloadable' ? '' : ' full-w'}`} type="button" data-d="ia-pedir" onClick={() => pedirIA('online')}><Icone n="ia" />{tx('Pedir à IA', 'Ask the AI')}</button>
          {(navegador === 'available' || navegador === 'downloadable') && <button className="btn sug" type="button" data-d="ia-navegador" onClick={() => pedirIA('navegador')}><Icone n="ia" />{tx('IA do navegador', 'Browser AI')}</button>}
        </div>
        <p className="nota">{tx('A IA lê as medidas deste cômodo e propõe 3 arrumações; o Cabeaí confere cada uma.', 'The AI reads this room’s measurements and proposes 3 layouts; Cabeaí checks each one.')} {navegador === 'available' || navegador === 'downloadable' ? tx('A “IA do navegador” roda no seu computador, sem internet.', '“Browser AI” runs on your computer, no internet needed.') : ''}</p>
      </>}
    </>}
    <p className="nota">{tx('Cada sugestão vira um cenário para comparar. Toque em “Guardar” para manter uma; ao gerar de novo, as que você não guardou são trocadas.', 'Each suggestion becomes a scenario you can compare. Tap “Keep” to hold on to one; when you make new ones, the ones you didn’t keep are replaced.')}</p>
  </>;
}

/* ---------- cenários ---------- */
function SalvarCenario({ dados: x }: { dados: Record<string, unknown> }) {
  const d = useApp((s) => s.dados);
  const comodo = useApp((s) => s.comodo);
  const verCen = useApp((s) => s.verCen);
  const cenBase = useApp((s) => s.cenBase);
  const q = comodo ? d.comodos[comodo] : null;
  // o cenário que está aberto (ou de onde veio a arrumação atual) pode ser atualizado
  const baseId = [verCen, cenBase].find((id) => !!id && !!d.cenarios[id]) || null;
  const base = baseId ? d.cenarios[baseId] : null;
  const [modo, setModo] = useState<'atualizar' | 'novo'>(base ? 'atualizar' : 'novo');
  const [v, set, setV] = useValores(useCallback(() => ({ nome: base ? base.nome : nomeUnicoCenario(d) }), [base, d]), 'cen');
  const [escopo, setEscopo] = useState<Escopo>(base ? base.escopo : (x.escopo as Escopo) || 'casa');
  const [conflito, setConflito] = useState<null | { id: string; nome: string; sugestao: string }>(null);
  const alcance = (e: Escopo, c: string | null) => (e === 'casa' ? tx('casa toda', 'whole home') : nomeComodo(d, c));

  const trocarModo = (m: 'atualizar' | 'novo') => {
    setModo(m); setConflito(null);
    if (m === 'novo') { setV({ nome: nomeUnicoCenario(d) }); setEscopo((x.escopo as Escopo) || 'casa'); }
    else if (base) { setV({ nome: base.nome }); setEscopo(base.escopo); }
  };
  const concluir = (msg: string) => { atualizar((s) => { s.dlg = null; }); toast(msg); };
  const salvar = (nome: string, substituir: string | null) => {
    if (substituir && (!base || modo === 'novo' || substituir !== base.id)) {
      if (modo === 'atualizar' && base) {
        // outro cenário já tinha esse nome: ele sai e o atual fica com o nome
        removerCenario(substituir);
        substituirCenario(base.id, base.escopo, base.comodo, nome);
        concluir(tx(`Cenário “${nome}” atualizado.`, `Scenario “${nome}” updated.`));
        return;
      }
      substituirCenario(substituir, escopo, comodo, nome);
      concluir(tx(`Cenário “${nome}” substituído pela arrumação de agora.`, `Scenario “${nome}” replaced with the current layout.`));
      return;
    }
    if (modo === 'atualizar' && base) {
      substituirCenario(base.id, base.escopo, base.comodo, nome);
      concluir(tx(`Cenário “${nome}” atualizado com a arrumação de agora.`, `Scenario “${nome}” updated with the current layout.`));
      return;
    }
    salvarCenario(nome, escopo, comodo);
    concluir(tx(`Cenário “${nome}” salvo (${alcance(escopo, comodo)}).`, `Scenario “${nome}” saved (${alcance(escopo, comodo)}).`));
  };
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = String(v.nome || '').trim().slice(0, 40) || (modo === 'atualizar' && base ? base.nome : nomeUnicoCenario(d));
    const outro = cenarioComNome(d, nome, modo === 'atualizar' && base ? base.id : null);
    if (outro) { setConflito({ id: outro.id, nome: outro.nome, sugestao: nomeComTraco(d, nome) }); return; }
    salvar(nome, null);
  };
  return <>
    <Cab t={tx('Salvar cenário', 'Save scenario')} />
    <form data-form="cenario" noValidate onSubmit={enviar}>
      {base && (
        <div className="opcoes-radio" role="radiogroup" aria-label={tx('Como salvar', 'How to save')}>
          <label className="radio"><input type="radio" name="modo" value="atualizar" checked={modo === 'atualizar'} onChange={() => trocarModo('atualizar')} />
            <span><b>{tx(`Atualizar “${base.nome}”`, `Update “${base.nome}”`)}</b><span>{tx(`Troca a arrumação guardada nele pela de agora (${alcance(base.escopo, base.comodo)}).`, `Replaces the layout stored in it with the current one (${alcance(base.escopo, base.comodo)}).`)}</span></span></label>
          <label className="radio"><input type="radio" name="modo" value="novo" checked={modo === 'novo'} onChange={() => trocarModo('novo')} />
            <span><b>{tx('Salvar como um cenário novo', 'Save as a new scenario')}</b><span>{tx(`“${base.nome}” continua como está.`, `“${base.nome}” stays as it is.`)}</span></span></label>
        </div>
      )}
      <Texto px="fc" k="nome" rot={tx('Nome do cenário', 'Scenario name')} v={v} set={(k, val) => { set(k, val); setConflito(null); }} full max={40} />
      {conflito && (
        <div className="conflito" role="alert">
          <p className="erro">{tx(`Já existe um cenário chamado “${conflito.nome}”.`, `There is already a scenario named “${conflito.nome}”.`)}</p>
          <div className="grade-acoes">
            <button className="btn perigo" type="button" data-d="cen-substituir" onClick={() => salvar(conflito.nome, conflito.id)}>{tx(`Substituir “${conflito.nome}”`, `Replace “${conflito.nome}”`)}</button>
            <button className="btn prim" type="button" data-d="cen-novo-nome" onClick={() => { setV({ nome: conflito.sugestao }); salvar(conflito.sugestao, null); }}>{tx(`Salvar como “${conflito.sugestao}”`, `Save as “${conflito.sugestao}”`)}</button>
          </div>
          <p className="nota">{tx('Ou troque o nome acima e toque em Salvar.', 'Or change the name above and tap Save.')}</p>
        </div>
      )}
      {modo === 'novo' && (
        <div className="opcoes-radio" role="radiogroup" aria-label={tx('O que salvar', 'What to save')}>
          <label className="radio"><input type="radio" name="escopo" value="casa" checked={escopo === 'casa'} onChange={() => setEscopo('casa')} /><span><b>{tx('A casa toda', 'The whole home')}</b><span>{tx(`Guarda a arrumação de todos os cômodos (${pl(Object.keys(d.moveis).length, 'móvel', 'móveis')}).`, `Stores the layout of every room (${pl(Object.keys(d.moveis).length, 'item', 'items')}).`)}</span></span></label>
          {q && <label className="radio"><input type="radio" name="escopo" value="comodo" checked={escopo === 'comodo'} onChange={() => setEscopo('comodo')} /><span><b>{tx(`Só ${q.nome}`, `Only ${q.nome}`)}</b><span>{tx('Os outros cômodos não entram.', 'The other rooms are left out.')}</span></span></label>}
        </div>
      )}
      <p className="nota">{tx('O cenário é uma foto da arrumação. Toque nele na faixa de cima para comparar com o atual; “Usar este” põe tudo de volta nessas posições.', 'A scenario is a snapshot of the layout. Tap it in the top bar to compare it with the current one; “Use this” puts everything back in those positions.')}</p>
      <div className="grade-acoes"><button className="btn prim" type="submit">{modo === 'atualizar' ? tx('Atualizar cenário', 'Update scenario') : tx('Salvar cenário', 'Save scenario')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
    </form>
  </>;
}

/* ---------- apoiar o projeto ---------- */
export const PATROCINIO = 'https://github.com/sponsors/HerbertJulio';
export const REPOSITORIO = 'https://github.com/HerbertJulio/cabeai';
const PIX = 'hvcotta@gmail.com';
function Apoiar() {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(PIX); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    catch { toast(tx(`Chave PIX: ${PIX}`, `PIX key: ${PIX}`)); }
  };
  return <>
    <Cab t={tx('Apoie o Cabeaí', 'Support Cabeaí')} />
    <p>{tx('O Cabeaí é grátis, sem anúncios e de código aberto. Se ele te ajudou a arrumar a casa, você pode apoiar o projeto com qualquer valor.', 'Cabeaí is free, ad-free and open source. If it helped you plan your home, you can support the project with any amount.')}</p>
    <div className="apoio">
      <a className="btn prim full-w" href={PATROCINIO} target="_blank" rel="noopener noreferrer" data-d="patrocinar"><Icone n="coracao" />{tx('Patrocinar no GitHub', 'Sponsor on GitHub')}</a>
      <div className="pix">
        <div><b>{tx('PIX (chave e-mail)', 'PIX (Brazil, e-mail key)')}</b><span>{PIX}</span></div>
        <button className="btn peq" type="button" data-d="copiar-pix" onClick={copiar}>{copiado ? tx('Copiado!', 'Copied!') : tx('Copiar', 'Copy')}</button>
      </div>
      <a className="btn full-w" href={REPOSITORIO} target="_blank" rel="noopener noreferrer"><Icone n="estrela" />{tx('Dar uma estrela no GitHub', 'Star it on GitHub')}</a>
    </div>
    <p className="nota">{tx('Obrigado! Ideias e problemas também ajudam: abra uma issue no GitHub.', 'Thank you! Ideas and bug reports help too: open an issue on GitHub.')}</p>
    <div className="acoes"><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Fechar', 'Close')}</button></div>
  </>;
}

function Renomear({ titulo, atual, onSalvar, max = 40 }: { titulo: string; atual: string; onSalvar: (n: string) => void; max?: number }) {
  const [v, set] = useValores(useCallback(() => ({ nome: atual }), [atual]), atual);
  return <>
    <Cab t={titulo} />
    <form data-form="renomear" noValidate onSubmit={(e) => { e.preventDefault(); const n = String(v.nome || '').trim().slice(0, max); if (n) onSalvar(n); atualizar((s) => { s.dlg = null; }); }}>
      <Texto px="fr" k="nome" rot={tx('Nome', 'Name')} v={v} set={set} full max={max} foco />
      <div className="grade-acoes"><button className="btn prim" type="submit">{tx('Salvar', 'Save')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
    </form>
  </>;
}

function Importar({ dados: x }: { dados: Record<string, unknown> }) {
  const n = useApp((s) => Object.keys(s.dados.comodos).length);
  const c = x.cont as Contagem;
  return <>
    <Cab t={tx('Importar arquivo', 'Import file')} />
    <p>{tx('O arquivo tem', 'The file has')} <b>{pl(c.comodos, tx('cômodo', 'room'), tx('cômodos', 'rooms'))}</b>{c.andares > 1 ? tx(` em ${c.andares} andares`, ` on ${c.andares} floors`) : ''}, {pl(c.itens, 'item', tx('itens', 'items'))} {tx('e', 'and')} {pl(c.cenarios, tx('cenário', 'scenario'), tx('cenários', 'scenarios'))}.</p>
    {n > 0 && <p className="erro">{tx(`Isso troca tudo o que está aqui agora (${pl(n, 'cômodo', 'cômodos')}) pelo conteúdo do arquivo. Se quiser guardar o atual, exporte antes.`, `This replaces everything here now (${pl(n, 'room', 'rooms')}) with what’s in the file. To keep what you have, export it first.`)}</p>}
    <Sim rot={tx('Importar', 'Import')} d="importar-sim" onSim={() => { atualizar((s) => { s.dlg = null; }); trocarDados(x.novos as Dados); atualizar((s) => { s.vista = 'casa'; }); toast(tx('Arquivo importado.', 'File imported.')); }} />
  </>;
}

export default function Dialogo() {
  const dlg = useApp((s) => s.dlg);
  const dados = useApp((s) => s.dados);
  const ref = useRef<HTMLDialogElement>(null);
  const baixo = useRef<EventTarget | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (dlg && !el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    if (!dlg && el.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
  }, [dlg]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const cancel = (e: Event) => { e.preventDefault(); fecharDialogo(); };
    el.addEventListener('cancel', cancel);
    return () => el.removeEventListener('cancel', cancel);
  }, []);
  let corpo: React.ReactNode = null;
  if (dlg) {
    const x = dlg.dados, t = dlg.tipo;
    if (t === 'add') corpo = <Adicionar />;
    else if (t === 'comodo') corpo = <FormComodo dados={x} />;
    else if (t === 'sugestoes') corpo = <Sugestoes dados={x} />;
    else if (t === 'cenario') corpo = <SalvarCenario dados={x} />;
    else if (t === 'importar') corpo = <Importar dados={x} />;
    else if (t === 'remover-comodo') {
      const c = dados.comodos[String(x.id)];
      if (c) {
        const n = moveisDo(dados, c.id).length + Object.values(dados.els).filter((e) => e.comodo === c.id).length;
        corpo = <><Cab t={tx('Remover cômodo', 'Remove room')} /><p>{tx('Remover', 'Remove')} <b>{c.nome}</b>{n ? tx(` e ${pl(n, 'item', 'itens')} dele`, ` and its ${pl(n, 'item', 'items')}`) : ''}? {tx('Não dá para desfazer.', 'This can’t be undone.')}</p>
          <Sim rot={tx('Sim, remover', 'Yes, remove')} cls="perigo cheio" d="remover-comodo-sim" onSim={() => { const nome = c.nome; removerComodo(c.id); atualizar((s) => { s.dlg = null; }); enquadrar(); toast(tx(`${nome} removido.`, `${nome} removed.`)); }} /></>;
      }
    } else if (t === 'remover-item') {
      const a = alvoSel(dados, useApp.getState().sel, useApp.getState().selEl);
      if (a) corpo = <><Cab t={tx('Remover', 'Remove')} /><p>{tx('Remover', 'Remove')} <b>{a.obj.nome}</b> {tx('da planta?', 'from the floor plan?')}</p><Sim rot={tx('Sim, remover', 'Yes, remove')} cls="perigo cheio" d="remover-item-sim" onSim={() => { removerAlvo(); atualizar((s) => { s.dlg = null; }); }} /></>;
    } else if (t === 'cen-nome') {
      const c = dados.cenarios[String(x.id)];
      if (c) corpo = <Renomear titulo={tx('Renomear cenário', 'Rename scenario')} atual={c.nome} onSalvar={(n) => atualizarCenario(c.id, { nome: n })} />;
    } else if (t === 'cen-remover') {
      const c = dados.cenarios[String(x.id)];
      if (c) corpo = <><Cab t={tx('Apagar cenário', 'Delete scenario')} /><p>{tx(`Apagar “${c.nome}”? Os móveis continuam onde estão agora.`, `Delete “${c.nome}”? The furniture stays where it is now.`)}</p><Sim rot={tx('Sim, apagar', 'Yes, delete')} cls="perigo cheio" d="cen-remover-sim" onSim={() => { removerCenario(c.id); atualizar((s) => { s.dlg = null; }); }} /></>;
    } else if (t === 'cen-sobrescrever') {
      const c = dados.cenarios[String(x.id)];
      if (c) corpo = <><Cab t={tx('Salvar o atual por cima', 'Overwrite with the current layout')} /><p>{tx('Trocar o que está guardado em', 'Replace what’s stored in')} “{c.nome}” {tx('pela arrumação atual', 'with the current layout')} {c.escopo === 'casa' ? tx('da casa', 'of the whole home') : tx('de ', 'of ') + nomeComodo(dados, c.comodo)}?</p>
        <Sim rot={tx('Sim, trocar', 'Yes, replace')} d="cen-sobrescrever-sim" onSim={() => { sobrescreverCenario(c.id); atualizar((s) => { s.dlg = null; }); toast(tx('Cenário atualizado com a arrumação de agora.', 'Scenario updated with the current layout.')); }} /></>;
    } else if (t === 'levar') {
      const a = alvoSel(dados, useApp.getState().sel, useApp.getState().selEl);
      if (a && a.tipo === 'movel') {
        const outros = comodosOrdem(dados).filter((c) => c.id !== a.obj.comodo);
        corpo = <><Cab t={tx('Levar para outro cômodo', 'Move to another room')} /><p className="nota">{tx('Para onde vai', 'Where should')} <b>{a.obj.nome}</b>{tx('? Ele entra num lugar livre do cômodo escolhido.', ' go? It goes into a free spot in the room you pick.')}</p>
          <div className="grade-acoes">{outros.map((c) => <button key={c.id} className="btn" type="button" data-d="levar-para" data-q={c.id} onClick={() => { atualizar((s) => { s.dlg = null; }); levarPara(c.id); }}>{c.nome}</button>)}</div></>;
      }
    } else if (t === 'andar-nome') {
      const a = dados.andares[String(x.id)];
      if (a) corpo = <Renomear titulo={tx('Renomear andar', 'Rename floor')} atual={a.nome} max={30} onSalvar={(n) => salvarAndar(a.id, { nome: n })} />;
    } else if (t === 'remover-andar') {
      const a = dados.andares[String(x.id)];
      if (a) {
        const cs = comodosDoAndar(dados, a.id);
        corpo = <><Cab t={tx('Remover andar', 'Remove floor')} /><p>{tx('Remover', 'Remove')} <b>{a.nome}</b>{cs.length ? tx(` e ${pl(cs.length, 'cômodo', 'cômodos')} dele (com tudo o que está dentro)`, ` and its ${pl(cs.length, 'room', 'rooms')} (with everything inside)`) : ''}? {tx('Não dá para desfazer.', 'This can’t be undone.')}</p>
          <Sim rot={tx('Sim, remover', 'Yes, remove')} cls="perigo cheio" d="remover-andar-sim" onSim={() => { const nome = a.nome; removerAndar(a.id); atualizar((s) => { s.dlg = null; }); enquadrar(); toast(tx(`${nome} removido.`, `${nome} removed.`)); }} /></>;
      }
    } else if (t === 'andar-comodo') {
      const c = dados.comodos[String(x.id)];
      if (c) corpo = <><Cab t={tx(`Levar ${c.nome} para`, `Move ${c.nome} to`)} /><div className="grade-acoes">{andaresOrdem(dados).filter((a) => a.id !== c.andar).map((a) => (
        <button key={a.id} className="btn" type="button" onClick={() => { salvarComodo(c.id, { andar: a.id }); atualizar((s) => { s.dlg = null; }); enquadrar(); toast(tx(`${c.nome} foi para ${a.nome}.`, `${c.nome} moved to ${a.nome}.`)); }}>{a.nome}</button>
      ))}</div></>;
    } else if (t === 'zerar') {
      corpo = <><Cab t={tx('Apagar tudo', 'Delete everything')} /><p>{tx('Apagar todos os andares, cômodos, móveis e cenários deste navegador? Não dá para desfazer. Se quiser guardar uma cópia, use Exportar antes.', 'Delete all floors, rooms, furniture and scenarios from this browser? This can’t be undone. To keep a copy, use Export first.')}</p>
        <Sim rot={tx('Sim, apagar tudo', 'Yes, delete everything')} cls="perigo cheio" d="zerar-sim" onSim={() => { atualizar((s) => { s.dlg = null; }); trocarDados({ andares: {}, comodos: {}, moveis: {}, els: {}, cenarios: {} }); limparSel(); toast(tx('Tudo apagado.', 'Everything deleted.')); }} /></>;
    } else if (t === 'apoiar') {
      corpo = <Apoiar />;
    } else if (t === 'ajuda') {
      corpo = <><Cab t={tx('Como usar', 'How to use')} /><ul className="atalhos">
        <li><b>{tx('Cômodos:', 'Rooms:')}</b> {tx('“+ Novo cômodo” no painel da esquerda. Medidas de dentro, de parede a parede.', '“+ New room” in the left panel. Inside measurements, wall to wall.')}</li>
        <li><b>{tx('Casa:', 'Home:')}</b> {tx('na vista Casa os cômodos aparecem montados, cada andar lado a lado. Arraste um cômodo pelo nome para mudar o lugar dele; perto de outro, o ímã encosta as paredes. As setas mostram o espaço até o vizinho.', 'the Home view shows the rooms put together, each floor side by side. Drag a room by its name to move it; near another room, snap brings the walls together. The arrows show the space to the next room.')}</li>
        <li><b>{tx('Andares:', 'Floors:')}</b> {tx('“+ Novo andar” no painel; cada cômodo fica num andar.', '“+ New floor” in the panel; each room is on one floor.')}</li>
        <li><b>{tx('Adicionar:', 'Add:')}</b> {tx('botão “Adicionar”, o “+” de cada grupo, ou segure o dedo (botão direito) no ponto da planta.', 'the “Add” button, the “+” on each group, or press and hold (right-click) on a spot in the floor plan.')}</li>
        <li><b>{tx('Mover:', 'Move:')}</b> {tx('arraste. Vendo vários cômodos, dá para levar o móvel de um para o outro arrastando.', 'drag. When you see several rooms, you can drag furniture from one to another.')}</li>
        <li><b>{tx('Mesa com cadeiras:', 'Table with chairs:')}</b> {tx('na mesa, escolha quantas cadeiras vêm junto e de que lado; o espaço para puxar entra na conta.', 'on the table, choose how many chairs come with it and on which side; the space to pull them out is counted.')}</li>
        <li><b>{tx('Cama com baú:', 'Bed with storage chest:')}</b> {tx('baú na cabeceira, nos pés ou nos dois, com largura e posição próprias.', 'a chest at the headboard, at the foot of the bed or both, each with its own width and position.')}</li>
        <li><b>{tx('Setas coloridas:', 'Colored arrows:')}</b> {tx('o espaço que sobra em volta do móvel. Vermelho: não passa (menos de 60 cm). Amarelo: apertado. Verde: passa bem.', 'the free space left around the furniture. Red: no way through (under 60 cm). Yellow: tight. Green: plenty of room.')}</li>
        <li><b>{tx('Cenários:', 'Scenarios:')}</b> {tx('fotos da arrumação, de um cômodo ou da casa toda, para comparar e voltar a usar.', 'snapshots of the layout, of one room or the whole home, to compare and use again.')}</li>
        <li><b>{tx('Sugestões:', 'Suggestions:')}</b> {tx('3 arrumações diferentes. Trave os móveis que não quer mexer. Também dá para pedir à IA, de graça.', '3 different layouts. Lock the furniture you don’t want moved. You can also ask the AI, for free.')}</li>
        <li><b>{tx('Modo avançado:', 'Advanced mode:')}</b> {tx('painel de propriedades com posição em cm, ímã, medidas em todos e atalhos de teclado.', 'properties panel with position in cm, snap, measurements on everything and keyboard shortcuts.')}</li>
      </ul>
        <p className="nota">{tx('Seus dados ficam só neste navegador. Use Exportar para guardar uma cópia ou levar para outro aparelho. O Cabeaí é grátis e de código aberto.', 'Your data stays only in this browser. Use Export to keep a copy or move it to another device. Cabeaí is free and open source.')}</p>
        <div className="acoes"><button className="btn prim" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Entendi', 'Got it')}</button></div></>;
    }
  }
  return (
    <dialog className="dlg" id="dlg" ref={ref} aria-labelledby="dlg-t"
      onPointerDown={(e) => { baixo.current = e.target; }}
      onClick={(e) => { if (e.target === ref.current && baixo.current === ref.current) fecharDialogo(); }}>
      <div className="dlg-in" id="dlg-in">{corpo}</div>
    </dialog>
  );
}

