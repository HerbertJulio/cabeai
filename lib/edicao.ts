// Edição da planta da casa: girar e esticar cômodos levando junto o que está dentro, e as portas automáticas
// quando um cômodo desenhado encosta num corredor ou numa varanda. Funções puras: mudam só os objetos recebidos.
import { paredeDividida } from './casa';
import { T, tipoDoComodo } from './catalogo';
import { geoEl, normRot, prender, ret } from './geometria';
import { tx } from './i18n';
import type { Comodo, ComodoCompleto, ElParede, ItemCenario, Movel, Parede, TipoComodo } from './tipos';

const DEPOIS_DE_GIRAR: Record<Parede, Parede> = { cima: 'direita', direita: 'baixo', baixo: 'esquerda', esquerda: 'cima' };

/** Gira o cômodo 90° no sentido do relógio, com móveis, portas, janelas, pontos e as posições dos cenários.
 *  Um ponto (u, v) de dentro vai para (H − v, u); o meio do cômodo fica no mesmo lugar da planta. */
export function girarComodo90(c: Comodo, moveis: Movel[], els: ElParede[], itens: { item: ItemCenario; m: Movel }[]): void {
  const W = c.w, H = c.h;
  for (const m of moveis) { const r = ret(m); m.x = Math.round(H - r.y2); m.y = Math.round(r.x1); m.rot = normRot(m.rot + 90); }
  for (const { item, m } of itens) { const r = ret({ ...m, x: item.x, y: item.y, rot: item.rot }); item.x = Math.round(H - r.y2); item.y = Math.round(r.x1); item.rot = normRot(item.rot + 90); }
  for (const e of els) {
    const g = geoEl(c, e), inverte = e.parede === 'direita' || e.parede === 'esquerda';
    // de cima para a direita (e de baixo para a esquerda) a parede segue no mesmo sentido; nas outras, o sentido inverte
    e.inicio = Math.round(inverte ? H - g.b : g.a);
    e.largura = Math.round(g.b - g.a);
    if (inverte && e.tipo === 'porta') e.dobradica = e.dobradica === 'b' ? 'a' : 'b';
    e.parede = DEPOIS_DE_GIRAR[e.parede];
  }
  const cx = c.x + W / 2, cy = c.y + H / 2;
  c.w = H; c.h = W; c.x = Math.round(cx - H / 2); c.y = Math.round(cy - W / 2);
}

export type Borda = 'esq' | 'dir' | 'cima' | 'baixo';

/** Leva uma borda do cômodo até "v" (coordenada da planta do andar). O que está dentro fica no mesmo lugar da planta. */
export function esticarComodo(c: Comodo, borda: Borda, v: number, min: number, moveis: Movel[], els: ElParede[], itens: ItemCenario[]): void {
  if (borda === 'dir') { c.w = Math.max(min, Math.round(v - c.x)); return; }
  if (borda === 'baixo') { c.h = Math.max(min, Math.round(v - c.y)); return; }
  if (borda === 'esq') {
    const x2 = c.x + c.w, nx = Math.min(Math.round(v), x2 - min), d = c.x - nx;
    if (!d) return;
    c.x = nx; c.w = x2 - nx;
    for (const m of moveis) m.x += d;
    for (const it of itens) it.x += d;
    for (const e of els) if (e.parede === 'cima' || e.parede === 'baixo') e.inicio += d;
    return;
  }
  const y2 = c.y + c.h, ny = Math.min(Math.round(v), y2 - min), d = c.y - ny;
  if (!d) return;
  c.y = ny; c.h = y2 - ny;
  for (const m of moveis) m.y += d;
  for (const it of itens) it.y += d;
  for (const e of els) if (e.parede === 'esquerda' || e.parede === 'direita') e.inicio += d;
}

/** Divide o cômodo com uma parede nova. "eixo" x = parede em pé (de cima a baixo), y = parede deitada; "u" é onde a
 *  parede começa, medido por dentro a partir da esquerda (x) ou de cima (y), e ela tem T de espessura. "c" fica com a
 *  primeira parte e "novo" (que já vem com id, nome e tipo) com a segunda. Móveis, portas, janelas e pontos vão para
 *  o lado onde fica o meio deles (os cenários acompanham os móveis); depois, "acomodar" põe tudo para dentro. */
export function dividirComodo(c: Comodo, novo: Comodo, eixo: 'x' | 'y', u: number, moveis: Movel[], els: ElParede[], itens: { item: ItemCenario; m: Movel }[]): void {
  const W = c.w, H = c.h, vert = eixo === 'x', L = vert ? W : H, desloc = u + T;
  novo.andar = c.andar;
  if (vert) { novo.x = c.x + desloc; novo.y = c.y; novo.w = L - desloc; novo.h = H; c.w = u; }
  else { novo.x = c.x; novo.y = c.y + desloc; novo.w = W; novo.h = L - desloc; c.h = u; }
  const doOutroLado = (meio: number) => meio > u + T / 2;
  for (const m of moveis) {
    const r = ret(m);
    if (doOutroLado(vert ? (r.x1 + r.x2) / 2 : (r.y1 + r.y2) / 2)) { m.comodo = novo.id; if (vert) m.x -= desloc; else m.y -= desloc; }
  }
  for (const { item, m } of itens) {
    const r = ret({ ...m, x: item.x, y: item.y, rot: item.rot });
    if (doOutroLado(vert ? (r.x1 + r.x2) / 2 : (r.y1 + r.y2) / 2)) { item.comodo = novo.id; if (vert) item.x -= desloc; else item.y -= desloc; }
  }
  for (const e of els) {
    const aoLongo = vert ? e.parede === 'cima' || e.parede === 'baixo' : e.parede === 'esquerda' || e.parede === 'direita';
    // as paredes que correm junto com a nova: a do fundo vai para a segunda parte
    if (!aoLongo) { if (e.parede === (vert ? 'direita' : 'baixo')) e.comodo = novo.id; continue; }
    const g = geoEl({ w: W, h: H }, e);
    if (doOutroLado((g.a + g.b) / 2)) { e.comodo = novo.id; e.inicio = Math.round(g.a - desloc); }
    else e.inicio = Math.round(g.a);
  }
}

/** Depois de mexer no tamanho: móveis voltam para dentro e portas e janelas cabem na parede. */
export function acomodar(c: Comodo, moveis: Movel[], els: ElParede[]): void {
  for (const m of moveis) { const p = prender(c, m, m.x, m.y); m.x = p.x; m.y = p.y; }
  for (const e of els) { const g = geoEl(c, e); if (e.largura > g.L) e.largura = g.L; e.inicio = Math.round(g.a); }
}

/* ---------- portas automáticas ---------- */
const ABERTOS: TipoComodo[] = ['sala', 'cozinha', 'varanda', 'corredor', 'garagem'];
/** Cômodos que costumam ter porta para a varanda: a entrada da casa e a porta dos fundos. */
const DA_VARANDA: TipoComodo[] = ['sala', 'cozinha', 'servico', 'garagem'];

/** Porta ou vão para criar entre "a" (o cômodo novo) e um vizinho que divide a parede com ele, quando um dos dois é
 *  corredor ou varanda. Quarto, banheiro e área de serviço ganham porta abrindo para dentro deles; sala, cozinha e
 *  outro corredor ficam ligados por um vão livre. A varanda só ganha porta para a sala, a cozinha, a área de serviço
 *  e a garagem, e só quando divide pelo menos 1 m de parede com eles. */
export function portaEntre(a: Comodo, b: Comodo, els: ElParede[]): Omit<ElParede, 'id' | 'criado'> | null {
  const ta = tipoDoComodo(a), tb = tipoDoComodo(b);
  const corredor = ta === 'corredor' || tb === 'corredor', varanda = ta === 'varanda' || tb === 'varanda';
  if (a.andar !== b.andar || (!corredor && !varanda)) return null;
  // com varanda, só a entrada e a porta dos fundos (corredor encostado na varanda fica sem porta automática)
  if (varanda && !DA_VARANDA.includes(ta === 'varanda' ? tb : ta)) return null;
  // quem fica com a porta: o cômodo fechado (a porta abre para dentro dele); entre dois abertos, o novo, com vão livre
  const fechadoA = !ABERTOS.includes(ta), fechadoB = !ABERTOS.includes(tb);
  let dono: Comodo, outro: Comodo, abre: ElParede['abre'];
  if (fechadoA || fechadoB) { dono = fechadoA ? a : b; outro = dono === a ? b : a; abre = 'dentro'; }
  else if (varanda) { dono = ta === 'varanda' ? b : a; outro = dono === a ? b : a; abre = 'dentro'; }
  else { dono = a; outro = b; abre = 'vao'; }
  return portaNaParede(dono, outro, abre, els, corredor ? 70 : 100);
}

type Trecho = { parede: Parede; u1: number; u2: number };
type Pos = Pick<Comodo, 'x' | 'y' | 'w' | 'h'>;

/** Onde fica uma porta de "largura" no trecho de parede que "dono" divide com "outro" (medido na parede do dono):
 *  como se faz na obra, perto de um canto (a 10 cm dele) e com a dobradiça do lado do canto, para a folha abrir
 *  encostando na parede e deixar o resto da parede livre para os móveis. O canto bom é o do cômodo para onde a folha
 *  abre; entre dois cantos bons, fica o que não é o fundo do vizinho (num corredor, a porta vai mais para o meio dele).
 *  Passagem sem porta fica no meio do trecho. */
export function lugarDaPorta(dono: Pos, outro: Pos, pd: Trecho, largura: number, abre: ElParede['abre']): { inicio: number; dobradica: 'a' | 'b' } {
  const folga = pd.u2 - pd.u1 - largura;
  if (abre === 'vao' || folga < 4) return { inicio: Math.round(pd.u1 + Math.max(0, folga) / 2), dobradica: 'a' };
  const m = Math.min(10, folga / 2);
  const pdOutro = paredeDividida(outro, dono);
  // as duas paredes correm no mesmo sentido: o começo do trecho de um é o começo do trecho do outro
  const canto = (c: Pos, t: Trecho | null, lado: 'ini' | 'fim') => {
    if (!t) return false;
    const L = t.parede === 'cima' || t.parede === 'baixo' ? c.w : c.h;
    return lado === 'ini' ? t.u1 <= 1 : t.u2 >= L - 1;
  };
  const abrePara = abre === 'fora' ? [outro, pdOutro] as const : [dono, pd] as const, doOutro = abre === 'fora' ? [dono, pd] as const : [outro, pdOutro] as const;
  const nota = (lado: 'ini' | 'fim') => (canto(abrePara[0], abrePara[1], lado) ? 2 : 0) + (canto(doOutro[0], doOutro[1], lado) ? 0 : 1);
  return nota('fim') > nota('ini') ? { inicio: Math.round(pd.u2 - m - largura), dobradica: 'b' } : { inicio: Math.round(pd.u1 + m), dobradica: 'a' };
}

/** Porta (ou vão) no trecho de parede que "dono" divide com "outro", se couber e se ainda não houver porta ali. */
function portaNaParede(dono: Comodo, outro: Comodo, abre: ElParede['abre'], els: ElParede[], minimo = 70, auto = true): Omit<ElParede, 'id' | 'criado'> | null {
  const pd = paredeDividida(dono, outro); if (!pd) return null;
  const vao = pd.u2 - pd.u1;
  if (vao < minimo) return null;
  const tipoDono = tipoDoComodo(dono), entrada = tipoDoComodo(outro) === 'varanda' && tipoDono === 'sala';
  const ideal = abre === 'vao' ? Math.min(120, vao - 10) : tipoDono === 'banheiro' ? 70 : entrada ? 90 : 80;
  const largura = Math.round(Math.min(ideal, vao - 10));
  if (largura < 60) return null;
  // já existe porta nesse trecho (dos dois lados)? Não põe outra
  const pdOutro = paredeDividida(outro, dono);
  const cruza = (e: ElParede, comodo: string, parede: Parede, u1: number, u2: number) => e.comodo === comodo && e.tipo === 'porta' && e.parede === parede && e.inicio < u2 && e.inicio + e.largura > u1;
  if (els.some((e) => cruza(e, dono.id, pd.parede, pd.u1, pd.u2) || (pdOutro && cruza(e, outro.id, pdOutro.parede, pdOutro.u1, pdOutro.u2)))) return null;
  const nome = abre === 'vao' ? tx('Passagem', 'Opening') : entrada ? tx('Entrada', 'Entrance') : tx('Porta', 'Door');
  const lugar = lugarDaPorta(dono, outro, pd, largura, abre);
  return { tipo: 'porta', nome, comodo: dono.id, parede: pd.parede, inicio: lugar.inicio, largura, dobradica: lugar.dobradica, abre, ...(auto ? { auto: true, liga: outro.id } : {}) };
}

/** Depois que cômodos mudaram de lugar ou de tamanho: as portas automáticas e as paredes tiradas que perderam o
 *  vizinho saem; as que continuam encostadas se ajeitam no trecho de parede que sobrou (a parede tirada ocupa o
 *  trecho inteiro; a porta fica onde está se ainda couber, senão vai para perto de um canto do trecho e, se precisar,
 *  encolhe). */
export function revisarLigacoes(comodos: Record<string, Comodo>, els: ElParede[]): { remover: string[]; mudar: { id: string; inicio: number; largura: number; dobradica?: 'a' | 'b' }[] } {
  const remover: string[] = [], mudar: { id: string; inicio: number; largura: number; dobradica?: 'a' | 'b' }[] = [];
  for (const e of els) {
    if (e.tipo !== 'porta' || e.herdada || (!e.auto && !e.semParede) || !e.liga) continue;
    const a = comodos[e.comodo], b = comodos[e.liga];
    const pd = a && b && a.andar === b.andar ? paredeDividida(a, b) : null;
    if (!pd || pd.parede !== e.parede) { remover.push(e.id); continue; }
    const vao = pd.u2 - pd.u1;
    if (e.semParede) {
      if (vao < 10) { remover.push(e.id); continue; }
      if (!e.parcial) { if (e.inicio !== pd.u1 || e.largura !== vao) mudar.push({ id: e.id, inicio: pd.u1, largura: vao }); continue; }
      // cortada num trecho: o corte fica onde está, dentro do que sobrou da parede dividida
      const ini = Math.max(pd.u1, Math.min(e.inicio, pd.u2 - 10)), fim = Math.min(pd.u2, Math.max(ini + 10, e.inicio + e.largura));
      if (fim - ini < 10) remover.push(e.id);
      else if (ini !== e.inicio || fim - ini !== e.largura) mudar.push({ id: e.id, inicio: ini, largura: fim - ini });
      continue;
    }
    if (e.inicio >= pd.u1 - 0.5 && e.inicio + e.largura <= pd.u2 + 0.5) continue;
    const largura = Math.round(Math.min(e.largura, vao - 10));
    if (largura < (e.abre === 'vao' ? 40 : 60)) { remover.push(e.id); continue; }
    const lugar = lugarDaPorta(a, b, pd, largura, e.abre);
    // (a de correr corre para o lado contrário do canto, onde sobra parede)
    const dob = e.estilo === 'correr' ? (lugar.dobradica === 'a' ? 'b' : 'a') : lugar.dobradica;
    mudar.push({ id: e.id, inicio: lugar.inicio, largura, ...(e.abre === 'vao' ? {} : { dobradica: dob }) });
  }
  return { remover, mudar };
}

/** Tirar a parede entre "a" e "b": no lugar dela fica um vão do tamanho da parede dividida inteira (é como se os dois
 *  cômodos fossem um espaço só, em L ou do jeito que ficarem). Portas, janelas e pontos que estavam nessa parede,
 *  dos dois lados, saem junto. */
export function paredeTirada(a: Comodo, b: Comodo, els: ElParede[]): { el: Omit<ElParede, 'id' | 'criado'>; remover: ElParede[] } | null {
  if (a.andar !== b.andar) return null;
  const pa = paredeDividida(a, b), pb = paredeDividida(b, a);
  if (!pa || !pb || pa.u2 - pa.u1 < 10) return null;
  const naParede = (e: ElParede, c: Comodo, p: { parede: Parede; u1: number; u2: number }) => {
    if (e.comodo !== c.id || e.parede !== p.parede) return false;
    const g = geoEl(c, e);
    return g.a < p.u2 - 0.5 && g.b > p.u1 + 0.5;
  };
  const remover = els.filter((e) => !e.herdada && (naParede(e, a, pa) || naParede(e, b, pb)));
  return {
    el: { tipo: 'porta', nome: tx('Sem parede', 'No wall'), comodo: a.id, parede: pa.parede, inicio: pa.u1, largura: pa.u2 - pa.u1, dobradica: 'a', abre: 'vao', semParede: true, liga: b.id },
    remover
  };
}

/** Cortar só um trecho da parede entre "a" e "b": de "u1" a "u2", medidos na parede de "a" (ficam dentro do trecho
 *  que os dois dividem). Vira um vão; portas, janelas e pontos que caem no trecho saem junto, dos dois lados (menos o
 *  corte "fora", que este substitui). Pegando a parede dividida toda, é o mesmo que tirar a parede. */
export function corteNaParede(a: Comodo, b: Comodo, u1: number, u2: number, els: ElParede[], fora?: string): { el: Omit<ElParede, 'id' | 'criado'>; remover: ElParede[] } | null {
  if (a.andar !== b.andar) return null;
  const pa = paredeDividida(a, b), pb = paredeDividida(b, a);
  if (!pa || !pb || pa.u2 - pa.u1 < 10) return null;
  const ini = Math.round(Math.max(pa.u1, Math.min(u1, u2))), fim = Math.round(Math.min(pa.u2, Math.max(u1, u2)));
  if (fim - ini < 10) return null;
  // o mesmo trecho na parede de "b" (as duas paredes correm no mesmo sentido)
  const desl = pb.u1 - pa.u1;
  const cai = (e: ElParede, c: Comodo, parede: Parede, x1: number, x2: number) => {
    if (e.comodo !== c.id || e.parede !== parede) return false;
    const g = geoEl(c, e);
    return g.a < x2 - 0.5 && g.b > x1 + 0.5;
  };
  const remover = els.filter((e) => e.id !== fora && !e.herdada && (cai(e, a, pa.parede, ini, fim) || cai(e, b, pb.parede, ini + desl, fim + desl)));
  const inteira = ini <= pa.u1 + 0.5 && fim >= pa.u2 - 0.5;
  return {
    el: { tipo: 'porta', nome: tx('Sem parede', 'No wall'), comodo: a.id, parede: pa.parede, inicio: ini, largura: fim - ini, dobradica: 'a', abre: 'vao', semParede: true, liga: b.id, ...(inteira ? {} : { parcial: true }) },
    remover
  };
}

/** Até onde o corte "e" pode ir na parede dele, sem passar por cima de outra porta, janela ou ponto daquela parede
 *  (dos dois lados) nem sair do trecho dividido: "min" e "max", medidos na parede do dono do corte. */
export function limitesDoCorte(comodos: Record<string, Comodo>, e: ElParede, els: ElParede[]): { min: number; max: number; u1: number; u2: number } | null {
  const a = e.liga ? comodos[e.comodo] : null, b = e.liga ? comodos[e.liga] : null;
  if (!a || !b) return null;
  const pa = paredeDividida(a, b), pb = paredeDividida(b, a);
  if (!pa || !pb) return null;
  const desl = pb.u1 - pa.u1, g0 = geoEl(a, e);
  let min = pa.u1, max = pa.u2;
  for (const o of els) {
    if (o.id === e.id || o.herdada) continue;
    const doA = o.comodo === a.id && o.parede === pa.parede, doB = o.comodo === b.id && o.parede === pb.parede;
    if (!doA && !doB) continue;
    const g = geoEl(doA ? a : b, o), oa = g.a - (doA ? 0 : desl), ob = g.b - (doA ? 0 : desl);
    if (ob <= pa.u1 || oa >= pa.u2) continue;
    if (ob <= g0.a + 0.5) min = Math.max(min, ob);
    else if (oa >= g0.b - 0.5) max = Math.min(max, oa);
  }
  return { min, max, u1: pa.u1, u2: pa.u2 };
}

/** A parede tirada entre "a" e "b" (de qualquer um dos lados), se houver. */
export const semParedeEntre = (a: string, b: string, els: ElParede[]): ElParede | undefined =>
  els.find((e) => e.tipo === 'porta' && e.semParede && !e.herdada && ((e.comodo === a && e.liga === b) || (e.comodo === b && e.liga === a)));

/** Quem fica com a porta: ela abre para dentro do cômodo mais fechado (quarto, banheiro…); empate, para o menor. */
const peso = (t: TipoComodo) => (t === 'corredor' || t === 'varanda' ? 0 : ABERTOS.includes(t) ? 1 : 2);

/** Porta (ou passagem sem porta, com "porta" false) pedida entre dois cômodos que dividem a parede. Ela é da casa,
 *  não automática: fica onde está quando a pessoa acerta as medidas (com "auto", acompanha os cômodos como as
 *  automáticas). */
export function portaLigacao(a: Comodo, b: Comodo, porta: boolean, els: ElParede[], auto = false): Omit<ElParede, 'id' | 'criado'> | null {
  if (a.andar !== b.andar) return null;
  if (!porta) return portaNaParede(a, b, 'vao', els, 70, auto);
  const pa = peso(tipoDoComodo(a)), pb = peso(tipoDoComodo(b));
  const aDono = pa > pb || (pa === pb && a.w * a.h <= b.w * b.h);
  return portaNaParede(aDono ? a : b, aDono ? b : a, 'dentro', els, 70, auto);
}

/** Começo de um vão novo de "largura" na parede, o mais perto possível de "centro" (onde a pessoa tocou), sem cair em
 *  cima de outra porta ou janela daquela parede (as do vizinho na parede dividida também contam). Perto de um canto,
 *  a porta encosta a 10 cm dele. Sem lugar livre, null. */
export function lugarNaParede(q: Pick<ComodoCompleto, 'w' | 'h' | 'portas' | 'janelas'>, parede: Parede, centro: number, largura: number, porta: boolean): number | null {
  const L = parede === 'cima' || parede === 'baixo' ? q.w : q.h, max = L - largura;
  if (max < 0) return null;
  const vaos = q.portas.concat(q.janelas).filter((e) => e.parede === parede).map((e) => { const g = geoEl(q, e); return [g.a, g.b] as const; });
  const livre = (a: number) => !vaos.some(([x, y]) => a < y - 0.5 && a + largura > x + 0.5);
  let a0 = Math.min(Math.max(0, centro - largura / 2), max);
  if (porta && max >= 10) { if (a0 < 25) a0 = 10; else if (max - a0 < 25) a0 = max - 10; }
  for (let d = 0; d <= L; d += 5) {
    for (const a of d ? [a0 - d, a0 + d] : [a0]) if (a >= 0 && a <= max && livre(a)) return Math.round(a);
  }
  // as pontas da parede (o passo de 5 em 5 pode ter pulado por cima delas)
  for (const a of [0, max]) if (livre(a)) return Math.round(a);
  return null;
}

/** Parede livre de cada lado de um vão (até o canto ou até a próxima porta ou janela daquela parede). */
function livreDosLados(q: Pick<ComodoCompleto, 'w' | 'h' | 'portas' | 'janelas'>, e: Pick<ElParede, 'id' | 'parede' | 'inicio' | 'largura'>): { a: number; b: number } {
  const g = geoEl(q, e);
  let a = g.a, b = g.L - g.b;
  for (const o of q.portas.concat(q.janelas)) {
    if (o.id === e.id || o.parede !== e.parede) continue;
    const go = geoEl(q, o);
    if (go.b <= g.a + 0.5) a = Math.min(a, g.a - go.b);
    else if (go.a >= g.b - 0.5) b = Math.min(b, go.a - g.b);
  }
  return { a, b };
}
/** Para que lado a porta de correr abre: para onde sobra mais parede livre (a folha corre por cima dela). */
export const ladoDeCorrer = (q: Pick<ComodoCompleto, 'w' | 'h' | 'portas' | 'janelas'>, e: Pick<ElParede, 'id' | 'parede' | 'inicio' | 'largura'>): 'a' | 'b' => {
  const l = livreDosLados(q, e);
  return l.b > l.a ? 'b' : 'a';
};
/** A dobradiça da porta de abrir: do lado com menos parede livre (o canto mais perto), para a folha abrir encostada. */
export const ladoDaDobradica = (q: Pick<ComodoCompleto, 'w' | 'h' | 'portas' | 'janelas'>, e: Pick<ElParede, 'id' | 'parede' | 'inicio' | 'largura'>): 'a' | 'b' => {
  const l = livreDosLados(q, e);
  return l.b < l.a ? 'b' : 'a';
};

/** Quanto da parede do cômodo é dividido com vizinhos (de 0 a 1). */
export function parteDividida(c: Comodo, parede: Parede, outros: Comodo[]): number {
  const L = parede === 'cima' || parede === 'baixo' ? c.w : c.h;
  let dividido = 0;
  for (const o of outros) {
    if (o.id === c.id || o.andar !== c.andar) continue;
    const pd = paredeDividida(c, o);
    if (pd && pd.parede === parede) dividido += pd.u2 - pd.u1;
  }
  return L > 0 ? Math.min(1, dividido / L) : 1;
}

/** Porta da rua numa parede de fora do cômodo. */
export function portaDeEntrada(c: Comodo, parede: Parede, outros: Comodo[], els: ElParede[]): Omit<ElParede, 'id' | 'criado'> | null {
  const L = parede === 'cima' || parede === 'baixo' ? c.w : c.h;
  if (parteDividida(c, parede, outros) > 0.5 || L < 80) return null;
  if (els.some((e) => e.comodo === c.id && e.tipo === 'porta' && e.parede === parede)) return null;
  const largura = Math.round(Math.min(90, L - 20));
  return { tipo: 'porta', nome: tx('Entrada', 'Entrance'), comodo: c.id, parede, inicio: Math.round((L - largura) / 2), largura, dobradica: 'a', abre: 'dentro' };
}

/** Janela de correr no meio de uma parede de fora (no banheiro, uma pequena), sem cair em cima de porta. */
export function janelaNaParede(c: Comodo, parede: Parede, outros: Comodo[], els: ElParede[]): Omit<ElParede, 'id' | 'criado'> | null {
  const L = parede === 'cima' || parede === 'baixo' ? c.w : c.h;
  if (parteDividida(c, parede, outros) > 0.5) return null;
  const banheiro = tipoDoComodo(c) === 'banheiro';
  const largura = Math.round(banheiro ? Math.min(60, L - 40) : Math.min(150, Math.max(60, L - 80)));
  if (largura < 40) return null;
  const vaos = els.filter((e) => e.comodo === c.id && e.parede === parede && (e.tipo === 'porta' || e.tipo === 'janela'));
  for (const f of [0.5, 0.25, 0.75]) {
    const inicio = Math.round(Math.min(Math.max(0, L * f - largura / 2), L - largura));
    if (!vaos.some((e) => e.inicio < inicio + largura + 10 && e.inicio + e.largura + 10 > inicio)) {
      return { tipo: 'janela', nome: tx('Janela', 'Window'), comodo: c.id, parede, inicio, largura, abertura: 'correr', folhas: 2 };
    }
  }
  return null;
}
