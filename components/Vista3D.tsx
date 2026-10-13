'use client';
// A casa em 3D, de cima e de lado (isométrica), só para ver: gira de 90 em 90°, mostra um andar por vez, aproxima
// com a roda ou a pinça e anda arrastando. As paredes da frente ficam cortadas para ver dentro ("Paredes altas" sobe
// todas até o teto). O piso, o terreno e o tampo dos móveis são o próprio desenho da planta, deitado.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { caixaDe } from '@/lib/casa';
import { T, tipoDoComodo } from '@/lib/catalogo';
import { andaresOrdem, comodosDoAndar, cq, listaAtiva } from '@/lib/consultas';
import { registrarPlanta } from '@/lib/exportar';
import { geoEl } from '@/lib/geometria';
import { tx } from '@/lib/i18n';
import { caixaGirada, caixasDoMovel, faces, girar, matrizIso, naTela, ordenar, paredes3D, projetar, retDaParede, retGirado, type Caixa3 } from '@/lib/iso';
import { arvores, caminhos, extensaoTerreno } from '@/lib/jardim';
import { andar3D, girar3D, paredesAltas3D, useApp, verEm3D } from '@/lib/store';
import type { ComodoCompleto, Movel } from '@/lib/tipos';
import { n1 } from '@/lib/util';
import { DefsPlanta } from './desenho/Sala';
import { Desenho, transfLocal } from './desenho/Movel';
import { DefsJardim, TerrenoDesenho } from './desenho/Terreno';
import { Icone } from './icones';

type Item =
  | { tipo: 'parede'; caixa: Caixa3; alta: boolean; k: string }
  | { tipo: 'vidro'; caixa: Caixa3; k: string }
  | { tipo: 'movel'; caixa: Caixa3; m: Movel; q: ComodoCompleto; k: string }
  | { tipo: 'cadeira'; caixa: Caixa3; k: string }
  | { tipo: 'arvore'; caixa: Caixa3; x: number; y: number; r: number; h: number; frente: boolean; k: string };
type Vb = [number, number, number, number];

const C3 = Math.cos(Math.PI / 6);
const pts = (ps: [number, number][]) => ps.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ');
const matriz = (m: number[]) => `matrix(${m.map((v) => Math.round(v * 10000) / 10000).join(' ')})`;

/** Uma caixa com as três faces que aparecem: as dos lados um pouco mais escuras (a luz vem de cima, da esquerda). */
function Caixa({ b, cls, topo = true }: { b: Caixa3; cls: string; topo?: boolean }) {
  const f = faces(b);
  return <>
    <polygon className={`${cls} iso-fy`} points={pts(f.fy)} />
    <polygon className="iso-sy" points={pts(f.fy)} />
    <polygon className={`${cls} iso-fx`} points={pts(f.fx)} />
    <polygon className="iso-sx" points={pts(f.fx)} />
    {topo && <polygon className={`${cls} iso-ft`} points={pts(f.topo)} />}
  </>;
}

export default function Vista3D() {
  const dados = useApp((s) => s.dados);
  const tres = useApp((s) => s.tres);
  const verCen = useApp((s) => s.verCen);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tela, setTela] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState<{ z: number; cx: number | null; cy: number | null }>({ z: 1, cx: null, cy: null });
  const andares = andaresOrdem(dados).filter((a) => comodosDoAndar(dados, a.id).length);
  const andar = (tres.andar && andares.some((a) => a.id === tres.andar) ? tres.andar : andares[0]?.id) || null;
  const g = tres.giro;

  useEffect(() => {
    const el = svgRef.current?.parentElement; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setTela({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // girou ou trocou de andar: volta a enquadrar a casa
  useEffect(() => { setCam({ z: 1, cx: null, cy: null }); }, [g, andar]);

  const cena = useMemo(() => {
    if (!andar) return null;
    const cs = comodosDoAndar(dados, andar).map((c) => cq(dados, c.id)).filter((q): q is ComodoCompleto => !!q);
    const b = caixaDe(cs); if (!b) return null;
    const ids = new Set(cs.map((q) => q.id)), els = Object.values(dados.els).filter((e) => ids.has(e.comodo));
    const t = dados.terreno && dados.terreno.andar === andar ? dados.terreno : null;
    // a casa gira em volta do meio dela (fica no mesmo lugar da tela)
    const c = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
    const { paredes, vidros } = paredes3D(cs, g, { altas: tres.altas });
    const itens: Item[] = [];
    paredes.forEach((p, i) => itens.push({ tipo: 'parede', caixa: caixaGirada(p.caixa, g, c), alta: p.alta, k: 'p' + i }));
    vidros.forEach((v, i) => itens.push({ tipo: 'vidro', caixa: caixaGirada(v.caixa, g, c), k: 'v' + i }));
    for (const q of cs) for (const m of listaAtiva(dados, verCen, q.id)) {
      const cx = caixasDoMovel(m, q);
      itens.push({ tipo: 'movel', caixa: caixaGirada(cx.corpo, g, c), m, q, k: 'm' + m.id });
      cx.cadeiras.forEach((k2, i) => itens.push({ tipo: 'cadeira', caixa: caixaGirada(k2, g, c), k: 'c' + m.id + i }));
    }
    const arvs = t ? arvores(t, cs, caminhos(t, cs, els)) : [];
    // a árvore que fica na frente da casa (do lado de quem olha) fica transparente, para não tapar os cômodos
    const hb0 = retGirado(b, g, c), meio = hb0.x1 + hb0.y1 + hb0.x2 + hb0.y2;
    const casaTela = { x1: C3 * (hb0.x1 - hb0.y2), x2: C3 * (hb0.x2 - hb0.y1), y1: (hb0.x1 + hb0.y1) / 2 - 300, y2: (hb0.x2 + hb0.y2) / 2 };
    arvs.forEach((a, i) => {
      const h = 210 + a.r * 0.45, p = girar(a, g, c), s = a.r * 0.55, [X, Y] = projetar(p.x, p.y, h);
      const cruza = X + a.r * 1.1 > casaTela.x1 && X - a.r * 1.1 < casaTela.x2 && Y + a.r > casaTela.y1 && Y - a.r < casaTela.y2;
      itens.push({ tipo: 'arvore', caixa: { x1: p.x - s, y1: p.y - s, x2: p.x + s, y2: p.y + s, z1: 0, z2: h + a.r }, x: p.x, y: p.y, r: a.r, h, frente: cruza && 2 * (p.x + p.y) > meio, k: 'a' + i });
    });
    const ordem = ordenar(itens);
    // o que aparece na tela: as caixas e o chão (o terreno com a rua, ou a casa)
    const chao = t ? extensaoTerreno(t) : { x1: b.x1 - 60, y1: b.y1 - 60, x2: b.x2 + 60, y2: b.y2 + 60 };
    const cg = retGirado(chao, g, c);
    let X1 = Infinity, Y1 = Infinity, X2 = -Infinity, Y2 = -Infinity;
    const junta = (x: number, y: number) => { X1 = Math.min(X1, x); Y1 = Math.min(Y1, y); X2 = Math.max(X2, x); Y2 = Math.max(Y2, y); };
    for (const [x, y] of [[cg.x1, cg.y1], [cg.x2, cg.y1], [cg.x2, cg.y2], [cg.x1, cg.y2]]) junta(...projetar(x, y, 0));
    for (const it of itens) { const r = naTela(it.caixa); junta(r.x1, r.y1); junta(r.x2, r.y2); }
    const vb: Vb = [X1, Y1, X2 - X1, Y2 - Y1];
    // o foco ao abrir: a casa (com as paredes e os móveis), o terreno fica em volta
    let F1 = Infinity, G1 = Infinity, F2 = -Infinity, G2 = -Infinity;
    for (const it of itens) { if (it.tipo === 'arvore') continue; const r = naTela(it.caixa); F1 = Math.min(F1, r.x1); G1 = Math.min(G1, r.y1); F2 = Math.max(F2, r.x2); G2 = Math.max(G2, r.y2); }
    const hb = retGirado(b, g, c);
    for (const [x, y] of [[hb.x1, hb.y1], [hb.x2, hb.y1], [hb.x2, hb.y2], [hb.x1, hb.y2]]) { const [X, Y] = projetar(x, y, 0); F1 = Math.min(F1, X); G1 = Math.min(G1, Y); F2 = Math.max(F2, X); G2 = Math.max(G2, Y); }
    const foco: Vb = [F1 - 80, G1 - 80, F2 - F1 + 160, G2 - G1 + 160];
    return { cs, c, t, els, ordem, arvs, vb, foco };
  }, [dados, andar, g, tres.altas, verCen]);

  // enquadramento (como o da planta): o foco cabe na tela, longe da barra de baixo
  const base = useMemo(() => {
    const [bx, by, bw, bh] = cena ? cena.foco : [0, 0, 1000, 800];
    const ins = { t: 60, b: 100, l: 16, r: 16 }, uw = Math.max(80, tela.w - ins.l - ins.r), uh = Math.max(80, tela.h - ins.t - ins.b), s = Math.min(uw / bw, uh / bh) || 1;
    return { cx: bx + bw / 2 - (ins.l + uw / 2 - tela.w / 2) / s, cy: by + bh / 2 - (ins.t + uh / 2 - tela.h / 2) / s, w: tela.w / s, h: tela.h / s };
  }, [cena, tela]);
  const vbW = base.w / cam.z, vbH = base.h / cam.z, vbX = (cam.cx ?? base.cx) - vbW / 2, vbY = (cam.cy ?? base.cy) - vbH / 2;
  const upx = vbW / Math.max(1, tela.w);
  const vbRef = useRef<Vb>([vbX, vbY, vbW, vbH]); vbRef.current = [vbX, vbY, vbW, vbH];
  const cenaRef = useRef(cena); cenaRef.current = cena;
  // "Salvar a planta como imagem" salva o que está em 3D (a casa toda, com o terreno)
  useEffect(() => { registrarPlanta(() => (svgRef.current && cenaRef.current ? { svg: svgRef.current, vb: cenaRef.current.vb } : null)); return () => registrarPlanta(null); }, []);

  // arrastar move, a roda e a pinça aproximam
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<null | { x: number; y: number; cx: number; cy: number; d0?: number; z0?: number }>(null);
  const zoomNoPonto = (f: number, sx: number, sy: number) => {
    const [x, y, w, h] = vbRef.current, r = svgRef.current?.getBoundingClientRect(); if (!r) return;
    const px = x + ((sx - r.left) / r.width) * w, py = y + ((sy - r.top) / r.height) * h;
    setCam((c) => {
      const z = Math.min(Math.max(c.z * f, 0.4), 8), k = c.z / z, cx0 = c.cx ?? base.cx, cy0 = c.cy ?? base.cy;
      return { z, cx: px + (cx0 - px) * k, cy: py + (cy0 - py) * k };
    });
  };
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const roda = (e: WheelEvent) => { e.preventDefault(); zoomNoPonto(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)), e.clientX, e.clientY); };
    svg.addEventListener('wheel', roda, { passive: false });
    return () => svg.removeEventListener('wheel', roda);
  });
  const desce = (e: RPointerEvent<SVGSVGElement>) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const ps = [...ptrs.current.values()], cx = cam.cx ?? base.cx, cy = cam.cy ?? base.cy;
    if (ps.length === 2) gesto.current = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2, cx, cy, d0: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, z0: cam.z };
    else gesto.current = { x: e.clientX, y: e.clientY, cx, cy };
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (!ptrs.current.has(e.pointerId) || !gesto.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const G = gesto.current, ps = [...ptrs.current.values()], r = svgRef.current?.getBoundingClientRect(); if (!r) return;
    const esc = vbRef.current[2] / r.width;
    if (ps.length >= 2 && G.d0 && G.z0) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, z = Math.min(Math.max((G.z0 * d) / G.d0, 0.4), 8);
      setCam({ z, cx: G.cx, cy: G.cy });
      return;
    }
    setCam((c) => ({ z: c.z, cx: G.cx - (e.clientX - G.x) * esc, cy: G.cy - (e.clientY - G.y) * esc }));
  };
  const sobe = (e: RPointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId);
    const ps = [...ptrs.current.values()];
    gesto.current = ps.length === 1 ? { x: ps[0].x, y: ps[0].y, cx: cam.cx ?? base.cx, cy: cam.cy ?? base.cy } : null;
  };

  if (!cena) return <div className="vazio-3d"><p className="nota">{tx('Desenhe um cômodo para ver a casa em 3D.', 'Draw a room to see the home in 3D.')}</p></div>;
  const { cs, c, t, els, ordem, arvs } = cena;
  const M0 = matriz(matrizIso(g, c, 0));
  const fs = 12.5 * upx;
  return (<>
    <svg id="planta3d" ref={svgRef} className="iso" xmlns="http://www.w3.org/2000/svg" role="img" viewBox={`${n1(vbX)} ${n1(vbY)} ${n1(vbW)} ${n1(vbH)}`}
      aria-label={tx(`A casa em 3D: ${cs.map((q) => q.nome).join(', ')}`, `The home in 3D: ${cs.map((q) => q.nome).join(', ')}`)}
      onPointerDown={desce} onPointerMove={move} onPointerUp={sobe} onPointerCancel={sobe}>
      <defs><DefsPlanta /><DefsJardim /></defs>
      {/* o chão: o terreno (com a rua e o caminho), a base da casa e o piso de cada cômodo, deitados */}
      <g transform={M0}>
        {t && <TerrenoDesenho t={t} cs={cs} els={els} plano />}
        {!t && <rect className="iso-sombra-casa" x={n1(caixaDe(cs)!.x1 - 30)} y={n1(caixaDe(cs)!.y1 - 30)} width={n1(caixaDe(cs)!.x2 - caixaDe(cs)!.x1 + 60)} height={n1(caixaDe(cs)!.y2 - caixaDe(cs)!.y1 + 60)} rx={40} />}
        {cs.map((q) => <rect key={'b' + q.id} className="iso-base" x={n1(q.x - T)} y={n1(q.y - T)} width={n1(q.w + 2 * T)} height={n1(q.h + 2 * T)} />)}
        {cs.map((q) => <rect key={'f' + q.id} className={`piso${q.corredor ? ' corredor' : ''} q-${tipoDoComodo(q)}`} x={n1(q.x)} y={n1(q.y)} width={n1(q.w)} height={n1(q.h)} />)}
        {/* onde a parede foi cortada, o piso continua */}
        {cs.flatMap((q) => q.portas.filter((p) => p.semParede && !p.herdada).map((p) => { const gg = geoEl(q, p), r = retDaParede(q, p.parede, gg.a, gg.b); return <rect key={'sp' + p.id} className={`piso q-${tipoDoComodo(q)}`} x={n1(r.x1)} y={n1(r.y1)} width={n1(r.x2 - r.x1)} height={n1(r.y2 - r.y1)} />; }))}
        {arvs.map((a, i) => <circle key={'sa' + i} className="iso-sombra" cx={n1(a.x)} cy={n1(a.y)} r={n1(a.r * 0.7)} />)}
      </g>
      {/* paredes, móveis e árvores, do fundo para a frente */}
      {ordem.map((it) => {
        if (it.tipo === 'parede') return <g key={it.k} className={`iso-parede${it.alta ? ' alta' : ''}`}><Caixa b={it.caixa} cls="iso-p" /></g>;
        if (it.tipo === 'vidro') return <g key={it.k} className="iso-vidro"><Caixa b={it.caixa} cls="iso-v" /></g>;
        if (it.tipo === 'cadeira') return <g key={it.k} className="iso-mv"><Caixa b={it.caixa} cls="mv-base t-cadeira" /></g>;
        if (it.tipo === 'arvore') {
          const [bx, by] = projetar(it.x, it.y, 0), [tx0, ty0] = projetar(it.x, it.y, it.h);
          return (
            <g key={it.k} className={`iso-arvore${it.frente ? ' na-frente' : ''}`}>
              <line className="iso-tronco" x1={n1(bx)} y1={n1(by)} x2={n1(tx0)} y2={n1(ty0)} style={{ strokeWidth: n1(Math.max(10, it.r * 0.12)) }} />
              <ellipse className="iso-copa" cx={n1(tx0)} cy={n1(ty0)} rx={n1(it.r * 1.1)} ry={n1(it.r * 0.95)} />
              <ellipse className="iso-copa-luz" cx={n1(tx0 - it.r * 0.3)} cy={n1(ty0 - it.r * 0.32)} rx={n1(it.r * 0.5)} ry={n1(it.r * 0.38)} />
            </g>
          );
        }
        // o móvel: os lados na cor dele e, em cima, o desenho dele na planta (na mesa, só o tampo: as cadeiras vêm à parte)
        const { m, q, caixa } = it, mesa = m.tipo === 'mesa';
        return (
          <g key={it.k} className="iso-mv">
            <Caixa b={caixa} cls={`mv-base t-${m.tipo}`} topo={false} />
            <g transform={matriz(matrizIso(g, c, caixa.z2))}>
              <g transform={`translate(${n1(q.x)} ${n1(q.y)})`}>
                <g transform={transfLocal(m)}>{mesa ? <rect className="mv-base t-mesa" width={n1(m.larg)} height={n1(m.prof)} rx={3} /> : <Desenho m={m} />}</g>
              </g>
            </g>
          </g>
        );
      })}
      {/* o nome de cada cômodo, em pé no meio dele */}
      {cs.map((q) => {
        const p = girar({ x: q.x + q.w / 2, y: q.y + q.h / 2 }, g, c), [x, y] = projetar(p.x, p.y, 0);
        return <text key={'n' + q.id} className="iso-nome" x={n1(x)} y={n1(y)} textAnchor="middle" dy=".35em" style={{ fontSize: n1(fs), strokeWidth: n1(fs * 0.32) }}>{q.nome}</text>;
      })}
    </svg>
    <div className="flut dock dock-3d" role="toolbar" aria-label={tx('Vista em 3D', '3D view')}>
      <button type="button" className="dock-b" data-3d="girar-esq" title={tx('Girar a casa para a esquerda', 'Turn the home left')} aria-label={tx('Girar a casa para a esquerda', 'Turn the home left')} onClick={() => girar3D(-1)}><Icone n="girar-esq" /></button>
      <button type="button" className="dock-b" data-3d="girar-dir" title={tx('Girar a casa para a direita', 'Turn the home right')} aria-label={tx('Girar a casa para a direita', 'Turn the home right')} onClick={() => girar3D(1)}><Icone n="girar" /></button>
      {andares.length > 1 && <><span className="dock-sep" aria-hidden="true" />{andares.map((a) => <button key={a.id} type="button" className="dock-b" data-3d-andar={a.id} aria-pressed={a.id === andar} onClick={() => andar3D(a.id)}><span className="sempre">{a.nome}</span></button>)}</>}
      <span className="dock-sep" aria-hidden="true" />
      <button type="button" className="dock-b" data-3d="altas" aria-pressed={tres.altas} title={tx('Paredes da frente até o teto', 'Front walls up to the ceiling')} onClick={() => paredesAltas3D(!tres.altas)}><Icone n="parede" /><span>{tx('Paredes altas', 'Tall walls')}</span></button>
      <button type="button" className="dock-b prim" data-3d="sair" onClick={() => verEm3D(false)}><Icone n="comodo" /><span className="sempre">{tx('Planta', 'Plan')}</span></button>
    </div>
  </>);
}
