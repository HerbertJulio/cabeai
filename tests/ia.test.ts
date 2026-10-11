import { describe, expect, it } from 'vitest';
import { completoNaCasa, exemplo, moveisDo } from '../lib/dados';
import { extrairJson, lerOpcoesIA, montarPrompt, pedidoCorrecao } from '../lib/ia';

describe('IA', () => {
  const d = exemplo();
  const q = completoNaCasa(d, 'q1')!;
  const todos = moveisDo(d, 'q1');

  it('pede as 3 opções com as medidas do cômodo e de cada móvel', () => {
    const p = montarPrompt(q, todos, []);
    expect(p).toContain(`${q.w} cm de largura`);
    for (const m of todos) expect(p).toContain(`id "${m.id}"`);
    expect(p).toContain('"opcoes"');
  });

  it('acha o JSON mesmo com texto e cercas de código em volta', () => {
    const txt = 'Claro! Aqui está:\n```json\n{"opcoes":[{"titulo":"A","moveis":[{"id":"x","x":1,"y":2,"rot":0}],"explicacao":"tem } dentro"}]}\n```\nAbraços';
    expect(extrairJson(txt)).toEqual({ opcoes: [{ titulo: 'A', moveis: [{ id: 'x', x: 1, y: 2, rot: 0 }], explicacao: 'tem } dentro' }] });
    expect(extrairJson('sem json')).toBeNull();
  });

  it('traz os móveis para dentro do cômodo, ignora ids estranhos e conta os problemas', () => {
    const [a, b] = todos;
    const res = {
      opcoes: [
        { titulo: 'Fora do cômodo', moveis: [{ id: a.id, x: -500, y: 9999, rot: 90 }, { id: 'nao-existe', x: 0, y: 0, rot: 0 }], explicacao: 'x' },
        { titulo: 'Um em cima do outro', moveis: [{ id: a.id, x: 0, y: 0, rot: 0 }, { id: b.id, x: 0, y: 0, rot: 0 }], explicacao: 'y' },
        { titulo: 'Vazia', moveis: [], explicacao: 'z' }
      ]
    };
    const ops = lerOpcoesIA(q, todos, res);
    expect(ops.length).toBe(2);
    const i = ops[0].itens[a.id];
    expect(i.x).toBeGreaterThanOrEqual(0);
    expect(i.y).toBeGreaterThanOrEqual(0);
    expect(i.rot).toBe(90);
    expect(ops[0].itens['nao-existe']).toBeUndefined();
    expect(ops[1].problemas).toBeGreaterThan(0);
    const corr = pedidoCorrecao(q, todos, ops);
    expect(corr).toContain('Opção 2');
    expect(corr).toContain(b.id);
  });
});
