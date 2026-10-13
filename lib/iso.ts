// A casa em 3D, vista de cima e de lado (isométrica): o piso de cada cômodo, as paredes em pé e os móveis como
// caixas da altura deles. As paredes de fora do fundo ficam inteiras (com o vão das portas e das janelas); as outras
// são cortadas a 1,10 m, como numa maquete aberta, para dar para ver dentro. Tudo em cm; aqui só se calcula, o
// desenho fica em components/Vista3D.tsx.
import { paredeDividida } from './casa';
import { PAREDES, T, horizontal } from './catalogo';
import { cadeirasLocais, compParede, geoEl, jeitoDaPorta, localParaSala, ret, temCadeiras } from './geometria';
import type { Comodo, ComodoCompleto, Movel, Parede, Ret, TipoMovel } from './tipos';

/** Pé-direito, a altura do corte das paredes "abertas", e as alturas das portas e janelas (cm). */
export const ALTURA = 260, CORTE = 110, ALTO_PORTA = 210, PEITORIL = 100, ALTO_JANELA = 210;
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;

/** Quantos quartos de volta (no sentido do relógio) a casa girou na tela. */
export type Giro = 0 | 1 | 2 | 3;
export interface Caixa3 { x1: number; y1: number; x2: number; y2: number; z1: number; z2: number }
type P2 = { x: number; y: number };

/** As matrizes de girar a planta: (dx, dy) → (a·dx + b·dy, c·dx + d·dy), com y para baixo. */
const GIROS: Record<Giro, [number, number, number, number]> = { 0: [1, 0, 0, 1], 1: [0, -1, 1, 0], 2: [-1, 0, 0, -1], 3: [0, 1, -1, 0] };
/** Gira um ponto da planta em volta de "c". */
export function girar(p: P2, g: Giro, c: P2): P2 {
  const [a, b, cc, d] = GIROS[g], dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + a * dx + b * dy, y: c.y + cc * dx + d * dy };
}
/** O retângulo da planta depois de girar (continua com os lados alinhados). */
export function retGirado(r: Ret, g: Giro, c: P2): Ret {
  const a = girar({ x: r.x1, y: r.y1 }, g, c), b = girar({ x: r.x2, y: r.y2 }, g, c);
  return { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
}
/** Ponto (já girado) na tela: o x vai para a direita e para baixo, o y para a esquerda e para baixo, o z para cima. */
export const projetar = (x: number, y: number, z: number): [number, number] => [C30 * (x - y), S30 * (x + y) - z];
/** A matriz (SVG) que leva o desenho da planta, na altura "h", para a vista em 3D (girando em volta de "c"). */
export function matrizIso(g: Giro, c: P2, h: number): [number, number, number, number, number, number] {
  const [a, b, cc, d] = GIROS[g];
  // x' = c.x + a(x - c.x) + b(y - c.y);  y' = c.y + cc(x - c.x) + d(y - c.y)
  const ex = c.x - a * c.x - b * c.y, ey = c.y - cc * c.x - d * c.y;
  // X = C30(x' - y');  Y = S30(x' + y') - h
  return [C30 * (a - cc), S30 * (a + cc), C30 * (b - d), S30 * (b + d), C30 * (ex - ey), S30 * (ex + ey) - h];
}

/** As três faces que aparecem de uma caixa (a de cima e as duas da frente), já na tela. */
export function faces(b: Caixa3): { topo: [number, number][]; fx: [number, number][]; fy: [number, number][] } {
  const p = projetar;
  return {
    topo: [p(b.x1, b.y1, b.z2), p(b.x2, b.y1, b.z2), p(b.x2, b.y2, b.z2), p(b.x1, b.y2, b.z2)],
    fx: [p(b.x2, b.y1, b.z1), p(b.x2, b.y2, b.z1), p(b.x2, b.y2, b.z2), p(b.x2, b.y1, b.z2)],
    fy: [p(b.x1, b.y2, b.z1), p(b.x2, b.y2, b.z1), p(b.x2, b.y2, b.z2), p(b.x1, b.y2, b.z2)]
  };
}
/** O pedaço da tela que a caixa ocupa. */
export function naTela(b: Caixa3): { x1: number; y1: number; x2: number; y2: number } {
  const xs = [C30 * (b.x1 - b.y2), C30 * (b.x2 - b.y1)];
  return { x1: xs[0], x2: xs[1], y1: S30 * (b.x1 + b.y1) - b.z2, y2: S30 * (b.x2 + b.y2) - b.z1 };
}

/** A ordem de desenhar (do fundo para a frente): uma caixa vem antes da outra quando fica toda atrás dela em algum
 *  eixo (a vista olha do lado do x e do y maiores, e de cima). Só as que se cruzam na tela importam. */
export function ordenar<T extends { caixa: Caixa3 }>(itens: T[]): T[] {
  const n = itens.length, telas = itens.map((i) => naTela(i.caixa)), e = 0.5;
  const atras: number[][] = itens.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = telas[i], b = telas[j];
    if (a.x2 <= b.x1 + e || b.x2 <= a.x1 + e || a.y2 <= b.y1 + e || b.y2 <= a.y1 + e) continue;
    const A = itens[i].caixa, B = itens[j].caixa;
    const aAtras = A.x2 <= B.x1 + e || A.y2 <= B.y1 + e || A.z2 <= B.z1 + e;
    const bAtras = B.x2 <= A.x1 + e || B.y2 <= A.y1 + e || B.z2 <= A.z1 + e;
    if (aAtras && !bAtras) atras[j].push(i);
    else if (bAtras && !aAtras) atras[i].push(j);
    else if (aAtras && bAtras) { if (A.x1 + A.y1 + A.z1 <= B.x1 + B.y1 + B.z1) atras[j].push(i); else atras[i].push(j); }
    // (cruzadas, o que só acontece com móveis um em cima do outro: fica a ordem de baixo)
  }
  const feito = new Uint8Array(n), out: T[] = [];
  const visitar = (i: number) => {
    if (feito[i]) return;
    feito[i] = 1;
    for (const j of atras[i]) visitar(j);
    out.push(itens[i]);
  };
  // começa pelos mais do fundo, para os empates ficarem estáveis
  const ordem = itens.map((_, i) => i).sort((i, j) => { const A = itens[i].caixa, B = itens[j].caixa; return A.x1 + A.y1 - (B.x1 + B.y1) || A.z1 - B.z1; });
  for (const i of ordem) visitar(i);
  return out;
}

/* ---------- paredes ---------- */
/** Um trecho de parede em pé: a caixa (na planta do andar, sem girar) e se é a de fora do fundo, inteira. */
export interface Parede3 { caixa: Caixa3; alta: boolean }
/** Vidro de uma janela: na parede alta, o painel em pé; na cortada, uma faixa em cima do corte. */
export interface Vidro3 { caixa: Caixa3 }

type Faixa = [number, number];
/** Junta os trechos de altura (z) que se encostam ou se cruzam. */
function juntar(fs: Faixa[]): Faixa[] {
  const s = fs.slice().sort((a, b) => a[0] - b[0]), out: Faixa[] = [];
  for (const f of s) { const u = out[out.length - 1]; if (u && f[0] <= u[1] + 0.5) u[1] = Math.max(u[1], f[1]); else out.push([f[0], f[1]]); }
  return out;
}
/** Tira de "fs" o trecho [a, b]. */
function tirar(fs: Faixa[], a: number, b: number): Faixa[] {
  const out: Faixa[] = [];
  for (const [x, y] of fs) { if (b <= x || a >= y) { out.push([x, y]); continue; } if (a > x) out.push([x, a]); if (b < y) out.push([b, y]); }
  return out;
}
/** O retângulo da planta (do andar) de um trecho da parede "p" de "c": de "u1" a "u2" ao longo dela, na espessura. */
export function retDaParede(c: Comodo, p: Parede, u1: number, u2: number): Ret {
  if (p === 'cima') return { x1: c.x + u1, y1: c.y - T, x2: c.x + u2, y2: c.y };
  if (p === 'baixo') return { x1: c.x + u1, y1: c.y + c.h, x2: c.x + u2, y2: c.y + c.h + T };
  if (p === 'esquerda') return { x1: c.x - T, y1: c.y + u1, x2: c.x, y2: c.y + u2 };
  return { x1: c.x + c.w, y1: c.y + u1, x2: c.x + c.w + T, y2: c.y + u2 };
}
/** Para onde a parede "p" olha (de dentro do cômodo para fora). */
const NORMAL: Record<Parede, P2> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };

/** As paredes do andar em caixas que não se cruzam (as paredes divididas e os cantos entram uma vez só): as de fora
 *  que ficam no fundo da vista ("g") sobem até o teto, com o vão das portas e das janelas; as outras ficam cortadas
 *  na altura do corte, com o vão das portas. Com "altas", todas sobem até o teto. */
export function paredes3D(cs: ComodoCompleto[], g: Giro, o: { altas?: boolean } = {}): { paredes: Parede3[]; vidros: Vidro3[] } {
  const pecas: { r: Ret; z: Faixa[] }[] = [], vidros: Vidro3[] = [];
  // a parede é de fora quando, logo depois da face de fora dela, não tem cômodo nem parede de outro
  const naCasa = (x: number, y: number) => cs.some((c) => x > c.x - T && x < c.x + c.w + T && y > c.y - T && y < c.y + c.h + T);
  for (const q of cs) {
    for (const p of PAREDES) {
      const L = compParede(q, p), n = NORMAL[p];
      const ng = { x: GIROS[g][0] * n.x + GIROS[g][1] * n.y, y: GIROS[g][2] * n.x + GIROS[g][3] * n.y };
      const fundo = ng.x + ng.y < 0;
      // onde muda alguma coisa ao longo da parede: os cantos, o trecho dividido com cada vizinho, as portas e janelas
      const divisas: number[] = [];
      for (const v of cs) { if (v.id === q.id) continue; const pd = paredeDividida(q, v); if (pd && pd.parede === p) divisas.push(pd.u1, pd.u2); }
      const vaos = q.portas.filter((e) => e.parede === p).map((e) => { const gg = geoEl(q, e); return { a: gg.a, b: gg.b, sem: !!e.semParede }; });
      const jans = q.janelas.filter((e) => e.parede === p).map((e) => { const gg = geoEl(q, e); return { a: gg.a, b: gg.b }; });
      const marcas = [-T, 0, L, L + T, ...divisas, ...vaos.flatMap((v) => [v.a, v.b]), ...jans.flatMap((j) => [j.a, j.b])].filter((u) => u >= -T && u <= L + T);
      const us = [...new Set(marcas.map((u) => Math.round(u * 10) / 10))].sort((a, b) => a - b);
      for (let k = 0; k + 1 < us.length; k++) {
        const u1 = us[k], u2 = us[k + 1]; if (u2 - u1 < 0.5) continue;
        const m = (u1 + u2) / 2, r = retDaParede(q, p, u1, u2);
        const fora = !naCasa((r.x1 + r.x2) / 2 + n.x * (T / 2 + 1), (r.y1 + r.y2) / 2 + n.y * (T / 2 + 1));
        const alta = !!o.altas || (fundo && fora);
        let z: Faixa[] = [[0, alta ? ALTURA : CORTE]];
        const vao = vaos.find((v) => m > v.a && m < v.b), jan = jans.find((j) => m > j.a && m < j.b);
        if (vao) z = tirar(z, 0, alta ? (vao.sem ? ALTURA : ALTO_PORTA) : CORTE);
        else if (jan && alta) {
          z = tirar(z, PEITORIL, ALTO_JANELA);
          const meio = horizontal(p) ? { y1: r.y1 + T * 0.4, y2: r.y1 + T * 0.6 } : { x1: r.x1 + T * 0.4, x2: r.x1 + T * 0.6 };
          vidros.push({ caixa: { ...r, ...meio, z1: PEITORIL, z2: ALTO_JANELA } });
        } else if (jan) vidros.push({ caixa: { ...r, z1: CORTE, z2: CORTE + 1.5 } });
        if (z.length) pecas.push({ r, z });
      }
    }
  }
  return { paredes: unirParedes(pecas), vidros };
}

/** Junta os pedaços de parede numa grade (os cantos e as paredes divididas aparecem em mais de um cômodo) e devolve
 *  caixas que não se cruzam: em cada canto da grade, a parede vai de cada trecho de altura (z) que algum pedaço tem. */
function unirParedes(pecas: { r: Ret; z: Faixa[] }[]): Parede3[] {
  if (!pecas.length) return [];
  const xs = [...new Set(pecas.flatMap((p) => [p.r.x1, p.r.x2]).map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  const ys = [...new Set(pecas.flatMap((p) => [p.r.y1, p.r.y2]).map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  const ix = new Map(xs.map((v, i) => [v, i])), iy = new Map(ys.map((v, i) => [v, i]));
  const W = xs.length - 1, H = ys.length - 1, cel: (Faixa[] | null)[] = new Array(W * H).fill(null);
  const chave = (v: number) => Math.round(v * 10) / 10;
  for (const p of pecas) {
    const i1 = ix.get(chave(p.r.x1))!, i2 = ix.get(chave(p.r.x2))!, j1 = iy.get(chave(p.r.y1))!, j2 = iy.get(chave(p.r.y2))!;
    for (let j = j1; j < j2; j++) for (let i = i1; i < i2; i++) { const k = j * W + i; cel[k] = juntar([...(cel[k] || []), ...p.z]); }
  }
  // a mesma coluna de parede em células vizinhas vira uma caixa só (primeiro em linhas, depois juntando as linhas)
  const nome = (f: Faixa[] | null) => (f && f.length ? f.map((x) => x.join('-')).join('|') : '');
  type Corrida = { i1: number; i2: number; j1: number; j2: number; k: string; z: Faixa[] };
  let abertas: Corrida[] = [];
  const prontas: Corrida[] = [];
  for (let j = 0; j < H; j++) {
    const linha: Corrida[] = [];
    for (let i = 0; i < W;) {
      const k = nome(cel[j * W + i]);
      if (!k) { i++; continue; }
      let i2 = i + 1; while (i2 < W && nome(cel[j * W + i2]) === k) i2++;
      linha.push({ i1: i, i2, j1: j, j2: j + 1, k, z: cel[j * W + i]! });
      i = i2;
    }
    const proximas: Corrida[] = [];
    for (const c of linha) {
      const a = abertas.find((x) => x.i1 === c.i1 && x.i2 === c.i2 && x.k === c.k && x.j2 === j);
      if (a) { a.j2 = j + 1; proximas.push(a); abertas = abertas.filter((x) => x !== a); } else proximas.push(c);
    }
    prontas.push(...abertas);
    abertas = proximas;
  }
  prontas.push(...abertas);
  return prontas.flatMap((c) => c.z.map(([z1, z2]) => ({ caixa: { x1: xs[c.i1], y1: ys[c.j1], x2: xs[c.i2], y2: ys[c.j2], z1, z2 }, alta: z2 > CORTE + 1 })));
}

/* ---------- móveis ---------- */
const ALTURAS: Record<TipoMovel, number> = {
  'cama': 50, 'guarda-roupa': 210, 'berco': 90, 'comoda': 85, 'cabeceira': 55, 'mesa': 76, 'cadeira': 45, 'sofa': 80, 'poltrona': 85,
  'estante': 190, 'rack': 50, 'geladeira': 180, 'fogao': 88, 'pia': 90, 'lavadora': 85, 'tanque': 85, 'armario': 210, 'vaso': 40,
  'lavatorio': 85, 'box': 4, 'banheira': 55, 'escada': 40, 'outro': 75
};
/** A altura do móvel (cm). */
export const alturaDoMovel = (m: Pick<Movel, 'tipo'>): number => ALTURAS[m.tipo] ?? 75;
/** A caixa do móvel no andar (sem girar) e, na mesa, as cadeiras em volta (cada uma uma caixa baixa). */
export function caixasDoMovel(m: Movel, c: Comodo): { corpo: Caixa3; cadeiras: Caixa3[] } {
  const r = ret(m), h = alturaDoMovel(m);
  const corpo = { x1: c.x + r.x1, y1: c.y + r.y1, x2: c.x + r.x2, y2: c.y + r.y2, z1: 0, z2: h };
  const cadeiras = temCadeiras(m)
    ? cadeirasLocais(m).map((k) => { const s = localParaSala(m, { x1: k.x, y1: k.y, x2: k.x + k.w, y2: k.y + k.h }); return { x1: c.x + s.x1, y1: c.y + s.y1, x2: c.x + s.x2, y2: c.y + s.y2, z1: 0, z2: 45 }; })
    : [];
  return { corpo, cadeiras };
}
/** Gira a caixa (na planta) em volta de "c". */
export function caixaGirada(b: Caixa3, g: Giro, c: P2): Caixa3 { return { ...retGirado(b, g, c), z1: b.z1, z2: b.z2 }; }
