import { describe, expect, it } from 'vitest';
import { imaComodo } from '../lib/casa';
import { tipoDoComodo } from '../lib/catalogo';
import { completoNaCasa, normalizarDados, normalizarEl } from '../lib/dados';
import { paredeTirada, portaEntre, revisarLigacoes, semParedeEntre } from '../lib/edicao';
import { avaliar } from '../lib/geometria';
import { areaLivre, areaM2, fmtArea, textoResumo } from '../lib/resumo';
import {
  atualizar, colar, conectarComodo, copiar, desenharComodo, desfazer, duplicarComodo, estadoAtual, moverComodo, porParede, refazer, salvarEl, selecionar, tirarParede, trocarDados
} from '../lib/store';
import type { Comodo, Dados, ElParede } from '../lib/tipos';
import { vazio } from '../lib/tipos';

const q = (id: string, x: number, y: number, w: number, h: number, tipo?: Comodo['tipo']): Comodo => ({ id, nome: id, x, y, w, h, andar: 't', criado: 1, ...(tipo ? { tipo } : {}), ...(tipo === 'corredor' ? { corredor: true } : {}) });
const el = (id: string, v: Record<string, unknown>): ElParede => normalizarEl((v.tipo as ElParede['tipo']) || 'porta', id, v);

describe('cômodos que grudam', () => {
  it('o vizinho de frente puxa de mais longe que um cômodo só para alinhar', () => {
    const quarto = q('a', 0, 0, 300, 300), cor = q('c', 0, 0, 110, 400);
    // 30 cm da parede do quarto, de frente para ele: gruda
    expect(imaComodo(cor, 345, 0, [quarto], 36).x).toBe(315);
    // longe na outra direção (embaixo do quarto, sem encarar): só alinha bem de perto
    expect(imaComodo(cor, 345, 900, [quarto], 36).x).toBe(345);
  });

  it('a porta automática sabe quem ela liga e sai quando eles se separam', () => {
    const quarto = q('a', 0, 0, 300, 300, 'quarto'), cor = q('c', 315, 0, 110, 400, 'corredor');
    const p = portaEntre(cor, quarto, [])!;
    expect(p).toMatchObject({ comodo: 'a', parede: 'direita', abre: 'dentro', auto: true, liga: 'c' });
    const porta = { ...p, id: 'p', criado: 1 } as ElParede;
    // ainda encostados: fica
    expect(revisarLigacoes({ a: quarto, c: cor }, [porta])).toEqual({ remover: [], mudar: [] });
    // o corredor desceu: o trecho dividido encolheu e a porta vai para o meio do que sobrou
    const desceu = { ...cor, y: 180 };
    const r = revisarLigacoes({ a: quarto, c: desceu }, [porta]);
    expect(r.remover).toEqual([]);
    expect(r.mudar[0]).toMatchObject({ id: 'p', largura: 80 });
    expect(r.mudar[0].inicio).toBeGreaterThanOrEqual(180);
    // longe: a porta sai
    expect(revisarLigacoes({ a: quarto, c: { ...cor, x: 500 } }, [porta]).remover).toEqual(['p']);
    // uma porta posta à mão não sai
    const minha = el('m', { comodo: 'a', parede: 'direita', inicio: 10, largura: 80 });
    expect(revisarLigacoes({ a: quarto, c: { ...cor, x: 500 } }, [minha]).remover).toEqual([]);
  });

  it('o tipo do cômodo antigo vem do nome', () => {
    expect(tipoDoComodo({ nome: 'Cozinha' })).toBe('cozinha');
    expect(tipoDoComodo({ nome: 'Suíte do casal' })).toBe('quarto');
    expect(tipoDoComodo({ nome: 'Cômodo 3' })).toBe('outro');
    expect(tipoDoComodo({ nome: 'Room 1' })).toBe('outro');
    expect(tipoDoComodo({ nome: 'Lavabo', corredor: true })).toBe('corredor');
  });
});

describe('tirar a parede entre dois cômodos', () => {
  const sala = q('s', 0, 0, 400, 300, 'sala'), coz = q('k', 415, 0, 250, 450, 'cozinha');

  it('o vão ocupa a parede dividida inteira e leva junto o que estava nela', () => {
    const porta = el('p', { comodo: 's', parede: 'direita', inicio: 100, largura: 80 });
    const tomada = el('t', { tipo: 'interruptor', comodo: 'k', parede: 'esquerda', inicio: 50, largura: 10, ponto: 'tomada' });
    const janela = el('j', { tipo: 'janela', comodo: 'k', parede: 'direita', inicio: 50, largura: 120 });
    const r = paredeTirada(sala, coz, [porta, tomada, janela])!;
    expect(r.el).toMatchObject({ comodo: 's', parede: 'direita', inicio: 0, largura: 300, semParede: true, liga: 'k', abre: 'vao' });
    expect(r.remover.map((e) => e.id).sort()).toEqual(['p', 't']);
  });

  it('o vizinho vê a parede aberta e nada reclama de móvel "na frente" dela', () => {
    const vao = { ...paredeTirada(sala, coz, [])!.el, id: 'v', criado: 1 } as ElParede;
    const d = normalizarDados({ andares: { t: { nome: 'T' } }, comodos: { s: sala, k: coz }, els: { v: vao }, moveis: { m: { tipo: 'sofa', nome: 'Sofá', larg: 200, prof: 90, comodo: 's', x: 310, y: 50, rot: 90 } } });
    expect(d.els.v).toMatchObject({ semParede: true, largura: 300 });
    const k = completoNaCasa(d, 'k')!;
    expect(k.portas.find((p) => p.herdada)).toMatchObject({ semParede: true, parede: 'esquerda', inicio: 0, largura: 300 });
    expect(avaliar(completoNaCasa(d, 's')!, Object.values(d.moveis)).itens).toEqual([]);
    expect(semParedeEntre('k', 's', Object.values(d.els))?.id).toBe('v');
  });

  it('a parede tirada vale do lado do vizinho mesmo com uma porta dele no trecho', () => {
    const vao = { ...paredeTirada(sala, coz, [])!.el, id: 'v', criado: 1 } as ElParede;
    const d = normalizarDados({ andares: { t: { nome: 'T' } }, comodos: { s: sala, k: coz }, els: { v: vao, p: { tipo: 'porta', comodo: 'k', parede: 'esquerda', inicio: 100, largura: 80 } } });
    const k = completoNaCasa(d, 'k')!;
    expect(k.portas.some((p) => p.herdada && p.semParede)).toBe(true);
    // e o aviso diz que a porta ficou no vão
    expect(avaliar(k, []).itens.some((i) => i.eid === 'p' || i.eid === 'v')).toBe(true);
  });

  it('a parede tirada para um cômodo que não existe mais volta (ao abrir os dados)', () => {
    const d = normalizarDados({ andares: { t: { nome: 'T' } }, comodos: { s: sala }, els: { v: { tipo: 'porta', comodo: 's', parede: 'direita', inicio: 0, largura: 300, semParede: true, liga: 'k' } } });
    expect(d.els.v).toBeUndefined();
  });
});

describe('na loja: ligar, tirar parede, desfazer, duplicar e copiar', () => {
  const comecar = (d: Dados = vazio()) => {
    atualizar((s) => { s.carregado = false; });
    trocarDados(d);
    atualizar((s) => { s.carregado = true; });
  };
  const dados = () => estadoAtual().dados;

  it('corredor que encosta no quarto ganha porta; tirar e pôr a parede; desfazer e refazer', () => {
    comecar();
    const quarto = desenharComodo({ andar: null, x: 0, y: 0, w: 300, h: 300, tipo: 'quarto' });
    const cor = desenharComodo({ andar: null, x: 500, y: 0, w: 110, h: 400, tipo: 'corredor' });
    expect(Object.values(dados().els)).toHaveLength(0);
    moverComodo(cor.id, 315, 0);
    expect(conectarComodo(cor.id)).toEqual([dados().comodos[quarto.id].nome]);
    const auto = Object.values(dados().els).filter((e) => e.auto);
    expect(auto).toHaveLength(1);
    expect(tirarParede(cor.id, quarto.id)).toBe(true);
    expect(Object.values(dados().els).filter((e) => e.semParede)).toHaveLength(1);
    expect(Object.values(dados().els).filter((e) => e.auto)).toHaveLength(0);
    expect(desfazer()).toBe(true);
    expect(Object.values(dados().els).filter((e) => e.semParede)).toHaveLength(0);
    expect(Object.values(dados().els).filter((e) => e.auto)).toHaveLength(1);
    expect(refazer()).toBe(true);
    expect(Object.values(dados().els).filter((e) => e.semParede)).toHaveLength(1);
    // pôr a parede de volta refaz a porta automática do corredor
    expect(porParede(quarto.id, cor.id)).toBe(true);
    expect(Object.values(dados().els).filter((e) => e.auto)).toHaveLength(1);
    // afastar o corredor tira a porta
    moverComodo(cor.id, 700, 0);
    conectarComodo(cor.id);
    expect(Object.values(dados().els)).toHaveLength(0);
  });

  it('a porta automática que a pessoa arrasta vira dela: não some quando os cômodos se separam', () => {
    comecar();
    const quarto = desenharComodo({ andar: null, x: 0, y: 0, w: 300, h: 300, tipo: 'quarto' });
    const cor = desenharComodo({ andar: null, x: 315, y: 0, w: 110, h: 400, tipo: 'corredor' });
    expect(cor.ligados).toEqual([dados().comodos[quarto.id].nome]);
    const p = Object.values(dados().els).find((e) => e.auto)!;
    salvarEl(p.id, { inicio: p.inicio + 30 });
    expect(dados().els[p.id].auto).toBeUndefined();
    moverComodo(cor.id, 700, 0);
    conectarComodo(cor.id);
    expect(dados().els[p.id]).toBeTruthy();
  });

  it('duplica o cômodo com os móveis e as portas dele, ao lado', () => {
    comecar(normalizarDados({
      andares: { t: { nome: 'T' } }, comodos: { a: q('a', 0, 0, 300, 300, 'quarto') },
      moveis: { m: { tipo: 'cama', nome: 'Cama', larg: 140, prof: 190, comodo: 'a', x: 0, y: 0, rot: 0 } },
      els: { p: { tipo: 'porta', comodo: 'a', parede: 'baixo', inicio: 20, largura: 80 } }
    }));
    const nid = duplicarComodo('a')!;
    const n = dados().comodos[nid];
    expect(n).toMatchObject({ w: 300, h: 300, x: 315, y: 0 });
    expect(n.nome).not.toBe('a');
    expect(Object.values(dados().moveis).filter((m) => m.comodo === nid)).toHaveLength(1);
    expect(Object.values(dados().els).filter((e) => e.comodo === nid)).toHaveLength(1);
    desfazer();
    expect(dados().comodos[nid]).toBeUndefined();
  });

  it('copia um móvel e cola em outro cômodo', () => {
    comecar(normalizarDados({
      andares: { t: { nome: 'T' } }, comodos: { a: q('a', 0, 0, 300, 300), b: q('b', 315, 0, 300, 300) },
      moveis: { m: { tipo: 'cama', nome: 'Cama', larg: 140, prof: 190, comodo: 'a', x: 0, y: 0, rot: 0 } }
    }));
    selecionar({ id: 'm' });
    expect(copiar()).toBe(true);
    expect(colar({ comodo: 'b' })).toBe(true);
    const nb = Object.values(dados().moveis).filter((m) => m.comodo === 'b');
    expect(nb).toHaveLength(1);
    expect(nb[0]).toMatchObject({ tipo: 'cama', larg: 140, prof: 190 });
  });
});

describe('áreas e resumo', () => {
  it('área, chão livre (sobreposição conta uma vez) e o texto do resumo', () => {
    expect(areaM2({ w: 300, h: 350 })).toBe(10.5);
    expect(fmtArea(10.5)).toBe('10,5 m²');
    expect(fmtArea(123.4)).toBe('123 m²');
    const cama = { id: 'm', tipo: 'cama', larg: 100, prof: 200, rot: 0, x: 0, y: 0 } as never;
    const outra = { id: 'n', tipo: 'cama', larg: 100, prof: 200, rot: 0, x: 0, y: 0 } as never;
    expect(areaLivre({ w: 300, h: 300 }, [cama, outra])).toEqual({ m2: 7, pct: 78 });
    const d = normalizarDados({ andares: { t: { nome: 'Térreo' } }, comodos: { a: { ...q('a', 0, 0, 300, 300), nome: 'Quarto' } }, moveis: { m: { tipo: 'cama', nome: 'Cama', larg: 140, prof: 190, comodo: 'a' } } });
    const t = textoResumo(d);
    expect(t).toContain('9,0 m²');
    expect(t).toContain('Quarto: 3,00 × 3,00 m');
    expect(t).toContain('Cama: 1,40 × 1,90 m');
  });
});
