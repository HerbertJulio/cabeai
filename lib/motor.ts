// Sugestões automáticas: testa centenas de arrumações no próprio aparelho e escolhe 3 bem diferentes.
import { NOME_PAREDE, PAREDES, PONTO_DO, horizontal } from './catalogo';
import {
  COSTAS, FRENTE, avaliar, bloqueiaPorta, cobreInterruptor, dims, distRet, folgas, folgasRet, geoEl, geoPorta, janelaRuim, ladosCama,
  lugarLivre, naAreaDoAr, naFrentePorta, noTrecho, normRot, paredeDe, pontosUsados, posValida, precisaFrente, ret, sobrepoe, temCadeiras,
  uv2xy, zonaFrente, zonasCadeiras
} from './geometria';
import { registro, tx } from './i18n';
import type { Avaliacao, ComodoCompleto, ItemCenario, Movel, Parede, Ponto, Ret } from './tipos';
import { tem } from './util';

export function aleatorio(semente: number): () => number {
  let s = semente >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function estaticoOk(q: ComodoCompleto, m: Movel, r: Ret): boolean {
  if (r.x1 < -0.5 || r.y1 < -0.5 || r.x2 > q.w + 0.5 || r.y2 > q.h + 0.5) return false;
  if (q.portas.some((p) => bloqueiaPorta(q, p, r) || (p.abre !== 'dentro' && naFrentePorta(q, p, r)))) return false;
  if (q.interruptores.some((i) => cobreInterruptor(q, i, r, m.alto, m.tipo))) return false;
  if (m.alto && (q.ares.some((a) => naAreaDoAr(q, a, r)) || q.janelas.some((j) => janelaRuim(q, j, r)))) return false;
  return true;
}
const cabe = (q: ComodoCompleto, z: Ret): boolean => z.x1 > -0.5 && z.y1 > -0.5 && z.x2 < q.w + 0.5 && z.y2 < q.h + 0.5;

interface Cand { x: number; y: number; rot: number; r: Ret; zonas: Ret[]; parede: Parede | ''; costas: boolean; mesa?: boolean }

/** Zonas que precisam ficar livres: frente (portas, gavetas, forno…) e cadeiras da mesa. */
function zonasDe(m: Movel, x: number, y: number, rot: number): Ret[] {
  const out: Ret[] = [];
  const need = precisaFrente(m);
  if (need) out.push(zonaFrente(m, x, y, rot, need));
  if (temCadeiras(m)) for (const z of zonasCadeiras(m, x, y, rot)) out.push(z.r);
  return out;
}
const portasLivres = (q: ComodoCompleto, zs: Ret[]) => zs.every((z) => !q.portas.some((p) => p.abre === 'dentro' && bloqueiaPorta(q, p, z)));

/** Posições encostadas: costas (ou a lateral, para cama de solteiro e berço) numa parede. Mesa com cadeiras dos dois lados vai para o meio. */
function candidatosDe(q: ComodoCompleto, m: Movel): Cand[] {
  const out: Cand[] = [], passo = 10;
  const testar = (x: number, y: number, rot: number, parede: Parede | '', costas: boolean) => {
    const d = dims(m, rot), r = { x1: x, y1: y, x2: x + d.w, y2: y + d.h };
    if (!estaticoOk(q, m, r)) return;
    const zonas = zonasDe(m, x, y, rot);
    if (!zonas.every((z) => cabe(q, z)) || !portasLivres(q, zonas)) return;
    out.push({ x, y, rot, r, zonas, parede, costas });
  };
  for (const parede of PAREDES) {
    const rots = [COSTAS[parede]];
    if (m.tipo === 'berco' || (m.tipo === 'cama' && m.larg < 120) || m.tipo === 'mesa') rots.push(normRot(COSTAS[parede] + 90), normRot(COSTAS[parede] + 270));
    for (const rot of rots) {
      const d = dims(m, rot);
      if (d.w > q.w + 0.5 || d.h > q.h + 0.5) continue;
      const hz = horizontal(parede), L = hz ? q.w - d.w : q.h - d.h, us: number[] = [];
      for (let u = 0; u < L; u += passo) us.push(u);
      us.push(L);
      for (const u0 of us) {
        const u = Math.round(u0);
        const x = hz ? u : parede === 'esquerda' ? 0 : q.w - d.w, y = hz ? (parede === 'cima' ? 0 : q.h - d.h) : u;
        testar(x, y, rot, parede, rot === COSTAS[parede]);
      }
    }
  }
  if (temCadeiras(m) && m.ladoCadeiras !== 'frente') {
    for (const rot of [0, 90]) {
      const d = dims(m, rot);
      for (let y = 0; y <= q.h - d.h; y += 20) for (let x = 0; x <= q.w - d.w; x += 20) testar(Math.round(x), Math.round(y), rot, '', false);
    }
  }
  return out;
}

interface Bloco { m: Movel; x: number; y: number; rot: number; r: Ret; zonas: Ret[]; zu: Ret | null }
function bloco(m: Movel, x: number, y: number, rot: number, r: Ret): Bloco {
  return { m, x, y, rot, r, zonas: zonasDe(m, x, y, rot), zu: m.tipo === 'mesa' && !temCadeiras(m) ? zonaFrente(m, x, y, rot, 60) : null };
}

/** Cadeira solta de frente para uma mesa já posta (encosto para fora). */
function candidatosCadeira(q: ComodoCompleto, m: Movel, col: Bloco[]): Cand[] {
  const out: Cand[] = [];
  for (const o of col) {
    if (o.m.tipo !== 'mesa' || temCadeiras(o.m)) continue;
    const rm = normRot(o.rot), rot = normRot(rm + 180), d = dims(m, rot), R = o.r;
    let x: number, y: number;
    if (rm === 0) { x = (R.x1 + R.x2 - d.w) / 2; y = R.y2; }
    else if (rm === 180) { x = (R.x1 + R.x2 - d.w) / 2; y = R.y1 - d.h; }
    else if (rm === 90) { x = R.x1 - d.w; y = (R.y1 + R.y2 - d.h) / 2; }
    else { x = R.x2; y = (R.y1 + R.y2 - d.h) / 2; }
    x = Math.round(x); y = Math.round(y);
    const r = { x1: x, y1: y, x2: x + d.w, y2: y + d.h };
    if (estaticoOk(q, m, r)) out.push({ x, y, rot, r, zonas: [], parede: '', costas: false, mesa: true });
  }
  return out;
}

function livreDe(m: Movel, c: Cand, col: Bloco[]): boolean {
  for (const o of col) {
    if (sobrepoe(c.r, o.r)) return false;
    if (o.zonas.some((z) => sobrepoe(c.r, z))) return false;
    if (c.zonas.some((z) => sobrepoe(z, o.r))) return false;
    if (o.zu && m.tipo !== 'cadeira' && sobrepoe(c.r, o.zu)) return false;
  }
  return true;
}

function notaLocal(q: ComodoCompleto, m: Movel, c: Cand, col: Bloco[]): number {
  let s = 0;
  if (c.parede) s += c.costas ? 12 : 7;
  if (Number(c.r.x1 < 1) + Number(c.r.x2 > q.w - 1) + Number(c.r.y1 < 1) + Number(c.r.y2 > q.h - 1) >= 2) s += 6;
  if (m.tipo === 'cama' && m.larg >= 120) {
    const f = folgasRet(q, c.r, col.map((o) => o.r)), lados = c.rot % 180 === 0 ? [f.esq.gap, f.dir.gap] : [f.cima.gap, f.baixo.gap];
    for (const g of lados) s += g >= 60 ? 16 : -16;
  }
  if (m.tipo === 'berco') { const cama = col.find((o) => o.m.tipo === 'cama'); if (cama) s -= distRet(c.r, cama.r) / 6; }
  if (c.mesa) s += 60;
  if (m.tipo === 'mesa') for (const j of q.janelas) { const g = geoEl(q, j); if (noTrecho(q, j.parede, g.a, g.b, c.r, 90)) { s += 10; break; } }
  if (m.tipo === 'fogao' || m.tipo === 'geladeira') { const pia = col.find((o) => o.m.tipo === 'pia'); if (pia) { const dd = distRet(c.r, pia.r); s += dd < 3 ? (m.tipo === 'fogao' ? 14 : 6) : -dd / 20; } }
  if (m.tipo === 'sofa') { const tv = col.find((o) => o.m.tipo === 'rack'); if (tv) { const dd = distRet(c.r, tv.r); s += dd >= 150 && dd <= 400 ? 14 : -6; } }
  for (const p of q.portas) { const g = geoPorta(q, p); if (noTrecho(q, p.parede, g.a - 20, g.b + 20, c.r, g.r + 45)) s -= 14; }
  s += bonusPontos(pontosUsados(q, m.tipo, c.r));
  return s;
}

/** Móvel na frente do ponto que ele usa (rack no ponto de TV, pia na água e no esgoto, fogão no gás) ganha pontos;
 *  tomada vale pouco, porque costuma ter em toda parede. */
const bonusPontos = (ps: Ponto[]): number => ps.reduce((s, p) => s + (p === 'tomada' ? 5 : 16), 0);

const PRIOR: Record<string, number> = {
  'cama': 0, 'guarda-roupa': 1, 'sofa': 1, 'pia': 1, 'berco': 2, 'geladeira': 2, 'fogao': 2, 'armario': 3, 'comoda': 3,
  'rack': 3, 'estante': 4, 'mesa': 4, 'lavadora': 4, 'outro': 5, 'cadeira': 6
};

type Pos = { x: number; y: number; rot: number; r: Ret };
function tentativa(q: ComodoCompleto, pecas: Movel[], fixos: Movel[], cands: Map<string, Cand[]>, rnd: () => number): Map<string, Pos | null> {
  const col = fixos.map((f) => bloco(f, f.x, f.y, normRot(f.rot), ret(f)));
  const pos = new Map<string, Pos | null>();
  const ordem = pecas
    .map((m) => ({ m, k: (tem(PRIOR, m.tipo) ? PRIOR[m.tipo] : 5) * 1e6 - m.larg * m.prof + rnd() * 2500 }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.m);
  for (const m of ordem) {
    const lista = (m.tipo === 'cadeira' ? candidatosCadeira(q, m, col) : []).concat(cands.get(m.id) || []);
    const top: { c: Cand; s: number }[] = [];
    for (const c of lista) {
      if (!livreDe(m, c, col)) continue;
      const s = notaLocal(q, m, c, col) + rnd() * 26;
      if (top.length < 3) { top.push({ c, s }); top.sort((a, b) => b.s - a.s); }
      else if (s > top[2].s) { top[2] = { c, s }; top.sort((a, b) => b.s - a.s); }
    }
    if (!top.length) { pos.set(m.id, null); continue; }
    const pick = top[rnd() < 0.6 ? 0 : Math.floor(rnd() * top.length)].c;
    pos.set(m.id, pick);
    col.push(bloco(m, pick.x, pick.y, pick.rot, pick.r));
  }
  // quem não coube encostado vai para qualquer lugar livre; se nem isso, fica onde está
  for (const m of ordem) {
    if (pos.get(m.id)) continue;
    const outros = col.map((o) => ({ ...o.m, x: o.x, y: o.y, rot: o.rot }));
    const l = lugarLivre(q, m, outros);
    const c = posValida(q, m, l.x, l.y, l.rot, outros, false) ? { x: l.x, y: l.y, rot: l.rot, r: ret(m, l.x, l.y, l.rot) } : { x: m.x, y: m.y, rot: normRot(m.rot), r: ret(m) };
    pos.set(m.id, c);
    col.push(bloco(m, c.x, c.y, c.rot, c.r));
  }
  return pos;
}

/* ---------- por onde dá para andar (faixa de 60 ou 80 cm), a partir das portas ---------- */
interface Alcance { g: number; cols: number; rows: number; vis: Uint8Array; n: number }
function alcance(q: ComodoCompleto, rs: Ret[], raio: number): Alcance {
  const g = 5, cols = Math.max(1, Math.floor(q.w / g)), rows = Math.max(1, Math.floor(q.h / g)), n = cols * rows;
  const livre = new Uint8Array(n), vis = new Uint8Array(n), r2 = raio * raio;
  for (let j = 0; j < rows; j++) {
    const cy = (j + 0.5) * g;
    if (cy < raio || cy > q.h - raio) continue;
    for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * g;
      if (cx < raio || cx > q.w - raio) continue;
      let ok = 1;
      for (const R of rs) { const dx = Math.max(R.x1 - cx, 0, cx - R.x2), dy = Math.max(R.y1 - cy, 0, cy - R.y2); if (dx * dx + dy * dy < r2) { ok = 0; break; } }
      livre[j * cols + i] = ok;
    }
  }
  const fila: number[] = [];
  for (const p of q.portas) {
    const gp = geoPorta(q, p), meio = (gp.a + gp.b) / 2;
    let achou = false;
    for (let v = raio; v <= raio + 30 && !achou; v += g) {
      for (let du = 0; du <= (gp.b - gp.a) / 2 && !achou; du += g) {
        for (const sgn of [1, -1]) {
          const pt = uv2xy(q, p.parede, meio + sgn * du, v), i = Math.floor(pt[0] / g), j = Math.floor(pt[1] / g);
          if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
          const k = j * cols + i;
          if (livre[k] && !vis[k]) { vis[k] = 1; fila.push(k); achou = true; }
        }
      }
    }
  }
  for (let h = 0; h < fila.length; h++) {
    const k = fila[h], i = k % cols, j = (k - i) / cols;
    if (i > 0 && livre[k - 1] && !vis[k - 1]) { vis[k - 1] = 1; fila.push(k - 1); }
    if (i < cols - 1 && livre[k + 1] && !vis[k + 1]) { vis[k + 1] = 1; fila.push(k + 1); }
    if (j > 0 && livre[k - cols] && !vis[k - cols]) { vis[k - cols] = 1; fila.push(k - cols); }
    if (j < rows - 1 && livre[k + cols] && !vis[k + cols]) { vis[k + cols] = 1; fila.push(k + cols); }
  }
  return { g, cols, rows, vis, n: fila.length };
}

/** Lados por onde se usa o móvel: a frente (portas, gavetas, mesa), as cadeiras, os lados compridos (cama) ou qualquer lado. */
function faixasDeUso(m: Movel, prof: number): Ret[] {
  const r = ret(m), R = normRot(m.rot);
  const lados = {
    cima: { x1: r.x1, y1: r.y1 - prof, x2: r.x2, y2: r.y1 }, baixo: { x1: r.x1, y1: r.y2, x2: r.x2, y2: r.y2 + prof },
    esq: { x1: r.x1 - prof, y1: r.y1, x2: r.x1, y2: r.y2 }, dir: { x1: r.x2, y1: r.y1, x2: r.x2 + prof, y2: r.y2 }
  };
  // mesa com cadeiras: é preciso chegar até a área das cadeiras
  if (temCadeiras(m)) return zonasCadeiras(m).map((z) => z.r);
  if (precisaFrente(m) || m.tipo === 'mesa') return [lados[FRENTE[R]]];
  if (m.tipo === 'cama') return R % 180 === 0 ? [lados.esq, lados.dir] : [lados.cima, lados.baixo];
  return [lados.cima, lados.baixo, lados.esq, lados.dir];
}

function alcancaFaixa(A: Alcance, z: Ret): boolean {
  const i1 = Math.max(0, Math.floor(z.x1 / A.g)), i2 = Math.min(A.cols - 1, Math.floor((z.x2 - 0.01) / A.g));
  const j1 = Math.max(0, Math.floor(z.y1 / A.g)), j2 = Math.min(A.rows - 1, Math.floor((z.y2 - 0.01) / A.g));
  for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) if (A.vis[j * A.cols + i]) return true;
  return false;
}

interface Nota { s: number; av: Avaliacao; semPassagem: string[] }
function notaFinal(q: ComodoCompleto, lista: Movel[]): Nota {
  const av = avaliar(q, lista), semPassagem: string[] = [];
  let s = -1000 * av.itens.length;
  if (q.portas.length && lista.length) {
    const rs = lista.map((m) => ret(m)), a60 = alcance(q, rs, 30), a80 = alcance(q, rs, 40);
    s += a60.n * 0.03;
    for (const m of lista) {
      const fx = faixasDeUso(m, 45);
      if (!fx.some((z) => alcancaFaixa(a60, z))) { s -= 400; semPassagem.push(m.nome); continue; }
      if (faixasDeUso(m, 55).some((z) => alcancaFaixa(a80, z))) s += 12;
      if (m.tipo === 'cama' && m.larg >= 120 && fx.every((z) => alcancaFaixa(a60, z))) s += 30;
    }
  }
  for (const m of lista) {
    if (m.tipo === 'cama' && m.larg >= 120) { const lados = ladosCama(m, folgas(q, m, lista.filter((o) => o !== m))); for (const g of lados) s += g >= 60 ? 20 : -20; }
    if (paredeDe(q, m)) s += 8;
    s += bonusPontos(pontosUsados(q, m.tipo, ret(m)));
    if (m.tipo === 'cadeira' && lista.some((o) => o.tipo === 'mesa' && distRet(ret(m), ret(o)) < 3)) s += 25;
    if (m.tipo === 'berco') { const cama = lista.find((o) => o.tipo === 'cama'); if (cama) s -= distRet(ret(m), ret(cama)) / 5; }
  }
  return { s, av, semPassagem };
}

function assinatura(q: ComodoCompleto, lista: Movel[]): { grande: string; fino: string } {
  const de = (tipo: string) => { const m = lista.find((o) => o.tipo === tipo); return m ? paredeDe(q, m) || 'meio' : '-'; };
  return {
    grande: de('cama') + '|' + de('guarda-roupa') + '|' + de('sofa') + '|' + de('mesa'),
    fino: lista.map((m) => `${m.id}:${Math.round(m.x / 20)},${Math.round(m.y / 20)},${normRot(m.rot)}`).join(';')
  };
}

function diferenca(a: Movel[], b: Movel[]): number {
  const mb = new Map(b.map((m) => [m.id, m]));
  let n = 0;
  for (const m of a) { const o = mb.get(m.id); if (!o || Math.abs(o.x - m.x) > 40 || Math.abs(o.y - m.y) > 40 || normRot(o.rot) !== normRot(m.rot)) n++; }
  return n;
}

const CURTO = registro<Parede>(
  { cima: 'em cima', baixo: 'embaixo', esquerda: 'à esquerda', direita: 'à direita' },
  { cima: 'at the top', baixo: 'at the bottom', esquerda: 'on the left', direita: 'on the right' }
);
/** Nome do móvel no meio da frase: em português tudo minúsculo; em inglês só a primeira letra, sem mexer em siglas ("TV stand"). */
const nomeNaFrase = (nome: string): string => tx(nome.toLowerCase(), /^[A-Z]{2}/.test(nome) ? nome : nome.charAt(0).toLowerCase() + nome.slice(1));
/** "a, b e c" / "a, b and c". */
const juntar = (xs: string[]): string => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + tx(' e ', ' and ') + xs[xs.length - 1]);
const principal = (lista: Movel[]): Movel | undefined =>
  lista.find((m) => m.tipo === 'cama') || lista.find((m) => m.tipo === 'sofa') || lista.find((m) => m.tipo === 'guarda-roupa') || lista.find((m) => m.tipo === 'mesa') || lista.find((m) => m.tipo === 'pia');

function detalheSug(q: ComodoCompleto, lista: Movel[]): string {
  const p0 = principal(lista);
  const segundo = lista.find((m) => m !== p0 && ['guarda-roupa', 'rack', 'mesa', 'geladeira', 'estante'].includes(m.tipo));
  if (!segundo) return '';
  const p = paredeDe(q, segundo);
  return nomeNaFrase(segundo.nome) + ' ' + (p ? CURTO[p] : tx('no meio', 'in the middle'));
}

function tituloSug(q: ComodoCompleto, lista: Movel[], k: number): string {
  const m = principal(lista);
  if (!m) return tx('Arrumação ', 'Layout ') + (k + 1);
  const p = paredeDe(q, m);
  return `${m.nome} ${p ? CURTO[p] : tx('no meio', 'in the middle')}`.slice(0, 40);
}

function explicarSug(q: ComodoCompleto, lista: Movel[], nota: Nota, fixos: Movel[]): string {
  const partes: string[] = [], outros = (m: Movel) => lista.filter((o) => o.id !== m.id);
  const cama = lista.find((m) => m.tipo === 'cama');
  if (cama) {
    const p = paredeDe(q, cama), lados = ladosCama(cama, folgas(q, cama, outros(cama))).map((g) => Math.max(0, Math.round(g)));
    partes.push(tx(
      `Cama ${p ? 'com a cabeceira na parede ' + NOME_PAREDE[p] : 'no meio do cômodo'}` + (cama.larg >= 120 ? `, com ${lados[0]} e ${lados[1]} cm livres dos lados` : '') + '.',
      `Bed ${p ? 'with the headboard on the ' + NOME_PAREDE[p] + ' wall' : 'in the middle of the room'}` + (cama.larg >= 120 ? `, with ${lados[0]} and ${lados[1]} cm free on the sides` : '') + '.'
    ));
  }
  const sofa = lista.find((m) => m.tipo === 'sofa');
  if (sofa) { const p = paredeDe(q, sofa); partes.push(tx(`Sofá ${p ? 'encostado na parede ' + NOME_PAREDE[p] : 'solto no meio'}.`, `Sofa ${p ? 'against the ' + NOME_PAREDE[p] + ' wall' : 'in the middle, away from the walls'}.`)); }
  const gr = lista.find((m) => m.tipo === 'guarda-roupa');
  if (gr) {
    const p = paredeDe(q, gr), fr = folgas(q, gr, outros(gr))[FRENTE[normRot(gr.rot)]].gap;
    partes.push(tx(
      `Guarda-roupa ${p ? 'na parede ' + NOME_PAREDE[p] : 'solto no cômodo'}, com ${Math.max(0, Math.round(fr))} cm livres na frente.`,
      `Wardrobe ${p ? 'on the ' + NOME_PAREDE[p] + ' wall' : 'away from the walls'}, with ${Math.max(0, Math.round(fr))} cm free in front.`
    ));
  }
  const mesa = lista.find((m) => temCadeiras(m));
  if (mesa) partes.push(tx(
    `${mesa.nome} com ${mesa.cadeiras === 1 ? '1 cadeira' : mesa.cadeiras + ' cadeiras'} e espaço para puxar.`,
    `${mesa.nome} with ${mesa.cadeiras === 1 ? '1 chair' : mesa.cadeiras + ' chairs'} and room to pull ${mesa.cadeiras === 1 ? 'it' : 'them'} out.`
  ));
  // móveis nos pontos que usam (a tomada fica de fora: tem em quase toda parede)
  for (const m of lista) {
    const ps = pontosUsados(q, m.tipo, ret(m)).filter((p) => p !== 'tomada');
    if (!ps.length) continue;
    if (m.tipo === 'cama') { partes.push(tx('Cabeceira entre as arandelas.', 'Headboard between the wall lights.')); continue; }
    partes.push(tx(`${m.nome} na frente ${juntar(ps.map((p) => PONTO_DO[p]))}.`, `${m.nome} in front of ${juntar(ps.map((p) => PONTO_DO[p]))}.`));
  }
  const berco = lista.find((m) => m.tipo === 'berco');
  if (berco && cama) { const dd = Math.round(distRet(ret(berco), ret(cama))); partes.push(dd < 5 ? tx('Berço encostado na cama.', 'Crib against the bed.') : tx(`Berço a ${dd} cm da cama.`, `Crib ${dd} cm from the bed.`)); }
  if (q.portas.length) partes.push(nota.semPassagem.length
    ? tx(`Atenção: ${nota.semPassagem.join(', ')} fica sem passagem de 60 cm.`, `Heads up: there’s no 60 cm path to ${nota.semPassagem.join(', ')}.`)
    : tx('Dá para passar (60 cm ou mais) da porta até todos os móveis.', 'There’s a path (60 cm or wider) from the door to all the furniture.'));
  if (fixos.length) partes.push(tx(`Ficaram no lugar: ${fixos.map((m) => m.nome).join(', ')}.`, `Kept in place: ${fixos.map((m) => m.nome).join(', ')}.`));
  if (nota.av.itens.length) partes.push(tx('Pendente: ', 'Still to fix: ') + nota.av.itens[0].t);
  return partes.join(' ');
}

export interface Opcao { itens: Record<string, ItemCenario>; titulo: string; explicacao: string; problemas: number }

const esperar = () => new Promise<void>((r) => setTimeout(r, 0));
const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Até 3 arrumações bem diferentes para um cômodo; móveis travados ficam onde estão. */
export async function sugerirComodo(q: ComodoCompleto, moveis: Movel[], aviso?: (n: number) => void, orcamentoMs = 900): Promise<Opcao[]> {
  const todos = moveis.map((m) => ({ ...m }));
  const fixos = todos.filter((m) => m.fixo), pecas = todos.filter((m) => !m.fixo);
  if (!pecas.length) return [];
  const cands = new Map(pecas.map((m) => [m.id, candidatosDe(q, m)]));
  const rnd = aleatorio(Date.now() ^ (todos.length * 7919));
  const vistos = new Map<string, { lista: Movel[]; ass: { grande: string; fino: string }; nota: Nota }>(), t0 = agora();
  let n = 0;
  while (n < 900 && agora() - t0 < orcamentoMs) {
    const lote = agora();
    while (n < 900 && agora() - lote < 40) {
      n++;
      const pos = tentativa(q, pecas, fixos, cands, rnd);
      const lista = todos.map((m) => { const p = pos.get(m.id); return p ? { ...m, x: p.x, y: p.y, rot: p.rot } : m; });
      const ass = assinatura(q, lista);
      if (vistos.has(ass.fino)) continue;
      vistos.set(ass.fino, { lista, ass, nota: notaFinal(q, lista) });
    }
    if (aviso) aviso(n);
    await esperar();
  }
  const ordem = Array.from(vistos.values()).sort((a, b) => b.nota.s - a.nota.s), escolhidos: typeof ordem = [];
  if (!ordem.length) return [];
  escolhidos.push(ordem[0]);
  const melhor = ordem[0].nota.s;
  for (const r of ordem) { if (escolhidos.length >= 3 || r.nota.s < melhor - 600) break; if (!escolhidos.includes(r) && escolhidos.every((e) => e.ass.grande !== r.ass.grande)) escolhidos.push(r); }
  for (const r of ordem) { if (escolhidos.length >= 3) break; if (!escolhidos.includes(r) && escolhidos.every((e) => diferenca(e.lista, r.lista) >= 2)) escolhidos.push(r); }
  for (const r of ordem) { if (escolhidos.length >= 3) break; if (!escolhidos.includes(r)) escolhidos.push(r); }
  // títulos repetidos ganham um detalhe, para dar para diferenciar as opções
  const tits = escolhidos.map((r, k) => tituloSug(q, r.lista, k));
  for (let k = 1; k < tits.length; k++) {
    if (!tits.slice(0, k).includes(tits[k])) continue;
    const d = detalheSug(q, escolhidos[k].lista), t2 = d ? tits[k] + ', ' + d : '';
    tits[k] = t2 && !tits.slice(0, k).includes(t2) ? t2 : tits[k] + tx(' (outra)', ' (another)');
  }
  return escolhidos.map((r, k) => ({
    itens: Object.fromEntries(r.lista.map((m) => [m.id, { comodo: q.id, x: m.x, y: m.y, rot: normRot(m.rot) }])),
    titulo: tits[k],
    explicacao: explicarSug(q, r.lista, r.nota, fixos),
    problemas: r.nota.av.itens.length
  }));
}

/** Casa toda: junta a 1ª, 2ª e 3ª opção de cada cômodo. */
export async function sugerirCasa(comodos: ComodoCompleto[], moveisDe: (id: string) => Movel[], aviso?: (n: number) => void): Promise<Opcao[]> {
  const por: Record<string, Opcao[]> = {};
  const orc = Math.max(250, Math.round(1800 / Math.max(1, comodos.length)));
  for (const q of comodos) por[q.id] = await sugerirComodo(q, moveisDe(q.id), aviso, orc);
  const out: Opcao[] = [], vistos = new Set<string>();
  for (let k = 0; k < 3; k++) {
    const itens: Record<string, ItemCenario> = {}, partes: string[] = [];
    let probs = 0, algum = false;
    for (const q of comodos) {
      const ops = por[q.id];
      if (!ops.length) { for (const m of moveisDe(q.id)) itens[m.id] = { comodo: q.id, x: m.x, y: m.y, rot: normRot(m.rot) }; continue; }
      const o = ops[Math.min(k, ops.length - 1)];
      algum = true;
      Object.assign(itens, o.itens);
      probs += o.problemas;
      partes.push(`${q.nome}: ${o.titulo.charAt(0).toLowerCase() + o.titulo.slice(1)}.`);
    }
    if (!algum) break;
    const chave = JSON.stringify(itens);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ itens, titulo: tx('Casa toda', 'Whole home'), explicacao: partes.join(' '), problemas: probs });
  }
  return out;
}
