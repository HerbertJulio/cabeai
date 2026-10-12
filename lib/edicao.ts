// Edição da planta da casa: girar e esticar cômodos levando junto o que está dentro, e as portas automáticas
// quando um cômodo desenhado encosta num corredor ou numa varanda. Funções puras: mudam só os objetos recebidos.
import { paredeDividida } from './casa';
import { tipoDoComodo } from './catalogo';
import { geoEl, normRot, prender, ret } from './geometria';
import { tx } from './i18n';
import type { Comodo, ElParede, ItemCenario, Movel, Parede, TipoComodo } from './tipos';

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

/** Porta (ou vão) no meio do trecho de parede que "dono" divide com "outro", se couber e se ainda não houver porta ali. */
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
  return { tipo: 'porta', nome, comodo: dono.id, parede: pd.parede, inicio: Math.round(pd.u1 + (vao - largura) / 2), largura, dobradica: 'a', abre, ...(auto ? { auto: true, liga: outro.id } : {}) };
}

/** Depois que cômodos mudaram de lugar ou de tamanho: as portas automáticas e as paredes tiradas que perderam o
 *  vizinho saem; as que continuam encostadas se ajeitam no trecho de parede que sobrou (a parede tirada ocupa o
 *  trecho inteiro; a porta fica onde está se ainda couber, senão vai para o meio e, se precisar, encolhe). */
export function revisarLigacoes(comodos: Record<string, Comodo>, els: ElParede[]): { remover: string[]; mudar: { id: string; inicio: number; largura: number }[] } {
  const remover: string[] = [], mudar: { id: string; inicio: number; largura: number }[] = [];
  for (const e of els) {
    if (e.tipo !== 'porta' || e.herdada || (!e.auto && !e.semParede) || !e.liga) continue;
    const a = comodos[e.comodo], b = comodos[e.liga];
    const pd = a && b && a.andar === b.andar ? paredeDividida(a, b) : null;
    if (!pd || pd.parede !== e.parede) { remover.push(e.id); continue; }
    const vao = pd.u2 - pd.u1;
    if (e.semParede) {
      if (vao < 10) remover.push(e.id);
      else if (e.inicio !== pd.u1 || e.largura !== vao) mudar.push({ id: e.id, inicio: pd.u1, largura: vao });
      continue;
    }
    if (e.inicio >= pd.u1 - 0.5 && e.inicio + e.largura <= pd.u2 + 0.5) continue;
    const largura = Math.round(Math.min(e.largura, vao - 10));
    if (largura < (e.abre === 'vao' ? 40 : 60)) { remover.push(e.id); continue; }
    mudar.push({ id: e.id, inicio: Math.round(pd.u1 + (vao - largura) / 2), largura });
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

/** A parede tirada entre "a" e "b" (de qualquer um dos lados), se houver. */
export const semParedeEntre = (a: string, b: string, els: ElParede[]): ElParede | undefined =>
  els.find((e) => e.tipo === 'porta' && e.semParede && !e.herdada && ((e.comodo === a && e.liga === b) || (e.comodo === b && e.liga === a)));

/** Quem fica com a porta: ela abre para dentro do cômodo mais fechado (quarto, banheiro…); empate, para o menor. */
const peso = (t: TipoComodo) => (t === 'corredor' || t === 'varanda' ? 0 : ABERTOS.includes(t) ? 1 : 2);

/** Porta (ou passagem sem porta, com "porta" false) pedida entre dois cômodos que dividem a parede. Ela é da casa,
 *  não automática: fica onde está quando a pessoa acerta as medidas. */
export function portaLigacao(a: Comodo, b: Comodo, porta: boolean, els: ElParede[]): Omit<ElParede, 'id' | 'criado'> | null {
  if (a.andar !== b.andar) return null;
  if (!porta) return portaNaParede(a, b, 'vao', els, 70, false);
  const pa = peso(tipoDoComodo(a)), pb = peso(tipoDoComodo(b));
  const aDono = pa > pb || (pa === pb && a.w * a.h <= b.w * b.h);
  return portaNaParede(aDono ? a : b, aDono ? b : a, 'dentro', els, 70, false);
}

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
