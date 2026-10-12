// Formulários: valores para mostrar nos campos e a validação do que foi digitado.
import { LIM_BAU, LIM_CADEIRA, LIM_COMODO, LIM_MOVEL, MAX_CADEIRAS, PAREDES, TIPOS, TIPOS_PAREDE, pontoDe } from './catalogo';
import { tx } from './i18n';
import { compParede, geoEl, normRot } from './geometria';
import type { AlinhaBau, Comodo, ElParede, LadoCadeiras, Movel, Parede, TipoMovel, TipoParede } from './tipos';
import { clamp, fmtM, parseDist, parseInteiro, parseMedida, tem } from './util';

export type Valores = Record<string, string | boolean>;
const s = (v: unknown) => String(v == null ? '' : v).trim();

export type QualBau = 'nenhum' | 'cab' | 'pe' | 'dois';
export const qualBau = (m: Pick<Movel, 'bauCab' | 'bauPe'>): QualBau => (m.bauCab && m.bauPe ? 'dois' : m.bauCab ? 'cab' : m.bauPe ? 'pe' : 'nenhum');

export function valsMovel(m: Movel): Valores {
  return {
    nome: m.nome, larg: fmtM(m.larg), prof: fmtM(m.prof), alto: m.alto, abertura: m.abertura, nPortas: m.nPortas ? String(m.nPortas) : '',
    frente: m.frente == null ? '' : String(m.frente), escada: m.escada || 'reta',
    x: String(Math.round(m.x)), y: String(Math.round(m.y)), rot: String(normRot(m.rot)), comodo: m.comodo, fixo: m.fixo,
    cadeiras: String(m.cadeiras || 0), ladoCadeiras: m.ladoCadeiras, cadLarg: fmtM(m.cadLarg), cadProf: fmtM(m.cadProf),
    bau: qualBau(m),
    bauCabLarg: fmtM(m.bauCab ? m.bauCabLarg : m.larg), bauCabProf: fmtM(m.bauCab || 40), bauCabAl: m.bauCabAl, bauCabDx: String(m.bauCabDx || 0),
    bauPeLarg: fmtM(m.bauPe ? m.bauPeLarg : m.larg), bauPeProf: fmtM(m.bauPe || 45), bauPeAl: m.bauPeAl, bauPeDx: String(m.bauPeDx || 0)
  };
}

export function valsNovoMovel(tipo: TipoMovel, r: Valores = {}): Valores {
  const t = TIPOS[tipo];
  return {
    nome: r.nome || '', larg: r.larg || '', prof: r.prof || '', alto: tem(r, 'alto') ? !!r.alto : t.alto,
    abertura: (r.abertura as string) || (t.ab ? t.ab[0] : 'nenhuma'), nPortas: r.nPortas || '', frente: r.frente || '', escada: (r.escada as string) || 'reta',
    cadeiras: (r.cadeiras as string) ?? (tipo === 'mesa' ? '1' : '0'), ladoCadeiras: (r.ladoCadeiras as string) || 'frente', cadLarg: r.cadLarg || fmtM(45), cadProf: r.cadProf || fmtM(50),
    bau: (r.bau as string) || 'nenhum', bauCabLarg: r.bauCabLarg || '', bauCabProf: r.bauCabProf || fmtM(40), bauCabAl: (r.bauCabAl as string) || 'centro', bauCabDx: r.bauCabDx || '0',
    bauPeLarg: r.bauPeLarg || '', bauPeProf: r.bauPeProf || fmtM(45), bauPeAl: (r.bauPeAl as string) || 'centro', bauPeDx: r.bauPeDx || '0'
  };
}

const alinha = (v: unknown): AlinhaBau => (v === 'esq' || v === 'dir' ? v : 'centro');

/** Confere os campos de um móvel. "atual" = o móvel sendo editado (null ao adicionar). */
export function validarMovel(v: Valores, tipo: TipoMovel, atual: Movel | null): { campos?: Partial<Movel>; erro?: string } {
  const t = TIPOS[tipo] || TIPOS.outro, c: Partial<Movel> = {};
  const caracol = tipo === 'escada' && v.escada === 'caracol';
  const larg = parseMedida(v.larg), prof = caracol ? larg : parseMedida(v.prof);
  if (!(larg >= LIM_MOVEL.min && larg <= LIM_MOVEL.max) || !(prof >= LIM_MOVEL.min && prof <= LIM_MOVEL.max))
    return { erro: tx(`Preencha as duas medidas, por exemplo ${t.exA} e ${t.exB} (ou ${parseMedida(t.exA)} e ${parseMedida(t.exB)} em cm).`, `Fill in both measurements, for example ${t.exA} and ${t.exB} (or ${parseMedida(t.exA)} and ${parseMedida(t.exB)} in cm).`) };
  c.larg = larg; c.prof = prof;
  const nome = s(v.nome).slice(0, 30);
  if (nome) c.nome = nome; else if (atual) c.nome = atual.nome;
  if (tem(v, 'alto')) c.alto = !!v.alto;
  if (t.ab) c.abertura = t.ab.includes(v.abertura as never) ? (v.abertura as Movel['abertura']) : t.ab[0];
  if (t.ab && tem(v, 'nPortas')) {
    const txt = s(v.nPortas);
    if (!txt || c.abertura !== 'abrir') c.nPortas = atual ? atual.nPortas : 0;
    else { const n = parseInteiro(txt); if (!(n != null && n >= 1 && n <= 8)) return { erro: tx('Quantas portas: de 1 a 8 (ou deixe em branco).', 'Number of doors: 1 to 8 (or leave it blank).') }; c.nPortas = n; }
  }
  if (tipo === 'escada') c.escada = caracol ? 'caracol' : 'reta';
  if (tem(v, 'frente')) {
    const txt = s(v.frente);
    if (!txt) c.frente = null;
    else {
      const n = parseDist(txt);
      if (n == null || Number.isNaN(n) || n > 300) return { erro: tx('Espaço livre na frente: em centímetros (60) ou metros (0,60), até 3 m. Em branco fica automático.', 'Front clearance: in centimeters (60) or meters (0.60), up to 3 m. Leave it blank for automatic.') };
      c.frente = n;
    }
  }
  if (tipo === 'mesa' && tem(v, 'cadeiras')) {
    const n = parseInteiro(v.cadeiras);
    if (n == null || Number.isNaN(n) || n < 0 || n > MAX_CADEIRAS) return { erro: tx(`Cadeiras: de 0 a ${MAX_CADEIRAS}.`, `Chairs: 0 to ${MAX_CADEIRAS}.`) };
    c.cadeiras = n;
    if (n > 0) {
      c.ladoCadeiras = (['frente', 'dois', 'volta'].includes(String(v.ladoCadeiras)) ? v.ladoCadeiras : 'frente') as LadoCadeiras;
      const cl = parseMedida(v.cadLarg), cp = parseMedida(v.cadProf);
      if (!(cl >= LIM_CADEIRA.min && cl <= LIM_CADEIRA.max) || !(cp >= LIM_CADEIRA.min && cp <= LIM_CADEIRA.max)) return { erro: tx('Confira o tamanho da cadeira, por exemplo 0,45 × 0,50.', `Check the chair size, for example ${fmtM(45)} × ${fmtM(50)}.`) };
      c.cadLarg = cl; c.cadProf = cp;
    }
  }
  if (tipo === 'cama' && tem(v, 'bau')) {
    const qual = String(v.bau) as QualBau;
    const um = (pre: 'Cab' | 'Pe', ligado: boolean, rot: string): string | null => {
      if (!ligado) { (c as Record<string, unknown>)['bau' + pre] = 0; return null; }
      const p = parseMedida(v[`bau${pre}Prof`]), lTxt = s(v[`bau${pre}Larg`]), l = lTxt ? parseMedida(lTxt) : larg;
      if (!(p >= LIM_BAU.min && p <= LIM_BAU.max)) return tx(`Profundidade do baú ${rot}: entre ${fmtM(LIM_BAU.min)} e ${fmtM(LIM_BAU.max)} m.`, `Chest ${rot}: the depth must be between ${fmtM(LIM_BAU.min)} and ${fmtM(LIM_BAU.max)} m.`);
      if (!(l >= LIM_MOVEL.min && l <= LIM_MOVEL.max)) return tx(`Confira a largura do baú ${rot}.`, `Check the width of the chest ${rot}.`);
      const dx = parseInteiro(v[`bau${pre}Dx`]);
      if (dx != null && (Number.isNaN(dx) || Math.abs(dx) > 200)) return tx(`Ajuste do baú ${rot}: em cm, de -200 a 200.`, `Chest ${rot}: the adjustment is in cm, from -200 to 200.`);
      Object.assign(c, { ['bau' + pre]: p, [`bau${pre}Larg`]: l, [`bau${pre}Al`]: alinha(v[`bau${pre}Al`]), [`bau${pre}Dx`]: dx || 0 });
      return null;
    };
    const e1 = um('Cab', qual === 'cab' || qual === 'dois', tx('da cabeceira', 'at the headboard')); if (e1) return { erro: e1 };
    const e2 = um('Pe', qual === 'pe' || qual === 'dois', tx('dos pés', 'at the foot')); if (e2) return { erro: e2 };
  }
  return { campos: c };
}

export function valsParede(q: Comodo, e: ElParede): Valores {
  const g = geoEl(q, e);
  return {
    nome: e.nome, parede: e.parede, largura: fmtM(g.b - g.a), dist: fmtM(g.a), inicioCm: String(Math.round(g.a)),
    dobradica: e.dobradica || 'a', abre: e.abre || 'dentro', abertura: e.abertura || 'correr', folhas: String(e.folhas || 2), folga: fmtM(e.folga || 0),
    ponto: pontoDe(e)
  };
}

export function valsNovaParede(tipo: TipoParede, q: Comodo | null, ctx: { parede?: Parede; u?: number } | null, r: Valores = {}): Valores {
  const tp = TIPOS_PAREDE[tipo], parede = (r.parede as Parede) || (ctx && ctx.parede) || tp.parede;
  let dist = (r.dist as string) ?? '';
  if (r.dist == null && ctx && ctx.parede && ctx.u != null && q) { const L = compParede(q, ctx.parede); dist = fmtM(clamp(Math.round(ctx.u - tp.larg / 2), 0, Math.max(0, L - tp.larg))); }
  return {
    nome: r.nome || '', parede, largura: r.largura || '', dist, dobradica: r.dobradica || 'a', abre: r.abre || 'dentro',
    abertura: r.abertura || 'correr', folhas: r.folhas || '2', folga: r.folga || '', ponto: r.ponto || 'interruptor'
  };
}

export function validarParede(v: Valores, tipo: TipoParede, q: Comodo, atual: ElParede | null): { campos?: Partial<ElParede>; erro?: string } {
  const tp = TIPOS_PAREDE[tipo], c: Partial<ElParede> = {};
  const parede = (PAREDES.includes(v.parede as Parede) ? v.parede : atual ? atual.parede : tp.parede) as Parede, L = compParede(q, parede);
  let larg: number;
  if (tipo === 'interruptor') larg = atual ? atual.largura : tp.larg;
  else { const b = s(v.largura); larg = b ? parseMedida(b) : atual ? Math.min(atual.largura, L) : Math.min(tp.larg, L); }
  const mx = Math.min(tp.max, L);
  if (!(larg >= tp.min && larg <= mx)) return { erro: tx(`Use uma largura entre ${fmtM(tp.min)} e ${fmtM(mx)} m.`, `Use a width between ${fmtM(tp.min)} and ${fmtM(mx)} m.`) };
  const d = parseDist(v.dist);
  if (d != null && Number.isNaN(d)) return { erro: tx('Confira a distância do canto, por exemplo 0,80. Em branco fica no meio.', `Check the distance from the corner, for example ${fmtM(80)}. Leave it blank to center it.`) };
  Object.assign(c, { parede, largura: larg, inicio: Math.round(clamp(d == null ? (L - larg) / 2 : d, 0, L - larg)) });
  const nome = s(v.nome).slice(0, 30);
  if (nome) c.nome = nome;
  if (tipo === 'porta') { c.dobradica = v.dobradica === 'b' ? 'b' : 'a'; c.abre = v.abre === 'fora' || v.abre === 'vao' ? v.abre : 'dentro'; }
  if (tipo === 'janela') { c.abertura = v.abertura === 'abrir' ? 'abrir' : 'correr'; c.folhas = v.folhas === '1' ? 1 : 2; }
  if (tipo === 'interruptor') c.ponto = pontoDe(v);
  if (tipo === 'ar') {
    const f = parseDist(v.folga);
    if ((f != null && Number.isNaN(f)) || (f != null && f > 200)) return { erro: tx('Confira a área livre de cada lado, por exemplo 0,30.', `Check the free space on each side, for example ${fmtM(30)}.`) };
    c.folga = f == null ? 30 : f;
  }
  return { campos: c };
}

export function validarComodo(v: Valores): { campos?: { nome: string; w: number; h: number }; erro?: string } {
  const w = parseMedida(v.w), h = parseMedida(v.h), nome = s(v.nome).slice(0, 30);
  if (!(w >= LIM_COMODO.min && w <= LIM_COMODO.max) || !(h >= LIM_COMODO.min && h <= LIM_COMODO.max))
    return { erro: tx(`Preencha largura e comprimento, por exemplo 3,00 e 4,00 (entre ${fmtM(LIM_COMODO.min)} e ${fmtM(LIM_COMODO.max)} m).`, `Fill in width and length, for example ${fmtM(300)} and ${fmtM(400)} (between ${fmtM(LIM_COMODO.min)} and ${fmtM(LIM_COMODO.max)} m).`) };
  return { campos: { nome, w, h } };
}
