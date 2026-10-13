'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GRUPOS_TIPOS, ORDEM_PAREDE, ORDEM_TIPOS, TIPOS, TIPOS_PAREDE, ehParede, ehTipoComodo, horizontal, tipoMovel } from '@/lib/catalogo';
import { alvoSel, andaresOrdem, comodosDoAndar, comodosOrdem, cq, ladosDaPorta, nomeComodo } from '@/lib/consultas';
import { contar, moveisDo, type Contagem } from '@/lib/dados';
import { valsNovaParede, valsNovoMovel, validarComodo, validarMovel, validarParede, type Valores } from '@/lib/formularios';
import { iaNavegadorDisponivel } from '@/lib/iaNavegador';
import { reduzirImagem } from '@/lib/imagem';
import {
  abrirCenario, modoDesenho, pararPlanta, plantaPeloDesenho, adicionarEl, adicionarMovel, andarNoHistorico, apagarPonto, apagarTudo, atualizar, atualizarCenario, cenarioComNome, criarComodo, criarCorredor, criarPonto,
  desfazer, enquadrar, fecharDialogo, gerarSugestoes, importarDados, levarPara, listaHistorico, nomeComTraco, nomeComodoNovo, nomeCorredorNovo, nomeUnicoCenario, pararIA, pedirIA, posicionarComodo, refazer,
  removerAlvo, removerAndar, removerCenario, removerComodo, restaurarPonto, salvarAndar, salvarCenario, salvarComodo, salvarMovel, sobrescreverCenario, substituirCenario, toast, useApp, type Junto
} from '@/lib/store';
import type { Dados, Escopo, Parede, TipoMovel, TipoParede } from '@/lib/tipos';
import { tx } from '@/lib/i18n';
import { areaDaCasa, areaDoAndar, areaM2, fmtArea, textoResumo } from '@/lib/resumo';
import { dataCurta, fmtM, parseDist, parseMedida, pl } from '@/lib/util';
import { imagemDaPlanta } from '@/lib/exportar';
import { vaoEntre, type Alinhar, type Lado4 } from '@/lib/casa';
import { CamposMovel, CamposParede, Escolha, Marca, Texto, opcoesTipoComodo, useValores } from './campos';
import { Icone } from './icones';

function Cab({ t, sug }: { t: string; sug?: boolean }) {
  return <div className="dlg-cab"><h2 id="dlg-t">{sug && <Icone n="estrela" />}{t}</h2><button type="button" className="folha-x" data-d="fechar" aria-label={tx('Fechar', 'Close')} onClick={fecharDialogo}><Icone n="x" /></button></div>;
}
function Sim({ rot, cls = 'prim', onSim, d }: { rot: string; cls?: string; onSim: () => void; d: string }) {
  return <div className="grade-acoes"><button className={`btn ${cls}`} type="button" data-d={d} onClick={onSim}>{rot}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>;
}

/* ---------- planta pela foto do desenho em papel ---------- */
function FotoDesenho({ dados }: { dados: Record<string, unknown> }) {
  const planta = useApp((s) => s.planta);
  const temCasa = useApp((s) => Object.keys(s.dados.comodos).length > 0);
  const [img, setImg] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [abrindo, setAbrindo] = useState(false);
  const [erroLocal, setErroLocal] = useState('');
  const erro = erroLocal || String(dados.erro || '');
  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setErroLocal(''); atualizar((s) => { if (s.dlg) s.dlg.dados.erro = ''; });
    if (!/^image\//.test(f.type)) { setErroLocal(tx('Escolha uma foto (imagem).', 'Choose a photo (an image).')); return; }
    if (f.size > 30 * 1024 * 1024) { setErroLocal(tx('Essa foto é grande demais. Tente outra.', 'That photo is too big. Try another one.')); return; }
    setAbrindo(true);
    try { setImg(await reduzirImagem(f, 1600)); } catch { setErroLocal(tx('Não consegui abrir essa foto. Tente outra.', 'Couldn’t open that photo. Try another one.')); } finally { setAbrindo(false); }
  };
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!img && texto.trim().length < 10) { setErroLocal(tx('Tire a foto do desenho ou descreva a casa nas observações.', 'Take a photo of the sketch or describe the home in the notes.')); return; }
    setErroLocal('');
    plantaPeloDesenho(img, texto);
  };
  return <>
    <Cab t={tx('Montar pelo desenho em papel', 'Build from a paper sketch')} />
    <p className="nota">{tx('Tire uma foto do rascunho da planta (de cima, com boa luz e a folha inteira). A IA lê o desenho e monta os cômodos, os corredores e as portas. Medidas escritas no papel ajudam muito.', 'Take a photo of your floor plan sketch (from above, with good light and the whole sheet). The AI reads it and builds the rooms, hallways and doors. Measurements written on the paper help a lot.')}</p>
    <form data-form="foto-desenho" noValidate onSubmit={enviar}>
      <label className={`foto-escolha${img ? ' com-foto' : ''}`}>
        <input type="file" accept="image/*" data-k="foto" disabled={planta.busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; escolher(f); }} />
        {img
          ? <img src={img} alt={tx('Foto do desenho', 'Photo of the sketch')} />
          : <span><Icone n="camera" />{abrindo ? tx('Abrindo a foto…', 'Opening the photo…') : tx('Tirar ou escolher a foto', 'Take or choose a photo')}</span>}
      </label>
      {img && !planta.busy && <p className="nota">{tx('Toque na foto para trocar.', 'Tap the photo to change it.')}</p>}
      <div className="campo full">
        <label htmlFor="fd-texto">{tx('Observações (opcional)', 'Notes (optional)')}</label>
        <textarea id="fd-texto" data-k="texto" rows={3} maxLength={2000} value={texto} disabled={planta.busy} onChange={(e) => setTexto(e.target.value)}
          placeholder={tx('Ex.: varanda grande na frente, sala, corredor com banheiro de um lado e dois quartos de frente um para o outro, cozinha pequena e outra varanda nos fundos.', 'E.g.: big porch at the front, living room, a hallway with a bathroom on one side and two bedrooms facing each other, a small kitchen and another porch at the back.')} />
      </div>
      {temCasa && <p className="nota">{tx('Os cômodos vão para um andar novo, “Do desenho”, sem mexer no que você já tem.', 'The rooms go to a new floor, “From the sketch”, without touching what you already have.')}</p>}
      {planta.busy && <p className="ia-status" role="status"><span className="spin" aria-hidden="true" />{planta.msg}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="grade-acoes">
        {planta.busy
          ? <button className="btn" type="button" data-d="parar" onClick={pararPlanta}>{tx('Parar', 'Stop')}</button>
          : <button className="btn prim" type="submit" data-d="montar">{tx('Montar a planta', 'Build the plan')}</button>}
        <button className="btn" type="button" data-d="desenhar" disabled={planta.busy} onClick={() => { fecharDialogo(); modoDesenho(true); }}>{tx('Prefiro desenhar aqui', 'I’d rather draw here')}</button>
      </div>
    </form>
  </>;
}

/** Os dois lados da parede escolhida no formulário da porta nova (o cômodo e o vizinho, ou a rua). */
function ladosNaParede(d: Dados, comodo: string, v: Valores): { dentro: string; fora: string } {
  const c = d.comodos[comodo], parede = (['cima', 'baixo', 'esquerda', 'direita'].includes(String(v.parede)) ? v.parede : 'cima') as Parede;
  const L = c ? (horizontal(parede) ? c.w : c.h) : 0, largura = Math.min(parseMedida(v.largura) || TIPOS_PAREDE.porta.larg, L), dist = parseDist(v.dist);
  const inicio = dist == null || Number.isNaN(dist) ? (L - largura) / 2 : dist;
  return ladosDaPorta(d, { comodo, parede, inicio, largura });
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
      {parede ? <CamposParede px="fa" tipo={tipo as TipoParede} v={v} set={set} add lados={tipo === 'porta' && q ? ladosNaParede(dados, q.id, v) : undefined} /> : <CamposMovel px="fa" tipo={tipo as TipoMovel} v={v} set={set} add />}
      <p className="nota">{parede
        ? `${add.ctx && add.ctx.parede ? tx('Já vem na parede e no ponto que você escolheu.', 'It’s already on the wall, at the spot you picked.') : tx('Em branco: largura padrão e no meio da parede.', 'Left blank: default width, centered on the wall.')} ${tx('Depois dá para arrastar pela parede.', 'You can drag it along the wall later.')}`
        : `${tx(`Medidas em metros (${fmtM(162)}) ou centímetros (162).`, `Measurements in meters (${fmtM(162)}) or centimeters (162).`)} ${add.ctx && add.ctx.x != null ? tx('Vai no ponto que você escolheu na planta.', 'It goes at the spot you picked on the floor plan.') : tx('Entra num lugar livre; depois é só arrastar.', 'It goes in a free spot; then just drag it.')}`}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{tx('Adicionar', 'Add')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
    </form>
  </>;
}

/* ---------- cômodo: novo ou editar ---------- */
/** Textos do alinhamento conforme o lado (à direita/esquerda alinha topo e base; acima/abaixo, esquerda e direita). */
function opcoesAlinhar(lado: string): [string, string][] {
  const lateral = lado === 'direita' || lado === 'esquerda';
  return [
    ['inicio', lateral ? tx('Topos alinhados', 'Tops aligned') : tx('Lados esquerdos alinhados', 'Left sides aligned')],
    ['meio', tx('Centralizado', 'Centered')],
    ['fim', lateral ? tx('Fundos alinhados', 'Bottoms aligned') : tx('Lados direitos alinhados', 'Right sides aligned')]
  ];
}
const opcoesLado = (comDe = true): [string, string][] => [
  ['direita', comDe ? tx('À direita de…', 'To the right of…') : tx('Para a direita', 'To the right')],
  ['esquerda', comDe ? tx('À esquerda de…', 'To the left of…') : tx('Para a esquerda', 'To the left')],
  ['acima', comDe ? tx('Acima de… (na planta)', 'Above… (on the plan)') : tx('Para cima (na planta)', 'Up (on the plan)')],
  ['abaixo', comDe ? tx('Abaixo de… (na planta)', 'Below… (on the plan)') : tx('Para baixo (na planta)', 'Down (on the plan)')]
];

function FormComodo({ dados: x }: { dados: Record<string, unknown> }) {
  const d = useApp((s) => s.dados);
  const atual = x.id ? d.comodos[String(x.id)] : null;
  const as = andaresOrdem(d);
  const andarIni = String(x.andar || (atual ? atual.andar : (useApp.getState().comodo && d.comodos[useApp.getState().comodo!]?.andar) || (as[0] && as[0].id) || ''));
  const refIni = String(x.ref || (!atual && useApp.getState().comodo && d.comodos[useApp.getState().comodo!]?.andar === andarIni ? useApp.getState().comodo : '') || '');
  const ini = useCallback(() => ({
    nome: atual ? atual.nome : nomeComodoNovo(d), tipo: atual ? atual.tipo || (atual.corredor ? 'corredor' : '') : '', w: atual ? fmtM(atual.w) : '', h: atual ? fmtM(atual.h) : '', andar: andarIni,
    onde: String(x.onde || 'auto'), ref: refIni, alinhar: 'inicio', espaco: ''
  }), [atual, d, andarIni, refIni, x.onde]);
  const [v, set] = useValores(ini, String(x.id || 'novo'));
  const [erro, setErro] = useState('');
  const andarSel = String(v.andar || andarIni);
  const vizinhos = comodosOrdem(d).filter((c) => c.andar === andarSel && (!atual || c.id !== atual.id));
  const onde = String(v.onde || 'auto'), ref = vizinhos.find((c) => c.id === v.ref) ? String(v.ref) : vizinhos[0]?.id || '';
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const r = validarComodo(v);
    if (r.erro) { setErro(r.erro); return; }
    const { nome, w, h } = r.campos!, tipo = ehTipoComodo(v.tipo) ? v.tipo : '';
    let junto: Junto | null = null;
    if (onde !== 'auto') {
      if (!ref) { setErro(tx('Não há outro cômodo neste andar para ficar ao lado.', 'There is no other room on this floor to place it next to.')); return; }
      const esp = parseDist(v.espaco);
      if (esp != null && (Number.isNaN(esp) || esp > 2000)) { setErro(tx('Espaço entre as paredes: em centímetros (ex.: 120) ou metros (1,20).', 'Gap between walls: in centimeters (e.g. 120) or meters (1.20).')); return; }
      junto = { ref, lado: onde as Lado4, alinhar: (String(v.alinhar) as Alinhar) || 'inicio', espaco: esp || 0 };
    }
    atualizar((s) => { s.dlg = null; });
    if (atual) {
      const tipoAntes = atual.tipo || (atual.corredor ? 'corredor' : '');
      salvarComodo(atual.id, { nome: nome || atual.nome, w, h, ...(tipo !== tipoAntes ? { tipo } : {}), ...(v.andar && v.andar !== atual.andar && !junto ? { andar: String(v.andar) } : {}) });
      if (junto) posicionarComodo(atual.id, junto);
      toast(tx('Cômodo atualizado.', 'Room updated.'));
      return;
    }
    const nm = nome || nomeComodoNovo(useApp.getState().dados);
    criarComodo({ nome: nm, w, h, andar: String(v.andar || '') || undefined, junto, tipo });
    enquadrar();
    toast(tx(`${nm} criado. Agora coloque as portas, janelas e os móveis.`, `${nm} created. Now add the doors, windows and furniture.`));
  };
  return <>
    <Cab t={atual ? tx('Editar cômodo', 'Edit room') : tx('Novo cômodo', 'New room')} />
    <form data-form="comodo" noValidate onSubmit={enviar}>
      <div className="campos">
        <Texto px="fq2" k="nome" rot={tx('Nome', 'Name')} v={v} set={set} full max={30} ph={tx('ex.: Quarto 1, Sala, Cozinha', 'e.g. Bedroom 1, Living room, Kitchen')} />
        <Escolha px="fq2" k="tipo" rot={tx('O que é (para as portas automáticas, a cor do piso e os móveis sugeridos)', 'What it is (for automatic doors, floor color and suggested furniture)')} v={v} set={set} full opts={opcoesTipoComodo(String(v.nome || ''))} />
        <Texto px="fq2" k="w" rot={tx('Largura (esquerda → direita)', 'Width (left → right)')} v={v} set={set} num ph={tx(`ex.: ${fmtM(300)}`, `e.g. ${fmtM(300)}`)} foco={!x.onde} />
        <Texto px="fq2" k="h" rot={tx('Comprimento (cima → baixo)', 'Length (top → bottom)')} v={v} set={set} num ph={tx(`ex.: ${fmtM(400)}`, `e.g. ${fmtM(400)}`)} />
        {as.length > 1 && <Escolha px="fq2" k="andar" rot={tx('Andar', 'Floor')} v={v} set={set} full opts={as.map((a) => [a.id, a.nome])} />}
        <Escolha px="fq2" k="onde" rot={tx('Onde fica na planta da casa', 'Where it goes on the home plan')} v={v} set={set} full
          opts={[['auto', atual ? tx('Deixar onde está', 'Keep it where it is') : tx('Ao lado dos outros (automático)', 'Next to the others (automatic)')], ...opcoesLado()]} />
        {onde !== 'auto' && <>
          <Escolha px="fq2" k="ref" rot={tx('Qual cômodo', 'Which room')} v={{ ...v, ref }} set={set} full opts={vizinhos.length ? vizinhos.map((c) => [c.id, c.nome]) : [['', tx('Nenhum cômodo neste andar', 'No rooms on this floor')]]} />
          <Escolha px="fq2" k="alinhar" rot={tx('Alinhamento', 'Alignment')} v={v} set={set} opts={opcoesAlinhar(onde)} />
          <Texto px="fq2" k="espaco" rot={tx('Espaço entre as paredes', 'Gap between walls')} v={v} set={set} num ph={tx('0 = dividem a parede', '0 = shared wall')} />
        </>}
      </div>
      <p className="nota">{tx(`Medidas de dentro, de parede a parede, em metros (${fmtM(300)}) ou centímetros (300).`, `Inside measurements, wall to wall, in meters (${fmtM(300)}) or centimeters (300).`)} {onde === 'auto' && !atual ? tx('O cômodo entra na planta da casa ao lado dos outros, dividindo a parede; depois é só arrastar pelo nome na vista Casa.', 'The room goes into the home plan next to the others, sharing a wall; then just drag it by its name in the Home view.') : ''}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{atual ? tx('Salvar', 'Save') : tx('Criar cômodo', 'Create room')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
    </form>
  </>;
}

/* ---------- corredor ligando cômodos ---------- */
function FormCorredor({ dados: x }: { dados: Record<string, unknown> }) {
  const d = useApp((s) => s.dados);
  const atualQ = useApp((s) => s.comodo);
  const todos = comodosOrdem(d);
  const aIni = String(x.a || (atualQ && d.comodos[atualQ] ? atualQ : todos[0]?.id || ''));
  const ini = useCallback(() => ({ nome: nomeCorredorNovo(d), a: aIni, b: String(x.b || ''), lado: 'direita', comprimento: '', largura: fmtM(100), alinhar: 'meio', portas: true }), [d, aIni, x.b]);
  const [v, set] = useValores(ini, 'corredor');
  const [erro, setErro] = useState('');
  const A = d.comodos[String(v.a)] || null;
  const outros = A ? todos.filter((c) => c.andar === A.andar && c.id !== A.id) : [];
  const B = outros.find((c) => c.id === v.b) || null;
  const lado = String(v.lado || 'direita') as Lado4;
  const vao = A && B ? vaoEntre(A, B, lado) : null;
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!A) { setErro(tx('Escolha de qual cômodo o corredor sai.', 'Choose the room the hallway starts from.')); return; }
    const larg = parseMedida(v.largura);
    if (!(larg >= 60 && larg <= 400)) { setErro(tx(`Largura do corredor: entre ${fmtM(60)} e ${fmtM(400)} m.`, `Hallway width: between ${fmtM(60)} and ${fmtM(400)} m.`)); return; }
    const txt = String(v.comprimento || '').trim();
    const comp = txt ? parseMedida(txt) : null;
    if (comp != null && !(comp >= 30 && comp <= 3000)) { setErro(tx(`Comprimento: entre ${fmtM(30)} e ${fmtM(3000)} m.`, `Length: between ${fmtM(30)} and ${fmtM(3000)} m.`)); return; }
    const r = criarCorredor({ nome: String(v.nome || '').trim(), a: A.id, b: B ? B.id : null, lado, comprimento: comp, largura: larg, alinhar: (String(v.alinhar) as Alinhar) || 'meio', portas: !!v.portas });
    if ('erro' in r) { setErro(r.erro); return; }
    atualizar((s) => { s.dlg = null; s.vista = 'casa'; });
    enquadrar();
    const nome = useApp.getState().dados.comodos[r.id]?.nome || '';
    toast(B ? tx(`${nome} criado ligando ${A.nome} e ${B.nome}.`, `${nome} created connecting ${A.nome} and ${B.nome}.`) : tx(`${nome} criado saindo de ${A.nome}.`, `${nome} created from ${A.nome}.`));
  };
  return <>
    <Cab t={tx('Novo corredor', 'New hallway')} />
    <p className="nota">{tx('O corredor sai de um cômodo, para o lado que você escolher, e pode chegar em outro. As portas das pontas já entram nas paredes dos dois.', 'The hallway starts at a room, goes the way you choose and can reach another room. The doors at its ends go into both walls.')}</p>
    <form data-form="corredor" noValidate onSubmit={enviar}>
      <div className="campos">
        <Texto px="fco" k="nome" rot={tx('Nome', 'Name')} v={v} set={set} full max={30} />
        <Escolha px="fco" k="a" rot={tx('Sai de', 'Starts at')} v={v} set={set} opts={todos.map((c) => [c.id, c.nome])} />
        <Escolha px="fco" k="lado" rot={tx('Para que lado', 'Which way')} v={v} set={set} opts={opcoesLado(false)} />
        <Escolha px="fco" k="b" rot={tx('Chega em', 'Ends at')} v={v} set={set} full opts={[['', tx('Nenhum (só o corredor)', 'None (just the hallway)')], ...outros.map((c) => [c.id, c.nome] as [string, string])]} />
        <Texto px="fco" k="comprimento" rot={tx('Comprimento', 'Length')} v={v} set={set} num
          ph={vao != null ? tx(`em branco: ${fmtM(vao)} m (o espaço que já existe)`, `blank: ${fmtM(vao)} m (the existing gap)`) : tx(`ex.: ${fmtM(300)}`, `e.g. ${fmtM(300)}`)} />
        <Texto px="fco" k="largura" rot={tx('Largura', 'Width')} v={v} set={set} num ph={tx(`ex.: ${fmtM(100)}`, `e.g. ${fmtM(100)}`)} />
        <Escolha px="fco" k="alinhar" rot={tx('Na parede de saída', 'On the starting wall')} v={v} set={set} full opts={opcoesAlinhar(lado)} />
        <Marca px="fco" k="portas" rot={tx('Ligar as pontas (porta para quarto e banheiro, passagem para sala e cozinha)', 'Connect the ends (a door to bedrooms and bathrooms, an opening to living room and kitchen)')} v={v} set={set} />
      </div>
      <p className="nota">{B && vao == null ? tx(`${B.nome} vai para a outra ponta do corredor.`, `${B.nome} moves to the other end of the hallway.`) : B ? tx(`Com o comprimento em branco, ${B.nome} fica onde está.`, `With the length blank, ${B.nome} stays where it is.`) : ''}</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade-acoes"><button className="btn prim" type="submit">{tx('Criar corredor', 'Create hallway')}</button><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Cancelar', 'Cancel')}</button></div>
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
    <p className="nota">{tx('O Cabeaí testa centenas de arrumações e mostra as', 'Cabeaí tries hundreds of layouts and shows the')} <b>{tx('3 melhores, diferentes entre si', '3 best ones, all different from each other')}</b>{tx(', respeitando portas, janelas, ar-condicionado, interruptores e tomadas, as portas dos móveis, as cadeiras e a passagem de 60 cm, e pondo o rack, a pia, a máquina de lavar e o fogão nos pontos de TV, água, esgoto e gás.', ', taking into account doors, windows, the air conditioner, switches and outlets, furniture doors, chairs and a 60 cm walkway, and putting the TV stand, sink, washer and stove at the TV, water, drain and gas hookups.')}</p>
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
    <p className="nota">{tx('Se mudar de ideia, dá para desfazer (↶) e o que havia antes fica guardado no Histórico.', 'If you change your mind, you can undo (↶), and what was here before stays saved in the History.')}</p>
    <Sim rot={tx('Importar', 'Import')} d="importar-sim" onSim={() => { atualizar((s) => { s.dlg = null; }); importarDados(x.novos as Dados); toast(tx('Arquivo importado.', 'File imported.'), '', 'desfazer'); }} />
  </>;
}

/* ---------- histórico: desfazer, refazer e pontos de restauração ---------- */
const hora = (t: number) => { try { return new Date(t).toLocaleTimeString(useApp.getState().idioma === 'en' ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
function Historico() {
  useApp((s) => s.hist.v);
  const hist = useApp((s) => s.hist);
  const pontos = useApp((s) => s.pontos);
  const temCasa = useApp((s) => Object.keys(s.dados.comodos).length > 0);
  const [nome, setNome] = useState('');
  const { feitos, desfeitos } = listaHistorico();
  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (criarPonto(nome.trim())) { setNome(''); toast(tx('Ponto de restauração guardado.', 'Restore point saved.')); }
  };
  return <>
    <Cab t={tx('Histórico', 'History')} />
    <div className="grade-acoes">
      <button className="btn" type="button" data-d="h-desfazer" disabled={!hist.desfazer} onClick={desfazer}><Icone n="desfazer" />{tx('Desfazer', 'Undo')}</button>
      <button className="btn" type="button" data-d="h-refazer" disabled={!hist.refazer} onClick={refazer}><Icone n="refazer" />{tx('Refazer', 'Redo')}</button>
    </div>
    <p className="grupo-t">{tx('Alterações desta visita', 'Changes in this visit')}</p>
    {!feitos.length && !desfeitos.length ? <p className="nota">{tx('Nenhuma alteração ainda. Cada coisa que você mudar aparece aqui, e dá para voltar até ela.', 'No changes yet. Everything you change shows up here, and you can go back to it.')}</p> : (
      <ol className="hist-lista" data-hist="passos">
        {desfeitos.slice().reverse().map((p, k, arr) => (
          <li key={'f' + k} className="desfeito"><span className="hist-t">{p.rotulo}</span><span className="hist-h">{hora(p.t)}</span>
            <button type="button" className="btn peq" data-d="h-refazer-ate" onClick={() => andarNoHistorico(-(arr.length - k))}>{tx('Refazer até aqui', 'Redo up to here')}</button></li>
        ))}
        <li className="agora"><span className="hist-t">{tx('Agora', 'Now')}</span></li>
        {feitos.map((p, k) => (
          <li key={'p' + k}><span className="hist-t">{p.rotulo}</span><span className="hist-h">{hora(p.t)}</span>
            <button type="button" className="btn peq" data-d="h-voltar" onClick={() => andarNoHistorico(k + 1)}>{k === 0 ? tx('Desfazer', 'Undo') : tx('Desfazer até aqui', 'Undo up to here')}</button></li>
        ))}
      </ol>
    )}
    <p className="grupo-t">{tx('Pontos de restauração', 'Restore points')}</p>
    <p className="nota">{tx('Guardam a casa inteira neste navegador (cômodos, paredes, móveis e cenários): sozinhos ao abrir, a cada 10 minutos de uso e antes de importar, apagar tudo ou montar pelo desenho, e quando você quiser. Voltar para um ponto também dá para desfazer.', 'They keep the whole home in this browser (rooms, walls, furniture and scenarios): automatically when you open it, every 10 minutes of use and before importing, deleting everything or building from a sketch, and whenever you want. Going back to a point can be undone too.')}</p>
    <form className="hist-novo" data-form="ponto" noValidate onSubmit={guardar}>
      <input type="text" data-k="ponto-nome" maxLength={60} value={nome} placeholder={tx('Nome (ex.: antes da reforma)', 'Name (e.g. before the renovation)')} aria-label={tx('Nome do ponto de restauração', 'Restore point name')} onChange={(e) => setNome(e.target.value)} />
      <button className="btn prim" type="submit" data-d="ponto-criar" disabled={!temCasa}>{tx('Guardar agora', 'Save now')}</button>
    </form>
    {pontos.length ? (
      <ul className="hist-lista" data-hist="pontos">
        {pontos.map((p) => (
          <li key={p.id} className={p.auto ? 'auto' : 'meu'}>
            <span className="hist-t">{p.nome}<small>{dataCurta(p.t)} · {p.resumo}{p.auto ? tx(' · automático', ' · automatic') : ''}</small></span>
            <span className="hist-b">
              <button type="button" className="btn peq" data-d="ponto-voltar" onClick={() => { if (restaurarPonto(p.id)) atualizar((s) => { s.dlg = null; }); }}>{tx('Voltar para este', 'Go back to this')}</button>
              <button type="button" className="ico-btn peq" data-d="ponto-apagar" aria-label={tx(`Apagar o ponto “${p.nome}”`, `Delete the point “${p.nome}”`)} onClick={() => apagarPonto(p.id)}><Icone n="x" /></button>
            </span>
          </li>
        ))}
      </ul>
    ) : <p className="nota">{tx('Nenhum ponto guardado ainda.', 'No points saved yet.')}</p>}
    <div className="acoes"><button className="btn" type="button" data-d="fechar" onClick={fecharDialogo}>{tx('Fechar', 'Close')}</button></div>
  </>;
}

/* ---------- resumo da casa e lista de móveis ---------- */
function Resumo() {
  const d = useApp((s) => s.dados);
  const [copiado, setCopiado] = useState(false);
  const as = andaresOrdem(d).filter((a) => comodosDoAndar(d, a.id).length);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(textoResumo(d)); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    catch { toast(tx('O navegador não deixou copiar. Selecione o texto e copie à mão.', 'The browser didn’t allow copying. Select the text and copy it by hand.'), 'erro'); }
  };
  const nm = Object.keys(d.moveis).length;
  return <>
    <Cab t={tx('Resumo da casa', 'Home summary')} />
    <p className="resumo-total"><b>{fmtArea(areaDaCasa(d))}</b> · {pl(Object.keys(d.comodos).length, tx('cômodo', 'room'), tx('cômodos', 'rooms'))} · {pl(nm, tx('móvel', 'item'), tx('móveis', 'items'))}</p>
    {as.map((a) => (
      <div key={a.id} className="resumo-andar">
        {as.length > 1 && <p className="grupo-t">{a.nome} · {fmtArea(areaDoAndar(d, a.id))}</p>}
        <table className="resumo-tab">
          <thead><tr><th scope="col">{tx('Cômodo', 'Room')}</th><th scope="col">{tx('Medidas', 'Size')}</th><th scope="col">{tx('Área', 'Area')}</th></tr></thead>
          <tbody>
            {comodosDoAndar(d, a.id).map((c) => {
              const ms = moveisDo(d, c.id);
              return [
                <tr key={c.id}><th scope="row">{c.nome}</th><td>{fmtM(c.w)} × {fmtM(c.h)} m</td><td>{fmtArea(areaM2(c))}</td></tr>,
                ...ms.map((m) => <tr key={m.id} className="resumo-movel"><td>{m.nome}</td><td colSpan={2}>{fmtM(m.larg)} × {fmtM(m.prof)} m</td></tr>)
              ];
            })}
          </tbody>
        </table>
      </div>
    ))}
    <div className="grade-acoes">
      <button className="btn prim" type="button" data-d="resumo-copiar" onClick={copiar}><Icone n="copiar" />{copiado ? tx('Copiado!', 'Copied!') : tx('Copiar a lista', 'Copy the list')}</button>
      <button className="btn" type="button" data-d="resumo-imagem" onClick={() => { fecharDialogo(); void imagemDaPlanta(); }}><Icone n="imagem" />{tx('Imagem da planta', 'Plan image')}</button>
    </div>
    <p className="nota">{tx('A lista vai como texto, para mandar por mensagem ou levar na loja.', 'The list goes as text, to send in a message or take to the store.')}</p>
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
    else if (t === 'corredor') corpo = <FormCorredor dados={x} />;
    else if (t === 'foto-desenho') corpo = <FotoDesenho dados={x} />;
    else if (t === 'sugestoes') corpo = <Sugestoes dados={x} />;
    else if (t === 'cenario') corpo = <SalvarCenario dados={x} />;
    else if (t === 'importar') corpo = <Importar dados={x} />;
    else if (t === 'historico') corpo = <Historico />;
    else if (t === 'resumo') corpo = <Resumo />;
    else if (t === 'remover-comodo') {
      const c = dados.comodos[String(x.id)];
      if (c) {
        const n = moveisDo(dados, c.id).length + Object.values(dados.els).filter((e) => e.comodo === c.id).length;
        corpo = <><Cab t={tx('Remover cômodo', 'Remove room')} /><p>{tx('Remover', 'Remove')} <b>{c.nome}</b>{n ? tx(` e ${pl(n, 'item', 'itens')} dele`, ` and its ${pl(n, 'item', 'items')}`) : ''}? {tx('Se mudar de ideia, use Desfazer (↶).', 'If you change your mind, use Undo (↶).')}</p>
          <Sim rot={tx('Sim, remover', 'Yes, remove')} cls="perigo cheio" d="remover-comodo-sim" onSim={() => { const nome = c.nome; removerComodo(c.id); atualizar((s) => { s.dlg = null; }); enquadrar(); toast(tx(`${nome} removido.`, `${nome} removed.`), '', 'desfazer'); }} /></>;
      }
    } else if (t === 'remover-item') {
      const a = alvoSel(dados, useApp.getState().sel, useApp.getState().selEl);
      if (a) corpo = <><Cab t={tx('Remover', 'Remove')} /><p>{tx('Remover', 'Remove')} <b>{a.obj.nome}</b> {tx('da planta?', 'from the floor plan?')}</p><Sim rot={tx('Sim, remover', 'Yes, remove')} cls="perigo cheio" d="remover-item-sim" onSim={() => { const nome = a.obj.nome; removerAlvo(); atualizar((s) => { s.dlg = null; }); toast(tx(`${nome} removido.`, `${nome} removed.`), '', 'desfazer'); }} /></>;
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
        corpo = <><Cab t={tx('Remover andar', 'Remove floor')} /><p>{tx('Remover', 'Remove')} <b>{a.nome}</b>{cs.length ? tx(` e ${pl(cs.length, 'cômodo', 'cômodos')} dele (com tudo o que está dentro)`, ` and its ${pl(cs.length, 'room', 'rooms')} (with everything inside)`) : ''}? {tx('Se mudar de ideia, use Desfazer (↶).', 'If you change your mind, use Undo (↶).')}</p>
          <Sim rot={tx('Sim, remover', 'Yes, remove')} cls="perigo cheio" d="remover-andar-sim" onSim={() => { const nome = a.nome; removerAndar(a.id); atualizar((s) => { s.dlg = null; }); enquadrar(); toast(tx(`${nome} removido.`, `${nome} removed.`), '', 'desfazer'); }} /></>;
      }
    } else if (t === 'andar-comodo') {
      const c = dados.comodos[String(x.id)];
      if (c) corpo = <><Cab t={tx(`Levar ${c.nome} para`, `Move ${c.nome} to`)} /><div className="grade-acoes">{andaresOrdem(dados).filter((a) => a.id !== c.andar).map((a) => (
        <button key={a.id} className="btn" type="button" onClick={() => { salvarComodo(c.id, { andar: a.id }); atualizar((s) => { s.dlg = null; }); enquadrar(); toast(tx(`${c.nome} foi para ${a.nome}.`, `${c.nome} moved to ${a.nome}.`)); }}>{a.nome}</button>
      ))}</div></>;
    } else if (t === 'zerar') {
      corpo = <><Cab t={tx('Apagar tudo', 'Delete everything')} /><p>{tx('Apagar todos os andares, cômodos, móveis e cenários deste navegador? Se mudar de ideia, use Desfazer (↶) ou volte pelo Histórico, que guarda um ponto de restauração antes. Para ter uma cópia fora daqui, use Exportar.', 'Delete all floors, rooms, furniture and scenarios from this browser? If you change your mind, use Undo (↶) or go back through the History, which keeps a restore point first. To keep a copy elsewhere, use Export.')}</p>
        <Sim rot={tx('Sim, apagar tudo', 'Yes, delete everything')} cls="perigo cheio" d="zerar-sim" onSim={() => { atualizar((s) => { s.dlg = null; }); apagarTudo(); toast(tx('Tudo apagado.', 'Everything deleted.'), '', 'desfazer'); }} /></>;
    } else if (t === 'apoiar') {
      corpo = <Apoiar />;
    } else if (t === 'ajuda') {
      corpo = <><Cab t={tx('Como usar', 'How to use')} /><ul className="atalhos">
        <li><b>{tx('Cômodos:', 'Rooms:')}</b> {tx('“+ Novo cômodo” no painel da esquerda. Medidas de dentro, de parede a parede.', '“+ New room” in the left panel. Inside measurements, wall to wall.')}</li>
        <li><b>{tx('Desenhar:', 'Draw:')}</b> {tx('toque em “Desenhar”, escolha o que vai desenhar (sala, quarto, corredor…) e arraste na planta. O ímã junta as paredes, e corredor e varanda já ganham porta ou passagem para os cômodos que tocam. Na barra de baixo, escolha Porta, De correr, Passagem ou Janela e toque numa parede para pôr ali; “Cômodo” volta a desenhar cômodos.', 'tap “Draw”, pick what to draw (living room, bedroom, hallway…) and drag on the plan. Snap joins the walls, and hallways and porches get a door or an opening to the rooms they touch. In the bar at the bottom, pick Door, Sliding, Opening or Window and tap a wall to put it there; “Room” goes back to drawing rooms.')}</li>
        <li><b>{tx('Barra de ações:', 'Action bar:')}</b> {tx('tocar num móvel, numa porta ou num cômodo mostra, em cima dele, o que dá para fazer: girar, duplicar, editar e, em “Mais”, o resto. No modo de desenhar ela fica embaixo, junto das ferramentas, para não cobrir as paredes.', 'tapping a piece of furniture, a door or a room shows what you can do right above it: rotate, duplicate, edit and, under “More”, everything else. While drawing it sits at the bottom, next to the tools, so it doesn’t cover the walls.')}</li>
        <li><b>{tx('Portas:', 'Doors:')}</b> {tx('a porta é da parede entre os dois cômodos, e dá para tocar nela pelos dois lados. Com ela selecionada, a barra de ações vira a porta: “Abrir para…” diz para que cômodo ela vai abrir e “Dobradiça” troca o lado da dobradiça (na de correr, “Correr” troca o lado para onde ela corre). Em “Mais” dá para escolher porta de abrir, dupla, de correr ou só a passagem. As portas que entram sozinhas ficam perto do canto, abrindo encostadas na parede.', 'the door belongs to the wall between the two rooms, and you can tap it from either side. With it selected, the action bar flips it: “Open into…” says which room it will open into and “Hinge” switches the hinge side (on a sliding door, “Slide” switches the side it slides to). Under “More” you can pick a hinged, double or sliding door, or just an opening. Automatic doors go near a corner, opening against the wall.')}</li>
        <li><b>{tx('Foto do desenho:', 'Sketch photo:')}</b> {tx('tire uma foto do rascunho feito no papel e a IA monta os cômodos, os corredores e as portas. Depois é só conferir as medidas.', 'take a photo of a sketch on paper and the AI builds the rooms, hallways and doors. Then just check the measurements.')}</li>
        <li><b>{tx('Casa:', 'Home:')}</b> {tx('na vista Casa os cômodos aparecem montados, cada andar lado a lado, com a área de cada um. Toque num cômodo para selecionar: arraste pelo piso ou pelo nome para mudar o lugar, use as alças azuis para esticar as paredes e “Girar”, na barra em cima dele, para girar. Cada cômodo ganha o piso do tipo dele (madeira no quarto, cerâmica no banheiro…). Perto de outro cômodo as paredes grudam (ficam acesas) e, se um deles é corredor ou varanda, a porta já entra sozinha.', 'the Home view shows the rooms put together, each floor side by side, with each room’s area. Tap a room to select it: drag it by its floor or name to move it, use the blue handles to stretch its walls and “Rotate”, in the bar above it, to rotate it. Each room gets the floor that fits its type (wood in bedrooms, tiles in bathrooms…). Near another room the walls snap together (they light up) and, if one of them is a hallway or porch, the door goes in by itself.')}</li>
        <li><b>{tx('Tirar parede:', 'Remove a wall:')}</b> {tx('com o cômodo selecionado, toque na tesoura da parede que ele divide com o vizinho (ou em Paredes): os dois viram um espaço só, em L ou do jeito que ficarem. Os tijolos põem a parede de volta.', 'with the room selected, tap the scissors on the wall it shares with a neighbor (or Walls): both become one space, L-shaped or however they fit. The bricks put the wall back.')}</li>
        <li><b>{tx('Desfazer e histórico:', 'Undo and history:')}</b> {tx('↶ e ↷ no topo (ou Ctrl+Z e Ctrl+Shift+Z). O relógio mostra tudo o que mudou e os pontos de restauração, que guardam a casa inteira para voltar depois.', '↶ and ↷ at the top (or Ctrl+Z and Ctrl+Shift+Z). The clock shows everything that changed and the restore points, which keep the whole home to go back to later.')}</li>
        <li><b>{tx('Esconder móveis:', 'Hide furniture:')}</b> {tx('o botão do sofá, no canto da planta, esconde os móveis para mexer em portas, janelas, no ar e nas tomadas; o das camadas escolhe o que mais aparece (nomes, pontos, piso, grade…).', 'the sofa button, in the corner of the plan, hides the furniture so you can work on doors, windows, the AC and outlets; the layers button picks what else shows (names, hookups, floor, grid…).')}</li>
        <li><b>{tx('Trena:', 'Tape measure:')}</b> {tx('o botão da trena (ou a tecla M) mede qualquer distância: arraste de um ponto ao outro; as pontas grudam nas paredes e nos móveis.', 'the tape button (or the M key) measures any distance: drag from one point to another; the ends snap to walls and furniture.')}</li>
        <li><b>{tx('Andares:', 'Floors:')}</b> {tx('“+ Novo andar” no painel; cada cômodo fica num andar.', '“+ New floor” in the panel; each room is on one floor.')}</li>
        <li><b>{tx('Adicionar:', 'Add:')}</b> {tx('botão “Adicionar”, o “+” de cada grupo, ou segure o dedo (botão direito) no ponto da planta.', 'the “Add” button, the “+” on each group, or press and hold (right-click) on a spot in the floor plan.')}</li>
        <li><b>{tx('Mover:', 'Move:')}</b> {tx('arraste. Vendo vários cômodos, dá para levar o móvel de um para o outro arrastando.', 'drag. When you see several rooms, you can drag furniture from one to another.')}</li>
        <li><b>{tx('Mesa com cadeiras:', 'Table with chairs:')}</b> {tx('na mesa, escolha quantas cadeiras vêm junto e de que lado; o espaço para puxar entra na conta.', 'on the table, choose how many chairs come with it and on which side; the space to pull them out is counted.')}</li>
        <li><b>{tx('Cama com baú:', 'Bed with storage chest:')}</b> {tx('baú na cabeceira, nos pés ou nos dois, com largura e posição próprias.', 'a chest at the headboard, at the foot of the bed or both, each with its own width and position.')}</li>
        <li><b>{tx('Corredores:', 'Hallways:')}</b> {tx('“+ Corredor” liga dois cômodos com o comprimento e a largura que você escolher; nas pontas, quarto e banheiro ganham porta e sala e cozinha, passagem. Um cômodo novo também pode ficar à direita, à esquerda, acima ou abaixo de outro, e “O que é” diz se ele é sala, quarto, corredor…', '“+ Hallway” connects two rooms with the length and width you choose; at its ends, bedrooms and bathrooms get a door and living rooms and kitchens an opening. A new room can also go to the right, left, above or below another one, and “What it is” says whether it’s a living room, bedroom, hallway…')}</li>
        <li><b>{tx('Pontos na parede:', 'Wall points:')}</b> {tx('em “Tomada e outros pontos”, escolha interruptor, tomada, arandela, TV, internet, água, esgoto ou gás. As sugestões põem o rack no ponto de TV, a pia e a máquina de lavar na água e no esgoto e o fogão no gás.', 'in “Outlet or hookup”, pick a switch, outlet, wall light, TV outlet, network jack, water, drain or gas hookup. Suggestions put the TV stand at the TV outlet, the sink and washer at the water and drain, and the stove at the gas.')}</li>
        <li><b>{tx('Escadas:', 'Stairs:')}</b> {tx('reta ou caracol, em Adicionar → Escada. Já entram travadas, para as sugestões não mexerem nelas.', 'straight or spiral, in Add → Stairs. They start locked, so suggestions leave them alone.')}</li>
        <li><b>{tx('Setas coloridas:', 'Colored arrows:')}</b> {tx('o espaço que sobra em volta do móvel. Vermelho: não passa (menos de 60 cm). Amarelo: apertado. Verde: passa bem.', 'the free space left around the furniture. Red: no way through (under 60 cm). Yellow: tight. Green: plenty of room.')}</li>
        <li><b>{tx('Cenários:', 'Scenarios:')}</b> {tx('fotos da arrumação, de um cômodo ou da casa toda, para comparar e voltar a usar.', 'snapshots of the layout, of one room or the whole home, to compare and use again.')}</li>
        <li><b>{tx('Sugestões:', 'Suggestions:')}</b> {tx('3 arrumações diferentes. Trave os móveis que não quer mexer. Também dá para pedir à IA, de graça.', '3 different layouts. Lock the furniture you don’t want moved. You can also ask the AI, for free.')}</li>
        <li><b>{tx('Copiar e duplicar:', 'Copy and duplicate:')}</b> {tx('copie um móvel ou item de parede e cole em outro cômodo (Ctrl+C e Ctrl+V, ou segurando o dedo no cômodo). Um cômodo inteiro também se duplica, com o que tem dentro.', 'copy a piece of furniture or a wall item and paste it into another room (Ctrl+C and Ctrl+V, or press and hold in the room). A whole room can be duplicated too, with what’s inside.')}</li>
        <li><b>{tx('Resumo e imagem:', 'Summary and image:')}</b> {tx('no menu ⋯, o resumo mostra a área de cada cômodo e a lista de móveis para copiar; “Salvar a planta como imagem” baixa um PNG (no celular, abre o compartilhar).', 'in the ⋯ menu, the summary shows each room’s area and the furniture list to copy; “Save the plan as an image” downloads a PNG (on a phone, it opens sharing).')}</li>
        <li><b>{tx('Modo avançado:', 'Advanced mode:')}</b> {tx('painel de propriedades com posição em cm, ímã, medidas em todos e atalhos de teclado.', 'properties panel with position in cm, snap, measurements on everything and keyboard shortcuts.')}</li>
      </ul>
        <p className="grupo-t">{tx('Atalhos de teclado', 'Keyboard shortcuts')}</p>
        <ul className="atalhos">
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> {tx('desfazer', 'undo')} · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> {tx('ou', 'or')} <kbd>Ctrl</kbd>+<kbd>Y</kbd> {tx('refazer', 'redo')}</li>
          <li><kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd> {tx('copiar e colar', 'copy and paste')} · <kbd>Ctrl</kbd>+<kbd>D</kbd> {tx('duplicar', 'duplicate')} · <kbd>Delete</kbd> {tx('remover', 'remove')}</li>
          <li><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> {tx('mover 1 cm', 'move 1 cm')} ({tx('com', 'with')} <kbd>Shift</kbd>, 10 cm) · <kbd>R</kbd> {tx('girar', 'rotate')}</li>
          <li><kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>0</kbd> {tx('enquadrar', 'fit')} · <kbd>{tx('Espaço', 'Space')}</kbd> {tx('segurado: mover a planta', 'held: move the plan')}</li>
          <li><kbd>M</kbd> {tx('trena', 'tape measure')} · <kbd>Esc</kbd> {tx('sair ou tirar a seleção', 'exit or clear selection')} · <kbd>?</kbd> {tx('esta ajuda', 'this help')}</li>
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

