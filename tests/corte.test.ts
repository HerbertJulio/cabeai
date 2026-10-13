import { describe, expect, it } from 'vitest';
import { completoNaCasa, normalizarDados, normalizarEl } from '../lib/dados';
import { corteNaParede, limitesDoCorte, revisarLigacoes } from '../lib/edicao';
import { descreverMudanca } from '../lib/historico';
import {
  ajustarCorte, anotarPasso, atualizar, cancelarCorte, cortarParede, cortarParedeToda, desenharComodo, desfazer, esquecerPasso, estadoAtual, iniciarCorte, limparSel, listaHistorico, moverComodo, moverCorte, porParede, trocarDados
} from '../lib/store';
import type { Comodo, Dados, ElParede } from '../lib/tipos';
import { vazio } from '../lib/tipos';

const q = (id: string, x: number, y: number, w: number, h: number, tipo?: Comodo['tipo']): Comodo => ({ id, nome: id, x, y, w, h, andar: 't', criado: 1, ...(tipo ? { tipo } : {}) });
const el = (id: string, v: Record<string, unknown>): ElParede => normalizarEl((v.tipo as ElParede['tipo']) || 'porta', id, v);
// a sala (4 × 3 m) e a cozinha do lado direito dela (2,5 × 4,5 m): a parede dividida tem 3 m (u de 0 a 300 na sala)
const sala = q('s', 0, 0, 400, 300, 'sala'), coz = q('k', 415, -50, 250, 450, 'cozinha');

describe('cortar só um trecho da parede', () => {
  it('o corte fica no trecho marcado e leva junto só o que cai nele (dos dois lados)', () => {
    const porta = el('p', { comodo: 's', parede: 'direita', inicio: 200, largura: 80 });
    // a tomada da cozinha a 1,50 m do canto dela fica a 1,00 m na parede da sala (a cozinha começa 50 cm acima)
    const tomada = el('t', { tipo: 'interruptor', comodo: 'k', parede: 'esquerda', inicio: 150, largura: 10, ponto: 'tomada' });
    const r = corteNaParede(sala, coz, 40, 140, [porta, tomada])!;
    expect(r.el).toMatchObject({ comodo: 's', parede: 'direita', inicio: 40, largura: 100, semParede: true, parcial: true, liga: 'k', abre: 'vao' });
    expect(r.remover.map((e) => e.id)).toEqual(['t']);
    // marcado de trás para a frente e passando da parede: fica dentro do trecho dividido
    expect(corteNaParede(sala, coz, 260, -80, [])!.el).toMatchObject({ inicio: 0, largura: 260, parcial: true });
    // pegando o trecho todo, é a parede toda (sem "parcial")
    expect(corteNaParede(sala, coz, 0, 300, [])!.el.parcial).toBeUndefined();
    // curto demais, ou cômodos que não se encostam: nada
    expect(corteNaParede(sala, coz, 100, 105, [])).toBeNull();
    expect(corteNaParede(sala, { ...coz, x: 600 }, 0, 100, [])).toBeNull();
  });

  it('as pontas param antes de outra porta, janela ou ponto da parede, e na ponta do trecho', () => {
    const corte = { ...corteNaParede(sala, coz, 100, 160, [])!.el, id: 'c', criado: 1 } as ElParede;
    const porta = el('p', { comodo: 's', parede: 'direita', inicio: 200, largura: 80 });
    const tomada = el('t', { tipo: 'interruptor', comodo: 'k', parede: 'esquerda', inicio: 90, largura: 10, ponto: 'tomada' });
    // a tomada da cozinha (90 a 100 lá) fica de 40 a 50 na parede da sala
    expect(limitesDoCorte({ s: sala, k: coz }, corte, [corte, porta, tomada])).toEqual({ min: 50, max: 200, u1: 0, u2: 300 });
    expect(limitesDoCorte({ s: sala, k: coz }, corte, [corte])).toEqual({ min: 0, max: 300, u1: 0, u2: 300 });
  });

  it('o corte parcial fica onde está quando os cômodos mudam; o da parede toda acompanha', () => {
    const parcial = { ...corteNaParede(sala, coz, 100, 200, [])!.el, id: 'c', criado: 1 } as ElParede;
    const toda = { ...corteNaParede(sala, coz, 0, 300, [])!.el, id: 'd', criado: 1 } as ElParede;
    // a cozinha desce 1,50 m: o trecho dividido vira 100 a 300 na sala
    const desceu = { s: sala, k: { ...coz, y: 100 } };
    expect(revisarLigacoes(desceu, [parcial]).mudar).toEqual([]);
    expect(revisarLigacoes(desceu, [toda]).mudar).toEqual([{ id: 'd', inicio: 100, largura: 200 }]);
    // desce mais (trecho de 220 a 300): o corte encolhe para caber
    expect(revisarLigacoes({ s: sala, k: { ...coz, y: 220 } }, [parcial]).mudar).toEqual([{ id: 'c', inicio: 220, largura: 10 }]);
    // separados: o corte sai
    expect(revisarLigacoes({ s: sala, k: { ...coz, x: 700 } }, [parcial]).remover).toEqual(['c']);
  });

  it('o "parcial" fica guardado e o vizinho desenha só o trecho cortado', () => {
    const corte = { ...corteNaParede(sala, coz, 100, 200, [])!.el, id: 'c', criado: 1 } as ElParede;
    const d = normalizarDados({ andares: { t: { nome: 'T' } }, comodos: { s: sala, k: coz }, els: { c: corte } });
    expect(d.els.c).toMatchObject({ semParede: true, parcial: true, inicio: 100, largura: 100 });
    // na cozinha, o mesmo trecho fica de 150 a 250 (ela começa 50 cm acima)
    expect(completoNaCasa(d, 'k')!.portas.find((p) => p.herdada)).toMatchObject({ semParede: true, parede: 'esquerda', inicio: 150, largura: 100 });
  });
});

describe('a tesoura na loja', () => {
  const comecar = (d: Dados = vazio()) => {
    atualizar((s) => { s.carregado = false; });
    trocarDados(d);
    atualizar((s) => { s.carregado = true; });
  };
  const dados = () => estadoAtual().dados;
  const cortes = () => Object.values(dados().els).filter((e) => e.semParede);

  it('marcar, ajustar pelas pontas, levar pela parede, parede toda, pôr de volta e desfazer', () => {
    comecar();
    const a = desenharComodo({ andar: null, x: 0, y: 0, w: 400, h: 300, tipo: 'sala' });
    const b = desenharComodo({ andar: null, x: 415, y: 0, w: 250, h: 300, tipo: 'cozinha' });
    iniciarCorte(a.id, b.id);
    expect(estadoAtual().corte).toEqual({ a: a.id, b: b.id });
    expect(estadoAtual().selComodo).toBe(a.id);
    cancelarCorte();
    expect(estadoAtual().corte).toBeNull();
    iniciarCorte(a.id, b.id);
    limparSel();
    expect(estadoAtual().corte).toBeNull();

    const r = cortarParede(a.id, b.id, 20, 120)!;
    expect(r.largura).toBe(100);
    expect(cortes()).toHaveLength(1);
    expect(cortes()[0]).toMatchObject({ comodo: a.id, inicio: 20, largura: 100, parcial: true, liga: b.id });
    expect(estadoAtual().selEl).toBe(r.eid);
    expect(listaHistorico().feitos[0].rotulo).toMatch(/^Cortou 1,00 m da parede entre/);

    // as pontas: a de cima até 0 (a ponta da parede), a de baixo até 2,00 m; nunca menos de 20 cm
    anotarPasso('Acertou o corte');
    atualizar((s) => { s.arrastando = true; });
    expect(ajustarCorte(r.eid, -30, 120)).toEqual({ ini: 0, fim: 120 });
    expect(ajustarCorte(r.eid, 0, 200)).toEqual({ ini: 0, fim: 200 });
    expect(ajustarCorte(r.eid, 190, 200)).toEqual({ ini: 180, fim: 200 });
    atualizar((s) => { s.arrastando = false; });
    esquecerPasso();
    expect(dados().els[r.eid]).toMatchObject({ inicio: 180, largura: 20, parcial: true });
    // levar pela parede, do mesmo tamanho, sem sair do trecho
    moverCorte(r.eid, 400);
    expect(dados().els[r.eid]).toMatchObject({ inicio: 280, largura: 20 });
    // a ponta que chega às duas pontas do trecho vira a parede toda
    expect(ajustarCorte(r.eid, 0, 300)).toEqual({ ini: 0, fim: 300 });
    expect(dados().els[r.eid].parcial).toBeUndefined();
    ajustarCorte(r.eid, 50, 300);
    expect(dados().els[r.eid].parcial).toBe(true);
    expect(cortarParedeToda(r.eid)).toBe(true);
    expect(dados().els[r.eid]).toMatchObject({ inicio: 0, largura: 300 });
    expect(dados().els[r.eid].parcial).toBeUndefined();
    expect(listaHistorico().feitos[0].rotulo).toMatch(/^Tirou a parede toda entre/);
    expect(desfazer()).toBe(true);
    expect(dados().els[r.eid].parcial).toBe(true);
    // pôr a parede de volta tira o corte
    expect(porParede(a.id, b.id)).toBe(true);
    expect(cortes()).toHaveLength(0);
    // cortar de novo com um corte lá troca o corte velho pelo novo
    cortarParede(a.id, b.id, 0, 100);
    cortarParede(a.id, b.id, 150, 250);
    expect(cortes()).toHaveLength(1);
    expect(cortes()[0]).toMatchObject({ inicio: 150, largura: 100 });
    // mover a cozinha para baixo mantém o corte no lugar (ainda cabe)
    moverComodo(b.id, 415, 100);
    expect(cortes()[0]).toMatchObject({ inicio: 150, largura: 100 });
  });

  it('o histórico chama o corte pelo que ele é', () => {
    const corte = { ...corteNaParede(sala, coz, 100, 200, [])!.el, id: 'c', criado: 1 } as ElParede;
    const d0 = normalizarDados({ andares: { t: { nome: 'T' } }, comodos: { s: sala, k: coz }, els: { c: corte } });
    const d1 = normalizarDados({ ...d0, els: { c: { ...corte, inicio: 140 } } });
    expect(descreverMudanca(d0, d1)).toBe('Moveu o corte da parede');
  });
});
