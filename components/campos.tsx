'use client';
// Campos dos formulários (os mesmos para adicionar, editar e no painel do modo avançado).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AB_NOME, ESCADA_NOME, ESCADA_PADRAO, LADO_CAD_NOME, MAX_CADEIRAS, PAREDES, PAREDE_NOME, PONTO_BASE, PONTO_NOME, TIPOS, TIPOS_PAREDE, horizontal, rotDist } from '@/lib/catalogo';
import { frenteAutomatica } from '@/lib/geometria';
import { tx } from '@/lib/i18n';
import { fmtM, parseInteiro, parseMedida } from '@/lib/util';
import type { Valores } from '@/lib/formularios';
import type { Abertura, Parede, Ponto, TipoMovel, TipoParede } from '@/lib/tipos';

type Set = (k: string, v: string | boolean) => void;
type Commit = (k: string, val: string | boolean) => void;
interface Base { px: string; k: string; rot: string; v: Valores; set: Set; commit?: Commit; full?: boolean; oculto?: boolean }

export function Texto({ px, k, rot, v, set, commit, full, oculto, num, max, ph, foco }: Base & { num?: boolean; max?: number; ph?: string; foco?: boolean }) {
  if (oculto) return null;
  return (
    <div className={`campo${full ? ' full' : ''}`}>
      <label htmlFor={`${px}-${k}`}>{rot}</label>
      <input id={`${px}-${k}`} data-k={k} autoComplete="off" inputMode={num ? 'decimal' : undefined} maxLength={max} placeholder={ph} autoFocus={foco}
        value={String(v[k] ?? '')} onChange={(e) => set(k, e.target.value)}
        onBlur={(e) => commit?.(k, e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter' && commit) { e.preventDefault(); commit(k, e.currentTarget.value); } }} />
    </div>
  );
}

export function Escolha({ px, k, rot, v, set, commit, full, oculto, opts }: Base & { opts: [string, string][] }) {
  if (oculto) return null;
  return (
    <div className={`campo${full ? ' full' : ''}`}>
      <label htmlFor={`${px}-${k}`}>{rot}</label>
      <select id={`${px}-${k}`} data-k={k} value={String(v[k] ?? '')} onChange={(e) => { set(k, e.target.value); commit?.(k, e.target.value); }}>
        {opts.map(([val, t]) => <option key={val} value={val}>{t}</option>)}
      </select>
    </div>
  );
}

export function Marca({ px, k, rot, v, set, commit }: Base) {
  return (
    <label className="check full" htmlFor={`${px}-${k}`}>
      <input type="checkbox" id={`${px}-${k}`} data-k={k} checked={!!v[k]} onChange={(e) => { set(k, e.target.checked); commit?.(k, e.target.checked); }} /> {rot}
    </label>
  );
}

const alinha = (): [string, string][] => [['centro', tx('Centralizado', 'Centered')], ['esq', tx('Alinhado à esquerda', 'Aligned left')], ['dir', tx('Alinhado à direita', 'Aligned right')]];

/** Campos de um móvel. No modo avançado aparecem tipo, posição, cômodo e travar. */
export function CamposMovel({ px, tipo, v, set, commit, avancado, add, comodos }: { px: string; tipo: TipoMovel; v: Valores; set: Set; commit?: Commit; avancado?: boolean; add?: boolean; comodos?: [string, string][] }) {
  const t = TIPOS[tipo] || TIPOS.outro, p = { px, v, set, commit };
  const cad = Number(v.cadeiras || 0), bau = String(v.bau || 'nenhum'), caracol = tipo === 'escada' && v.escada === 'caracol';
  const autoFrente = frenteAutomatica({ tipo, abertura: (v.abertura as Abertura) || (t.ab ? t.ab[0] : 'nenhuma'), larg: parseMedida(v.larg) || parseMedida(t.exA), prof: parseMedida(v.prof) || parseMedida(t.exB), nPortas: parseInteiro(v.nPortas) || 0 });
  const blocoBau = (pre: 'Cab' | 'Pe', titulo: string): ReactNode => (
    <>
      <p className="grupo-t full">{titulo}</p>
      <Texto {...p} k={`bau${pre}Larg`} rot={tx('Largura do baú', 'Chest width')} num ph={tx('igual à cama', 'same as the bed')} />
      <Texto {...p} k={`bau${pre}Prof`} rot={tx('Profundidade', 'Depth')} num ph={tx('ex.: ', 'e.g. ') + fmtM(45)} />
      <Escolha {...p} k={`bau${pre}Al`} rot={tx('Posição', 'Position')} opts={alinha()} />
      <Texto {...p} k={`bau${pre}Dx`} rot={tx('Ajuste (cm, + vai para a direita)', 'Adjust (cm, + moves it right)')} num ph="0" />
    </>
  );
  return (
    <div className="campos">
      <Texto {...p} k="nome" rot={tx('Nome', 'Name')} full max={30} ph={t.rot} />
      {avancado && <Escolha {...p} k="tipo" rot={tx('Tipo', 'Type')} full opts={Object.keys(TIPOS).map((k) => [k, TIPOS[k as TipoMovel].chip])} />}
      {tipo === 'escada' && <Escolha {...p} k="escada" rot={tx('Tipo de escada', 'Stair type')} full opts={(['reta', 'caracol'] as const).map((k) => [k, ESCADA_NOME[k]])} />}
      {caracol
        ? <Texto {...p} k="larg" rot={tx('Diâmetro', 'Diameter')} num ph={tx('ex.: ', 'e.g. ') + fmtM(ESCADA_PADRAO.caracol.larg)} foco={add} />
        : <>
          <Texto {...p} k="larg" rot={t.a} num ph={tx('ex.: ', 'e.g. ') + t.exA} foco={add} />
          <Texto {...p} k="prof" rot={t.b} num ph={tx('ex.: ', 'e.g. ') + t.exB} />
        </>}
      {avancado && <>
        <Texto {...p} k="x" rot={tx('Da parede esquerda (cm)', 'From the left wall (cm)')} num />
        <Texto {...p} k="y" rot={tx('Da parede de cima (cm)', 'From the top wall (cm)')} num />
        <Escolha {...p} k="rot" rot={tx('Costas (cabeceira) para', 'Back (headboard) facing')} opts={[['0', tx('Cima', 'Top')], ['90', tx('Direita', 'Right')], ['180', tx('Baixo', 'Bottom')], ['270', tx('Esquerda', 'Left')]]} />
        {comodos && <Escolha {...p} k="comodo" rot={tx('Cômodo', 'Room')} opts={comodos} />}
      </>}
      {t.ab && <Escolha {...p} k="abertura" rot={tx('Como abre', 'How it opens')} opts={t.ab.map((k) => [k, AB_NOME[k]])} />}
      {t.ab && t.ab.includes('abrir') && <Texto {...p} k="nPortas" rot={tx('Quantas portas', 'Number of doors')} num ph={tx('automático', 'automatic')} oculto={v.abertura !== 'abrir'} />}
      <Texto {...p} k="frente" rot={tx('Espaço livre na frente (cm)', 'Free space in front (cm)')} num ph={tx(`automático: ${autoFrente} cm`, `automatic: ${autoFrente} cm`)} />
      {tipo === 'mesa' && <>
        <Escolha {...p} k="cadeiras" rot={tx('Cadeiras junto', 'Chairs with it')} opts={Array.from({ length: MAX_CADEIRAS + 1 }, (_, n) => [String(n), n === 0 ? tx('Sem cadeira', 'No chair') : n === 1 ? tx('1 cadeira', '1 chair') : tx(`${n} cadeiras`, `${n} chairs`)])} />
        {cad > 0 && <>
          <Escolha {...p} k="ladoCadeiras" rot={tx('Onde ficam', 'Where they go')} opts={Object.entries(LADO_CAD_NOME)} />
          <Texto {...p} k="cadLarg" rot={tx('Largura da cadeira', 'Chair width')} num ph={fmtM(45)} />
          <Texto {...p} k="cadProf" rot={tx('Profundidade da cadeira', 'Chair depth')} num ph={fmtM(50)} />
        </>}
      </>}
      {tipo === 'cama' && <>
        <Escolha {...p} k="bau" rot={tx('Baú', 'Chest')} full opts={[['nenhum', tx('Sem baú', 'No chest')], ['cab', tx('Na cabeceira', 'At the headboard')], ['pe', tx('Nos pés', 'At the foot')], ['dois', tx('Na cabeceira e nos pés', 'At the headboard and the foot')]]} />
        {(bau === 'cab' || bau === 'dois') && blocoBau('Cab', tx('Baú da cabeceira', 'Chest at the headboard'))}
        {(bau === 'pe' || bau === 'dois') && blocoBau('Pe', tx('Baú dos pés', 'Chest at the foot'))}
      </>}
      <Marca {...p} k="alto" rot={tx('Móvel alto (não pode na área do ar-condicionado nem na frente de janela)', 'Tall furniture (can’t go in the air conditioner area or in front of a window)')} />
      {avancado && <Marca {...p} k="fixo" rot={tx('Travar no lugar (as sugestões não mexem nele)', 'Lock in place (suggestions won’t move it)')} />}
    </div>
  );
}

/** Campos de um item de parede. */
export function CamposParede({ px, tipo, v, set, commit, avancado, add, phNome }: { px: string; tipo: TipoParede; v: Valores; set: Set; commit?: Commit; avancado?: boolean; add?: boolean; phNome?: string }) {
  const tp = TIPOS_PAREDE[tipo], par = (v.parede as Parede) || tp.parede, hz = horizontal(par), p = { px, v, set, commit };
  return (
    <div className="campos">
      {tipo === 'interruptor' && <Escolha {...p} k="ponto" rot={tx('O que é', 'What it is')} full opts={(['interruptor', 'tomada', 'ambos'] as const).map((k) => [k, PONTO_NOME[k]])} />}
      <Texto {...p} k="nome" rot={tx('Nome', 'Name')} full max={30} ph={phNome || (tipo === 'interruptor' ? PONTO_BASE[(v.ponto as Ponto) || 'interruptor'] : tp.rot)} />
      <Escolha {...p} k="parede" rot={tx('Parede', 'Wall')} full={tipo !== 'interruptor'} opts={PAREDES.map((x) => [x, PAREDE_NOME[x]])} />
      {tipo !== 'interruptor' && <Texto {...p} k="largura" rot={tp.rotLarg} num ph={add ? tp.ex : ''} />}
      {avancado ? <Texto {...p} k="inicioCm" rot={rotDist(par) + ' (cm)'} num /> : <Texto {...p} k="dist" rot={rotDist(par)} num ph={tx('em branco = no meio', 'blank = centered')} />}
      {tipo === 'porta' && <>
        <Escolha {...p} k="dobradica" rot={tx('Dobradiça', 'Hinge')} opts={[['a', hz ? tx('Esquerda', 'Left') : tx('Em cima', 'Top')], ['b', hz ? tx('Direita', 'Right') : tx('Embaixo', 'Bottom')]]} />
        <Escolha {...p} k="abre" rot={tx('Abre para', 'Opens')} opts={[['dentro', tx('Dentro do cômodo', 'Into the room')], ['fora', tx('Fora', 'Out of the room')]]} />
      </>}
      {tipo === 'janela' && <>
        <Escolha {...p} k="abertura" rot={tx('Tipo', 'Type')} opts={[['correr', tx('De correr', 'Sliding')], ['abrir', tx('De abrir (para dentro)', 'Casement (opens inward)')]]} />
        <Escolha {...p} k="folhas" rot={tx('Folhas', 'Panels')} opts={[['2', tx('2 folhas', '2 panels')], ['1', tx('1 folha', '1 panel')]]} oculto={v.abertura !== 'abrir'} />
      </>}
      {tipo === 'ar' && <Texto {...p} k="folga" rot={tx('Área livre de cada lado (sem móvel alto)', 'Clear area on each side (no tall furniture)')} num ph={add ? fmtM(30) : ''} full />}
    </div>
  );
}

/** Estado de um formulário, reiniciado quando a "chave" muda (outro item). */
export function useValores(inicial: () => Valores, chave: string): [Valores, Set, (v: Valores) => void] {
  const [v, setV] = useState<Valores>(inicial);
  const ultima = useRef(chave);
  useEffect(() => { if (ultima.current !== chave) { ultima.current = chave; setV(inicial()); } }, [chave, inicial]);
  return [v, (k, val) => setV((o) => ({ ...o, [k]: val })), setV];
}
