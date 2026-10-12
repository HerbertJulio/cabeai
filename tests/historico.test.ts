import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizarDados } from '../lib/dados';
import { Historico, aparar, descreverMudanca, lerPontos, novoPonto } from '../lib/historico';
import type { Dados } from '../lib/tipos';

const base = (): Dados => normalizarDados({
  andares: { t: { nome: 'Térreo' } },
  comodos: { a: { nome: 'Sala', w: 400, h: 300, andar: 't', x: 0, y: 0 } },
  moveis: { m: { tipo: 'sofa', nome: 'Sofá', larg: 200, prof: 90, comodo: 'a', x: 0, y: 0, rot: 0 } }
});
const com = (d: Dados, f: (x: Dados) => void): Dados => { const x = JSON.parse(JSON.stringify(d)) as Dados; f(x); return x; };

describe('o nome de cada mudança', () => {
  it('fala do cômodo, do móvel ou do cenário que mudou', () => {
    const a = base();
    expect(descreverMudanca(a, com(a, (x) => { x.moveis.m.x = 50; }))).toBe('Moveu Sofá');
    expect(descreverMudanca(a, com(a, (x) => { x.moveis.m.rot = 90; }))).toBe('Girou Sofá');
    expect(descreverMudanca(a, com(a, (x) => { x.comodos.a.x = 30; }))).toBe('Moveu Sala na planta');
    expect(descreverMudanca(a, com(a, (x) => { x.comodos.a.w = 500; }))).toBe('Mudou o tamanho de Sala');
    expect(descreverMudanca(a, com(a, (x) => { delete x.moveis.m; }))).toBe('Removeu Sofá');
    // o cômodo saiu com o móvel dentro: conta só o cômodo
    expect(descreverMudanca(a, com(a, (x) => { delete x.comodos.a; delete x.moveis.m; }))).toBe('Removeu Sala');
    expect(descreverMudanca(a, com(a, (x) => { x.moveis.m.x = 50; x.moveis.m.nome = 'Sofá novo'; }))).toBe('Renomeou Sofá para Sofá novo');
  });
});

describe('desfazer e refazer', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('mudanças seguidas viram um passo só; desfazer e refazer andam pelos passos', () => {
    vi.useFakeTimers();
    const h = new Historico(() => {});
    const d0 = base(), d1 = com(d0, (x) => { x.moveis.m.x = 10; }), d2 = com(d1, (x) => { x.moveis.m.x = 20; }), d3 = com(d2, (x) => { x.moveis.m.rot = 90; });
    h.iniciar(d0);
    expect(h.podeDesfazer).toBe(false);
    // um arraste: várias mudanças durante o gesto
    h.registrar(d1, true); h.registrar(d2, true);
    expect(h.podeDesfazer).toBe(true);
    h.fimGesto(); vi.runAllTimers();
    h.registrar(d3, false); vi.advanceTimersByTime(500);
    expect(h.lista().feitos.map((p) => p.rotulo)).toEqual(['Girou Sofá', 'Moveu Sofá']);
    expect(h.desfazer()!.antes).toBe(d2);
    expect(h.desfazer()!.antes).toBe(d0);
    expect(h.desfazer()).toBeNull();
    expect(h.podeRefazer).toBe(true);
    expect(h.refazer()!.depois).toBe(d2);
    // mudar depois de desfazer apaga o que dava para refazer
    h.registrar(com(d2, (x) => { x.moveis.m.y = 5; }), false);
    h.confirmar();
    expect(h.podeRefazer).toBe(false);
  });

  it('com nome: o passo leva o nome dado', () => {
    const h = new Historico(() => {});
    const d0 = base();
    h.iniciar(d0);
    h.anotar('Tirou a parede');
    h.registrar(com(d0, (x) => { x.comodos.a.w = 410; }), false);
    h.confirmar();
    expect(h.lista().feitos[0].rotulo).toBe('Tirou a parede');
  });
});

describe('pontos de restauração', () => {
  it('guarda até 12 automáticos e lê de volta o que estava salvo', () => {
    const d = base();
    const ps = Array.from({ length: 15 }, (_, k) => ({ ...novoPonto(d, 'auto ' + k, true), t: 1000 + k }));
    ps.push({ ...novoPonto(d, 'meu', false), t: 1 });
    const r = aparar(ps);
    expect(r.lista.filter((p) => p.auto)).toHaveLength(12);
    expect(r.lista.find((p) => p.nome === 'meu')).toBeTruthy();
    expect(r.lista[0].nome).toBe('auto 14');
    const lidos = lerPontos(r.texto);
    expect(lidos).toHaveLength(13);
    expect(lidos[0].dados.comodos.a.nome).toBe('Sala');
    expect(lerPontos('lixo')).toEqual([]);
    expect(novoPonto(d, '', false).resumo).toBe('1 cômodo · 1 móvel');
  });
});
