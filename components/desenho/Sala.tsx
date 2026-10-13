// Desenho de um cômodo (unidades = cm; origem = canto interno de cima à esquerda).
import type { ReactNode } from 'react';
import { AR_PROF, NOME_PAREDE, PAREDES, PONTO_NOME, T, ehInterruptor, horizontal, pontoDe, tipoDoComodo } from '@/lib/catalogo';
import { tx } from '@/lib/i18n';
import { compParede, folgas, folhaDe, folhasPorta, geoEl, geoPorta, giraParaDentro, jeitoDaPorta, nivel, ret, temGiro, uv2xy, zonaAr, type Folga } from '@/lib/geometria';
import { areaM2, fmtArea } from '@/lib/resumo';
import type { Avaliacao, ComodoCompleto, ElParede, Movel, Parede, Ret, Vista } from '@/lib/tipos';
import { fmtM, n1, pl } from '@/lib/util';
import { Desenho, DesenhoAbertura, Rotulo, transfLocal } from './Movel';

type Q = ComodoCompleto;

/** Pisos (em cm, presos no canto de cada cômodo) e a sombra dos móveis: a planta com cara de projeto. Madeira no
 *  quarto, porcelanato na sala, no corredor e na cozinha, cerâmica no banheiro e na área de serviço, deck na varanda.
 *  O porcelanato tem 50 × 50 e a cerâmica 25 × 25: as juntas caem na grade de 50 cm. */
export function DefsPlanta() {
  const linhas = (d: string, cls: string) => <path className={cls} d={d} />;
  return <>
    <pattern id="piso-madeira" patternUnits="userSpaceOnUse" width="120" height="54">
      <rect className="pt-madeira" width="120" height="54" />
      {linhas('M0 18H120M0 36H120M0 54H120M0 0V18M40 18V36M80 36V54', 'pt-madeira-l')}
    </pattern>
    <pattern id="piso-porcelanato" patternUnits="userSpaceOnUse" width="50" height="50">
      <rect className="pt-porc" width="50" height="50" />
      {linhas('M0 0H50M0 0V50', 'pt-porc-l')}
    </pattern>
    <pattern id="piso-cozinha" patternUnits="userSpaceOnUse" width="50" height="50">
      <rect className="pt-coz" width="50" height="50" />
      {linhas('M0 0H50M0 0V50', 'pt-coz-l')}
    </pattern>
    <pattern id="piso-ceramica" patternUnits="userSpaceOnUse" width="25" height="25">
      <rect className="pt-ceram" width="25" height="25" />
      {linhas('M0 0H25M0 0V25', 'pt-ceram-l')}
    </pattern>
    <pattern id="piso-deck" patternUnits="userSpaceOnUse" width="90" height="28">
      <rect className="pt-deck" width="90" height="28" />
      {linhas('M0 0H90M0 14H90M0 0V14M45 14V28', 'pt-deck-l')}
    </pattern>
    <filter id="sombra-mv" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.4" floodColor="#10141a" floodOpacity="0.2" />
    </filter>
  </>;
}
function rectEm(q: Q, parede: Parede, u1: number, v1: number, u2: number, v2: number) {
  const p1 = uv2xy(q, parede, u1, v1), p2 = uv2xy(q, parede, u2, v2);
  return { x: n1(Math.min(p1[0], p2[0])), y: n1(Math.min(p1[1], p2[1])), width: n1(Math.abs(p1[0] - p2[0])), height: n1(Math.abs(p1[1] - p2[1])) };
}
function linhaEm(q: Q, parede: Parede, u1: number, v1: number, u2: number, v2: number) {
  const p1 = uv2xy(q, parede, u1, v1), p2 = uv2xy(q, parede, u2, v2);
  return { x1: n1(p1[0]), y1: n1(p1[1]), x2: n1(p2[0]), y2: n1(p2[1]) };
}
const rotTexto = (parede: Parede) => (parede === 'esquerda' ? -90 : parede === 'direita' ? 90 : 0);
function Txt({ cls, p, rt, children }: { cls: string; p: [number, number]; rt: number; children: ReactNode }) {
  return <text className={cls} x={n1(p[0])} y={n1(p[1])} textAnchor="middle" dy=".35em" transform={rt ? `rotate(${rt} ${n1(p[0])} ${n1(p[1])})` : undefined}>{children}</text>;
}
/** Quarto de círculo em coordenadas da parede: dobradiça em hu, folha de raio r. */
function arcoUV(q: Q, parede: Parede, hu: number, du: number, r: number, sv: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 20; i++) { const t = ((Math.PI / 2) * i) / 20, pt = uv2xy(q, parede, hu + du * r * Math.cos(t), sv * r * Math.sin(t)); pts.push(n1(pt[0]) + ',' + n1(pt[1])); }
  return pts.join(' L');
}

function Paredes({ q }: { q: Q }) {
  const out: ReactNode[] = [];
  for (const parede of PAREDES) {
    const L = compParede(q, parede);
    const vaos = q.portas.concat(q.janelas).filter((e) => e.parede === parede).map((e) => { const g = geoEl(q, e); return [g.a, g.b]; }).sort((a, b) => a[0] - b[0]);
    let cur = -T;
    const segs: number[][] = [];
    for (const [a, b] of vaos) { if (a > cur) segs.push([cur, a]); cur = Math.max(cur, b); }
    if (cur < L + T) segs.push([cur, L + T]);
    segs.forEach(([u1, u2], k) => out.push(<rect key={parede + k} className="parede" {...rectEm(q, parede, u1, -T, u2, 0)} />));
  }
  return <>{out}</>;
}

/** Parede tirada: o piso continua pelo vão (uma linha tracejada clarinha marca onde um cômodo vira o outro). */
function SemParede({ q, p }: { q: Q; p: ElParede }) {
  const g = geoEl(q, p);
  return (
    <g className="sem-parede" aria-hidden="true">
      <rect className={`piso piso-junta${q.corredor ? ' corredor' : ''} q-${tipoDoComodo(q)}`} {...rectEm(q, p.parede, g.a, -T - 0.5, g.b, 0.5)} />
      <line className="junta-l" {...linhaEm(q, p.parede, g.a, -T / 2, g.b, -T / 2)} />
    </g>
  );
}

/** "tudo": a porta para tocar e ver; "casca": só a área de toque (o desenho vai por cima de tudo, em PortasPorCima);
 *  "desenho": só o desenho, sem pegar o toque. */
type ParteDaPorta = 'tudo' | 'casca' | 'desenho';
function Porta({ q, p, sel, bloq, vista, parte = 'tudo' }: { q: Q; p: ElParede; sel: boolean; bloq: boolean; vista: Vista; parte?: ParteDaPorta }) {
  if (p.herdada && vista === 'casa') return null; // na planta da casa, o vizinho já desenha essa porta; aqui fica só o vão
  if (p.semParede) return <SemParede q={q} p={p} />;
  const g = geoPorta(q, p), jeito = jeitoDaPorta(p);
  const cls = `porta-el${sel ? ' sel' : ''}${bloq ? ' bloq' : ''}${p.herdada ? ' herdada' : ''}${jeito === 'vao' ? ' vao' : ''}${jeito === 'correr' ? ' correr' : ''}${parte === 'casca' ? ' casca' : parte === 'desenho' ? ' por-cima' : ''}`;
  const comoAbre = jeito === 'vao' ? tx('vão livre, sem porta', 'open doorway, no door') : jeito === 'correr' ? tx('porta de correr', 'sliding door')
    : `${jeito === 'dupla' ? tx('dupla, ', 'double, ') : ''}${p.abre === 'dentro' ? tx(`abre para dentro de ${q.nome}`, `opens into ${q.nome}`) : tx(`abre para fora de ${q.nome}`, `opens out of ${q.nome}`)}`;
  const aria = tx(`${p.nome}, porta de ${fmtM(g.r)} metros na parede ${NOME_PAREDE[p.parede]}, ${comoAbre}. Enter abre as opções; setas movem pela parede.`, `${p.nome}, ${fmtM(g.r)}-meter door on the ${NOME_PAREDE[p.parede]} wall, ${comoAbre}. Enter opens the options; arrow keys move it along the wall.`);
  // a porta é da parede: a cópia que o vizinho desenha também se toca (e diz por qual cômodo foi tocada)
  const comum = parte === 'desenho' ? { className: cls, 'aria-hidden': true as const }
    : { className: cls, 'data-eid': p.id, 'data-via': p.herdada ? q.id : undefined, tabIndex: 0, role: 'button', 'aria-label': aria };
  const hit = (v2: number) => (parte === 'desenho' ? null : <rect className="hit" {...rectEm(q, p.parede, g.a, -T, g.b, v2)} />);
  if (parte === 'casca') return <g {...comum}>{hit(jeito === 'vao' || jeito === 'correr' ? 24 : Math.min(30, g.r))}</g>;
  if (jeito === 'vao') {
    // vão livre: só a abertura na parede, com o batente tracejado
    return (
      <g {...comum}>
        <rect className="zona-porta" {...rectEm(q, p.parede, g.a, -T, g.b, 0)} />
        <line className="vao-l" {...linhaEm(q, p.parede, g.a, -T / 2, g.b, -T / 2)} />
        {hit(24)}
      </g>
    );
  }
  if (jeito === 'correr') {
    // de correr: a folha dentro da parede, fechada no vão (onde ela fica aberta vai por cima da parede, em CorrerAberta)
    return (
      <g {...comum}>
        <rect className="zona-porta" {...rectEm(q, p.parede, g.a, -T, g.b, 0)} />
        <rect className="correr-folha" {...rectEm(q, p.parede, g.a, -T * 0.66, g.b, -T * 0.34)} />
        {hit(24)}
      </g>
    );
  }
  const folhas = folhasPorta(q, p);
  return (
    <g {...comum}>
      {folhas.map((f, k) => {
        const lin = arcoUV(q, p.parede, f.hu, f.du, f.r, g.sv), H = uv2xy(q, p.parede, f.hu, 0);
        return <g key={k}><path className="zona-porta" d={`M${n1(H[0])},${n1(H[1])} L${lin} Z`} /><path className="arco" d={`M${lin}`} /></g>;
      })}
      {hit(Math.min(30, g.r))}
      {folhas.map((f, k) => { const H = uv2xy(q, p.parede, f.hu, 0), E = uv2xy(q, p.parede, f.hu, g.sv * f.r); return <line key={k} className="folha-porta" x1={n1(H[0])} y1={n1(H[1])} x2={n1(E[0])} y2={n1(E[1])} />; })}
    </g>
  );
}

/** Porta de correr aberta: o contorno tracejado da folha, dentro da parede, do lado para onde ela corre. */
function CorrerAberta({ q, p, sel }: { q: Q; p: ElParede; sel: boolean }) {
  const g = geoEl(q, p), w = g.b - g.a;
  const [u1, u2] = p.dobradica === 'b' ? [g.b, Math.min(g.b + w, g.L + T)] : [Math.max(g.a - w, -T), g.a];
  if (u2 - u1 < 2) return null;
  return <rect className={`correr-aberta${sel ? ' sel' : ''}`} aria-hidden="true" {...rectEm(q, p.parede, u1, -T * 0.66, u2, -T * 0.34)} />;
}

function Janela({ q, j, sel, ruim }: { q: Q; j: ElParede; sel: boolean; ruim: boolean }) {
  const g = geoEl(q, j), w = g.b - g.a;
  const aria = tx(`${j.nome}, janela ${j.abertura === 'abrir' ? 'de abrir' : 'de correr'} de ${fmtM(w)} metros, parede ${NOME_PAREDE[j.parede]}. Enter abre as opções; setas movem pela parede.`, `${j.nome}, ${fmtM(w)}-meter ${j.abertura === 'abrir' ? 'casement' : 'sliding'} window on the ${NOME_PAREDE[j.parede]} wall. Enter opens the options; arrow keys move it along the wall.`);
  if (j.abertura === 'abrir') {
    const lf = folhaDe(q, j), dobs: [number, number][] = j.folhas === 1 ? [[g.a, 1]] : [[g.a, 1], [g.b, -1]];
    return (
      <g className={`jan${sel ? ' sel' : ''}${ruim ? ' tapada' : ''}`} data-eid={j.id} tabIndex={0} role="button" aria-label={aria}>
        <rect className="hit" {...rectEm(q, j.parede, g.a, -T, g.b, 24)} />
        {dobs.map(([hu, du], k) => { const H = uv2xy(q, j.parede, hu, 0); return <g key={k}><path className="jan-arco" d={`M${n1(H[0])},${n1(H[1])} L${arcoUV(q, j.parede, hu, du, lf, 1)} Z`} /><line className="jan-vidro" {...linhaEm(q, j.parede, hu, 0, hu, lf)} /></g>; })}
        <rect className="jan-moldura" {...rectEm(q, j.parede, g.a, -T, g.b, 0)} />
        <line className="jan-vidro" {...linhaEm(q, j.parede, g.a + 2, -T / 2, g.b - 2, -T / 2)} />
      </g>
    );
  }
  return (
    <g className={`jan${sel ? ' sel' : ''}${ruim ? ' tapada' : ''}`} data-eid={j.id} tabIndex={0} role="button" aria-label={aria}>
      <rect className="hit" {...rectEm(q, j.parede, g.a, -T, g.b, 24)} />
      <rect className="jan-faixa" {...rectEm(q, j.parede, g.a, 0, g.b, 10)} />
      <rect className="jan-moldura" {...rectEm(q, j.parede, g.a, -T, g.b, 0)} />
      <line className="jan-vidro" {...linhaEm(q, j.parede, g.a + 2, -T * 0.66, g.a + w * 0.56, -T * 0.66)} />
      <line className="jan-vidro" {...linhaEm(q, j.parede, g.a + w * 0.44, -T * 0.34, g.b - 2, -T * 0.34)} />
    </g>
  );
}

function ArBase({ q, a, sel }: { q: Q; a: ElParede; sel: boolean }) {
  const g = geoEl(q, a), z = zonaAr(q, a);
  return (
    <g className={`arel${sel ? ' sel' : ''}`} data-eid={a.id} tabIndex={0} role="button" aria-label={tx(`${a.nome}, aparelho de ${fmtM(g.b - g.a)} metros na parede ${NOME_PAREDE[a.parede]}. Enter abre as opções; setas movem pela parede.`, `${a.nome}, ${fmtM(g.b - g.a)}-meter unit on the ${NOME_PAREDE[a.parede]} wall. Enter opens the options; arrow keys move it along the wall.`)}>
      <rect {...rectEm(q, a.parede, z.a, 0, z.b, 10)} fill="url(#hach)" />
      <line className="restr-borda" {...linhaEm(q, a.parede, z.a, 10, z.b, 10)} />
      <rect className="hit" {...rectEm(q, a.parede, g.a, -T, g.b, AR_PROF + 4)} />
    </g>
  );
}
function ArTopo({ q, a, sel }: { q: Q; a: ElParede; sel: boolean }) {
  const g = geoEl(q, a), w = g.b - g.a, c = uv2xy(q, a.parede, g.a + w / 2, AR_PROF / 2);
  return (
    <g className={`ar-top${sel ? ' sel' : ''}`} aria-hidden="true">
      <rect className="ar-r" {...rectEm(q, a.parede, g.a, 0, g.b, AR_PROF)} />
      <g transform={`translate(${n1(c[0] - 8)} ${n1(c[1] - 8)}) scale(0.667)`}><path className="ar-i" d="M12 3v18M4.21 7.5l15.58 9M4.21 16.5l15.58-9M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M18.11 5.59L17.2 9l3.41.92M5.89 5.59L6.8 9l-3.41.92M3.39 14.09L6.8 15l-.91 3.42M20.61 14.09L17.2 15l.91 3.42" /></g>
    </g>
  );
}
/** Caminho fechado em coordenadas da parede (u ao longo dela, v para dentro do cômodo). */
function caminhoUV(q: Q, parede: Parede, pts: [number, number][]): string {
  return pts.map(([u, v], k) => { const p = uv2xy(q, parede, u, v); return (k ? 'L' : 'M') + n1(p[0]) + ',' + n1(p[1]); }).join(' ') + ' Z';
}
/** "light switch" para leitores de tela, sem estragar siglas ("TV outlet"). */
const minuscula = (s: string): string => (/^.[A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** Largura aproximada do rótulo de um ponto (cm do desenho; letras de 8,5 em caixa alta). */
const larguraRotulo = (nome: string) => nome.length * 4.3 + 4;
const textoJanela = (q: Q, j: ElParede) => { const g = geoEl(q, j); return `${j.nome} · ${fmtM(g.b - g.a)}`; };
/** Rótulos que ficam do lado de fora da parede: os dos pontos e, na planta da casa, os das janelas (dentro do cômodo
 *  fica a etiqueta dele). Quando dois estão perto na mesma parede (água e esgoto, TV e internet), o segundo vai para
 *  uma faixa mais longe da parede, para não encavalar. */
function faixasRotulos(q: Q, maxFaixas: (p: Parede) => number, comJanelas: boolean, k: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const parede of PAREDES) {
    const fora = q.interruptores.filter((i) => i.parede === parede).map((i) => ({ el: i, txt: i.nome }))
      .concat(comJanelas ? q.janelas.filter((j) => j.parede === parede).map((j) => ({ el: j, txt: textoJanela(q, j) })) : []);
    const its = fora
      .map(({ el, txt }) => { const g = geoEl(q, el), mid = (g.a + g.b) / 2, meia = (larguraRotulo(txt) * k) / 2; return { id: el.id, a: mid - meia, b: mid + meia }; })
      .sort((x, y) => x.a - y.a);
    const fim: number[] = [], n = maxFaixas(parede);
    for (const it of its) {
      let k = fim.findIndex((f) => f <= it.a);
      if (k < 0 && fim.length < n) { k = fim.length; fim.push(it.b); }
      else if (k < 0) k = fim.indexOf(Math.min(...fim));
      fim[k] = it.b;
      out.set(it.id, k);
    }
  }
  return out;
}

/** Nomes das portas, janelas, ar-condicionado e pontos. A planta desenha esta camada depois de todos os cômodos,
 *  para os nomes ficarem por cima dos móveis e dos cômodos vizinhos. */
export function RotulosSala({ q, vista, k = 1 }: { q: Q; vista: Vista; k?: number }) {
  const casa = vista === 'casa';
  // em cima e à esquerda ficam as cotas do cômodo (fora da planta da casa): ali cabem só duas faixas de rótulo
  const faixas = faixasRotulos(q, (p) => (!casa && (p === 'cima' || p === 'esquerda') ? 2 : 3), casa, k);
  const fora = (id: string) => -T - 6 * k - (faixas.get(id) || 0) * 11 * k;
  return (
    <g className="rotulos" aria-hidden="true" style={k !== 1 ? ({ '--k': Math.round(k * 100) / 100 } as React.CSSProperties) : undefined}>
      {q.portas.map((p) => {
        if ((p.herdada && casa) || p.semParede) return null;
        const g = geoPorta(q, p), j = jeitoDaPorta(p);
        const lab = j === 'vao' || j === 'correr' ? uv2xy(q, p.parede, (g.a + g.b) / 2, 10)
          : j === 'dupla' ? uv2xy(q, p.parede, (g.a + g.b) / 2, g.sv * g.r * 0.22)
            : uv2xy(q, p.parede, g.hu + g.du * g.r * 0.55, g.sv * g.r * 0.3);
        return <text key={'p' + p.id + (p.herdada ? 'h' : '')} className={`porta-nome${p.herdada ? ' herdada' : ''}`} x={n1(lab[0])} y={n1(lab[1])} textAnchor="middle" dy=".35em">{p.nome}</text>;
      })}
      {q.janelas.map((j) => {
        const g = geoEl(q, j), w = g.b - g.a, v = casa ? fora(j.id) : j.abertura === 'abrir' ? Math.min(folhaDe(q, j) * 0.45, 30) : 19;
        return <Txt key={j.id} cls="jan-nome" p={uv2xy(q, j.parede, g.a + w / 2, v)} rt={rotTexto(j.parede)}>{textoJanela(q, j)}</Txt>;
      })}
      {q.ares.map((a) => { const g = geoEl(q, a); return <Txt key={a.id} cls="anot ar-nome" p={uv2xy(q, a.parede, (g.a + g.b) / 2, AR_PROF + 7 * k)} rt={horizontal(a.parede) ? 0 : -90}>{a.nome}</Txt>; })}
      {q.interruptores.map((i) => { const g = geoEl(q, i); return <Txt key={i.id} cls="anot ponto-nome" p={uv2xy(q, i.parede, (g.a + g.b) / 2, fora(i.id))} rt={rotTexto(i.parede)}>{i.nome}</Txt>; })}
    </g>
  );
}

/** Retângulo (no cômodo) de um trecho dado em coordenadas da parede. */
function retUV(q: Q, parede: Parede, u1: number, v1: number, u2: number, v2: number): Ret {
  const a = uv2xy(q, parede, u1, v1), b = uv2xy(q, parede, u2, v2);
  return { x1: Math.min(a[0], b[0]), y1: Math.min(a[1], b[1]), x2: Math.max(a[0], b[0]), y2: Math.max(a[1], b[1]) };
}
/** Onde fica a etiqueta do cômodo na planta da casa: no canto de cima à esquerda, a não ser que ali abra uma porta,
 *  fique o ar-condicionado, o nome de uma porta ou um móvel (com o nome dele); aí ela vai para o canto mais livre. */
export function lugarEtiqueta(q: Q, w: number, h: number, moveis: Movel[] = []): { x: number; y: number } {
  const m = 6, cands = [{ x: m, y: m }, { x: q.w - m - w, y: m }, { x: m, y: q.h - m - h }, { x: q.w - m - w, y: q.h - m - h }];
  const ocupado: Ret[] = [];
  for (const p of q.portas) {
    if (p.semParede) continue;
    const g = geoPorta(q, p), j = jeitoDaPorta(p);
    // as folhas que abrem para dentro deste cômodo (dele ou do vizinho) e o nome de um vão ou porta de correr dele
    if (giraParaDentro(p)) for (const f of folhasPorta(q, p)) ocupado.push(retUV(q, p.parede, Math.min(f.hu, f.hu + f.du * f.r), 0, Math.max(f.hu, f.hu + f.du * f.r), f.r));
    else if ((j === 'vao' || j === 'correr') && !p.herdada) ocupado.push(retUV(q, p.parede, g.a, 0, g.b, 18));
  }
  for (const a of q.ares) { const z = zonaAr(q, a); ocupado.push(retUV(q, a.parede, z.a, 0, z.b, AR_PROF + 14)); }
  for (const i of q.interruptores) { const g = geoEl(q, i); ocupado.push(retUV(q, i.parede, g.a - 4, 0, g.b + 4, 7)); }
  for (const m of moveis) ocupado.push(ret(m));
  const sobra = (c: { x: number; y: number }) => ocupado.reduce((t, r) => t + Math.max(0, Math.min(r.x2, c.x + w) - Math.max(r.x1, c.x)) * Math.max(0, Math.min(r.y2, c.y + h) - Math.max(r.y1, c.y)), 0);
  let melhor = cands[0], menor = Infinity;
  for (const c of cands) { if (c.x < 0 || c.y < 0) continue; const s = sobra(c); if (s < menor - 1) { menor = s; melhor = c; } if (s === 0) break; }
  return melhor;
}

/** Ponto na parede: uma placa com o símbolo do que ele é. */
function Interruptor({ q, i, sel, ruim }: { q: Q; i: ElParede; sel: boolean; ruim: boolean }) {
  const g = geoEl(q, i), mid = (g.a + g.b) / 2, w = Math.max(6, g.b - g.a), hw = Math.max(12, w / 2 + 6), ponto = pontoDe(i), par = i.parede;
  const furo = (u: number, k: number) => { const c = uv2xy(q, par, u, 2.6); return <circle key={k} className="interr-f" cx={n1(c[0])} cy={n1(c[1])} r={0.9} />; };
  const circ = (v: number, r: number) => { const c = uv2xy(q, par, mid, v); return <circle className="interr-g" cx={n1(c[0])} cy={n1(c[1])} r={r} />; };
  const traco = (u1: number, v1: number, u2: number, v2: number, cls = 'interr-g') => <line className={cls} {...linhaEm(q, par, mid + u1, v1, mid + u2, v2)} />;
  const forma = (pts: [number, number][], cls: string) => <path className={cls} d={caminhoUV(q, par, pts.map(([du, v]): [number, number] => [mid + du, v]))} />;
  const simbolo: Record<typeof ponto, ReactNode> = {
    // interruptor: tecla; tomada: dois furos; os dois: tecla e furos
    interruptor: traco(-w * 0.22, 2, w * 0.22, 2, 'interr-t'),
    tomada: [furo(mid - w * 0.18, 1), furo(mid + w * 0.18, 2)],
    ambos: <>{traco(-w * 0.4, 2, -w * 0.1, 2, 'interr-t')}{furo(mid + w * 0.12, 1)}{furo(mid + w * 0.34, 2)}</>,
    // arandela: o símbolo de ponto de luz (círculo com um X)
    luz: <>{circ(2, 1.9)}{traco(-1.3, 0.7, 1.3, 3.3)}{traco(-1.3, 3.3, 1.3, 0.7)}</>,
    // TV: uma telinha; internet: a entrada do cabo de rede
    tv: <><rect className="interr-g" {...rectEm(q, par, mid - 2.6, 0.4, mid + 2.6, 3.4)} />{traco(-1.2, 4.3, 1.2, 4.3)}</>,
    rede: forma([[-1.8, 0.6], [1.8, 0.6], [1.8, 3], [0.8, 3], [0.8, 3.9], [-0.8, 3.9], [-0.8, 3], [-1.8, 3]], 'interr-g'),
    // água: uma gota; esgoto: o ralo; gás: uma chama
    agua: forma([[0, 0.3], [1.1, 1.8], [1.6, 2.8], [1.2, 3.7], [0, 4.2], [-1.2, 3.7], [-1.6, 2.8], [-1.1, 1.8]], 'interr-c'),
    esgoto: <>{circ(2.2, 1.9)}{traco(-1.2, 1.6, 1.2, 1.6)}{traco(-1.2, 2.8, 1.2, 2.8)}</>,
    gas: forma([[0, 4.3], [1.3, 3.2], [1.5, 2], [0.7, 0.4], [0.5, 1.6], [-0.2, 0.6], [-1.3, 2], [-1.4, 3.2]], 'interr-c')
  };
  return (
    <g className={`interr-el${sel ? ' sel' : ''}${ruim ? ' ruim' : ''} p-${ponto}`} data-eid={i.id} tabIndex={0} role="button"
      aria-label={tx(`${i.nome}, ${minuscula(PONTO_NOME[ponto])} na parede ${NOME_PAREDE[par]}. Enter abre as opções; setas movem pela parede.`, `${i.nome}, ${minuscula(PONTO_NOME[ponto])} on the ${NOME_PAREDE[par]} wall. Enter opens the options; arrow keys move it along the wall.`)}>
      <rect className="hit" {...rectEm(q, par, mid - hw, -T, mid + hw, 14)} />
      <rect className="interr" rx={ponto === 'tomada' ? 2.5 : ehInterruptor(ponto) ? 1 : 1.5} {...rectEm(q, par, mid - w / 2, -1, mid + w / 2, 5)} />
      {simbolo[ponto]}
    </g>
  );
}

function Cotas({ q }: { q: Q }) {
  const yd = -T - 26, xd = -T - 26;
  return <g aria-hidden="true">
    <line className="cota-ext" x1={0} y1={-T - 3} x2={0} y2={yd - 5} /><line className="cota-ext" x1={q.w} y1={-T - 3} x2={q.w} y2={yd - 5} />
    <line className="cota-l" x1={0} y1={yd} x2={q.w} y2={yd} /><line className="cota-l" x1={-4} y1={yd + 4} x2={4} y2={yd - 4} /><line className="cota-l" x1={q.w - 4} y1={yd + 4} x2={q.w + 4} y2={yd - 4} />
    <text className="cota-t" x={q.w / 2} y={yd - 5} textAnchor="middle">{fmtM(q.w)} m</text>
    <line className="cota-ext" x1={-T - 3} y1={0} x2={xd - 5} y2={0} /><line className="cota-ext" x1={-T - 3} y1={q.h} x2={xd - 5} y2={q.h} />
    <line className="cota-l" x1={xd} y1={0} x2={xd} y2={q.h} /><line className="cota-l" x1={xd - 4} y1={4} x2={xd + 4} y2={-4} /><line className="cota-l" x1={xd - 4} y1={q.h + 4} x2={xd + 4} y2={q.h - 4} />
    <text className="cota-t" transform={`translate(${xd - 5} ${q.h / 2}) rotate(-90)`} textAnchor="middle">{fmtM(q.h)} m</text>
  </g>;
}

/** Seta com o espaço livre (cm), colorida pelo nível: vermelho não passa, amarelo apertado, verde passa bem. */
export function Seta({ f, rotulo }: { f: Folga; rotulo?: string }) {
  const n = nivel(f.gap);
  let x1: number, y1: number, x2: number, y2: number;
  if (f.eixo === 'x') { x1 = f.de; x2 = f.ate; y1 = y2 = f.em; } else { y1 = f.de; y2 = f.ate; x1 = x2 = f.em; }
  const len = f.eixo === 'x' ? x2 - x1 : y2 - y1, hd = Math.min(6, len / 2.6);
  const txt = rotulo || Math.round(f.gap) + ' cm', tw = txt.length * 6.2 + 10, th = 15;
  let lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
  if (f.eixo === 'x' && len < tw + 4) ly -= th * 0.9;
  if (f.eixo === 'y' && len < th + 4) lx += tw / 2 + 5;
  return (
    <g className={`seta n-${rotulo ? 'casa' : n}`}>
      <line className="fl" x1={n1(x1)} y1={n1(y1)} x2={n1(x2)} y2={n1(y2)} />
      {f.eixo === 'x'
        ? <><path className="fh" d={`M${n1(x1)},${n1(y1)} l${n1(hd)},${n1(-hd * 0.6)} v${n1(hd * 1.2)} z`} /><path className="fh" d={`M${n1(x2)},${n1(y2)} l${n1(-hd)},${n1(-hd * 0.6)} v${n1(hd * 1.2)} z`} /></>
        : <><path className="fh" d={`M${n1(x1)},${n1(y1)} l${n1(-hd * 0.6)},${n1(hd)} h${n1(hd * 1.2)} z`} /><path className="fh" d={`M${n1(x2)},${n1(y2)} l${n1(-hd * 0.6)},${n1(-hd)} h${n1(hd * 1.2)} z`} /></>}
      <g className="pill"><rect x={n1(lx - tw / 2)} y={n1(ly - th / 2)} width={n1(tw)} height={th} rx={th / 2} /><text x={n1(lx)} y={n1(ly)} dy=".36em" textAnchor="middle">{txt}</text></g>
    </g>
  );
}

export interface PropsSala {
  q: Q;
  lista: Movel[];
  av: Avaliacao;
  sel: string | null;
  selEl: string | null;
  foco: boolean;
  vista: Vista;
  ty: number | null;
  setasTodos: boolean;
  selComodo: boolean;
  /** Portas atrapalhadas em qualquer cômodo visível (a porta é dos dois lados da parede). */
  bloqueadas?: Set<string>;
}

/** Porta deste cômodo cuja folha abre para o outro lado da parede: na planta da casa o desenho dela vai numa camada
 *  por cima (PortasPorCima), senão o piso do vizinho, desenhado depois, cobriria a folha. A área de toque fica aqui,
 *  embaixo dos móveis e da etiqueta do cômodo, como a das outras portas. */
const abreParaFora = (p: ElParede): boolean => !p.herdada && !p.semParede && temGiro(p) && p.abre === 'fora';

/** Na planta da casa, por cima de todos os cômodos: as portas que abrem para o vizinho (ou para a rua) e as portas de
 *  correr abertas dentro da parede (que o vizinho cobriria com a parede dele). */
export function PortasPorCima({ q, selEl, bloqueadas }: { q: Q; selEl: string | null; bloqueadas: Set<string> }) {
  return <>
    {q.portas.filter(abreParaFora).map((p) => <Porta key={'pf' + p.id} q={q} p={p} sel={selEl === p.id} bloq={bloqueadas.has(p.id)} vista="casa" parte="desenho" />)}
    {q.portas.filter((p) => !p.herdada && !p.semParede && jeitoDaPorta(p) === 'correr').map((p) => <CorrerAberta key={'ca' + p.id} q={q} p={p} sel={selEl === p.id} />)}
  </>;
}

export function Sala({ q, lista, av, sel, selEl, foco, vista, ty, setasTodos, selComodo, bloqueadas }: PropsSala) {
  const casa = vista === 'casa', varios = vista !== 'um';
  const grade: ReactNode[] = [];
  for (let x = 50; x < q.w; x += 50) grade.push(<line key={'gx' + x} className="grade-l" x1={x} y1={0} x2={x} y2={q.h} />);
  for (let y = 50; y < q.h; y += 50) grade.push(<line key={'gy' + y} className="grade-l" x1={0} y1={y} x2={q.w} y2={y} />);
  const ordem = lista.slice().sort((a, b) => Number(a.id === sel) - Number(b.id === sel));
  const comSetas = setasTodos ? lista : lista.filter((m) => m.id === sel);
  const probs = av.itens.length;
  return (
    <>
      <rect className={`piso${q.corredor ? ' corredor' : ''} q-${tipoDoComodo(q)}`} x={0} y={0} width={q.w} height={q.h} data-piso={q.id} />
      {grade}
      {q.portas.map((p) => <Porta key={'p' + p.id + (p.herdada ? 'h' : '')} q={q} p={p} sel={selEl === p.id} bloq={(bloqueadas || av.portasBloq).has(p.id)} vista={vista} parte={casa && abreParaFora(p) ? 'casca' : 'tudo'} />)}
      <Paredes q={q} />
      {!casa && q.portas.filter((p) => !p.semParede && jeitoDaPorta(p) === 'correr').map((p) => <CorrerAberta key={'ca' + p.id + (p.herdada ? 'h' : '')} q={q} p={p} sel={selEl === p.id} />)}
      {(varios && foco) || selComodo ? <rect className={`sala-foco${selComodo ? ' forte' : ''}`} x={-T - 4} y={-T - 4} width={q.w + 2 * T + 8} height={q.h + 2 * T + 8} rx={4} /> : null}
      {q.ares.map((a) => <ArBase key={a.id} q={q} a={a} sel={selEl === a.id} />)}
      {q.janelas.map((j) => <Janela key={j.id} q={q} j={j} sel={selEl === j.id} ruim={av.elsRuins.has(j.id)} />)}
      {q.interruptores.map((i) => <Interruptor key={i.id} q={q} i={i} sel={selEl === i.id} ruim={av.elsRuins.has(i.id)} />)}
      {!casa && <Cotas q={q} />}
      {vista === 'lado' && ty != null && (
        <text className={`sala-t${foco ? ' ativo' : ''}`} data-qt={q.id} x={0} y={n1(ty)}>{q.nome}{probs ? ` · ${pl(probs, tx('problema', 'problem'), tx('problemas', 'problems'))}` : ''}</text>
      )}
      {ordem.map((m) => (
        <g key={m.id} className={`mv${sel === m.id ? ' sel' : ''}${av.conflitos.has(m.id) ? ' conflito' : ''}`} data-id={m.id} tabIndex={0} role="button"
          aria-label={tx(`${m.nome}, ${fmtM(m.larg)} por ${fmtM(m.prof)} metros${m.fixo ? ', travado' : ''}. Enter abre as opções; setas movem; R gira.`, `${m.nome}, ${fmtM(m.larg)} by ${fmtM(m.prof)} meters${m.fixo ? ', locked' : ''}. Enter opens the options; arrow keys move it; R rotates it.`)}>
          <g transform={transfLocal(m)} filter="url(#sombra-mv)"><Desenho m={m} /></g>
          <Rotulo m={m} />
        </g>
      ))}
      {ordem.map((m) => { const d = DesenhoAbertura({ m }); return d ? <g key={'ab' + m.id} className={`mv-abre${av.conflitos.has(m.id) ? ' ruim' : ''}`} transform={transfLocal(m)}>{d}</g> : null; })}
      {q.ares.map((a) => <ArTopo key={'t' + a.id} q={q} a={a} sel={selEl === a.id} />)}
      {/* na planta da casa, a etiqueta fica por cima dos móveis: é por ela que se arrasta o cômodo */}
      {casa && (() => {
        const dimensoes = `${fmtM(q.w)} × ${fmtM(q.h)}`, area = fmtArea(areaM2(q)), nw = q.nome.length * 7.4 + 30;
        const cabe = (t: string) => nw + t.length * 5.7 + 8 + 10 <= q.w - 12;
        const med = cabe(`${dimensoes} · ${area}`) ? `${dimensoes} · ${area}` : cabe(dimensoes) ? dimensoes : '';
        const w = Math.max(40, Math.min(q.w - 12, nw + (med ? med.length * 5.7 + 8 : 0) + 10)), pos = lugarEtiqueta(q, w, 26, lista);
        return (
          <g className={`sala-rot${foco ? ' ativo' : ''}${probs ? ' ruim' : ''}`} data-qt={q.id} role="button" tabIndex={0} transform={pos.x !== 6 || pos.y !== 6 ? `translate(${n1(pos.x - 6)} ${n1(pos.y - 6)})` : undefined}
            aria-label={tx(`${q.nome}, ${fmtM(q.w)} por ${fmtM(q.h)} metros, ${area}${probs ? ', ' + pl(probs, 'problema', 'problemas') : ''}. Arraste para mudar o cômodo de lugar na planta.`, `${q.nome}, ${fmtM(q.w)} by ${fmtM(q.h)} meters, ${area}${probs ? ', ' + pl(probs, 'problem', 'problems') : ''}. Drag to move the room on the floor plan.`)}>
            <rect className="sala-rot-bg" x={6} y={6} width={n1(w)} height={26} rx={7} />
            <g transform="translate(11 10) scale(0.75)"><path className="sala-rot-i" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" /></g>
            <text className="sala-rot-t" x={33} y={24}>{q.nome}{med && <tspan className="sala-rot-m" dx={6}>{med}</tspan>}</text>
          </g>
        );
      })()}
      {comSetas.map((m) => {
        const f = folgas(q, m, lista.filter((o) => o.id !== m.id));
        return (['esq', 'dir', 'cima', 'baixo'] as const).filter((k) => f[k].gap >= 1).map((k) => <Seta key={m.id + k} f={f[k]} />);
      })}
    </>
  );
}
