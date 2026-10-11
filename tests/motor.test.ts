import { describe, expect, it } from 'vitest';
import { completoNaCasa, exemplo, moveisDo } from '../lib/dados';
import { sugerirCasa, sugerirComodo } from '../lib/motor';

describe('sugestões', () => {
  it('dá até 3 arrumações diferentes e respeita o móvel travado', async () => {
    const d = exemplo();
    const q = completoNaCasa(d, 'q2')!;
    const moveis = moveisDo(d, 'q2').map((m) => (m.tipo === 'berco' ? { ...m, fixo: true } : m));
    const ops = await sugerirComodo(q, moveis, undefined, 400);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.length).toBeLessThanOrEqual(3);
    const berco = moveis.find((m) => m.tipo === 'berco')!;
    for (const o of ops) expect(o.itens[berco.id]).toMatchObject({ x: berco.x, y: berco.y });
    const chaves = new Set(ops.map((o) => JSON.stringify(o.itens)));
    expect(chaves.size).toBe(ops.length);
  });
  it('casa toda junta os cômodos', async () => {
    const d = exemplo();
    const cs = Object.keys(d.comodos).map((id) => completoNaCasa(d, id)!);
    const ops = await sugerirCasa(cs, (id) => moveisDo(d, id));
    expect(ops.length).toBeGreaterThan(0);
    expect(Object.keys(ops[0].itens).length).toBe(Object.keys(d.moveis).length);
  });
});
