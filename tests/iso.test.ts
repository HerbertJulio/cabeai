import { describe, expect, it } from 'vitest';
import { T } from '../lib/catalogo';
import { completoNaCasa, normalizarDados, normalizarMovel } from '../lib/dados';
import { ALTURA, CORTE, alturaDoMovel, caixasDoMovel, girar, matrizIso, ordenar, paredes3D, projetar, type Caixa3, type Giro } from '../lib/iso';
import type { ComodoCompleto } from '../lib/tipos';

// a sala (4 × 3 m) com a cozinha à direita (2,5 × 3 m): a parede entre as duas é de dentro
const casa = () => normalizarDados({
  andares: { t: { nome: 'Térreo' } },
  comodos: { s: { nome: 'Sala', x: 0, y: 0, w: 400, h: 300, andar: 't', tipo: 'sala' }, k: { nome: 'Cozinha', x: 415, y: 0, w: 250, h: 300, andar: 't', tipo: 'cozinha' } },
  els: {
    p: { tipo: 'porta', comodo: 's', parede: 'baixo', inicio: 100, largura: 90, abre: 'dentro' },
    j: { tipo: 'janela', comodo: 's', parede: 'cima', inicio: 150, largura: 120 },
    v: { tipo: 'porta', comodo: 's', parede: 'direita', inicio: 100, largura: 90, abre: 'vao', liga: 'k' }
  }
});
const cs = (): ComodoCompleto[] => { const d = casa(); return ['s', 'k'].map((id) => completoNaCasa(d, id)!); };
const cruzam = (a: Caixa3, b: Caixa3) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 0.5 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 0.5 && Math.min(a.z2, b.z2) - Math.max(a.z1, b.z1) > 0.5;

describe('a casa em 3D', () => {
  it('a matriz do desenho deitado é o mesmo que girar e projetar o ponto', () => {
    const c = { x: 330, y: 150 };
    for (const g of [0, 1, 2, 3] as Giro[]) for (const [x, y, h] of [[0, 0, 0], [400, 300, 0], [120, 75, 76], [-15, 315, 260]]) {
      const [a, b, cc, d, e, f] = matrizIso(g, c, h), p = girar({ x, y }, g, c), [X, Y] = projetar(p.x, p.y, h);
      expect(a * x + cc * y + e).toBeCloseTo(X, 6);
      expect(b * x + d * y + f).toBeCloseTo(Y, 6);
    }
    // girar quatro vezes volta ao lugar
    let p = { x: 12, y: 345 };
    for (let k = 0; k < 4; k++) p = girar(p, 1, { x: 100, y: 100 });
    expect(p.x).toBeCloseTo(12, 9); expect(p.y).toBeCloseTo(345, 9);
  });

  it('as paredes não se cruzam; só as de fora do fundo sobem até o teto', () => {
    for (const g of [0, 1, 2, 3] as Giro[]) {
      const { paredes } = paredes3D(cs(), g);
      for (let i = 0; i < paredes.length; i++) for (let j = i + 1; j < paredes.length; j++) expect(cruzam(paredes[i].caixa, paredes[j].caixa)).toBe(false);
      // a parede entre a sala e a cozinha (x de 400 a 415) fica cortada
      const meio = paredes.filter((p) => p.caixa.x1 >= 400 && p.caixa.x2 <= 415 && p.caixa.y1 >= 0 && p.caixa.y2 <= 300);
      expect(meio.length).toBeGreaterThan(0);
      expect(meio.every((p) => p.caixa.z2 <= CORTE)).toBe(true);
    }
    // de frente (sem girar), o fundo é em cima e à esquerda: a parede de cima da sala é alta, a de baixo é cortada
    const { paredes, vidros } = paredes3D(cs(), 0);
    const cima = paredes.filter((p) => p.caixa.y2 <= 0 && p.caixa.x1 >= 0 && p.caixa.x2 <= 400);
    const baixo = paredes.filter((p) => p.caixa.y1 >= 300 && p.caixa.x1 >= 0 && p.caixa.x2 <= 400);
    expect(Math.max(...cima.map((p) => p.caixa.z2))).toBe(ALTURA);
    expect(Math.max(...baixo.map((p) => p.caixa.z2))).toBe(CORTE);
    // a janela da parede alta: peitoril, verga e o vidro no meio
    const naJanela = cima.filter((p) => p.caixa.x1 >= 150 && p.caixa.x2 <= 270);
    expect(naJanela.map((p) => [p.caixa.z1, p.caixa.z2]).sort((a, b) => a[0] - b[0])).toEqual([[0, 100], [210, ALTURA]]);
    expect(vidros.some((v) => v.caixa.z1 === 100 && v.caixa.z2 === 210)).toBe(true);
    // o vão da porta na parede de baixo (cortada) fica livre
    expect(baixo.some((p) => p.caixa.x1 < 180 && p.caixa.x2 > 110)).toBe(false);
    // virando a casa, a parede de baixo vira a do fundo e sobe
    const virada = paredes3D(cs(), 2).paredes.filter((p) => p.caixa.y1 >= 300 && p.caixa.x1 >= 0 && p.caixa.x2 <= 400);
    expect(Math.max(...virada.map((p) => p.caixa.z2))).toBe(ALTURA);
    // com "altas", tudo sobe
    expect(paredes3D(cs(), 0, { altas: true }).paredes.filter((p) => p.caixa.y1 >= 300 && p.caixa.x2 <= 400).every((p) => p.caixa.z2 === ALTURA || p.caixa.z1 >= 200)).toBe(true);
  });

  it('o canto de dentro de uma casa em L não vira um poste alto', () => {
    // o quarto embaixo da sala, só do lado esquerdo: o canto de cima à esquerda dele fica no meio da casa
    const d = normalizarDados({ andares: { t: { nome: 'T' } }, comodos: { s: { nome: 'Sala', x: 0, y: 0, w: 400, h: 300, andar: 't' }, q: { nome: 'Quarto', x: 0, y: 315, w: 250, h: 300, andar: 't' } } });
    const { paredes } = paredes3D(['s', 'q'].map((id) => completoNaCasa(d, id)!), 0);
    // a faixa entre os dois (y de 300 a 315), da esquerda até o fim do quarto, é toda cortada
    const entre = paredes.filter((p) => p.caixa.y1 < 315 && p.caixa.y2 > 300 && p.caixa.x1 < 250 && p.caixa.x2 > 0);
    expect(entre.length).toBeGreaterThan(0);
    expect(entre.every((p) => p.caixa.z2 <= CORTE)).toBe(true);
    // e a parede de fora da esquerda (fundo, de frente) sobe inteira, de um canto ao outro
    const altura = (x: number, y: number) => Math.max(0, ...paredes.filter((p) => x > p.caixa.x1 && x < p.caixa.x2 && y > p.caixa.y1 && y < p.caixa.y2).map((p) => p.caixa.z2));
    for (const y of [-T / 2, 150, 307, 460, 615 + T / 2]) expect(altura(-T / 2, y)).toBe(ALTURA);
    // o canto de dentro (embaixo da sala, à direita do quarto) é de fora e fica de frente: cortado
    expect(altura(250 + T / 2, 300 + T / 2)).toBe(CORTE);
  });

  it('desenha do fundo para a frente', () => {
    const a = { caixa: { x1: 0, y1: 0, x2: 100, y2: 100, z1: 0, z2: 100 }, n: 'fundo' };
    const b = { caixa: { x1: 0, y1: 120, x2: 100, y2: 220, z1: 0, z2: 100 }, n: 'frente' };
    const c = { caixa: { x1: 0, y1: 0, x2: 100, y2: 100, z1: 100, z2: 120 }, n: 'em cima' };
    const o = ordenar([b, c, a]).map((x) => x.n);
    expect(o.indexOf('fundo')).toBeLessThan(o.indexOf('frente'));
    expect(o.indexOf('fundo')).toBeLessThan(o.indexOf('em cima'));
  });

  it('cada móvel tem a altura dele e a mesa traz as cadeiras', () => {
    expect(alturaDoMovel({ tipo: 'guarda-roupa' })).toBe(210);
    expect(alturaDoMovel({ tipo: 'cama' })).toBe(50);
    const mesa = normalizarMovel('m', { tipo: 'mesa', nome: 'Mesa', larg: 120, prof: 80, x: 100, y: 100, rot: 0, comodo: 's', cadeiras: 4, ladoCadeiras: 'dois' });
    const r = caixasDoMovel(mesa, { id: 's', nome: 'Sala', x: 1000, y: 0, w: 400, h: 300, andar: 't', criado: 1 });
    expect(r.corpo).toMatchObject({ x1: 1100, y1: 100, x2: 1220, y2: 180, z1: 0, z2: 76 });
    expect(r.cadeiras).toHaveLength(4);
    expect(r.cadeiras.every((k) => k.z2 === 45 && (k.y2 <= 100.5 || k.y1 >= 179.5))).toBe(true);
  });
});
