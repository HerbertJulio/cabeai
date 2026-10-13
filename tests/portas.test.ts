import { describe, expect, it } from 'vitest';
import { abreDoOutroLado, paredeDividida, portaVistaDe, portasVizinhas } from '../lib/casa';
import { elVisto, ladosDaPorta, rotuloVirar, vizinhoDaPorta } from '../lib/consultas';
import { completoNaCasa, normalizarDados, normalizarEl } from '../lib/dados';
import { lugarDaPorta, lugarNaParede, portaEntre } from '../lib/edicao';
import { validarParede, valsParede } from '../lib/formularios';
import { avaliar, bloqueiaPorta, folhasPorta, giraParaDentro, jeitoDaPorta, temGiro } from '../lib/geometria';
import { descreverMudanca } from '../lib/historico';
import {
  abrirPortaPara, atualizar, criarCorredor, removerComodo, estadoAtual, ferramentaDesenho, listaHistorico, modoDesenho, mudarJeitoPorta, porNaParede, salvarComodo,
  salvarElVisto, selecionar, trocarDados, virarDobradica
} from '../lib/store';
import type { Comodo, Dados, ElParede } from '../lib/tipos';

const q = (id: string, x: number, y: number, w: number, h: number, tipo?: Comodo['tipo']): Comodo => ({ id, nome: id, x, y, w, h, andar: 't', criado: 1, ...(tipo ? { tipo } : {}), ...(tipo === 'corredor' ? { corredor: true } : {}) });
const el = (id: string, v: Record<string, unknown>): ElParede => normalizarEl((v.tipo as ElParede['tipo']) || 'porta', id, v);
const casa = (comodos: Comodo[], els: Record<string, Record<string, unknown>> = {}): Dados =>
  normalizarDados({ andares: { t: { nome: 'Térreo' } }, comodos: Object.fromEntries(comodos.map((c) => [c.id, c])), els, moveis: {}, cenarios: {} });
const sala = { x: 0, y: 0, w: 300, h: 300 };

describe('jeitos de porta', () => {
  it('de abrir, dupla, de correr e passagem, e o que cada uma varre', () => {
    const abrir = el('a', { comodo: 'q', parede: 'baixo', inicio: 100, largura: 80, abre: 'dentro', dobradica: 'a' });
    const dupla = el('d', { comodo: 'q', parede: 'baixo', inicio: 100, largura: 120, abre: 'dentro', estilo: 'dupla' });
    const correr = el('c', { comodo: 'q', parede: 'baixo', inicio: 100, largura: 80, abre: 'dentro', estilo: 'correr' });
    const vao = el('v', { comodo: 'q', parede: 'baixo', inicio: 100, largura: 80, abre: 'vao', estilo: 'dupla' });
    expect([abrir, dupla, correr, vao].map(jeitoDaPorta)).toEqual(['abrir', 'dupla', 'correr', 'vao']);
    // passagem não guarda estilo (não tem porta)
    expect(vao.estilo).toBeUndefined();
    expect(temGiro(correr)).toBe(false);
    expect(giraParaDentro(dupla)).toBe(true);
    // a dupla tem duas folhas de meia largura, uma em cada ponta
    expect(folhasPorta(sala, dupla)).toEqual([{ hu: 100, du: 1, r: 60 }, { hu: 220, du: -1, r: 60 }]);
    expect(folhasPorta(sala, correr)).toEqual([]);
    // um móvel bem no meio do vão, a 50 cm da parede: a folha de 80 cm bate, as de 60 cm da dupla não
    const meio = { x1: 150, y1: 300 - 52, x2: 170, y2: 300 - 48 };
    expect(bloqueiaPorta(sala, abrir, meio)).toBe(true);
    expect(bloqueiaPorta(sala, dupla, meio)).toBe(false);
    // perto da dobradiça da direita, a segunda folha da dupla bate
    expect(bloqueiaPorta(sala, dupla, { x1: 200, y1: 300 - 30, x2: 215, y2: 300 - 20 })).toBe(true);
    // de correr não varre nada, mas pede a frente livre: um móvel colado no vão é problema
    expect(bloqueiaPorta(sala, correr, meio)).toBe(false);
    const c = { ...completoNaCasa(casa([q('q', 0, 0, 300, 300)], { c: { ...correr } }), 'q')! };
    const av = avaliar(c, [{ id: 'm', tipo: 'outro', nome: 'Baú', larg: 60, prof: 30, alto: false, comodo: 'q', x: 110, y: 270, rot: 0, criado: 1, fixo: false, abertura: 'nenhuma', nPortas: 0, frente: null, cadeiras: 0, ladoCadeiras: 'frente', cadLarg: 45, cadProf: 50, bauCab: 0, bauCabLarg: 0, bauCabAl: 'centro', bauCabDx: 0, bauPe: 0, bauPeLarg: 0, bauPeAl: 'centro', bauPeDx: 0 }]);
    expect(av.itens.some((i) => i.eid === 'c')).toBe(true);
  });

  it('o formulário lê e escreve o jeito, e "abre" vale só para o lado', () => {
    const c = q('q', 0, 0, 300, 300);
    const p = el('p', { comodo: 'q', parede: 'baixo', inicio: 100, largura: 80, abre: 'fora', estilo: 'dupla' });
    const v = valsParede(c, p);
    expect(v).toMatchObject({ jeito: 'dupla', abre: 'fora' });
    expect(validarParede({ ...v, jeito: 'correr' }, 'porta', c, p).campos).toMatchObject({ estilo: 'correr', abre: 'fora' });
    expect(validarParede({ ...v, jeito: 'vao' }, 'porta', c, p).campos).toMatchObject({ abre: 'vao', estilo: undefined });
    expect(validarParede({ ...v, jeito: 'abrir', abre: 'dentro' }, 'porta', c, p).campos).toMatchObject({ abre: 'dentro', estilo: undefined });
  });
});

describe('porta perto do canto, como na obra', () => {
  it('fica a 10 cm do canto do cômodo para onde abre, com a dobradiça desse lado', () => {
    // banheiro em cima do fim de um corredor comprido: o canto da direita é o fundo do corredor
    const cor = q('c', 0, 315, 600, 100, 'corredor'), ban = q('b', 400, 0, 200, 300, 'banheiro');
    const p = portaEntre(ban, cor, [])!;
    expect(p).toMatchObject({ comodo: 'b', parede: 'baixo', abre: 'dentro', largura: 70, inicio: 10, dobradica: 'a' });
    // passagem fica no meio do trecho
    const s = q('s', 0, 315, 300, 300, 'sala'), cor2 = q('c2', 0, 0, 300, 300, 'corredor');
    const vao = portaEntre(cor2, s, [])!;
    expect(vao).toMatchObject({ abre: 'vao', largura: 120, inicio: 90 });
  });

  it('sem canto do cômodo no trecho, o lado que não é o fundo do vizinho ganha', () => {
    const a = q('a', 0, 0, 300, 400), b = q('b', 315, 100, 100, 300);
    const pd = paredeDividida(a, b)!;
    expect(pd).toEqual({ parede: 'direita', u1: 100, u2: 400 });
    // o fim do trecho (400) é o canto do quarto: a porta vai para lá, abrindo encostada na parede de baixo
    expect(lugarDaPorta(a, b, pd, 80, 'dentro')).toEqual({ inicio: 310, dobradica: 'b' });
    // abrindo para o vizinho, conta o canto dele: o começo do trecho é o canto de cima do corredor
    expect(lugarDaPorta(a, b, pd, 80, 'fora')).toEqual({ inicio: 110, dobradica: 'a' });
  });

  it('um toque na parede põe o vão perto do dedo, sem cair em cima de outro, e encosta no canto', () => {
    const c = { w: 400, h: 300, portas: [el('p', { comodo: 'q', parede: 'baixo', inicio: 150, largura: 80 })], janelas: [] as ElParede[] };
    expect(lugarNaParede(c, 'baixo', 300, 80, true)).toBe(260);
    // em cima da porta que já existe: vai para o lado livre mais perto
    expect(lugarNaParede(c, 'baixo', 190, 80, true)).toBe(70);
    // perto do canto, a porta encosta a 10 cm dele (a janela não)
    expect(lugarNaParede(c, 'cima', 30, 80, true)).toBe(10);
    expect(lugarNaParede(c, 'cima', 30, 80, false)).toBe(0);
    expect(lugarNaParede(c, 'cima', 390, 80, true)).toBe(310);
    // parede cheia
    expect(lugarNaParede({ w: 100, h: 300, portas: [el('x', { comodo: 'q', parede: 'cima', inicio: 0, largura: 100 })], janelas: [] }, 'cima', 50, 60, true)).toBeNull();
  });
});

describe('a porta é da parede: os dois lados veem a mesma porta', () => {
  const quarto = q('a', 0, 0, 300, 300, 'quarto'), cor = q('c', 315, 0, 110, 400, 'corredor');

  it('o vizinho vê o estilo, a mesma dobradiça e o giro para o outro lado', () => {
    const p = el('p', { comodo: 'a', parede: 'direita', inicio: 210, largura: 80, abre: 'dentro', dobradica: 'b', estilo: 'dupla' });
    const viz = portasVizinhas(cor, [quarto, cor], [p]);
    expect(viz[0]).toMatchObject({ id: 'p', parede: 'esquerda', inicio: 210, abre: 'fora', dobradica: 'b', estilo: 'dupla', herdada: true });
    expect(abreDoOutroLado('vao')).toBe('vao');
    expect(portaVistaDe(quarto, cor, p)).toEqual({ parede: 'esquerda', inicio: 210, largura: 80, abre: 'fora' });
    // o corredor mais para baixo: a mesma porta fica mais para cima na parede dele
    const desceu = { ...cor, y: 100 };
    expect(portaVistaDe(quarto, desceu, p)).toMatchObject({ inicio: 110 });
    // a porta passa do trecho dividido: não dá para medir pelo vizinho
    expect(portaVistaDe(quarto, { ...cor, y: 250 }, p)).toBeNull();
  });

  it('os nomes dos dois lados e quem está do outro lado', () => {
    const d = casa([quarto, cor], { p: { tipo: 'porta', comodo: 'a', parede: 'direita', inicio: 210, largura: 80, abre: 'dentro' }, f: { tipo: 'porta', comodo: 'a', parede: 'baixo', inicio: 10, largura: 80 } });
    expect(vizinhoDaPorta(d, d.els.p)?.id).toBe('c');
    expect(ladosDaPorta(d, d.els.p)).toMatchObject({ dentro: 'a', fora: 'c' });
    expect(ladosDaPorta(d, d.els.f).viz).toBeNull();
    // vista pelo corredor, medida na parede dele
    const v = elVisto(d, 'p', 'c')!;
    expect(v).toMatchObject({ dono: false, e: { comodo: 'c', parede: 'esquerda', inicio: 210, abre: 'fora' } });
    expect(elVisto(d, 'p', 'a')!.dono).toBe(true);
    expect(elVisto(d, 'f', 'c')!.dono).toBe(true);
  });

  it('o botão de virar diz para onde a porta vai abrir, pelo nome (ou "para fora", na parede de fora)', () => {
    const d = casa([quarto, cor], { p: { tipo: 'porta', comodo: 'a', parede: 'direita', inicio: 210, largura: 80, abre: 'dentro' }, f: { tipo: 'porta', comodo: 'a', parede: 'baixo', inicio: 10, largura: 80, abre: 'dentro' } });
    expect(rotuloVirar(d, d.els.p)).toBe('Abrir para c');
    expect(rotuloVirar(d, d.els.p, true)).toBe('Para c');
    expect(rotuloVirar(d, { ...d.els.p, abre: 'fora' })).toBe('Abrir para a');
    expect(rotuloVirar(d, d.els.f)).toBe('Abrir para fora');
    expect(rotuloVirar(d, d.els.f, true)).toBe('Para fora');
    expect(rotuloVirar(d, { ...d.els.f, abre: 'fora' })).toBe('Abrir para a');
  });

  it('mudar de lado não aparece como "levou para outro cômodo" no histórico', () => {
    const d0 = casa([quarto, cor], { p: { tipo: 'porta', comodo: 'a', parede: 'direita', inicio: 210, largura: 80, abre: 'dentro' } });
    const d1 = structuredClone(d0); Object.assign(d1.els.p, { comodo: 'c', parede: 'esquerda', inicio: 210, abre: 'fora' });
    expect(descreverMudanca(d0, d1)).toBe('Mudou Porta');
    const d2 = structuredClone(d1); d2.els.p.inicio = 300;
    expect(descreverMudanca(d0, d2)).toBe('Moveu Porta');
  });
});

describe('na loja: virar, mudar o jeito, pegar pelo vizinho e pôr na parede', () => {
  const comecar = (d: Dados) => {
    atualizar((s) => { s.carregado = false; });
    trocarDados(d);
    atualizar((s) => { s.carregado = true; });
  };
  const dados = () => estadoAtual().dados;
  const quarto = q('a', 0, 0, 300, 300, 'quarto'), cor = q('c', 315, 0, 110, 400, 'corredor');

  it('vira para o outro lado e a dobradiça, muda o jeito e o nome acompanha, com nomes no histórico', () => {
    comecar(casa([quarto, cor], { p: { tipo: 'porta', nome: 'Porta', comodo: 'a', parede: 'direita', inicio: 210, largura: 80, abre: 'dentro', dobradica: 'b' } }));
    abrirPortaPara('p', 'fora');
    expect(dados().els.p.abre).toBe('fora');
    virarDobradica('p');
    expect(dados().els.p.dobradica).toBe('a');
    mudarJeitoPorta('p', 'vao');
    expect(dados().els.p).toMatchObject({ abre: 'vao', nome: 'Passagem' });
    mudarJeitoPorta('p', 'dupla');
    expect(dados().els.p).toMatchObject({ abre: 'dentro', estilo: 'dupla', nome: 'Porta' });
    mudarJeitoPorta('p', 'abrir');
    expect(dados().els.p.estilo).toBeUndefined();
    // de correr: corre para o lado com mais parede livre (o de cima, longe do canto de baixo)
    mudarJeitoPorta('p', 'correr');
    expect(dados().els.p).toMatchObject({ estilo: 'correr', dobradica: 'a' });
    mudarJeitoPorta('p', 'abrir');
    expect(dados().els.p.dobradica).toBe('b');
    const passos = listaHistorico().feitos.map((p) => p.rotulo);
    expect(passos.slice(2, 7)).toEqual(['Porta virou porta de abrir', 'Passagem virou porta dupla', 'Porta virou passagem sem porta', 'Virou a dobradiça de Porta', 'Porta abre para c']);
  });

  it('virar passagem ou porta não repete nome no cômodo', () => {
    comecar(casa([quarto, cor], {
      p: { tipo: 'porta', nome: 'Porta', comodo: 'a', parede: 'direita', inicio: 210, largura: 80 },
      v: { tipo: 'porta', nome: 'Passagem', comodo: 'a', parede: 'baixo', inicio: 100, largura: 90, abre: 'vao' }
    }));
    mudarJeitoPorta('v', 'abrir');
    expect(dados().els.v.nome).toBe('Porta 2');
    mudarJeitoPorta('p', 'vao');
    expect(dados().els.p.nome).toBe('Passagem');
  });

  it('tocada pelo vizinho: o foco fica nele; mexer de lá não muda a porta de cômodo enquanto ela fica na parede dividida', () => {
    comecar(casa([quarto, cor], { p: { tipo: 'porta', nome: 'Porta', comodo: 'a', parede: 'direita', inicio: 210, largura: 80, abre: 'dentro', dobradica: 'b', auto: true, liga: 'c' } }));
    selecionar({ eid: 'p' }, { via: 'c' });
    expect(estadoAtual().comodo).toBe('c');
    selecionar({ eid: 'p' });
    expect(estadoAtual().comodo).toBe('a');
    // a dobradiça e o lado, mudados pelo corredor: a porta continua no quarto, automática
    salvarElVisto('p', 'c', { dobradica: 'a' });
    expect(dados().els.p).toMatchObject({ comodo: 'a', parede: 'direita', inicio: 210, dobradica: 'a', auto: true, liga: 'c' });
    // "para dentro", visto do corredor, é abrir para o corredor
    salvarElVisto('p', 'c', { abre: 'dentro' });
    expect(dados().els.p).toMatchObject({ comodo: 'a', abre: 'fora' });
    // arrastada pela parede do corredor, ainda na parede dividida: fica no quarto (e deixa de ser automática)
    salvarElVisto('p', 'c', { inicio: 100 });
    expect(dados().els.p).toMatchObject({ comodo: 'a', parede: 'direita', inicio: 100 });
    expect(dados().els.p.auto).toBeUndefined();
    // apagar o corredor não leva a porta do quarto
    const d0 = structuredClone(dados());
    removerComodo('c');
    expect(dados().els.p).toMatchObject({ comodo: 'a', inicio: 100 });
    comecar(d0);
    // passou da parede dividida: agora é do corredor, na parede dele (abrindo para dentro dele)
    salvarElVisto('p', 'c', { inicio: 300 });
    expect(dados().els.p).toMatchObject({ comodo: 'c', parede: 'esquerda', inicio: 300, abre: 'dentro' });
    expect(completoNaCasa(dados(), 'a')!.portas.find((x) => x.id === 'p')).toBeUndefined();
  });

  it('a ferramenta de parede põe porta abrindo para o cômodo tocado, com a dobradiça do lado do canto mais perto', () => {
    comecar(casa([quarto, cor]));
    modoDesenho(true); ferramentaDesenho('porta');
    expect(estadoAtual().desenho.item).toBe('porta');
    const r = porNaParede('porta', 'a', 'baixo', 250);
    expect('id' in r).toBe(true);
    const p = 'id' in r ? dados().els[r.id] : null;
    expect(p).toMatchObject({ tipo: 'porta', comodo: 'a', parede: 'baixo', inicio: 210, largura: 80, abre: 'dentro', dobradica: 'b' });
    expect(estadoAtual().selEl).toBe('id' in r ? r.id : null);
    // a de correr corre para o lado onde sobra parede (aqui, para baixo), não para o canto
    const c = porNaParede('correr', 'c', 'direita', 50);
    expect('id' in c && dados().els[c.id]).toMatchObject({ estilo: 'correr', inicio: 10, dobradica: 'b' });
    const v = porNaParede('vao', 'a', 'cima', 150);
    expect('id' in v && dados().els[v.id]).toMatchObject({ abre: 'vao', nome: 'Passagem', largura: 90 });
    // escolher um tipo de cômodo larga a ferramenta; sair do modo também
    modoDesenho(true, 'sala');
    expect(estadoAtual().desenho.item).toBeNull();
    ferramentaDesenho('janela'); modoDesenho(false);
    expect(estadoAtual().desenho).toMatchObject({ ativo: false, item: null });
  });

  it('corredor pelo diálogo: porta para o quarto (perto do canto) e passagem para a sala', () => {
    comecar(casa([q('s', 0, 0, 400, 350, 'sala'), q('q', 700, 0, 300, 300, 'quarto')]));
    const r = criarCorredor({ nome: '', a: 's', b: 'q', lado: 'direita', comprimento: null, largura: 120, alinhar: 'meio', portas: true });
    expect('id' in r).toBe(true);
    const els = Object.values(dados().els);
    expect(els.find((e) => e.comodo === 'q')).toMatchObject({ abre: 'dentro', auto: true, inicio: 100, dobradica: 'a' });
    expect(els.find((e) => e.abre === 'vao')).toMatchObject({ auto: true });
    expect(dados().comodos[(r as { id: string }).id]).toMatchObject({ tipo: 'corredor', corredor: true });
  });

  it('o tipo do cômodo muda pelo painel; virar corredor liga aos vizinhos e a marca acompanha', () => {
    comecar(casa([q('a', 0, 0, 300, 300, 'quarto'), q('x', 315, 0, 110, 400)]));
    expect(Object.keys(dados().els)).toHaveLength(0);
    salvarComodo('x', { tipo: 'corredor' });
    expect(dados().comodos.x).toMatchObject({ tipo: 'corredor', corredor: true });
    expect(Object.values(dados().els)).toEqual([expect.objectContaining({ comodo: 'a', abre: 'dentro', auto: true, liga: 'x' })]);
    salvarComodo('x', { tipo: '' });
    expect(dados().comodos.x.tipo).toBeUndefined();
    expect(dados().comodos.x.corredor).toBeUndefined();
  });
});
