import { describe, expect, it } from 'vitest';
import { imaBorda, paredeDividida, retDesenhado } from '../lib/casa';
import { normalizarComodo, normalizarEl, normalizarMovel } from '../lib/dados';
import { acomodar, esticarComodo, girarComodo90, portaEntre } from '../lib/edicao';
import { ret } from '../lib/geometria';
import type { Comodo, ElParede, Movel } from '../lib/tipos';

const comodo = (v: Partial<Comodo> & { id: string }): Comodo => ({ nome: v.id, w: 400, h: 300, andar: 't', x: 0, y: 0, criado: 1, ...v });
const movel = (v: Partial<Movel> & { id: string }): Movel => normalizarMovel(v.id, { comodo: 'q', ...v } as Record<string, unknown>);
const el = (id: string, v: Record<string, unknown>): ElParede => normalizarEl((v.tipo as ElParede['tipo']) || 'porta', id, { comodo: 'q', ...v });

describe('girar o cômodo', () => {
  it('leva móveis, portas e janelas junto, no sentido do relógio', () => {
    const c = comodo({ id: 'q' });
    const cama = movel({ id: 'm', tipo: 'cama', larg: 160, prof: 200, x: 0, y: 0, rot: 0 });
    const p1 = el('p1', { parede: 'cima', inicio: 50, largura: 80, dobradica: 'a' });
    const j = el('j', { tipo: 'janela', parede: 'direita', inicio: 100, largura: 120 });
    const p2 = el('p2', { parede: 'esquerda', inicio: 20, largura: 80, dobradica: 'a' });
    girarComodo90(c, [cama], [p1, j, p2], []);
    expect(c).toMatchObject({ w: 300, h: 400, x: 50, y: -50 });
    // a cabeceira estava na parede de cima; agora está na da direita
    expect(cama.rot).toBe(90);
    expect(ret(cama)).toMatchObject({ x1: 100, y1: 0, x2: 300, y2: 160 });
    expect(p1).toMatchObject({ parede: 'direita', inicio: 50, dobradica: 'a' });
    expect(j).toMatchObject({ parede: 'baixo', inicio: 80 });
    expect(p2).toMatchObject({ parede: 'cima', inicio: 200, dobradica: 'b' });
  });

  it('quatro giros voltam ao começo', () => {
    const c = comodo({ id: 'q', x: 30, y: 40 });
    const m = movel({ id: 'm', tipo: 'guarda-roupa', larg: 180, prof: 55, x: 20, y: 245, rot: 180 });
    const p = el('p', { parede: 'baixo', inicio: 300, largura: 80, dobradica: 'b' });
    const item = { comodo: 'q', x: 10, y: 0, rot: 0 };
    for (let k = 0; k < 4; k++) girarComodo90(c, [m], [p], [{ item, m }]);
    expect(c).toMatchObject({ x: 30, y: 40, w: 400, h: 300 });
    expect(m).toMatchObject({ x: 20, y: 245, rot: 180 });
    expect(p).toMatchObject({ parede: 'baixo', inicio: 300, dobradica: 'b' });
    expect(item).toMatchObject({ x: 10, y: 0, rot: 0 });
  });
});

describe('esticar o cômodo pela parede', () => {
  it('o que está dentro fica no mesmo lugar da planta', () => {
    const c = comodo({ id: 'q', x: 100, w: 300 });
    const m = movel({ id: 'm', tipo: 'comoda', larg: 100, prof: 45, x: 10, y: 0 });
    const p = el('p', { parede: 'cima', inicio: 20, largura: 80 });
    const lado = el('l', { parede: 'esquerda', inicio: 40, largura: 80 });
    esticarComodo(c, 'esq', 50, 60, [m], [p, lado], []);
    expect(c).toMatchObject({ x: 50, w: 350 });
    expect(m.x).toBe(60);
    expect(p.inicio).toBe(70);
    expect(lado.inicio).toBe(40);
    esticarComodo(c, 'dir', 500, 60, [m], [p], []);
    expect(c).toMatchObject({ x: 50, w: 450 });
    esticarComodo(c, 'dir', 0, 60, [m], [p], []);
    expect(c.w).toBe(60);
    acomodar(c, [m], [p]);
    expect(m.x).toBe(0);
  });
});

describe('desenhar cômodos', () => {
  const sala = { x: 0, y: 0, w: 300, h: 400 };
  it('o ímã junta a parede do vizinho e alinha as bordas', () => {
    expect(imaBorda(322, 'x', [sala], 20, 'ini')).toBe(315);
    expect(imaBorda(122, 'x', [sala], 20, 'ini')).toBe(120);
    const r = retDesenhado({ x: 322, y: 8 }, { x: 600, y: 392 }, [sala], 20);
    expect(r).toEqual({ x: 315, y: 0, w: 285, h: 400 });
    expect(paredeDividida({ ...r }, sala)).toEqual({ parede: 'esquerda', u1: 0, u2: 400 });
    expect(paredeDividida(sala, { ...r })).toEqual({ parede: 'direita', u1: 0, u2: 400 });
  });

  it('corredor ganha porta para o quarto e passagem para a sala', () => {
    const corredor = comodo({ id: 'c', tipo: 'corredor', corredor: true, x: 315, y: 0, w: 100, h: 400 });
    const quarto = comodo({ id: 'q', tipo: 'quarto', x: 430, y: 0, w: 300, h: 300 });
    const s = comodo({ id: 's', tipo: 'sala', ...sala });
    const pq = portaEntre(corredor, quarto, [])!;
    expect(pq).toMatchObject({ comodo: 'q', parede: 'esquerda', abre: 'dentro', largura: 80, inicio: 110 });
    const ps = portaEntre(corredor, s, [])!;
    expect(ps).toMatchObject({ comodo: 'c', parede: 'esquerda', abre: 'vao', largura: 120 });
    // já tem porta nesse trecho: não põe outra
    expect(portaEntre(corredor, quarto, [{ ...pq, id: 'x', criado: 1 }])).toBeNull();
    // dois cômodos comuns lado a lado: sem porta automática
    expect(portaEntre(comodo({ id: 'a', tipo: 'quarto', x: 0, w: 300 }), comodo({ id: 'b', tipo: 'banheiro', x: 315, w: 200 }), [])).toBeNull();
  });

  it('guarda o tipo e aceita corredor estreito', () => {
    expect(normalizarComodo('c', { tipo: 'corredor', w: 90, h: 400 }, 't')).toMatchObject({ tipo: 'corredor', corredor: true, w: 90 });
    expect(normalizarComodo('v', { tipo: 'varanda' }, 't').tipo).toBe('varanda');
    expect(normalizarComodo('x', { tipo: 'piscina' }, 't').tipo).toBeUndefined();
    expect(normalizarEl('porta', 'p', { abre: 'vao' }).abre).toBe('vao');
  });
});
