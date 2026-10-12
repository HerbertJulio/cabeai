import { describe, expect, it } from 'vitest';
import { paredeDividida } from '../lib/casa';
import { extrairJson } from '../lib/ia';
import { lerPlanta, montarPromptPlanta, tipoPorNome } from '../lib/planta';
import { estadoAtual, montarDoDesenho, trocarDados } from '../lib/store';
import { vazio } from '../lib/tipos';

// a casa que o Herbert descreveu: varanda na frente, sala, corredor com banheiro de um lado e dois quartos
// de frente um para o outro, cozinha seguindo a sala e outra varanda nos fundos (com as imprecisões típicas da IA)
const RESPOSTA = `Aqui está:
\`\`\`json
{"comodos":[
 {"nome":"Varanda da frente","tipo":"varanda","x":0,"y":0,"w":800,"h":250},
 {"nome":"Sala","tipo":"sala","x":0,"y":250,"w":450,"h":400},
 {"nome":"Corredor","tipo":"corredor","x":448,"y":250,"w":102,"h":400},
 {"nome":"Banheiro","tipo":"banheiro","x":550,"y":250,"w":250,"h":180},
 {"nome":"Quarto 1","tipo":"quarto","x":550,"y":430,"w":250,"h":220},
 {"nome":"Cozinha","tipo":"cozinha","x":0,"y":652,"w":550,"h":250},
 {"nome":"Varanda dos fundos","tipo":"varanda","x":0,"y":900,"w":800,"h":200},
 {"nome":"","tipo":"x","x":0,"y":0,"w":-5,"h":10}
],
"ligacoes":[{"a":0,"b":1,"porta":true},{"a":1,"b":2,"porta":false},{"a":2,"b":3,"porta":true},{"a":2,"b":4,"porta":true},{"a":1,"b":5,"porta":false},{"a":5,"b":6,"porta":true},{"a":1,"b":99}],
"entrada":{"comodo":0,"parede":"baixo"},
"janelas":[{"comodo":3,"parede":"direita"},{"comodo":4,"parede":"direita"},{"comodo":1,"parede":"esquerda"}]}
\`\`\``;

describe('planta pelo desenho', () => {
  it('pede JSON com cômodos, ligações, entrada e janelas, e manda a observação da pessoa', () => {
    const p = montarPromptPlanta('varanda grande na frente', true, 'pt');
    expect(p).toContain('desenho feito à mão');
    expect(p).toContain('"ligacoes"');
    expect(p).toContain('varanda grande na frente');
    expect(montarPromptPlanta('casa', false, 'en')).toContain('English');
  });

  it('entende sinônimos dos tipos', () => {
    expect(tipoPorNome('suite', 'Suíte')).toBe('quarto');
    expect(tipoPorNome(undefined, 'Lavabo')).toBe('banheiro');
    expect(tipoPorNome('', 'Alpendre')).toBe('varanda');
    expect(tipoPorNome('area', 'Lavanderia')).toBe('servico');
    expect(tipoPorNome('quarto', 'Escritório')).toBe('quarto');
    expect(tipoPorNome('', 'Escritório')).toBe('outro');
  });

  it('acerta as bordas quase iguais para os vizinhos dividirem a parede', () => {
    const pl = lerPlanta(extrairJson(RESPOSTA))!;
    expect(pl.comodos).toHaveLength(7);
    const [varanda, sala, corredor, banheiro, quarto, cozinha, fundos] = pl.comodos;
    // de parede a parede pelo meio → medidas de dentro (meia parede de cada lado)
    expect(sala).toMatchObject({ x: 8, y: 258, w: 435, h: 385 });
    expect(paredeDividida(varanda, sala)?.parede).toBe('baixo');
    // o corredor começava em 448: agora encosta na sala
    expect(paredeDividida(sala, corredor)).toMatchObject({ parede: 'direita' });
    expect(paredeDividida(corredor, banheiro)?.parede).toBe('direita');
    expect(paredeDividida(corredor, quarto)?.parede).toBe('direita');
    expect(paredeDividida(banheiro, quarto)?.parede).toBe('baixo');
    // a cozinha começava em 652 (2 cm abaixo): encosta na sala
    expect(paredeDividida(sala, cozinha)?.parede).toBe('baixo');
    expect(paredeDividida(cozinha, fundos)?.parede).toBe('baixo');
    expect(pl.ligacoes).toHaveLength(6);
    expect(pl.entrada).toEqual({ comodo: 0, parede: 'baixo' });
    expect(pl.janelas).toHaveLength(3);
  });

  it('aceita resposta em metros e põe nomes', () => {
    const pl = lerPlanta({ comodos: [{ tipo: 'quarto', x: 0, y: 0, w: 3, h: 3 }, { tipo: 'quarto', x: 3, y: 0, w: 3.5, h: 3 }] })!;
    expect(pl.comodos.map((c) => [c.nome, c.w])).toEqual([['Quarto 1', 285], ['Quarto 2', 335]]);
    expect(lerPlanta({ comodos: [] })).toBeNull();
    expect(lerPlanta('nada')).toBeNull();
  });

  it('monta a casa com portas, passagens, entrada e janelas', () => {
    trocarDados(vazio());
    const pl = lerPlanta(extrairJson(RESPOSTA))!;
    const r = montarDoDesenho(pl);
    const d = estadoAtual().dados;
    expect(r.n).toBe(7);
    expect(Object.keys(d.comodos)).toHaveLength(7);
    const por = (nome: string) => Object.values(d.comodos).find((c) => c.nome === nome)!;
    const portas = Object.values(d.els).filter((e) => e.tipo === 'porta');
    const de = (nome: string) => portas.filter((p) => p.comodo === por(nome).id);
    // a porta da varanda abre para dentro da sala
    expect(de('Sala').some((p) => p.parede === 'cima' && p.abre === 'dentro')).toBe(true);
    // sala ↔ corredor e sala ↔ cozinha: passagem sem porta
    expect(portas.some((p) => p.abre === 'vao' && [por('Sala').id, por('Corredor').id].includes(p.comodo))).toBe(true);
    // banheiro e quarto: porta para dentro deles, na parede do corredor
    expect(de('Banheiro')).toMatchObject([{ parede: 'esquerda', abre: 'dentro', largura: 70 }]);
    expect(de('Quarto 1')).toMatchObject([{ parede: 'esquerda', abre: 'dentro', largura: 80 }]);
    // janelas só nas paredes de fora
    const janelas = Object.values(d.els).filter((e) => e.tipo === 'janela');
    expect(janelas.map((j) => [d.comodos[j.comodo].nome, j.parede]).sort()).toEqual([['Banheiro', 'direita'], ['Quarto 1', 'direita'], ['Sala', 'esquerda']]);
    expect(Object.values(d.comodos).find((c) => c.nome === 'Corredor')).toMatchObject({ corredor: true, tipo: 'corredor' });
    expect(estadoAtual().vista).toBe('casa');
  });
});
