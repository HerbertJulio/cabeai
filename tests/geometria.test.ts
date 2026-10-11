import { describe, expect, it } from 'vitest';
import { avaliar, cadeirasPorLado, dims, ladoNaSala, localParaSala, lugarLivre, normRot, precisaFrente, ret, zonasCadeiras } from '../lib/geometria';
import { normalizarMovel } from '../lib/dados';
import type { ComodoCompleto, ElParede, Movel } from '../lib/tipos';

const sala = (w: number, h: number, els: ElParede[] = []): ComodoCompleto => ({
  id: 'c', nome: 'Quarto', w, h, andar: 't', x: 0, y: 0, criado: 1, els,
  portas: els.filter((e) => e.tipo === 'porta'), janelas: els.filter((e) => e.tipo === 'janela'),
  ares: els.filter((e) => e.tipo === 'ar'), interruptores: els.filter((e) => e.tipo === 'interruptor')
});
const movel = (v: Partial<Movel> & { id: string }): Movel => normalizarMovel(v.id, { comodo: 'c', ...v } as Record<string, unknown>);

describe('geometria básica', () => {
  it('normaliza giros', () => {
    expect(normRot(-90)).toBe(270);
    expect(normRot(450)).toBe(90);
    expect(normRot('abc')).toBe(0);
  });
  it('troca largura e profundidade quando gira', () => {
    expect(dims({ larg: 100, prof: 50, rot: 90 })).toEqual({ w: 50, h: 100 });
  });
  it('acha sobreposição e móvel saindo do cômodo', () => {
    const q = sala(300, 300);
    const a = movel({ id: 'a', tipo: 'cama', larg: 160, prof: 200, x: 0, y: 0 });
    const b = movel({ id: 'b', tipo: 'comoda', larg: 100, prof: 45, x: 150, y: 10 });
    const c = movel({ id: 'k', tipo: 'outro', larg: 100, prof: 45, x: 250, y: 280 });
    const av = avaliar(q, [a, b, c]);
    expect(av.problemas.some((p) => p.includes('um em cima do outro'))).toBe(true);
    expect(av.problemas.some((p) => p.includes('saindo do cômodo'))).toBe(true);
  });
  it('porta que abre para dentro não pode ser bloqueada', () => {
    const porta: ElParede = { id: 'p', tipo: 'porta', nome: 'Porta', comodo: 'c', parede: 'cima', inicio: 0, largura: 80, criado: 1, dobradica: 'a', abre: 'dentro' };
    const q = sala(300, 300, [porta]);
    const m = movel({ id: 'm', tipo: 'comoda', larg: 60, prof: 40, x: 10, y: 10 });
    expect(avaliar(q, [m]).portasBloq.has('p')).toBe(true);
  });
  it('fogão e sofá pedem espaço na frente', () => {
    expect(precisaFrente(movel({ id: 'f', tipo: 'fogao', larg: 76, prof: 60 }))).toBe(70);
    expect(precisaFrente(movel({ id: 's', tipo: 'sofa', larg: 210, prof: 90 }))).toBe(50);
  });
});

describe('mesa com cadeiras', () => {
  it('distribui as cadeiras pelos lados', () => {
    const base = { id: 'm', tipo: 'mesa' as const, larg: 120, prof: 80 };
    expect(cadeirasPorLado(movel({ ...base, cadeiras: 1, ladoCadeiras: 'frente' }))).toEqual({ frente: 1, tras: 0, esq: 0, dir: 0 });
    expect(cadeirasPorLado(movel({ ...base, cadeiras: 4, ladoCadeiras: 'dois' }))).toEqual({ frente: 2, tras: 2, esq: 0, dir: 0 });
    expect(cadeirasPorLado(movel({ ...base, cadeiras: 6, ladoCadeiras: 'volta' }))).toEqual({ frente: 2, tras: 2, esq: 1, dir: 1 });
  });
  it('leva a área das cadeiras junto quando a mesa gira', () => {
    const m = movel({ id: 'm', tipo: 'mesa', larg: 100, prof: 50, x: 0, y: 100, rot: 270, cadeiras: 1, cadProf: 50 });
    expect(ladoNaSala(270, 'frente')).toBe('dir');
    const z = zonasCadeiras(m)[0].r;
    expect(z.x1).toBeCloseTo(50);
    expect(z.x2).toBeCloseTo(125);
    const r = ret(m);
    expect(z.y1).toBeGreaterThanOrEqual(r.y1 - 1);
    expect(z.y2).toBeLessThanOrEqual(r.y2 + 1);
    expect(localParaSala(m, { x1: 0, y1: 0, x2: 100, y2: 50 })).toEqual({ x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 });
  });
  it('reclama quando não dá para puxar a cadeira', () => {
    const q = sala(300, 300);
    const mesa = movel({ id: 'm', tipo: 'mesa', larg: 100, prof: 50, x: 0, y: 0, rot: 0, cadeiras: 1, cadProf: 50 });
    const cama = movel({ id: 'c', tipo: 'cama', larg: 200, prof: 160, x: 0, y: 90 });
    expect(avaliar(q, [mesa, cama]).problemas.some((p) => p.startsWith('As cadeiras de Mesa precisam de 75 cm'))).toBe(true);
    const longe = { ...cama, y: 140 };
    expect(avaliar(q, [mesa, longe]).problemas.length).toBe(0);
  });
  it('acha lugar para mesa com cadeiras dos dois lados no meio do cômodo', () => {
    const q = sala(400, 400);
    const m = movel({ id: 'm', tipo: 'mesa', larg: 120, prof: 80, cadeiras: 4, ladoCadeiras: 'dois', cadProf: 45 });
    const p = lugarLivre(q, m, []);
    const posto = { ...m, ...p };
    expect(avaliar(q, [posto]).problemas).toEqual([]);
  });
});

describe('cama com baú', () => {
  it('soma os baús no tamanho do conjunto e centraliza ou alinha', async () => {
    const { tam, partesCama } = await import('../lib/geometria');
    const cama = movel({ id: 'c', tipo: 'cama', larg: 140, prof: 190, bauPe: 45, bauPeLarg: 160 } as Partial<Movel> & { id: string });
    expect(tam(cama)).toEqual({ larg: 160, prof: 235 });
    expect(partesCama(cama).cama.x).toBe(10);
    const esq = { ...cama, bauPeAl: 'esq' as const };
    expect(partesCama(esq).cama.x).toBe(0);
    expect(tam(esq).larg).toBe(160);
    const desl = { ...cama, bauPeDx: 15 };
    expect(partesCama(desl).pe!.x - partesCama(desl).cama.x).toBe(5);
    const dois = { ...cama, bauCab: 30, bauCabLarg: 140 };
    expect(tam(dois)).toEqual({ larg: 160, prof: 265 });
    expect(dims(dois, 90)).toEqual({ w: 265, h: 160 });
  });
  it('outros móveis ignoram os campos de baú', () => {
    const m = movel({ id: 'm', tipo: 'comoda', larg: 100, prof: 45, bauPe: 40 } as Partial<Movel> & { id: string });
    expect(m.bauPe).toBe(0);
  });
});
