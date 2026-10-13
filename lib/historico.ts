// Histórico: desfazer e refazer nesta sessão (cada passo com um nome do que mudou) e os pontos de restauração,
// que guardam a casa inteira no navegador para voltar depois (automáticos e os que a pessoa cria).
import { PAREDE_OPOSTA } from './casa';
import { normalizarDados } from './dados';
import { tx } from './i18n';
import type { Dados, ElParede, Movel } from './tipos';
import { fmtM, minuscula, novoId, pl } from './util';

/* ---------- o nome de cada mudança ---------- */
const nomeEl = (e: ElParede) => (e.semParede ? tx('o corte da parede', 'the wall cut') : e.nome);

/** Descreve o que mudou de "a" para "b" numa frase curta ("Moveu Cama", "Tirou a parede…", "Moveu Sala e mais 2"). */
export function descreverMudanca(a: Dados, b: Dados): string {
  const casa: string[] = [], itens: string[] = [], cenarios: string[] = [];
  const mexidos = new Set<string>(); // cômodos que mudaram inteiros (o que está dentro deles não conta à parte)
  const ta = a.terreno, tb = b.terreno;
  if (ta !== tb) {
    if (!ta && tb) casa.push(tx(`Terreno de ${fmtM(tb.w)} × ${fmtM(tb.h)} m`, `${fmtM(tb.w)} × ${fmtM(tb.h)} m plot`));
    else if (ta && !tb) casa.push(tx('Tirou o terreno', 'Removed the plot'));
    else if (ta && tb && JSON.stringify(ta) !== JSON.stringify(tb)) casa.push(tx('Mudou o terreno', 'Changed the plot'));
  }
  for (const id in b.andares) { const x = a.andares[id], y = b.andares[id]; if (!x) casa.push(tx(`Novo andar: ${y.nome}`, `New floor: ${y.nome}`)); else if (x !== y && x.nome !== y.nome) casa.push(tx(`Renomeou ${x.nome} para ${y.nome}`, `Renamed ${x.nome} to ${y.nome}`)); }
  for (const id in a.andares) if (!b.andares[id]) casa.push(tx(`Removeu ${a.andares[id].nome}`, `Removed ${a.andares[id].nome}`));
  const mesmoComodo = (x: Dados['comodos'][string], y: Dados['comodos'][string]) =>
    x === y || (x.nome === y.nome && x.andar === y.andar && x.w === y.w && x.h === y.h && x.x === y.x && x.y === y.y && x.tipo === y.tipo && !!x.corredor === !!y.corredor);
  for (const id in b.comodos) {
    const x = a.comodos[id], y = b.comodos[id];
    if (!x) { casa.push(tx(`Novo cômodo: ${y.nome}`, `New room: ${y.nome}`)); mexidos.add(id); continue; }
    if (mesmoComodo(x, y)) continue;
    mexidos.add(id);
    if (x.nome !== y.nome) casa.push(tx(`Renomeou ${x.nome} para ${y.nome}`, `Renamed ${x.nome} to ${y.nome}`));
    else if (x.andar !== y.andar) casa.push(tx(`Levou ${y.nome} para ${b.andares[y.andar]?.nome || 'outro andar'}`, `Moved ${y.nome} to ${b.andares[y.andar]?.nome || 'another floor'}`));
    else if (x.w === y.h && x.h === y.w && x.w !== x.h) casa.push(tx(`Girou ${y.nome}`, `Rotated ${y.nome}`));
    else if (x.w !== y.w || x.h !== y.h) casa.push(tx(`Mudou o tamanho de ${y.nome}`, `Resized ${y.nome}`));
    else if (x.x !== y.x || x.y !== y.y) casa.push(tx(`Moveu ${y.nome} na planta`, `Moved ${y.nome} on the plan`));
    else casa.push(tx(`Mudou ${y.nome}`, `Changed ${y.nome}`));
  }
  for (const id in a.comodos) if (!b.comodos[id]) { casa.push(tx(`Removeu ${a.comodos[id].nome}`, `Removed ${a.comodos[id].nome}`)); mexidos.add(id); }
  const doMexido = (comodo: string) => mexidos.has(comodo);
  const frase = (x: Movel | ElParede | undefined, y: Movel | ElParede, movel: boolean): string | null => {
    if (!x) return tx(`Adicionou ${y.nome}`, `Added ${y.nome}`);
    if (x === y || JSON.stringify(x) === JSON.stringify(y)) return null;
    if (x.comodo !== y.comodo) {
      // a porta da parede dividida que passou a ser medida pelo outro lado continua na mesma parede
      const e0 = x as ElParede, e1 = y as ElParede, c0 = a.comodos[e0.comodo], c1 = b.comodos[e1.comodo];
      if (!movel && e0.tipo === 'porta' && e1.tipo === 'porta' && c0 && c1 && PAREDE_OPOSTA[e0.parede] === e1.parede) {
        const naPlanta = (c: typeof c0, e: ElParede) => (e.parede === 'cima' || e.parede === 'baixo' ? c.x : c.y) + e.inicio;
        return Math.abs(naPlanta(c0, e0) - naPlanta(c1, e1)) > 0.5 || e0.largura !== e1.largura ? tx(`Moveu ${nomeEl(e1)}`, `Moved ${nomeEl(e1)}`) : tx(`Mudou ${nomeEl(e1)}`, `Changed ${nomeEl(e1)}`);
      }
      return tx(`Levou ${y.nome} para ${b.comodos[y.comodo]?.nome || ''}`, `Moved ${y.nome} to ${b.comodos[y.comodo]?.nome || ''}`);
    }
    if (x.nome !== y.nome) return tx(`Renomeou ${x.nome} para ${y.nome}`, `Renamed ${x.nome} to ${y.nome}`);
    if (movel) {
      const m0 = x as Movel, m1 = y as Movel;
      if (m0.rot !== m1.rot) return tx(`Girou ${m1.nome}`, `Rotated ${m1.nome}`);
      if (m0.x !== m1.x || m0.y !== m1.y) return tx(`Moveu ${m1.nome}`, `Moved ${m1.nome}`);
      if (m0.fixo !== m1.fixo) return m1.fixo ? tx(`Travou ${m1.nome}`, `Locked ${m1.nome}`) : tx(`Destravou ${m1.nome}`, `Unlocked ${m1.nome}`);
      return tx(`Mudou ${m1.nome}`, `Changed ${m1.nome}`);
    }
    const e0 = x as ElParede, e1 = y as ElParede;
    if (e0.parede === e1.parede && e0.largura === e1.largura && e0.inicio !== e1.inicio) return tx(`Moveu ${nomeEl(e1)}`, `Moved ${nomeEl(e1)}`);
    return tx(`Mudou ${nomeEl(e1)}`, `Changed ${nomeEl(e1)}`);
  };
  let movidos = 0;
  for (const id in b.moveis) {
    const x = a.moveis[id], y = b.moveis[id];
    if (doMexido(y.comodo) && (!x || x.comodo === y.comodo)) continue;
    const f = frase(x, y, true);
    if (f) { itens.push(f); if (x && (x.x !== y.x || x.y !== y.y || x.rot !== y.rot)) movidos++; }
  }
  for (const id in a.moveis) if (!b.moveis[id] && !doMexido(a.moveis[id].comodo)) itens.push(tx(`Removeu ${a.moveis[id].nome}`, `Removed ${a.moveis[id].nome}`));
  for (const id in b.els) {
    const x = a.els[id], y = b.els[id];
    if (doMexido(y.comodo) && (!x || x.comodo === y.comodo)) continue;
    const f = frase(x, y, false);
    if (f) itens.push(f);
  }
  for (const id in a.els) if (!b.els[id] && !doMexido(a.els[id].comodo)) itens.push(tx(`Removeu ${a.els[id].nome}`, `Removed ${a.els[id].nome}`));
  let sugestoes = false;
  for (const id in b.cenarios) {
    const x = a.cenarios[id], y = b.cenarios[id];
    if (!x) { if (y.sugestao) sugestoes = true; else cenarios.push(tx(`Salvou o cenário “${y.nome}”`, `Saved the scenario “${y.nome}”`)); }
    else if (x !== y && JSON.stringify(x) !== JSON.stringify(y)) cenarios.push(x.sugestao && !y.sugestao ? tx(`Guardou “${y.nome}”`, `Kept “${y.nome}”`) : x.nome !== y.nome ? tx(`Renomeou o cenário “${y.nome}”`, `Renamed the scenario “${y.nome}”`) : tx(`Atualizou o cenário “${y.nome}”`, `Updated the scenario “${y.nome}”`));
  }
  for (const id in a.cenarios) if (!b.cenarios[id] && !a.cenarios[id].sugestao) cenarios.push(tx(`Apagou o cenário “${a.cenarios[id].nome}”`, `Deleted the scenario “${a.cenarios[id].nome}”`));
  if (sugestoes) cenarios.push(tx('Novas sugestões', 'New suggestions'));
  let partes = [...new Set(casa.length ? casa : itens.length ? itens : cenarios)];
  if (!casa.length && movidos > 3 && movidos >= itens.length - 1) partes = [tx(`Mudou a arrumação (${pl(movidos, 'móvel', 'móveis')})`, `Changed the layout (${pl(movidos, 'item', 'items')})`)];
  if (!partes.length) return tx('Alteração', 'Change');
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[0]} ${tx('e', 'and')} ${minuscula(partes[1])}`;
  return tx(`${partes[0]} e mais ${partes.length - 1}`, `${partes[0]} and ${partes.length - 1} more`);
}

/* ---------- desfazer e refazer ---------- */
export interface Passo { rotulo: string; t: number; antes: Dados; depois: Dados }
export interface InfoPasso { rotulo: string; t: number }

/** Guarda as versões dos dados. Mudanças seguidas (um arraste, várias setas do teclado) viram um passo só:
 *  o passo fecha quando o gesto termina ou depois de um instante sem mudar nada. */
export class Historico {
  private passado: Passo[] = [];
  private futuro: Passo[] = [];
  private base: Dados | null = null;
  private atual: Dados | null = null;
  private rotulo: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private contador = 0;
  constructor(private aoMudar: (lista: boolean) => void, private max = 100, private espera = 450) {}
  /** Muda a cada passo novo, desfeito ou refeito (para saber se o "Desfazer" de um aviso ainda é daquele passo). */
  get marca(): number { return this.contador; }

  private parar() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
  iniciar(d: Dados) { this.parar(); this.passado = []; this.futuro = []; this.base = this.atual = d; this.rotulo = null; this.contador++; this.aoMudar(true); }
  /** Os dados mudaram (por qualquer motivo que não seja desfazer ou refazer). */
  registrar(d: Dados, gesto: boolean) {
    if (!this.base) { this.base = this.atual = d; return; }
    this.atual = d;
    this.parar();
    if (!gesto) this.timer = setTimeout(() => this.confirmar(), this.espera);
    this.aoMudar(false);
  }
  fimGesto() { this.parar(); this.timer = setTimeout(() => this.confirmar(), 0); }
  /** O próximo passo terá este nome (o que estava pendente fecha antes, com o nome dele). */
  anotar(r: string) { this.confirmar(); this.rotulo = r; }
  esquecerRotulo() { this.rotulo = null; }
  confirmar() {
    this.parar();
    if (!this.base || !this.atual || this.atual === this.base) return;
    this.passado.push({ rotulo: this.rotulo || descreverMudanca(this.base, this.atual), t: Date.now(), antes: this.base, depois: this.atual });
    if (this.passado.length > this.max) this.passado.splice(0, this.passado.length - this.max);
    this.futuro = []; this.base = this.atual; this.rotulo = null; this.contador++;
    this.aoMudar(true);
  }
  get podeDesfazer(): boolean { return this.passado.length > 0 || (!!this.base && this.atual !== this.base); }
  get podeRefazer(): boolean { return this.futuro.length > 0 && this.atual === this.base; }
  desfazer(): Passo | null {
    this.confirmar();
    const p = this.passado.pop(); if (!p) return null;
    this.futuro.push(p); this.base = this.atual = p.antes; this.contador++;
    this.aoMudar(true);
    return p;
  }
  refazer(): Passo | null {
    this.confirmar();
    const p = this.futuro.pop(); if (!p) return null;
    this.passado.push(p); this.base = this.atual = p.depois; this.contador++;
    this.aoMudar(true);
    return p;
  }
  /** Os passos para a tela: os feitos (do mais novo ao mais velho) e os desfeitos que ainda dá para refazer. */
  lista(): { feitos: InfoPasso[]; desfeitos: InfoPasso[] } {
    return {
      feitos: this.passado.map(({ rotulo, t }) => ({ rotulo, t })).reverse(),
      desfeitos: this.futuro.map(({ rotulo, t }) => ({ rotulo, t })).reverse()
    };
  }
}

/* ---------- pontos de restauração (no navegador) ---------- */
export interface PontoRestauracao { id: string; t: number; nome: string; auto: boolean; resumo: string; dados: Dados }
export type InfoPonto = Omit<PontoRestauracao, 'dados'>;
export const CHAVE_PONTOS = 'cabeai:pontos';
const MAX_AUTO = 12, MAX_MANUAL = 12, MAX_TEXTO = 1_500_000;

export const resumoDados = (d: Dados): string =>
  `${pl(Object.keys(d.comodos).length, tx('cômodo', 'room'), tx('cômodos', 'rooms'))} · ${pl(Object.keys(d.moveis).length, tx('móvel', 'item'), tx('móveis', 'items'))}`;

export function novoPonto(d: Dados, nome: string, auto: boolean): PontoRestauracao {
  return { id: novoId('r'), t: Date.now(), nome: nome.trim().slice(0, 60) || tx('Ponto de restauração', 'Restore point'), auto, resumo: resumoDados(d), dados: d };
}

export function lerPontos(texto: string | null): PontoRestauracao[] {
  try {
    const o = JSON.parse(texto || '[]');
    if (!Array.isArray(o)) return [];
    return o.filter((p) => p && typeof p.id === 'string' && typeof p.t === 'number' && p.dados && typeof p.dados === 'object')
      .map((p) => ({ id: String(p.id), t: Number(p.t), nome: String(p.nome || '').slice(0, 60), auto: !!p.auto, resumo: String(p.resumo || ''), dados: normalizarDados(p.dados) }))
      .sort((a, b) => b.t - a.t);
  } catch { return []; }
}

/** Os pontos que ficam: até 12 automáticos e 12 da pessoa, e no máximo 1,5 milhão de letras (saem os mais velhos, os automáticos primeiro). */
export function aparar(ps: PontoRestauracao[]): { lista: PontoRestauracao[]; texto: string } {
  const ord = ps.slice().sort((a, b) => b.t - a.t);
  let lista = [...ord.filter((p) => !p.auto).slice(0, MAX_MANUAL), ...ord.filter((p) => p.auto).slice(0, MAX_AUTO)].sort((a, b) => b.t - a.t);
  let texto = JSON.stringify(lista);
  while (texto.length > MAX_TEXTO && lista.length > 1) {
    const velho = [...lista].reverse().find((p) => p.auto) || lista[lista.length - 1];
    lista = lista.filter((p) => p !== velho);
    texto = JSON.stringify(lista);
  }
  return { lista, texto };
}
