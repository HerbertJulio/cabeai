import { describe, expect, it } from 'vitest';
import { espacos, imaComodo, invade, nomeAndarNovo, planoCorredor, portasVizinhas, posicaoAoLado, posicaoNova, vaoEntre } from '../lib/casa';
import { completoNaCasa, exemplo, lerArquivo, migrarV1 } from '../lib/dados';
import { avaliar } from '../lib/geometria';
import { moveisDo } from '../lib/dados';
import type { Comodo } from '../lib/tipos';

const c = (id: string, x: number, y: number, w = 300, h = 300): Comodo => ({ id, nome: id, x, y, w, h, andar: 't', criado: 1 });

describe('casa montada', () => {
  it('põe o cômodo novo dividindo a parede com o anterior', () => {
    expect(posicaoNova([], 300, 300)).toEqual({ x: 0, y: 0 });
    expect(posicaoNova([c('a', 0, 0)], 300, 400)).toEqual({ x: 315, y: 0 });
  });
  it('dividir parede não é invadir; entrar no outro é', () => {
    expect(invade(c('a', 0, 0), c('b', 315, 0))).toBe(false);
    expect(invade(c('a', 0, 0), c('b', 300, 0))).toBe(true);
    expect(invade(c('a', 0, 0), c('b', 330, 0))).toBe(false);
  });
  it('ímã encosta a parede quando chega perto', () => {
    expect(imaComodo(c('b', 0, 0), 322, 7, [c('a', 0, 0)], 12)).toEqual({ x: 315, y: 0 });
  });
  it('mostra o espaço até o vizinho, mas não através de parede dividida', () => {
    const a = c('a', 0, 0), b = c('b', 315, 0), x = c('x', 700, 0);
    expect(espacos(a, [b, x]).find((e) => e.lado === 'dir')).toBeUndefined();
    const longe = espacos(a, [c('y', 400, 0)]).find((e) => e.lado === 'dir');
    expect(longe?.gap).toBe(70);
  });
  it('nomeia os andares', () => {
    expect(nomeAndarNovo([])).toBe('Térreo');
    expect(nomeAndarNovo([{ id: 't', nome: 'Térreo', ordem: 0, criado: 1 }])).toBe('1º andar');
  });
  it('porta na parede dividida vira vão no vizinho, abrindo ao contrário', () => {
    const d = exemplo();
    const sala = completoNaCasa(d, 'sala')!;
    const h = sala.portas.find((p) => p.herdada);
    expect(h?.parede).toBe('direita');
    expect(h?.abre).toBe('fora');
    expect(portasVizinhas(d.comodos.q1, Object.values(d.comodos), Object.values(d.els))).toEqual([]);
  });
  it('o exemplo não tem problemas', () => {
    const d = exemplo();
    for (const id of Object.keys(d.comodos)) expect([id, avaliar(completoNaCasa(d, id)!, moveisDo(d, id)).problemas]).toEqual([id, []]);
  });
});

describe('arquivos', () => {
  it('lê o formato antigo (versão 1) e põe os quartos lado a lado', () => {
    const d = migrarV1({
      'moveis/m1': { nome: 'Cama', tipo: 'cama', larg: 162, prof: 202, quarto: 'q2', x: 138, y: 198, rot: 180, criado: 1 },
      'portas/p1': { nome: 'Porta', quarto: 'q1', parede: 'cima', inicio: 220, largura: 80, dobradica: 'b', abre: 'dentro', criado: 1 },
      'cenarios/c1': { nome: 'Cenário 3', quarto: 'q2', itens: { m1: { x: 1, y: 2, rot: 90 } } }
    });
    expect(Object.keys(d.comodos).sort()).toEqual(['q1', 'q2']);
    expect(d.comodos.q2.x).toBe(315);
    expect(d.moveis.m1.comodo).toBe('q2');
    expect(d.els.p1.tipo).toBe('porta');
    expect(d.cenarios.c1.escopo).toBe('comodo');
    expect(d.cenarios.c1.itens.m1).toEqual({ comodo: 'q2', x: 1, y: 2, rot: 90 });
  });
  it('recusa o que não é do Cabeaí', () => {
    expect('erro' in lerArquivo('{"a":1}')).toBe(true);
    expect('erro' in lerArquivo('nada')).toBe(true);
  });
  it('ida e volta do arquivo novo', () => {
    const d = exemplo();
    const r = lerArquivo(JSON.stringify({ app: 'cabeai', versao: 2, dados: d }));
    expect('dados' in r && r.dados).toEqual(d);
  });
});

describe('cômodo ao lado de outro e corredores', () => {
  const sala = { x: 0, y: 0, w: 400, h: 300 };
  it('encosta à direita, à esquerda, acima e abaixo dividindo a parede, com alinhamento', () => {
    expect(posicaoAoLado({ w: 200, h: 100 }, sala, 'direita')).toEqual({ x: 415, y: 0 });
    expect(posicaoAoLado({ w: 200, h: 100 }, sala, 'direita', 'fim')).toEqual({ x: 415, y: 200 });
    expect(posicaoAoLado({ w: 200, h: 100 }, sala, 'esquerda', 'meio')).toEqual({ x: -215, y: 100 });
    expect(posicaoAoLado({ w: 200, h: 100 }, sala, 'abaixo', 'meio')).toEqual({ x: 100, y: 315 });
    expect(posicaoAoLado({ w: 200, h: 100 }, sala, 'acima', 'fim')).toEqual({ x: 200, y: -115 });
    // com espaço entre as paredes: duas paredes e o vão
    expect(posicaoAoLado({ w: 200, h: 100 }, sala, 'direita', 'inicio', 120)).toEqual({ x: 400 + 15 + 120 + 15, y: 0 });
  });
  it('corredor com comprimento leva o outro cômodo para a ponta', () => {
    const quarto = { x: 1000, y: 900, w: 300, h: 300 };
    const p = planoCorredor(sala, 'abaixo', 100, 'meio', quarto, 250);
    if ('erro' in p) throw new Error(p.erro);
    expect(p.corredor).toEqual({ x: 150, y: 315, w: 100, h: 250 });
    expect(p.b).toEqual({ x: 50, y: 315 + 250 + 15 });
  });
  it('corredor sem comprimento usa o espaço que já existe e não mexe no outro', () => {
    const cozinha = { x: 400 + 15 + 300 + 15, y: 50, w: 300, h: 300 };
    expect(vaoEntre(sala, cozinha, 'direita')).toBe(300);
    const p = planoCorredor(sala, 'direita', 100, 'meio', cozinha, null);
    if ('erro' in p) throw new Error(p.erro);
    expect(p.b).toBeUndefined();
    expect(p.corredor.w).toBe(300);
    expect(p.corredor.x).toBe(415);
    expect(p.corredor.y).toBe(50 + (250 - 100) / 2); // no meio da faixa onde os dois se encaram (y 50 a 300)
    expect(planoCorredor(sala, 'esquerda', 100, 'meio', cozinha, null)).toEqual({ erro: 'sem-vao' });
  });
  it('as portas do corredor viram vão nas paredes dos dois cômodos', () => {
    const d = exemplo();
    const sala2 = Object.values(d.comodos).find((c) => c.andar === 'terreo')!;
    const cor = { id: 'cor', nome: 'Corredor', w: 300, h: 100, andar: sala2.andar, x: sala2.x - 15 - 300, y: sala2.y + 100, criado: 9, corredor: true };
    d.comodos.cor = cor;
    d.els.pc = { id: 'pc', tipo: 'porta', nome: 'Porta', comodo: 'cor', parede: 'direita', inicio: 10, largura: 80, criado: 9, dobradica: 'a', abre: 'fora' };
    const q = completoNaCasa(d, sala2.id)!;
    const herdada = q.portas.find((p) => p.herdada && p.origem === 'pc');
    expect(herdada).toBeTruthy();
    expect(herdada!.parede).toBe('esquerda');
    expect(herdada!.abre).toBe('dentro');
  });
});
