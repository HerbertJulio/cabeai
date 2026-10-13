'use client';
// O passo a passo para montar a casa: o terreno, o contorno da casa, os cômodos, as portas e janelas e, por último,
// os móveis (ou só um cômodo). Cada etapa diz se é obrigatória; as opcionais têm "Pular". A planta mostra o resultado
// enquanto a pessoa digita e, nos cômodos e nas portas, é nela que se trabalha.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { caixaDe } from '@/lib/casa';
import { COMODO_NOME, LIM_COMODO, LIM_TERRENO, TIPOS_COMODO, tipoDoComodo } from '@/lib/catalogo';
import { andaresOrdem, comodosDoAndar, comodosOrdem } from '@/lib/consultas';
import { moveisDo } from '@/lib/dados';
import { tx } from '@/lib/i18n';
import { MODELOS, MODELO_NOME, contornoNoTerreno, frenteHorizontal, kitDoComodo, nomesDosTipos, parseMetros, recuos, terrenoEmVolta } from '@/lib/montar';
import { areaM2, fmtArea } from '@/lib/resumo';
import {
  ETAPAS, aplicarModelo, criarCasa, criarComodo, fecharPassos, ferramentaDesenho, ferramentaDividir, iniciarAdd, irParaEtapa, mobiliar, mudarTipoComodo,
  porAberturas, previaPassos, recolherPassos, removerTerreno, salvarComodo, salvarTerreno, seguirPassos, tamanhoPassos, toast, useApp, voltarPassos, type Etapa, type PecaParede
} from '@/lib/store';
import type { Dados, Parede, TipoComodo } from '@/lib/tipos';
import { fmtM, pl } from '@/lib/util';
import { Icone } from './icones';

const ROTULO: Record<Etapa, () => string> = {
  terreno: () => tx('Terreno', 'Plot'), casa: () => tx('Casa', 'House'), comodos: () => tx('Cômodos', 'Rooms'),
  aberturas: () => tx('Portas', 'Doors'), moveis: () => tx('Móveis', 'Furniture'), comodo: () => tx('Cômodo', 'Room')
};
const TITULO: Record<Etapa, () => string> = {
  terreno: () => tx('O terreno', 'The plot'), casa: () => tx('A casa', 'The house'), comodos: () => tx('Os cômodos', 'The rooms'),
  aberturas: () => tx('Portas e janelas', 'Doors and windows'), moveis: () => tx('Os móveis', 'The furniture'), comodo: () => tx('O cômodo', 'The room')
};
const OPCIONAL: Etapa[] = ['terreno', 'casa', 'aberturas', 'moveis'];
const RUAS = (): [Parede, string][] => [['baixo', tx('Embaixo', 'Bottom')], ['cima', tx('Em cima', 'Top')], ['esquerda', tx('Esquerda', 'Left')], ['direita', tx('Direita', 'Right')]];
const PECAS = (): [PecaParede, string][] => [['porta', tx('Porta', 'Door')], ['correr', tx('De correr', 'Sliding')], ['vao', tx('Passagem', 'Opening')], ['janela', tx('Janela', 'Window')]];

/** O contorno de fora da casa no andar de baixo (para o terreno ficar em volta dela). */
function contornoDeBaixo(d: Dados): { x: number; y: number; w: number; h: number } | null {
  const a = d.terreno && d.andares[d.terreno.andar] ? d.terreno.andar : andaresOrdem(d)[0]?.id;
  const b = a ? caixaDe(comodosDoAndar(d, a)) : null;
  return b ? { x: b.x1, y: b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1 } : null;
}

function Campo({ id, rot, valor, muda, ph, ajuda }: { id: string; rot: string; valor: string; muda: (v: string) => void; ph?: string; ajuda?: string }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rot}</label>
      <input id={id} inputMode="decimal" autoComplete="off" value={valor} placeholder={ph} aria-describedby={ajuda ? id + '-a' : undefined} onChange={(e) => muda(e.target.value)} />
      {ajuda && <span className="campo-ajuda" id={id + '-a'}>{ajuda}</span>}
    </div>
  );
}

/** O título da etapa e o que fazer nela (a primeira frase diz se é obrigatória). */
function Cabeca({ etapa, texto }: { etapa: Etapa; texto: string }) {
  return (
    <div className="passos-tit">
      <h3>{TITULO[etapa]()}</h3>
      <p><b>{OPCIONAL.includes(etapa) ? tx('Opcional.', 'Optional.') : tx('Obrigatório.', 'Required.')}</b> {texto}</p>
    </div>
  );
}

/** Voltar, Pular (nas etapas opcionais) e Continuar. Num formulário ("form"), Continuar envia o formulário. */
function Rodape({ form, continuar, pular, rotulo, desativado, nota }: { form?: boolean; continuar?: () => void; pular?: () => void; rotulo?: string; desativado?: boolean; nota?: string }) {
  const p = useApp((s) => s.passo), lista = ETAPAS[p.rota], k = lista.indexOf(p.etapa), ultima = k === lista.length - 1;
  return (
    <footer className="passos-pe">
      {nota && <p className="nota">{nota}</p>}
      <div className="passos-botoes">
        <button type="button" className="btn" data-acao="passos-voltar" disabled={k <= 0} onClick={voltarPassos}><Icone n="voltar" />{tx('Voltar', 'Back')}</button>
        <span className="passos-esp" />
        {pular && !ultima && <button type="button" className="btn" data-acao="passos-pular" onClick={pular}>{tx('Pular', 'Skip')}</button>}
        <button type={form ? 'submit' : 'button'} className="btn prim" data-acao="passos-continuar" disabled={desativado} onClick={form ? undefined : () => (continuar ? continuar() : seguirPassos(false))}>
          {rotulo || (ultima ? tx('Concluir', 'Finish') : tx('Continuar', 'Continue'))}
        </button>
      </div>
    </footer>
  );
}

/* ---------- 1. terreno ---------- */
function EtapaTerreno() {
  const dados = useApp((s) => s.dados);
  const t0 = dados.terreno;
  const [v, setV] = useState(() => t0
    ? { frente: fmtM(frenteHorizontal(t0.rua) ? t0.w : t0.h), fundo: fmtM(frenteHorizontal(t0.rua) ? t0.h : t0.w), rua: t0.rua }
    : { frente: fmtM(1000), fundo: fmtM(2500), rua: 'baixo' as Parede });
  const [erro, setErro] = useState('');
  const frente = parseMetros(v.frente), fundo = parseMetros(v.fundo);
  const ok = [frente, fundo].every((n) => n >= LIM_TERRENO.min && n <= LIM_TERRENO.max);
  const casa = useMemo(() => contornoDeBaixo(dados), [dados]);
  useEffect(() => { previaPassos(ok ? { terreno: terrenoEmVolta(casa, frente, fundo, v.rua) } : null); }, [ok, frente, fundo, v.rua, casa]);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!ok) { setErro(tx('Escreva a frente e o fundo do terreno, de 3 a 300 m (por exemplo, 10 e 25).', 'Type the plot’s front and depth, from 3 to 300 m (for example, 10 and 25).')); return; }
    salvarTerreno(frente, fundo, v.rua);
    seguirPassos(false);
  };
  return (
    <form className="passos-form" noValidate onSubmit={enviar}>
      <div className="passos-corpo">
        <Cabeca etapa="terreno" texto={tx('A frente e o fundo do lote e de que lado fica a rua. Sem essas medidas, pule: dá para pôr depois.', 'The lot’s front and depth and which side the street is on. If you don’t have them, skip: you can add them later.')} />
        <div className="campos">
          <Campo id="pt-frente" rot={tx('Frente (m)', 'Front (m)')} valor={v.frente} muda={(x) => { setV({ ...v, frente: x }); setErro(''); }} />
          <Campo id="pt-fundo" rot={tx('Fundo (m)', 'Depth (m)')} valor={v.fundo} muda={(x) => { setV({ ...v, fundo: x }); setErro(''); }} />
        </div>
        <div className="passos-linha">
          <span className="passos-rot" id="pt-rua">{tx('A rua fica', 'The street is at the')}</span>
          <div className="seg seg-cheio" role="group" aria-labelledby="pt-rua">
            {RUAS().map(([p, rot]) => <button key={p} type="button" data-rua={p} aria-pressed={v.rua === p} onClick={() => setV({ ...v, rua: p })}>{rot}</button>)}
          </div>
        </div>
        {ok && <p className="nota">{tx(`${fmtArea((frente * fundo) / 10000)} de terreno.`, `${fmtArea((frente * fundo) / 10000)} plot.`)}{casa ? tx(' A casa que já existe fica no meio dele.', ' The existing house goes in the middle of it.') : ''}</p>}
        {t0 && <button type="button" className="btn peq passos-tirar" data-acao="passos-tirar-terreno" onClick={() => { removerTerreno(); seguirPassos(true); }}>{tx('Tirar o terreno', 'Remove the plot')}</button>}
        {erro && <p className="erro" role="alert">{erro}</p>}
      </div>
      <Rodape form pular={() => seguirPassos(true)} />
    </form>
  );
}

/* ---------- 2. casa ---------- */
function EtapaCasa() {
  const dados = useApp((s) => s.dados);
  const temCasa = Object.keys(dados.comodos).length > 0;
  return temCasa ? <CasaPronta /> : <CasaNova />;
}
function CasaPronta() {
  const dados = useApp((s) => s.dados), caixa = contornoDeBaixo(dados), t = dados.terreno;
  const n = andaresOrdem(dados).filter((a) => comodosDoAndar(dados, a.id).length).length;
  const r = t && caixa ? recuos(t, caixa) : null, hz = t ? frenteHorizontal(t.rua) : true;
  return (
    <>
      <div className="passos-corpo">
        <Cabeca etapa="casa" texto={tx('A casa já tem cômodos. Para mudar o tamanho dela, arraste as paredes de fora no passo dos cômodos.', 'The house already has rooms. To change its size, drag its outside walls in the rooms step.')} />
        {caixa && <p className="passos-medida">{fmtM(hz ? caixa.w : caixa.h)} × {fmtM(hz ? caixa.h : caixa.w)} m {tx('por fora', 'outside')}{n > 1 ? tx(`, ${n} andares`, `, ${n} floors`) : ''}</p>}
        {r && <p className="nota">{tx(`Recuos: ${fmtM(r.frente)} m na frente, ${fmtM(r.fundo)} m no fundo e ${fmtM(r.lado1)} e ${fmtM(r.lado2)} m dos lados.`, `Setbacks: ${fmtM(r.frente)} m at the front, ${fmtM(r.fundo)} m at the back and ${fmtM(r.lado1)} and ${fmtM(r.lado2)} m at the sides.`)}</p>}
      </div>
      <Rodape />
    </>
  );
}
function CasaNova() {
  const dados = useApp((s) => s.dados), t = dados.terreno || null;
  const hz = t ? frenteHorizontal(t.rua) : true, frenteT = t ? (hz ? t.w : t.h) : 0, fundoT = t ? (hz ? t.h : t.w) : 0;
  const [v, setV] = useState(() => {
    const frente = t ? Math.min(1200, Math.max(300, frenteT - 300)) : 800, fundo = t ? Math.min(1200, Math.max(300, fundoT - 600)) : 1000;
    return { frente: fmtM(frente), fundo: fmtM(fundo), andares: 1, recuoFrente: t && fundoT - fundo >= 600 ? fmtM(300) : '', recuoLado: '' };
  });
  const [erro, setErro] = useState('');
  const m = { frente: parseMetros(v.frente), fundo: parseMetros(v.fundo), recuoFrente: v.recuoFrente.trim() ? parseMetros(v.recuoFrente, 100) : null, recuoLado: v.recuoLado.trim() ? parseMetros(v.recuoLado, 100) : null };
  const medidasOk = [m.frente, m.fundo].every((n) => n >= LIM_COMODO.min + 30 && n <= LIM_COMODO.max) && [m.recuoFrente, m.recuoLado].every((n) => n == null || Number.isFinite(n));
  const r = medidasOk ? contornoNoTerreno(t, m) : null;
  const naoCabe = r && 'erro' in r ? r.erro : '';
  useEffect(() => { previaPassos(r && 'caixa' in r ? { casa: r.caixa } : null); }, [JSON.stringify(r)]); // eslint-disable-line react-hooks/exhaustive-deps
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!medidasOk) { setErro(tx('Escreva a frente e o fundo da casa em metros (por exemplo, 8 e 10).', 'Type the house’s front and depth in meters (for example, 8 and 10).')); return; }
    const res = criarCasa({ ...m, andares: v.andares });
    if ('erro' in res) { setErro(res.erro); return; }
    seguirPassos(false);
  };
  const lado = hz ? tx('Recuo da esquerda (m)', 'Left setback (m)') : tx('Recuo de cima (m)', 'Top setback (m)');
  return (
    <form className="passos-form" noValidate onSubmit={enviar}>
      <div className="passos-corpo">
        <Cabeca etapa="casa" texto={tx('A medida da casa de fora a fora (o contorno). No próximo passo você divide em cômodos.', 'The house’s size from outside to outside (the outline). In the next step you split it into rooms.')} />
        <div className="campos">
          <Campo id="pc-frente" rot={tx('Frente (m)', 'Front (m)')} valor={v.frente} muda={(x) => { setV({ ...v, frente: x }); setErro(''); }} />
          <Campo id="pc-fundo" rot={tx('Fundo (m)', 'Depth (m)')} valor={v.fundo} muda={(x) => { setV({ ...v, fundo: x }); setErro(''); }} />
          {t && <Campo id="pc-rf" rot={tx('Recuo da frente (m)', 'Front setback (m)')} valor={v.recuoFrente} ph={tx('no meio', 'centered')} muda={(x) => { setV({ ...v, recuoFrente: x }); setErro(''); }} />}
          {t && <Campo id="pc-rl" rot={lado} valor={v.recuoLado} ph={tx('no meio', 'centered')} muda={(x) => { setV({ ...v, recuoLado: x }); setErro(''); }} />}
        </div>
        <div className="passos-linha">
          <span className="passos-rot" id="pc-and">{tx('Andares', 'Floors')}</span>
          <div className="seg" role="group" aria-labelledby="pc-and">
            {[1, 2, 3].map((n) => <button key={n} type="button" data-andares={n} aria-pressed={v.andares === n} onClick={() => setV({ ...v, andares: n })}>{n}</button>)}
          </div>
        </div>
        {(erro || naoCabe) && <p className="erro" role="alert">{erro || naoCabe}</p>}
      </div>
      <Rodape form pular={() => seguirPassos(true)} />
    </form>
  );
}

/* ---------- 3. cômodos ---------- */
function EtapaComodos() {
  const dados = useApp((s) => s.dados), desenho = useApp((s) => s.desenho), selComodo = useApp((s) => s.selComodo);
  const cs = comodosOrdem(dados), andares = andaresOrdem(dados).filter((a) => comodosDoAndar(dados, a.id).length);
  const sel = selComodo ? dados.comodos[selComodo] : null;
  const [andar, setAndar] = useState<string | null>(null);
  const aqui = andar && andares.some((a) => a.id === andar) ? andar : sel?.andar || andares[0]?.id || null;
  const semTipo = cs.filter((c) => tipoDoComodo(c) === 'outro');
  const texto = cs.length
    ? tx('Arraste o dedo de uma parede até a outra para pôr uma parede nova; arraste uma parede para mudar o tamanho dos dois lados. Toque num cômodo para dizer o que ele é.', 'Drag from one wall to the other to add a new wall; drag a wall to resize both sides. Tap a room to say what it is.')
    : tx('Arraste na planta para desenhar cada cômodo: perto de outro, as paredes grudam.', 'Drag on the plan to draw each room: near another one, the walls snap together.');
  return (
    <>
      <div className="passos-corpo">
        <Cabeca etapa="comodos" texto={texto} />
        {cs.length > 0 && (
          <div className="seg seg-cheio" role="group" aria-label={tx('Ferramenta', 'Tool')}>
            <button type="button" data-ferr-passo="dividir" aria-pressed={desenho.dividir} onClick={ferramentaDividir}><Icone n="parede" />{tx('Pôr parede', 'Add wall')}</button>
            <button type="button" data-ferr-passo="comodo" aria-pressed={!desenho.dividir && !desenho.item} onClick={() => ferramentaDesenho(null)}><Icone n="lapis" />{tx('Desenhar cômodo', 'Draw room')}</button>
          </div>
        )}
        {sel ? <EscolherTipo id={sel.id} /> : cs.length > 0 && aqui && (
          <div className="passos-bloco">
            <p className="passos-rot">{tx('Ou comece por um modelo', 'Or start from a template')}{andares.length > 1 ? tx(` no ${dados.andares[aqui]?.nome || ''}`, ` on the ${dados.andares[aqui]?.nome || ''}`) : ''}</p>
            {andares.length > 1 && (
              <div className="seg" role="group" aria-label={tx('Andar', 'Floor')}>
                {andares.map((a) => <button key={a.id} type="button" aria-pressed={a.id === aqui} onClick={() => setAndar(a.id)}>{a.nome}</button>)}
              </div>
            )}
            <div className="tipos">
              {MODELOS.map((m) => <button key={m} type="button" className="tipo" data-modelo={m} onClick={() => {
                aplicarModelo(aqui, m);
                toast(tx(`${MODELO_NOME[m]()} em ${dados.andares[aqui]?.nome || ''}. Arraste as paredes para acertar as medidas.`, `${MODELO_NOME[m]()} on the ${dados.andares[aqui]?.nome || ''}. Drag the walls to fix the sizes.`), '', 'desfazer');
              }}>{MODELO_NOME[m]()}</button>)}
            </div>
          </div>
        )}
        <div id="ctx-doca" className="ctx-doca" />
        {semTipo.length > 0 && cs.length > 1 && !sel && <p className="nota">{tx('Falta dizer o que é: ', 'Still to name: ')}{semTipo.slice(0, 4).map((c) => c.nome).join(', ')}{semTipo.length > 4 ? '…' : '.'}</p>}
      </div>
      <Rodape continuar={() => seguirPassos(false)} desativado={!cs.length} nota={cs.length ? undefined : tx('Desenhe pelo menos um cômodo para continuar.', 'Draw at least one room to continue.')} />
    </>
  );
}
/** O que é o cômodo selecionado (o nome acompanha o tipo enquanto for o automático). */
function EscolherTipo({ id }: { id: string }) {
  const c = useApp((s) => s.dados.comodos[id]);
  if (!c) return null;
  const t = tipoDoComodo(c);
  return (
    <div className="passos-bloco" data-tipo-de={c.id}>
      <p className="passos-rot">{tx(`O que é ${c.nome}?`, `What is ${c.nome}?`)} <span className="passos-med">{fmtM(c.w)} × {fmtM(c.h)} m · {fmtArea(areaM2(c))}</span></p>
      <div className="tipos">
        {TIPOS_COMODO.map((k) => <button key={k} type="button" className="tipo" data-tipo-passo={k} aria-pressed={t === k} onClick={() => mudarTipoComodo(c.id, k)}>{COMODO_NOME[k]}</button>)}
      </div>
    </div>
  );
}

/* ---------- 4. portas e janelas ---------- */
function EtapaAberturas() {
  const desenho = useApp((s) => s.desenho), rota = useApp((s) => s.passo.rota), comodo = useApp((s) => s.comodo);
  const auto = () => {
    const r = porAberturas(rota === 'comodo' && comodo ? comodo : undefined);
    toast(r.portas + r.janelas
      ? tx(`Pus ${pl(r.portas, 'porta', 'portas')} e ${pl(r.janelas, 'janela', 'janelas')}. Toque numa porta para virar para o outro lado.`, `Added ${pl(r.portas, 'door', 'doors')} and ${pl(r.janelas, 'window', 'windows')}. Tap a door to flip it.`)
      : tx('Já tem porta e janela onde dava para pôr.', 'There are already doors and windows wherever they fit.'), '', r.portas + r.janelas ? 'desfazer' : undefined);
  };
  return (
    <>
      <div className="passos-corpo">
        <Cabeca etapa="aberturas" texto={rota === 'comodo'
          ? tx('Eu ponho a porta perto de um canto e uma janela na parede de fora; depois é só tocar para ajustar.', 'I add the door near a corner and a window on an outside wall; then just tap to adjust.')
          : tx('Eu ponho as portas entre os cômodos, a porta da rua e uma janela em cada cômodo com parede de fora; depois é só tocar para ajustar.', 'I add the doors between rooms, the front door and a window in each room with an outside wall; then just tap to adjust.')} />
        <button type="button" className="btn prim full-w" data-acao="passos-auto" onClick={auto}><Icone n="porta" />{tx('Pôr portas e janelas sozinho', 'Add doors and windows for me')}</button>
        <div className="passos-bloco">
          <p className="passos-rot">{tx('Ou toque numa parede para pôr', 'Or tap a wall to add')}</p>
          <div className="tipos">
            {PECAS().map(([k, rot]) => <button key={k} type="button" className="tipo" data-peca-passo={k} aria-pressed={desenho.item === k} onClick={() => ferramentaDesenho(k)}>{rot}</button>)}
          </div>
        </div>
        <div id="ctx-doca" className="ctx-doca" />
      </div>
      <Rodape pular={() => seguirPassos(true)} />
    </>
  );
}

/* ---------- 5. móveis ---------- */
function EtapaMoveis() {
  const dados = useApp((s) => s.dados), rota = useApp((s) => s.passo.rota), comodo = useApp((s) => s.comodo), ocupado = useApp((s) => s.passo.ocupado);
  const cs = (rota === 'comodo' ? [comodo ? dados.comodos[comodo] : null] : comodosOrdem(dados)).filter((c): c is NonNullable<typeof c> => !!c);
  const chaveCs = cs.map((c) => c.id + tipoDoComodo(c)).join('|');
  const kits = useMemo(() => {
    const quartos = cs.filter((c) => tipoDoComodo(c) === 'quarto').sort((a, b) => b.w * b.h - a.w * a.h);
    return cs.map((c) => ({ c, itens: kitDoComodo(c, c.id === quartos[0]?.id), ja: moveisDo(dados, c.id).length })).filter((k) => k.itens.length);
  }, [chaveCs]); // eslint-disable-line react-hooks/exhaustive-deps
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  // o que cada cômodo costuma ter já vem marcado (menos onde já tem móveis)
  useEffect(() => {
    setMarcados((m) => {
      const n = { ...m };
      for (const k of kits) for (const it of k.itens) { const ch = k.c.id + ':' + it.chave; if (!(ch in n)) n[ch] = it.marcado && !k.ja; }
      return n;
    });
  }, [kits]);
  const escolhas = kits.map((k) => ({ comodo: k.c.id, itens: k.itens.filter((it) => marcados[k.c.id + ':' + it.chave]) })).filter((e) => e.itens.length);
  const total = escolhas.reduce((t, e) => t + e.itens.reduce((u, it) => u + (it.qtd || 1), 0), 0);
  const colocar = async () => {
    const n = await mobiliar(escolhas);
    if (n) {
      setMarcados((m) => { const x = { ...m }; for (const e of escolhas) for (const it of e.itens) x[e.comodo + ':' + it.chave] = false; return x; });
      toast(tx(`Pus ${pl(n, 'móvel', 'móveis')}. Arraste para mudar de lugar ou toque em ✦ Sugestões para outras arrumações.`, `Added ${pl(n, 'piece', 'pieces')} of furniture. Drag to move them or tap ✦ Suggestions for other layouts.`), '', 'desfazer');
    }
  };
  return (
    <>
      <div className="passos-corpo">
        <Cabeca etapa="moveis" texto={tx('Marque o que vai em cada cômodo e eu arrumo; depois é só arrastar.', 'Pick what goes in each room and I’ll arrange it; then just drag things around.')} />
        {kits.length ? kits.map((k) => (
          <div className="passos-kit" key={k.c.id} data-kit={k.c.id}>
            <p className="passos-rot">{k.c.nome}{k.ja ? <span className="passos-med">{tx(` já tem ${pl(k.ja, 'móvel', 'móveis')}`, ` already has ${pl(k.ja, 'piece', 'pieces')}`)}</span> : null}</p>
            <div className="tipos">
              {k.itens.map((it) => {
                const ch = k.c.id + ':' + it.chave;
                return <button key={it.chave} type="button" className="tipo kit" data-item={it.chave} aria-pressed={!!marcados[ch]} onClick={() => setMarcados({ ...marcados, [ch]: !marcados[ch] })}>
                  {it.nome}{it.qtd && it.qtd > 1 ? ` ×${it.qtd}` : ''}<small>{fmtM(it.larg)} × {fmtM(it.prof)}</small>
                </button>;
              })}
            </div>
          </div>
        )) : <p className="nota">{tx('Diga o que é cada cômodo (no passo dos cômodos) para eu sugerir os móveis.', 'Say what each room is (in the rooms step) so I can suggest furniture.')}</p>}
        <div className="acoes">
          <button type="button" className="btn prim" data-acao="passos-mobiliar" disabled={!total || !!ocupado} onClick={() => void colocar()}>{ocupado || (total ? tx(`Colocar e arrumar (${total})`, `Place and arrange (${total})`) : tx('Colocar e arrumar', 'Place and arrange'))}</button>
          <button type="button" className="btn" data-acao="passos-outro" disabled={!!ocupado} onClick={() => iniciarAdd('movel', rota === 'comodo' && comodo ? { comodo } : null)}>{tx('Outro móvel…', 'Another piece…')}</button>
        </div>
      </div>
      <Rodape />
    </>
  );
}

/* ---------- só um cômodo ---------- */
function EtapaComodo() {
  const dados = useApp((s) => s.dados), comodo = useApp((s) => s.comodo);
  const existe = comodo && dados.comodos[comodo] ? dados.comodos[comodo] : null;
  const [tipo, setTipo] = useState<TipoComodo>(existe ? tipoDoComodo(existe) : 'quarto');
  const [v, setV] = useState({ larg: fmtM(existe ? existe.w : 300), comp: fmtM(existe ? existe.h : 350), nome: existe ? existe.nome : '' });
  const [erro, setErro] = useState('');
  const w = parseMetros(v.larg, 30), h = parseMetros(v.comp, 30);
  const ok = [w, h].every((n) => n >= LIM_COMODO.min && n <= LIM_COMODO.max);
  useEffect(() => { previaPassos(ok && !existe ? { comodo: { w, h } } : null); }, [ok, w, h, existe]);
  const nomePadrao = nomesDosTipos([tipo], Object.values(dados.comodos).filter((c) => c.id !== existe?.id).map((c) => c.nome))[0];
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!ok) { setErro(tx('Escreva a largura e o comprimento de dentro, em metros (por exemplo, 3 e 3,5).', 'Type the inside width and length in meters (for example, 3 and 3.5).')); return; }
    const nome = (v.nome.trim() || nomePadrao).slice(0, 30);
    if (existe) salvarComodo(existe.id, { w, h, tipo, nome });
    else criarComodo({ nome, w, h, tipo });
    seguirPassos(false);
  };
  return (
    <form className="passos-form" noValidate onSubmit={enviar}>
      <div className="passos-corpo">
        <Cabeca etapa="comodo" texto={tx('Que cômodo é e as medidas de dentro, de parede a parede.', 'Which room it is and its inside size, wall to wall.')} />
        <div className="tipos">
          {TIPOS_COMODO.map((k) => <button key={k} type="button" className="tipo" data-tipo-passo={k} aria-pressed={tipo === k} onClick={() => setTipo(k)}>{COMODO_NOME[k]}</button>)}
        </div>
        <div className="campos">
          <Campo id="pq-larg" rot={tx('Largura (m)', 'Width (m)')} valor={v.larg} muda={(x) => { setV({ ...v, larg: x }); setErro(''); }} />
          <Campo id="pq-comp" rot={tx('Comprimento (m)', 'Length (m)')} valor={v.comp} muda={(x) => { setV({ ...v, comp: x }); setErro(''); }} />
          <div className="campo full">
            <label htmlFor="pq-nome">{tx('Nome (opcional)', 'Name (optional)')}</label>
            <input id="pq-nome" autoComplete="off" maxLength={30} value={v.nome} placeholder={nomePadrao} onChange={(e) => setV({ ...v, nome: e.target.value })} />
          </div>
        </div>
        {ok && <p className="nota">{fmtArea((w * h) / 10000)}</p>}
        {erro && <p className="erro" role="alert">{erro}</p>}
      </div>
      <Rodape form />
    </form>
  );
}

const CORPOS: Record<Etapa, () => ReactNode> = {
  terreno: () => <EtapaTerreno />, casa: () => <EtapaCasa />, comodos: () => <EtapaComodos />, aberturas: () => <EtapaAberturas />, moveis: () => <EtapaMoveis />, comodo: () => <EtapaComodo />
};

export default function Passos() {
  const p = useApp((s) => s.passo);
  const est = useApp((s) => s.estreito);
  const ref = useRef<HTMLElement>(null);
  // o espaço que o painel ocupa: a planta se enquadra no que sobra
  useLayoutEffect(() => {
    const el = ref.current;
    if (!p.ativo || !el) return;
    const medir = () => {
      const tela = document.getElementById('tela')?.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!tela) return;
      if (est) tamanhoPassos(Math.max(0, Math.round(tela.bottom - r.top + 8)), 0);
      else tamanhoPassos(0, Math.max(0, Math.round(r.right - tela.left + 12)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.ativo, est, p.etapa, p.recolhido]);
  if (!p.ativo) return null;
  const lista = ETAPAS[p.rota], k = lista.indexOf(p.etapa);
  const vistas = new Set([...p.feitas, ...p.puladas, p.etapa]);
  return (
    <section className={`passos${p.recolhido ? ' recolhido' : ''}`} id="passos" ref={ref} aria-labelledby="passos-t">
      <header className="passos-cab">
        <h2 id="passos-t">{p.rota === 'casa' ? tx('Montar a casa', 'Build the house') : tx('Montar o cômodo', 'Set up the room')}<span>{tx(`Passo ${k + 1} de ${lista.length}`, `Step ${k + 1} of ${lista.length}`)}</span></h2>
        {est && <button type="button" className="ico-btn" data-acao="passos-recolher" aria-expanded={!p.recolhido} aria-label={p.recolhido ? tx('Abrir o painel', 'Open the panel') : tx('Recolher o painel', 'Collapse the panel')} onClick={() => recolherPassos(!p.recolhido)}><Icone n={p.recolhido ? 'subir' : 'descer'} /></button>}
        <button type="button" className="ico-btn" data-acao="passos-sair" aria-label={tx('Sair do passo a passo (o que já foi feito fica)', 'Leave the step by step (what’s done stays)')} onClick={() => fecharPassos()}><Icone n="x" /></button>
      </header>
      <ol className="passos-trilha" aria-label={tx('Etapas', 'Steps')}>
        {lista.map((e, i) => {
          const feita = p.feitas.includes(e), pulada = p.puladas.includes(e), atual = e === p.etapa;
          return (
            <li key={e} className={`${atual ? 'atual' : ''}${feita ? ' feita' : ''}${pulada ? ' pulada' : ''}`}>
              <button type="button" data-etapa={e} aria-current={atual ? 'step' : undefined} disabled={!vistas.has(e) || atual} onClick={() => irParaEtapa(e)}
                aria-label={`${i + 1}. ${ROTULO[e]()}${feita ? tx(', feito', ', done') : pulada ? tx(', pulado', ', skipped') : ''}`}>
                <span className="passos-n" aria-hidden="true">{feita ? <Icone n="ok" /> : i + 1}</span>
                <span className="passos-r" aria-hidden="true">{ROTULO[e]()}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* a etapa nova começa do zero (os campos voltam aos valores dela) */}
      <div className="passos-etapa" key={p.etapa}>{CORPOS[p.etapa]()}</div>
    </section>
  );
}
