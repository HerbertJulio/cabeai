import { describe, expect, it } from 'vitest';
import { nomePadraoPonto, pontoDe } from '../lib/catalogo';
import { normalizarEl, normalizarMovel } from '../lib/dados';
import { avaliar, cobreInterruptor, pontosUsados, ret } from '../lib/geometria';
import { montarPrompt } from '../lib/ia';
import { sugerirComodo } from '../lib/motor';
import type { ComodoCompleto, ElParede, Movel, Ponto } from '../lib/tipos';

const sala = (w: number, h: number, els: ElParede[] = []): ComodoCompleto => ({
  id: 'c', nome: 'Sala', w, h, andar: 't', x: 0, y: 0, criado: 1, els,
  portas: els.filter((e) => e.tipo === 'porta'), janelas: els.filter((e) => e.tipo === 'janela'),
  ares: els.filter((e) => e.tipo === 'ar'), interruptores: els.filter((e) => e.tipo === 'interruptor')
});
const ponto = (id: string, p: Ponto, parede: ElParede['parede'], inicio: number, nome = id): ElParede =>
  normalizarEl('interruptor', id, { comodo: 'c', nome, parede, inicio, largura: 10, ponto: p });
const movel = (v: Partial<Movel> & { id: string }): Movel => normalizarMovel(v.id, { comodo: 'c', ...v } as Record<string, unknown>);

describe('pontos na parede', () => {
  it('lê os tipos novos e troca o que não conhece por interruptor', () => {
    for (const p of ['luz', 'tv', 'rede', 'agua', 'esgoto', 'gas'] as const) expect(ponto('e' + p, p, 'cima', 50).ponto).toBe(p);
    expect(normalizarEl('interruptor', 'x', { ponto: 'piscina' }).ponto).toBe('interruptor');
    expect(normalizarEl('interruptor', 'y', { ponto: 'constructor' }).ponto).toBe('interruptor');
    expect(pontoDe({})).toBe('interruptor');
  });

  it('interruptor pede 30 cm livres; os outros pontos só não podem ficar atrás de móvel alto', () => {
    const q = sala(400, 300);
    const rack = movel({ id: 'r', tipo: 'rack', larg: 180, prof: 45, x: 10, y: 0, rot: 0 });
    const gr = movel({ id: 'g', tipo: 'guarda-roupa', alto: true, larg: 180, prof: 55, x: 10, y: 0, rot: 0 });
    for (const p of ['tomada', 'luz', 'tv', 'rede', 'agua', 'esgoto', 'gas'] as const) {
      const i = ponto('i', p, 'cima', 100);
      expect(cobreInterruptor(q, i, ret(rack), rack.alto, rack.tipo)).toBe(false);
      expect(cobreInterruptor(q, i, ret(gr), gr.alto, gr.tipo)).toBe(true);
    }
    expect(cobreInterruptor(q, ponto('s', 'interruptor', 'cima', 100), ret(rack), rack.alto, rack.tipo)).toBe(true);
  });

  it('móvel alto que usa o ponto não tapa: geladeira na tomada e na água, estante no ponto de TV', () => {
    const q = sala(400, 300);
    const gel = movel({ id: 'gl', tipo: 'geladeira', alto: true, larg: 70, prof: 75, x: 70, y: 0, rot: 0 });
    const est = movel({ id: 'es', tipo: 'estante', alto: true, larg: 120, prof: 35, x: 50, y: 0, rot: 0 });
    expect(cobreInterruptor(q, ponto('t', 'tomada', 'cima', 100), ret(gel), true, 'geladeira')).toBe(false);
    expect(cobreInterruptor(q, ponto('a', 'agua', 'cima', 100), ret(gel), true, 'geladeira')).toBe(false);
    expect(cobreInterruptor(q, ponto('g', 'gas', 'cima', 100), ret(gel), true, 'geladeira')).toBe(true);
    expect(cobreInterruptor(q, ponto('v', 'tv', 'cima', 100), ret(est), true, 'estante')).toBe(false);
    expect(cobreInterruptor(q, ponto('w', 'agua', 'cima', 100), ret(est), true, 'estante')).toBe(true);
  });

  it('avisa quando um móvel alto tapa o ponto', () => {
    const q = sala(400, 300, [ponto('tv1', 'tv', 'cima', 100, 'Ponto de TV')]);
    const av = avaliar(q, [movel({ id: 'g', tipo: 'guarda-roupa', nome: 'Guarda-roupa', alto: true, larg: 180, prof: 55, x: 10, y: 0, rot: 0 })]);
    expect(av.problemas).toContain('Guarda-roupa tapa “Ponto de TV”: móvel alto encostado no ponto.');
    expect(av.elsRuins.has('tv1')).toBe(true);
  });

  it('sabe quais pontos o móvel está usando', () => {
    const q = sala(400, 300, [ponto('tv', 'tv', 'baixo', 195), ponto('ag', 'agua', 'cima', 60), ponto('es', 'esgoto', 'cima', 90), ponto('lz', 'luz', 'esquerda', 20)]);
    const rack = movel({ id: 'r', tipo: 'rack', larg: 180, prof: 45, x: 110, y: 255, rot: 180 });
    expect(pontosUsados(q, 'rack', ret(rack))).toEqual(['tv']);
    expect(pontosUsados(q, 'rack', ret({ ...rack, x: 110, y: 0, rot: 0 }))).toEqual([]);
    const pia = movel({ id: 'p', tipo: 'pia', larg: 120, prof: 55, x: 40, y: 0, rot: 0 });
    expect(pontosUsados(q, 'pia', ret(pia)).sort()).toEqual(['agua', 'esgoto']);
    // cabeceira na parede da esquerda, com a arandela ao lado
    const cama = movel({ id: 'c', tipo: 'cama', larg: 140, prof: 190, x: 0, y: 60, rot: 270 });
    expect(pontosUsados(q, 'cama', ret(cama))).toEqual(['luz']);
  });

  it('as sugestões põem o rack no ponto de TV e o fogão no gás', async () => {
    const q = sala(400, 320, [
      normalizarEl('porta', 'pt', { comodo: 'c', nome: 'Porta', parede: 'esquerda', inicio: 20, largura: 80 }),
      ponto('tv', 'tv', 'direita', 160), ponto('gs', 'gas', 'cima', 300)
    ]);
    const moveis = [
      movel({ id: 'r', tipo: 'rack', nome: 'Rack', larg: 160, prof: 45, x: 0, y: 0, rot: 0 }),
      movel({ id: 'f', tipo: 'fogao', nome: 'Fogão', larg: 76, prof: 60, x: 0, y: 200, rot: 0 })
    ];
    const ops = await sugerirComodo(q, moveis, undefined, 400);
    expect(ops.length).toBeGreaterThan(0);
    const melhor = ops[0], at = (id: string) => ({ ...moveis.find((m) => m.id === id)!, ...melhor.itens[id] });
    expect(pontosUsados(q, 'rack', ret(at('r')))).toEqual(['tv']);
    expect(pontosUsados(q, 'fogao', ret(at('f')))).toEqual(['gas']);
    expect(melhor.explicacao).toContain('Rack na frente do ponto de TV.');
  });

  it('a IA recebe os pontos e o móvel que usa cada um', () => {
    const q = sala(400, 300, [ponto('tv', 'tv', 'baixo', 195, 'Ponto de TV'), ponto('gs', 'gas', 'cima', 60, 'Gás')]);
    const p = montarPrompt(q, [movel({ id: 'r', tipo: 'rack', larg: 180, prof: 45, x: 0, y: 0, rot: 0 })], []);
    expect(p).toContain('"Ponto de TV" (ponto de TV)');
    expect(p).toContain('Bom lugar para móvel do tipo rack ou tipo estante');
    expect(p).toContain('"Gás" (ponto de gás)');
  });

  it('reconhece o nome padrão nos dois idiomas', () => {
    expect(nomePadraoPonto('Tomada', 'tomada')).toBe(true);
    expect(nomePadraoPonto('Tomada 3', 'tomada')).toBe(true);
    expect(nomePadraoPonto('Outlet 2', 'tomada')).toBe(true);
    expect(nomePadraoPonto('Tomada da TV', 'tomada')).toBe(false);
    expect(nomePadraoPonto('Ponto de TV', 'tomada')).toBe(false);
  });
});
