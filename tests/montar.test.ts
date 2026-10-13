import { describe, expect, it } from 'vitest';
import { invade, limitesDaLinha, linhaDaParede, paredeDividida, paredeNoPontoDaCasa } from '../lib/casa';
import { T } from '../lib/catalogo';
import { normalizarDados, normalizarEl, normalizarMovel } from '../lib/dados';
import { dividirComodo } from '../lib/edicao';
import { aberturasDoAndar, contornoNoTerreno, cortarModelo, dentroDoContorno, kitDoComodo, ligacaoBoa, nomesDosTipos, parseMetros, recuos, terrenoEmVolta, terrenoNaPlanta } from '../lib/montar';
import { descreverMudanca } from '../lib/historico';
import { abrirPassos, anotarPasso, aplicarModelo, atualizar, criarCasa, criarComodo, dividirComodoEm, estadoAtual, fecharPassos, fimMoverParede, listaHistorico, mobiliar, moverParedeReta, porAberturas, salvarTerreno, seguirPassos, trocarDados } from '../lib/store';
import { vazio, type Comodo, type Dados, type ElParede, type TipoComodo } from '../lib/tipos';

const q = (id: string, x: number, y: number, w: number, h: number, tipo?: TipoComodo): Comodo => ({ id, nome: id, x, y, w, h, andar: 't', criado: 1, ...(tipo ? { tipo } : {}), ...(tipo === 'corredor' ? { corredor: true } : {}) });

describe('medidas em metros', () => {
  it('lê metros, centímetros e números grandes como centímetros', () => {
    expect(parseMetros('10')).toBe(1000);
    expect(parseMetros('12,5')).toBe(1250);
    expect(parseMetros('8.4 m')).toBe(840);
    expect(parseMetros('1250 cm')).toBe(1250);
    expect(parseMetros('350')).toBe(350);
    expect(parseMetros('')).toBeNaN();
    expect(parseMetros('dez')).toBeNaN();
  });
});

describe('a casa no terreno', () => {
  it('com a rua embaixo, a casa fica no meio da frente e com o recuo pedido', () => {
    const t = terrenoNaPlanta(1000, 2500, 'baixo');
    expect(t).toEqual({ x: 0, y: 0, w: 1000, h: 2500, rua: 'baixo' });
    const r = contornoNoTerreno(t, { frente: 800, fundo: 1000, recuoFrente: 300, recuoLado: null });
    expect(r).toEqual({ caixa: { x: 100, y: 1200, w: 800, h: 1000 } });
    expect(recuos(t, (r as { caixa: { x: number; y: number; w: number; h: number } }).caixa)).toEqual({ frente: 300, fundo: 1200, lado1: 100, lado2: 100 });
    // o cômodo de dentro tem as paredes descontadas
    expect(dentroDoContorno({ x: 100, y: 1200, w: 800, h: 1000 })).toEqual({ x: 115, y: 1215, w: 770, h: 970 });
  });
  it('com a rua do lado, a frente vira a altura', () => {
    const t = terrenoNaPlanta(1000, 2500, 'esquerda');
    expect(t).toMatchObject({ w: 2500, h: 1000 });
    expect(contornoNoTerreno(t, { frente: 800, fundo: 1000, recuoFrente: 300, recuoLado: 50 })).toEqual({ caixa: { x: 300, y: 50, w: 1000, h: 800 } });
  });
  it('avisa quando a casa não cabe', () => {
    const t = terrenoNaPlanta(800, 1500, 'baixo');
    expect(contornoNoTerreno(t, { frente: 900, fundo: 1000, recuoFrente: null, recuoLado: null })).toHaveProperty('erro');
    expect(contornoNoTerreno(t, { frente: 700, fundo: 1000, recuoFrente: 600, recuoLado: null })).toHaveProperty('erro');
    expect(contornoNoTerreno(t, { frente: 700, fundo: 1000, recuoFrente: 200, recuoLado: 200 })).toHaveProperty('erro');
    // sem terreno, o contorno começa no canto
    expect(contornoNoTerreno(null, { frente: 700, fundo: 900, recuoFrente: null, recuoLado: null })).toEqual({ caixa: { x: 0, y: 0, w: 700, h: 900 } });
  });
  it('o terreno em volta de uma casa que já existe deixa ela no meio e a 3 m da rua', () => {
    const t = terrenoEmVolta({ x: -15, y: -15, w: 745, h: 410 }, 1000, 1500, 'baixo');
    expect(t).toMatchObject({ w: 1000, h: 1500 });
    expect(recuos(t, { x: -15, y: -15, w: 745, h: 410 })).toMatchObject({ frente: 300, lado1: 128 });
  });
});

describe('modelos prontos', () => {
  const dentro = { x: 15, y: 15, w: 770, h: 970 };
  it('2 quartos: quartos e banheiro no fundo, corredor, sala e cozinha na frente, todos dividindo as paredes', () => {
    const cs = cortarModelo(dentro, '2q').map((c, k) => q('c' + k, c.x, c.y, c.w, c.h, c.tipo));
    expect(cs.map((c) => c.tipo)).toEqual(['quarto', 'banheiro', 'quarto', 'corredor', 'sala', 'cozinha']);
    const cor = cs[3];
    expect(cor.h).toBe(100);
    expect(cor.w).toBe(770);
    // ninguém em cima de ninguém, tudo dentro da casa, e cada um encosta em alguém
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      expect(c.x).toBeGreaterThanOrEqual(15); expect(c.y).toBeGreaterThanOrEqual(15);
      expect(c.x + c.w).toBeLessThanOrEqual(785); expect(c.y + c.h).toBeLessThanOrEqual(985);
      for (let j = i + 1; j < cs.length; j++) expect(invade(c, cs[j])).toBe(false);
      expect(cs.some((o) => o !== c && paredeDividida(c, o))).toBe(true);
    }
    // a área de dentro bate: os cômodos e as paredes do meio enchem a casa
    const area = cs.reduce((t, c) => t + c.w * c.h, 0);
    expect(area).toBeLessThan(770 * 970);
    expect(area).toBeGreaterThan(770 * 970 * 0.93);
  });
  it('com a rua em cima, a sala e a cozinha vão para cima', () => {
    const cs = cortarModelo(dentro, '1q', 'cima');
    const sala = cs.find((c) => c.tipo === 'sala')!, quarto = cs.find((c) => c.tipo === 'quarto')!;
    expect(sala.y).toBeLessThan(quarto.y);
    const lado = cortarModelo({ x: 15, y: 15, w: 970, h: 770 }, '1q', 'esquerda');
    const s2 = lado.find((c) => c.tipo === 'sala')!, q2 = lado.find((c) => c.tipo === 'quarto')!;
    expect(s2.x).toBeLessThan(q2.x);
  });
  it('casa pequena demais para o modelo: não corta abaixo do mínimo', () => {
    const cs = cortarModelo({ x: 0, y: 0, w: 200, h: 240 }, '3q');
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) { expect(c.w).toBeGreaterThanOrEqual(90); expect(c.h).toBeGreaterThanOrEqual(90); }
  });
  it('nomes pelos tipos, sem repetir', () => {
    expect(nomesDosTipos(['quarto', 'banheiro', 'quarto', 'sala', 'banheiro'], ['Quarto 1'])).toEqual(['Quarto 2', 'Banheiro', 'Quarto 3', 'Sala', 'Banheiro 2']);
  });
});

describe('dividir um cômodo com uma parede', () => {
  it('a parede em pé deixa o que estava do outro lado no cômodo novo', () => {
    const c = q('a', 100, 50, 400, 300), novo = q('b', 0, 0, 0, 0);
    const cama = normalizarMovel('m1', { tipo: 'cama', larg: 90, prof: 190, comodo: 'a', x: 250, y: 0, rot: 0 });
    const sofa = normalizarMovel('m2', { tipo: 'sofa', larg: 150, prof: 80, comodo: 'a', x: 0, y: 200, rot: 0 });
    const els: ElParede[] = [
      normalizarEl('porta', 'p1', { comodo: 'a', parede: 'cima', inicio: 300, largura: 80 }),
      normalizarEl('janela', 'j1', { comodo: 'a', parede: 'direita', inicio: 100, largura: 100 }),
      normalizarEl('janela', 'j2', { comodo: 'a', parede: 'esquerda', inicio: 100, largura: 100 }),
      normalizarEl('porta', 'p2', { comodo: 'a', parede: 'baixo', inicio: 20, largura: 80 })
    ];
    dividirComodo(c, novo, 'x', 200, [cama, sofa], els, []);
    expect([c.x, c.w, novo.x, novo.y, novo.w, novo.h]).toEqual([100, 200, 315, 50, 185, 300]);
    expect(cama).toMatchObject({ comodo: 'b', x: 35 });
    expect(sofa).toMatchObject({ comodo: 'a', x: 0 });
    expect(els.map((e) => [e.id, e.comodo, e.inicio])).toEqual([['p1', 'b', 85], ['j1', 'b', 100], ['j2', 'a', 100], ['p2', 'a', 20]]);
    expect(paredeDividida(c, novo)).toEqual({ parede: 'direita', u1: 0, u2: 300 });
  });
  it('a parede deitada divide de cima para baixo', () => {
    const c = q('a', 0, 0, 300, 400), novo = q('b', 0, 0, 0, 0);
    dividirComodo(c, novo, 'y', 150, [], [], []);
    expect([c.h, novo.y, novo.h, novo.w]).toEqual([150, 165, 235, 300]);
  });
});

describe('a parede reta entre cômodos', () => {
  const A = q('A', 0, 0, 300, 300), A2 = q('A2', 0, 315, 300, 285), B = q('B', 315, 0, 300, 600), C = q('C', 0, 1200, 300, 200);
  it('junta os cômodos dos dois lados que seguem em linha', () => {
    const l = linhaDaParede([A, A2, B, C], 'x', 300, 100);
    expect(l).toMatchObject({ eixo: 'x', v: 300, antes: ['A', 'A2'], depois: ['B'], de: -15, ate: 615 });
    expect(paredeNoPontoDaCasa([A, A2, B, C], { x: 307, y: 100 }, 10)).toMatchObject({ eixo: 'x', v: 300, antes: ['A', 'A2'], depois: ['B'] });
    // a parede de baixo do A é a de cima do A2
    expect(paredeNoPontoDaCasa([A, A2, B, C], { x: 150, y: 306 }, 10)).toMatchObject({ eixo: 'y', v: 300, antes: ['A'], depois: ['A2'] });
    // a fachada da direita de B sozinho; longe de parede, nada
    expect(paredeNoPontoDaCasa([A, A2, B, C], { x: 622, y: 300 }, 10)).toMatchObject({ eixo: 'x', v: 615, antes: ['B'], depois: [] });
    expect(paredeNoPontoDaCasa([A, A2, B, C], { x: 150, y: 150 }, 10)).toBeNull();
    expect(limitesDaLinha({ A, A2, B }, l, 60)).toEqual({ de: 60, ate: 540 });
  });
});

describe('portas e janelas sozinhas', () => {
  it('cada cômodo ganha saída, a sala ganha a porta da rua e quem tem parede de fora ganha janela', () => {
    const cs = cortarModelo({ x: 15, y: 15, w: 770, h: 970 }, '2q').map((c, k) => q(['q1', 'ban', 'q2', 'cor', 'sala', 'coz'][k], c.x, c.y, c.w, c.h, c.tipo));
    const r = aberturasDoAndar(cs, [], { rua: 'baixo', entrada: true });
    const els = r.novos.map((e, k) => ({ ...e, id: 'e' + k, criado: k })) as ElParede[];
    const portas = els.filter((e) => e.tipo === 'porta'), janelas = els.filter((e) => e.tipo === 'janela');
    // todo cômodo tem pelo menos uma porta ou passagem (dele ou do vizinho)
    for (const c of cs) expect(portas.some((p) => p.comodo === c.id || p.liga === c.id)).toBe(true);
    // quartos e banheiro abrem para o corredor; sala e cozinha ficam abertas para ele
    for (const id of ['q1', 'ban', 'q2']) expect(portas.find((p) => p.comodo === id && p.liga === 'cor')?.abre).toBe('dentro');
    expect(portas.filter((p) => p.abre === 'vao').length).toBeGreaterThanOrEqual(2);
    const entrada = portas.find((p) => p.nome === 'Entrada');
    expect(entrada).toMatchObject({ comodo: 'sala', parede: 'baixo' });
    expect(janelas.some((j) => j.comodo === 'cor')).toBe(false);
    expect(new Set(janelas.map((j) => j.comodo))).toEqual(new Set(['q1', 'ban', 'q2', 'sala', 'coz']));
    expect(r.portas).toBe(portas.length);
    expect(r.janelas).toBe(janelas.length);
    // rodar de novo não repete porta onde já tem
    const de_novo = aberturasDoAndar(cs, els, { rua: 'baixo', entrada: true });
    expect(de_novo.novos.filter((e) => e.tipo === 'porta').length).toBe(0);
  });
  it('as ligações preferem o corredor e deixam sala e cozinha abertas', () => {
    expect(ligacaoBoa('corredor', 'quarto')).toEqual({ nota: 10, porta: true });
    expect(ligacaoBoa('sala', 'corredor')).toEqual({ nota: 10, porta: false });
    expect(ligacaoBoa('cozinha', 'sala')).toEqual({ nota: 9, porta: false });
    expect(ligacaoBoa('quarto', 'quarto').nota).toBeLessThan(1);
  });
});

describe('móveis de cada cômodo', () => {
  it('o maior quarto ganha cama de casal; banheiro pequeno não ganha box marcado', () => {
    const k = kitDoComodo(q('a', 0, 0, 300, 350, 'quarto'), true);
    expect(k[0]).toMatchObject({ tipo: 'cama', larg: 138, marcado: true });
    expect(k.find((i) => i.chave === 'criado')?.qtd).toBe(2);
    expect(kitDoComodo(q('b', 0, 0, 120, 150, 'banheiro'), false).find((i) => i.tipo === 'box')?.marcado).toBe(false);
    expect(kitDoComodo(q('c', 0, 0, 100, 400, 'corredor'), false)).toEqual([]);
  });
});

describe('o terreno nos dados', () => {
  it('entra pela normalização, com a rua e o andar, e aparece no histórico', () => {
    const d0 = normalizarDados({ andares: { t: { nome: 'Térreo' } }, comodos: {}, moveis: {}, els: {}, cenarios: {} });
    const d1 = normalizarDados({ ...d0, terreno: { andar: 't', x: 0, y: 0, w: 1000, h: 2500, rua: 'baixo' } });
    expect(d1.terreno).toEqual({ andar: 't', x: 0, y: 0, w: 1000, h: 2500, rua: 'baixo' });
    expect(descreverMudanca(d0, d1)).toBe('Terreno de 10,00 × 25,00 m');
    expect(normalizarDados({ terreno: { w: 50, h: 50 } }).terreno).toBeUndefined();
    // sem andar válido, vai para o primeiro (e cria o térreo)
    expect(normalizarDados({ terreno: { andar: 'x', w: 800, h: 1200, rua: 'lado' } }).terreno).toMatchObject({ andar: 'terreo', rua: 'baixo' });
    expect(T).toBe(15);
  });
});

describe('na loja: o passo a passo monta a casa', () => {
  const comecar = (d: Dados) => {
    atualizar((s) => { s.carregado = false; });
    trocarDados(d);
    atualizar((s) => { s.carregado = true; });
  };
  const dados = () => estadoAtual().dados;
  const lista = () => Object.values(dados().comodos);

  it('terreno, contorno, divisão, paredes, modelo, portas e janelas, cada um um passo do histórico', async () => {
    comecar(vazio());
    abrirPassos('casa');
    expect(estadoAtual().passo).toMatchObject({ ativo: true, etapa: 'terreno' });
    salvarTerreno(1000, 2500, 'baixo');
    expect(dados().terreno).toMatchObject({ x: 0, y: 0, w: 1000, h: 2500, rua: 'baixo' });
    seguirPassos(false);
    expect(estadoAtual().passo.etapa).toBe('casa');
    expect(criarCasa({ frente: 800, fundo: 1000, recuoFrente: 300, recuoLado: null, andares: 2 })).toHaveProperty('ids');
    expect(lista().map((c) => [c.nome, c.x, c.y, c.w, c.h])).toEqual([['Casa', 115, 1215, 770, 970], ['1º andar', 115, 1215, 770, 970]]);
    expect(Object.keys(dados().andares).length).toBe(2);
    // não cria de novo por cima
    expect(criarCasa({ frente: 800, fundo: 1000, recuoFrente: 300, recuoLado: null, andares: 1 })).toHaveProperty('erro');
    seguirPassos(false);
    expect(estadoAtual().desenho).toMatchObject({ ativo: true, dividir: true, item: null });
    // divide o térreo: uma parede deitada a 4 m do fundo
    const terreo = lista().find((c) => c.nome === 'Casa')!;
    const nid = dividirComodoEm(terreo.id, 'y', 400)!;
    expect(dados().comodos[terreo.id]).toMatchObject({ nome: 'Cômodo 1', h: 400 });
    expect(dados().comodos[nid]).toMatchObject({ nome: 'Cômodo 2', y: 1215 + 415, h: 970 - 415 });
    // a parede reta entre os dois anda junto
    const l = paredeNoPontoDaCasa(lista().filter((c) => c.andar === terreo.andar), { x: 300, y: 1215 + 407 }, 10)!;
    expect(l).toMatchObject({ eixo: 'y', antes: [terreo.id], depois: [nid] });
    anotarPasso('Moveu a parede entre Cômodo 1 e Cômodo 2');
    expect(moverParedeReta(l, 1215 + 450)).toBe(1215 + 450);
    expect(dados().comodos[terreo.id].h).toBe(450);
    expect(dados().comodos[nid]).toMatchObject({ y: 1215 + 465, h: 970 - 465 });
    // não deixa nenhum lado menor que o mínimo
    expect(moverParedeReta(l, 1215 + 10)).toBe(1215 + 60);
    fimMoverParede(l);
    // o modelo troca o andar inteiro, no mesmo contorno
    const ids = aplicarModelo(terreo.andar, '2q');
    expect(ids.length).toBe(6);
    expect(lista().filter((c) => c.andar === terreo.andar).map((c) => c.nome)).toEqual(['Quarto 1', 'Banheiro', 'Quarto 2', 'Corredor', 'Sala', 'Cozinha']);
    // o corredor já sai com as portas para os quartos e o banheiro
    expect(Object.values(dados().els).filter((e) => e.tipo === 'porta' && e.liga).length).toBeGreaterThanOrEqual(3);
    seguirPassos(false);
    const r = porAberturas();
    expect(r.janelas).toBeGreaterThanOrEqual(5);
    expect(Object.values(dados().els).some((e) => e.nome === 'Entrada' && e.parede === 'baixo')).toBe(true);
    // e o histórico tem os nomes dos passos
    const passos = listaHistorico().feitos.map((p) => p.rotulo);
    expect(passos.slice(0, 6)).toEqual(['Pôs portas e janelas', 'Dividiu Térreo em 2 quartos', 'Moveu a parede entre Cômodo 1 e Cômodo 2', 'Dividiu Casa', 'Casa de 8,00 × 10,00 m', 'Terreno de 10,00 × 25,00 m']);
    seguirPassos(false);
    expect(estadoAtual().passo.etapa).toBe('moveis');
    const q1 = lista().find((c) => c.nome === 'Quarto 1')!;
    const n = await mobiliar([{ comodo: q1.id, itens: kitDoComodo(q1, true).filter((i) => i.marcado) }]);
    expect(n).toBe(4);
    const ms = Object.values(dados().moveis).filter((m) => m.comodo === q1.id);
    expect(ms.map((m) => m.nome).sort()).toEqual(['Cama de casal', 'Criado-mudo', 'Criado-mudo 2', 'Guarda-roupa']);
    for (const m of ms) { expect(m.x).toBeGreaterThanOrEqual(0); expect(m.y).toBeGreaterThanOrEqual(0); }
    expect(listaHistorico().feitos[0].rotulo).toBe('Pôs 4 móveis');
    seguirPassos(false);
    expect(estadoAtual().passo.ativo).toBe(false);
    expect(estadoAtual().desenho.ativo).toBe(false);
  }, 20000);

  it('só um cômodo: a porta dele fica perto do canto, sem virar "Entrada"', () => {
    comecar(vazio());
    abrirPassos('comodo');
    expect(estadoAtual().passo.etapa).toBe('comodo');
    const id = criarComodo({ nome: 'Quarto', w: 300, h: 350, tipo: 'quarto' });
    porAberturas(id);
    const els = Object.values(dados().els);
    expect(els.find((e) => e.tipo === 'porta')).toMatchObject({ nome: 'Porta', inicio: 10, parede: 'baixo' });
    expect(els.filter((e) => e.tipo === 'janela').length).toBe(1);
    fecharPassos();
  });
});
