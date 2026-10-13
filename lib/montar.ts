// Montar a casa passo a passo: o contorno da casa no terreno, os modelos prontos de divisão, as portas e janelas
// postas sozinhas e os móveis de cada tipo de cômodo. Funções puras: devolvem o que criar, sem mexer no estado.
import { paredeDividida } from './casa';
import { COMODO_NOME, LIM_COMODO, T, tipoDoComodo } from './catalogo';
import { janelaNaParede, parteDividida, portaDeEntrada, portaLigacao } from './edicao';
import { tx } from './i18n';
import type { Comodo, ElParede, Movel, Parede, Terreno, TipoComodo, TipoMovel } from './tipos';

type Pos = { x: number; y: number; w: number; h: number };
const r5 = (v: number) => Math.round(v / 5) * 5;

/** Medida em metros ("10", "12,5", "8.4 m") ou centímetros ("1250 cm"; sem unidade, mais de "max" vira centímetros). */
export function parseMetros(s: unknown, max = 200): number {
  const t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  if (!t) return NaN;
  const m = /^(\d+(?:\.\d+)?)(cm|m)?$/.exec(t);
  if (!m) return NaN;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return NaN;
  if (m[2] === 'cm') return Math.round(n);
  if (m[2] === 'm') return Math.round(n * 100);
  return Math.round(n > max ? n : n * 100);
}

/* ---------- a casa no terreno ---------- */
/** O lado da frente corre na horizontal (rua em cima ou embaixo)? */
export const frenteHorizontal = (rua: Parede): boolean => rua === 'baixo' || rua === 'cima';

/** O terreno na planta: com a rua em cima ou embaixo, a frente é a largura; dos lados, a frente é a altura. */
export function terrenoNaPlanta(frente: number, fundo: number, rua: Parede, x = 0, y = 0): Omit<Terreno, 'andar'> {
  return frenteHorizontal(rua) ? { x, y, w: frente, h: fundo, rua } : { x, y, w: fundo, h: frente, rua };
}

export interface MedidasCasa { frente: number; fundo: number; recuoFrente: number | null; recuoLado: number | null }

/** O contorno da casa (por fora, com as paredes) dentro do terreno, ou o erro se ela não couber. "recuoLado" vazio
 *  deixa a casa no meio; ele é medido a partir da esquerda (rua em cima ou embaixo) ou de cima (rua dos lados). */
export function contornoNoTerreno(t: Omit<Terreno, 'andar'> | null, m: MedidasCasa): { caixa: Pos } | { erro: string } {
  const hz = t ? frenteHorizontal(t.rua) : true;
  const W = hz ? m.frente : m.fundo, H = hz ? m.fundo : m.frente;
  if (!t) return { caixa: { x: 0, y: 0, w: W, h: H } };
  const frenteT = hz ? t.w : t.h, fundoT = hz ? t.h : t.w;
  const rf = m.recuoFrente ?? Math.min(300, Math.max(0, fundoT - m.fundo) / 2);
  if (m.frente > frenteT) return { erro: tx('A casa é mais larga que o terreno.', 'The house is wider than the plot.') };
  if (m.fundo + rf > fundoT) return { erro: m.recuoFrente == null ? tx('A casa é mais funda que o terreno.', 'The house is deeper than the plot.') : tx('Com esse recuo da frente, a casa passa do fundo do terreno.', 'With that front setback, the house goes past the back of the plot.') };
  const rl = m.recuoLado ?? (frenteT - m.frente) / 2;
  if (rl + m.frente > frenteT) return { erro: tx('Com esse recuo do lado, a casa passa do outro lado do terreno.', 'With that side setback, the house goes past the other side of the plot.') };
  const lado = Math.round(rl), fr = Math.round(rf);
  if (t.rua === 'baixo') return { caixa: { x: t.x + lado, y: t.y + t.h - fr - H, w: W, h: H } };
  if (t.rua === 'cima') return { caixa: { x: t.x + lado, y: t.y + fr, w: W, h: H } };
  if (t.rua === 'esquerda') return { caixa: { x: t.x + fr, y: t.y + lado, w: W, h: H } };
  return { caixa: { x: t.x + t.w - fr - W, y: t.y + lado, w: W, h: H } };
}

/** O terreno em volta de uma casa que já existe (contorno por fora, na planta do andar): a casa fica no meio da frente
 *  e a 3 m da rua (ou no meio do fundo, se o terreno for curto). Sem casa, o terreno começa no canto da planta. */
export function terrenoEmVolta(casa: Pos | null, frente: number, fundo: number, rua: Parede): Omit<Terreno, 'andar'> {
  const t = terrenoNaPlanta(frente, fundo, rua);
  if (!casa) return t;
  const hz = frenteHorizontal(rua), frenteCasa = hz ? casa.w : casa.h, fundoCasa = hz ? casa.h : casa.w;
  const lado = Math.round((frente - frenteCasa) / 2), sobra = fundo - fundoCasa, rf = Math.round(sobra >= 600 ? 300 : Math.max(0, sobra) / 2);
  if (rua === 'baixo') return { ...t, x: casa.x - lado, y: casa.y + casa.h + rf - fundo };
  if (rua === 'cima') return { ...t, x: casa.x - lado, y: casa.y - rf };
  if (rua === 'esquerda') return { ...t, x: casa.x - rf, y: casa.y - lado };
  return { ...t, x: casa.x + casa.w + rf - fundo, y: casa.y - lado };
}

/** Os recuos da casa no terreno (por fora das paredes): da frente, do fundo e dos dois lados (esquerda e direita
 *  olhando a planta com a rua embaixo; de cima e de baixo com a rua dos lados). */
export function recuos(t: Omit<Terreno, 'andar'>, casa: Pos): { frente: number; fundo: number; lado1: number; lado2: number } {
  const esq = casa.x - t.x, dir = t.x + t.w - (casa.x + casa.w), cima = casa.y - t.y, baixo = t.y + t.h - (casa.y + casa.h);
  if (t.rua === 'baixo') return { frente: baixo, fundo: cima, lado1: esq, lado2: dir };
  if (t.rua === 'cima') return { frente: cima, fundo: baixo, lado1: esq, lado2: dir };
  if (t.rua === 'esquerda') return { frente: esq, fundo: dir, lado1: cima, lado2: baixo };
  return { frente: dir, fundo: esq, lado1: cima, lado2: baixo };
}

/** Cômodo de dentro (medidas de parede a parede) para um contorno por fora. */
export const dentroDoContorno = (c: Pos): Pos => ({ x: c.x + T, y: c.y + T, w: Math.max(LIM_COMODO.min, c.w - 2 * T), h: Math.max(LIM_COMODO.min, c.h - 2 * T) });

/* ---------- modelos prontos: a casa dividida em cômodos ---------- */
export type Modelo = 'kitnet' | '1q' | '2q' | '3q';
export const MODELOS: Modelo[] = ['kitnet', '1q', '2q', '3q'];
export const MODELO_NOME: Record<Modelo, () => string> = {
  kitnet: () => tx('Kitnet', 'Studio'), '1q': () => tx('1 quarto', '1 bedroom'), '2q': () => tx('2 quartos', '2 bedrooms'), '3q': () => tx('3 quartos', '3 bedrooms')
};
/** Um corte da casa: a parte "a" fica na esquerda (x) ou em cima (y); "f" é a fração do que sobra para ela e "cm"
 *  uma medida fixa. As folhas dizem o tipo do cômodo. */
type No = { t: TipoComodo } | { corte: 'x' | 'y'; f?: number; cm?: number; a: No; b: No };
const F = (t: TipoComodo): No => ({ t });
// com a rua embaixo: no fundo (em cima) os quartos e o banheiro, na frente a sala e a cozinha, um corredor no meio
const ARVORES: Record<Modelo, No> = {
  kitnet: { corte: 'y', f: 0.32, a: { corte: 'x', f: 0.5, a: F('banheiro'), b: F('cozinha') }, b: F('sala') },
  '1q': { corte: 'y', f: 0.5, a: { corte: 'x', f: 0.64, a: F('quarto'), b: F('banheiro') }, b: { corte: 'x', f: 0.58, a: F('sala'), b: F('cozinha') } },
  '2q': {
    corte: 'y', f: 0.46,
    a: { corte: 'x', f: 0.42, a: F('quarto'), b: { corte: 'x', cm: 165, a: F('banheiro'), b: F('quarto') } },
    b: { corte: 'y', cm: 100, a: F('corredor'), b: { corte: 'x', f: 0.58, a: F('sala'), b: F('cozinha') } }
  },
  '3q': {
    corte: 'y', f: 0.44,
    a: { corte: 'x', f: 0.34, a: F('quarto'), b: { corte: 'x', cm: 165, a: F('banheiro'), b: { corte: 'x', f: 0.5, a: F('quarto'), b: F('quarto') } } },
    b: { corte: 'y', cm: 100, a: F('corredor'), b: { corte: 'x', f: 0.55, a: F('sala'), b: F('cozinha') } }
  }
};
const MIN_PARTE = 90;

function cortar(r: Pos, no: No, out: { tipo: TipoComodo; r: Pos }[]) {
  if ('t' in no) { out.push({ tipo: no.t, r }); return; }
  const L = no.corte === 'x' ? r.w : r.h, livre = L - T;
  if (livre < 2 * MIN_PARTE) { cortar(r, no.a, out); return; }
  const a = Math.min(Math.max(r5(no.cm != null ? no.cm : livre * (no.f ?? 0.5)), MIN_PARTE), livre - MIN_PARTE);
  if (no.corte === 'x') { cortar({ x: r.x, y: r.y, w: a, h: r.h }, no.a, out); cortar({ x: r.x + a + T, y: r.y, w: livre - a, h: r.h }, no.b, out); }
  else { cortar({ x: r.x, y: r.y, w: r.w, h: a }, no.a, out); cortar({ x: r.x, y: r.y + a + T, w: r.w, h: livre - a }, no.b, out); }
}

/** Os cômodos do modelo dentro do espaço "r" (por dentro), com a frente para o lado da rua. */
export function cortarModelo(r: Pos, modelo: Modelo, rua: Parede = 'baixo'): { tipo: TipoComodo; x: number; y: number; w: number; h: number }[] {
  const hz = frenteHorizontal(rua);
  // monta com a rua embaixo (frente na largura) e depois vira para o lado certo
  const base: Pos = { x: 0, y: 0, w: hz ? r.w : r.h, h: hz ? r.h : r.w };
  const out: { tipo: TipoComodo; r: Pos }[] = [];
  cortar(base, ARVORES[modelo], out);
  return out.map(({ tipo, r: p }) => {
    let q: Pos;
    if (rua === 'baixo') q = p;
    else if (rua === 'cima') q = { x: base.w - p.x - p.w, y: base.h - p.y - p.h, w: p.w, h: p.h };
    else if (rua === 'esquerda') q = { x: base.h - p.y - p.h, y: p.x, w: p.h, h: p.w };
    else q = { x: p.y, y: base.w - p.x - p.w, w: p.h, h: p.w };
    return { tipo, x: r.x + q.x, y: r.y + q.y, w: q.w, h: q.h };
  });
}

/** Nomes para os tipos, sem repetir os que já existem ("Quarto 1", "Quarto 2", "Banheiro", "Banheiro 2"). */
export function nomesDosTipos(tipos: TipoComodo[], usados: Iterable<string>): string[] {
  const ja = new Set(usados);
  return tipos.map((t) => {
    const base = t === 'outro' ? tx('Cômodo', 'Room') : COMODO_NOME[t];
    let nome: string;
    if (t === 'quarto' || t === 'outro') { let k = 1; while (ja.has(`${base} ${k}`)) k++; nome = `${base} ${k}`; }
    else if (!ja.has(base)) nome = base;
    else { let k = 2; while (ja.has(`${base} ${k}`)) k++; nome = `${base} ${k}`; }
    ja.add(nome);
    return nome;
  });
}

/* ---------- portas e janelas sozinhas ---------- */
type NovoEl = Omit<ElParede, 'id' | 'criado'>;
/** O que liga dois tipos de cômodo e o quanto vale essa ligação (o corredor liga tudo; sala e cozinha ficam
 *  abertas uma para a outra; quarto e banheiro abrem para a circulação). "porta" false = passagem sem porta. */
export function ligacaoBoa(ta: TipoComodo, tb: TipoComodo): { nota: number; porta: boolean } {
  const par = (x: TipoComodo, y: TipoComodo) => (ta === x && tb === y) || (ta === y && tb === x);
  if (ta === 'corredor' || tb === 'corredor') {
    const o = ta === 'corredor' ? tb : ta;
    if (o === 'varanda') return { nota: 2, porta: true };
    if (o === 'corredor') return { nota: 9, porta: false };
    return { nota: 10, porta: !(o === 'sala' || o === 'cozinha' || o === 'garagem') };
  }
  if (par('sala', 'cozinha')) return { nota: 9, porta: false };
  if (par('varanda', 'sala') || par('cozinha', 'servico')) return { nota: 8, porta: true };
  if (par('varanda', 'cozinha')) return { nota: 6, porta: true };
  if (par('sala', 'quarto') || par('sala', 'banheiro') || par('garagem', 'sala') || par('garagem', 'cozinha') || par('garagem', 'servico')) return { nota: 5, porta: true };
  if (par('quarto', 'banheiro')) return { nota: 4, porta: true };
  if (par('sala', 'servico') || par('varanda', 'servico') || ta === 'outro' || tb === 'outro') return { nota: 3, porta: true };
  if (par('cozinha', 'banheiro') || par('quarto', 'cozinha')) return { nota: 1, porta: true };
  return { nota: 0.5, porta: true };
}

const ORDEM_ENTRADA: TipoComodo[] = ['sala', 'cozinha', 'corredor', 'outro', 'garagem', 'servico', 'quarto', 'banheiro'];
const SEM_JANELA: TipoComodo[] = ['corredor', 'varanda', 'garagem'];
/** Quanto o cômodo está para o lado da rua (maior = mais perto). */
const naFrente = (c: Pos, rua: Parede) => (rua === 'baixo' ? c.y + c.h : rua === 'cima' ? -c.y : rua === 'esquerda' ? -c.x : c.x + c.w);

/** As portas e janelas de um andar: uma ligação para cada cômodo (as melhores, sem ninguém ficar sem saída), as
 *  passagens entre sala, cozinha e corredor, a porta da rua (no andar de baixo, na parede do lado da rua) e uma
 *  janela em cada cômodo que tem parede de fora. Não repete porta onde já tem. */
export function aberturasDoAndar(cs: Comodo[], els: ElParede[], o: { rua: Parede | null; entrada: boolean }): { novos: NovoEl[]; portas: number; janelas: number } {
  const todos = els.slice(), novos: NovoEl[] = [];
  let k = 0, portas = 0, janelas = 0;
  const poe = (e: NovoEl | null) => { if (!e) return false; novos.push(e); todos.push({ ...e, id: 'n' + k++, criado: 0 } as ElParede); return true; };
  // ligações possíveis: cômodos que dividem pelo menos 70 cm de parede
  const arestas: { a: Comodo; b: Comodo; nota: number; porta: boolean }[] = [];
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const pd = paredeDividida(cs[i], cs[j]);
    if (!pd || pd.u2 - pd.u1 < 70) continue;
    arestas.push({ a: cs[i], b: cs[j], ...ligacaoBoa(tipoDoComodo(cs[i]), tipoDoComodo(cs[j])) });
  }
  // a árvore das melhores ligações (cada cômodo alcançável a partir da entrada)
  const tipos = (c: Comodo) => tipoDoComodo(c);
  const raiz = cs.slice().sort((a, b) => ORDEM_ENTRADA.indexOf(tipos(a)) - ORDEM_ENTRADA.indexOf(tipos(b)) || b.w * b.h - a.w * a.h)[0];
  const usadas = new Set<number>(), ligado = new Set<string>(raiz ? [raiz.id] : []);
  while (raiz && ligado.size < cs.length) {
    let melhor = -1;
    arestas.forEach((e, i) => { if (ligado.has(e.a.id) !== ligado.has(e.b.id) && (melhor < 0 || e.nota > arestas[melhor].nota)) melhor = i; });
    if (melhor < 0) { const resto = cs.find((c) => !ligado.has(c.id)); if (!resto) break; ligado.add(resto.id); continue; }
    usadas.add(melhor); ligado.add(arestas[melhor].a.id); ligado.add(arestas[melhor].b.id);
  }
  // e as passagens entre cômodos abertos (sala, cozinha, corredor) que ficaram de fora
  arestas.forEach((e, i) => { if (!usadas.has(i) && !e.porta && e.nota >= 8) usadas.add(i); });
  for (const i of [...usadas].sort((x, y) => arestas[y].nota - arestas[x].nota)) {
    const e = arestas[i];
    if (poe(portaLigacao(e.a, e.b, e.porta, todos, true))) portas++;
  }
  // a porta da rua: a varanda da frente já é a entrada; senão, a sala (ou quem vier antes) do lado da rua. Se já
  // houver porta para fora, fica ela.
  const paraFora = (e: ElParede) => e.tipo === 'porta' && !e.liga && !e.herdada && !e.semParede && cs.some((c) => c.id === e.comodo && parteDividida(c, e.parede, cs) < 0.5);
  if (o.entrada && o.rua && !todos.some(paraFora)) {
    const rua = o.rua;
    const deFrente = (c: Comodo) => parteDividida(c, rua, cs) < 0.5;
    const varanda = cs.find((c) => tipos(c) === 'varanda' && deFrente(c));
    if (!varanda) {
      const cands = cs.filter((c) => deFrente(c) && tipos(c) !== 'varanda').sort((a, b) => ORDEM_ENTRADA.indexOf(tipos(a)) - ORDEM_ENTRADA.indexOf(tipos(b)) || naFrente(b, rua) - naFrente(a, rua));
      for (const c of cands) if (poe(portaDeEntrada(c, rua, cs, todos))) { portas++; break; }
    }
  }
  // uma janela por cômodo, na melhor parede de fora (a sala de frente para a rua, o quarto longe dela)
  for (const c of cs) {
    const t = tipos(c);
    if (SEM_JANELA.includes(t) || todos.some((e) => e.tipo === 'janela' && e.comodo === c.id)) continue;
    const paredes = (['cima', 'baixo', 'esquerda', 'direita'] as Parede[]).filter((p) => parteDividida(c, p, cs) < 0.5);
    const comp = (p: Parede) => (p === 'cima' || p === 'baixo' ? c.w : c.h);
    const nota = (p: Parede) => comp(p) + (o.rua && p === o.rua ? (t === 'sala' ? 400 : t === 'quarto' ? -150 : 0) : 0);
    for (const p of paredes.sort((a, b) => nota(b) - nota(a))) if (poe(janelaNaParede(c, p, cs, todos))) { janelas++; break; }
  }
  return { novos, portas, janelas };
}

/* ---------- os móveis de cada tipo de cômodo ---------- */
export interface ItemKit { chave: string; tipo: TipoMovel; nome: string; larg: number; prof: number; marcado: boolean; extra?: Partial<Movel>; qtd?: number }

/** Os móveis que costumam ir num cômodo desse tipo, com medidas comuns no Brasil (os marcados já vêm escolhidos).
 *  "casal" diz se o quarto é o maior da casa (fica com a cama de casal). */
export function kitDoComodo(c: Comodo, casal: boolean): ItemKit[] {
  const t = tipoDoComodo(c), area = (c.w * c.h) / 10000;
  const it = (chave: string, tipo: TipoMovel, nome: string, larg: number, prof: number, marcado: boolean, extra?: Partial<Movel>, qtd?: number): ItemKit => ({ chave, tipo, nome, larg, prof, marcado, ...(extra ? { extra } : {}), ...(qtd ? { qtd } : {}) });
  if (t === 'quarto') return [
    casal ? it('cama-casal', 'cama', tx('Cama de casal', 'Double bed'), 138, 188, true) : it('cama-solteiro', 'cama', tx('Cama de solteiro', 'Single bed'), 88, 188, true),
    !casal ? it('cama-casal', 'cama', tx('Cama de casal', 'Double bed'), 138, 188, false) : it('cama-solteiro', 'cama', tx('Cama de solteiro', 'Single bed'), 88, 188, false),
    it('guarda-roupa', 'guarda-roupa', tx('Guarda-roupa', 'Wardrobe'), casal ? 200 : 150, 55, true, { alto: true, abertura: 'correr' }),
    it('criado', 'cabeceira', tx('Criado-mudo', 'Nightstand'), 45, 40, true, undefined, casal ? 2 : 1),
    it('escrivaninha', 'mesa', tx('Escrivaninha', 'Desk'), 100, 50, false, { cadeiras: 1, ladoCadeiras: 'frente', cadLarg: 45, cadProf: 50 }),
    it('comoda', 'comoda', tx('Cômoda', 'Dresser'), 100, 45, false, { abertura: 'gavetas' }),
    it('berco', 'berco', tx('Berço', 'Crib'), 70, 130, false)
  ];
  if (t === 'sala') return [
    it('sofa', 'sofa', tx('Sofá', 'Sofa'), area < 10 ? 180 : 210, 90, true),
    it('rack', 'rack', tx('Rack', 'TV stand'), 180, 45, true),
    it('mesa', 'mesa', tx('Mesa de jantar', 'Dining table'), 120, 80, area >= 12, { cadeiras: 4, ladoCadeiras: 'dois', cadLarg: 45, cadProf: 45 }),
    it('poltrona', 'poltrona', tx('Poltrona', 'Armchair'), 80, 80, false),
    it('estante', 'estante', tx('Estante', 'Bookcase'), 80, 35, false, { alto: true })
  ];
  if (t === 'cozinha') return [
    it('geladeira', 'geladeira', tx('Geladeira', 'Fridge'), 70, 75, true, { alto: true, abertura: 'abrir', nPortas: 1 }),
    it('fogao', 'fogao', tx('Fogão', 'Stove'), 76, 60, true),
    it('pia', 'pia', tx('Pia', 'Sink'), 120, 55, true),
    it('armario', 'armario', tx('Armário', 'Cabinet'), 80, 45, false, { alto: true, abertura: 'abrir' }),
    it('mesa', 'mesa', tx('Mesa', 'Table'), 80, 80, false, { cadeiras: 2, ladoCadeiras: 'dois', cadLarg: 45, cadProf: 45 })
  ];
  if (t === 'banheiro') return [
    it('vaso', 'vaso', tx('Vaso sanitário', 'Toilet'), 40, 65, true),
    it('lavatorio', 'lavatorio', tx('Pia do banheiro', 'Bathroom sink'), 60, 45, true),
    it('box', 'box', tx('Box do chuveiro', 'Shower'), 90, 90, c.w >= 140 && c.h >= 140)
  ];
  if (t === 'servico') return [
    it('lavadora', 'lavadora', tx('Máquina de lavar', 'Washing machine'), 60, 65, true),
    it('tanque', 'tanque', tx('Tanque', 'Utility sink'), 60, 55, true),
    it('armario', 'armario', tx('Armário', 'Cabinet'), 80, 45, false, { alto: true, abertura: 'abrir' })
  ];
  if (t === 'varanda') return [
    it('poltrona', 'poltrona', tx('Poltrona', 'Armchair'), 70, 70, false, undefined, 2),
    it('mesa', 'mesa', tx('Mesa', 'Table'), 80, 80, false, { cadeiras: 2, ladoCadeiras: 'dois', cadLarg: 45, cadProf: 45 })
  ];
  return [];
}
