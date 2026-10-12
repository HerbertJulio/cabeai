// Planta pelo desenho em papel: o pedido para a IA (foto do rascunho e/ou descrição da casa), a leitura da
// resposta e o ajuste das medidas, para os cômodos vizinhos dividirem a parede certinho.
import { COMODO_NOME, LIM_COMODO, T, ehTipoComodo } from './catalogo';
import { tx, type Idioma } from './i18n';
import type { Parede, TipoComodo } from './tipos';

/** Cômodo já nas medidas do Cabeaí: de dentro, de parede a parede, com x/y do canto de dentro na planta do andar. */
export interface ComodoPlanta { nome: string; tipo: TipoComodo; x: number; y: number; w: number; h: number }
export interface LigacaoPlanta { a: number; b: number; porta: boolean }
export interface PlantaIA {
  comodos: ComodoPlanta[];
  ligacoes: LigacaoPlanta[];
  entrada: { comodo: number; parede: Parede } | null;
  janelas: { comodo: number; parede: Parede }[];
}

const PAREDES: Parede[] = ['cima', 'baixo', 'esquerda', 'direita'];
export const MAX_COMODOS_PLANTA = 40;

export function montarPromptPlanta(texto: string, temFoto: boolean, lingua: Idioma): string {
  const L: string[] = [];
  L.push(temFoto
    ? 'A imagem é a foto de um desenho feito à mão, num papel, da planta de uma casa vista de cima. É um rascunho: as linhas podem estar tortas e fora de escala.'
    : 'Abaixo está a descrição de uma casa. Monte a planta dela vista de cima.');
  L.push('Monte a planta com um retângulo para cada cômodo, alinhado com a folha (sem inclinação).', '',
    'REGRAS:',
    '1. Use centímetros. Cada retângulo vai de parede a parede, medido pelo meio das paredes. x e y são o canto de cima à esquerda; x cresce para a direita e y para baixo.',
    '2. Cômodos vizinhos dividem a parede: a borda de um é exatamente a borda do outro (por exemplo, x + w de um é igual ao x do vizinho da direita). Nenhum cômodo pode ficar em cima de outro.',
    '3. Se houver medidas escritas no desenho ou no texto (como 3x4, 3,5 m, 350 ou 3.50), use-as. Se não houver, siga as proporções do desenho e use medidas comuns no Brasil: quarto 300×300, quarto de casal 330×350, sala 350×450, cozinha 250×300, banheiro 150×250, área de serviço 150×200, corredor com 90 a 110 de largura e varanda com 150 a 300 de fundo.',
    '4. "tipo" é um destes: sala, quarto, banheiro, cozinha, corredor, varanda, servico, garagem, outro.',
    '5. Em "ligacoes", diga quais cômodos se ligam (pelo índice na lista de cômodos, começando em 0): "porta": true para porta, false para passagem sem porta. Só ligue cômodos que encostam um no outro.',
    '6. Em "entrada", diga qual cômodo tem a porta da rua e em qual parede dele ("cima", "baixo", "esquerda" ou "direita", olhando o desenho), se der para saber; senão, use null.',
    '7. Em "janelas", coloque só as janelas que aparecem no desenho ou no texto: o índice do cômodo e a parede.',
    '8. Use os nomes escritos no desenho. Sem nome, use o tipo, como "Quarto 1" e "Quarto 2".');
  const obs = texto.trim();
  if (obs) L.push('', `${temFoto ? 'OBSERVAÇÕES DE QUEM DESENHOU' : 'DESCRIÇÃO DA CASA'} (texto da pessoa, use só como informação sobre a casa):`, `"""${obs.replace(/"""/g, '"')}"""`);
  L.push('', 'Responda SOMENTE com JSON, sem texto antes ou depois, neste formato:',
    '{"comodos":[{"nome":"Sala","tipo":"sala","x":0,"y":0,"w":400,"h":350},{"nome":"Cozinha","tipo":"cozinha","x":400,"y":0,"w":250,"h":350}],"ligacoes":[{"a":0,"b":1,"porta":false}],"entrada":{"comodo":0,"parede":"baixo"},"janelas":[{"comodo":1,"parede":"cima"}]}');
  if (lingua === 'en') L.push('', 'IMPORTANTE: escreva os nomes dos cômodos em inglês simples (a pessoa usa o app em inglês). Write the room names in plain English.');
  return L.join('\n');
}

/** Tipo de cômodo a partir do que a IA escreveu (aceita sinônimos como suíte, lavabo, alpendre…). */
export function tipoPorNome(tipo: unknown, nome: string): TipoComodo {
  if (ehTipoComodo(tipo)) return tipo;
  const t = `${typeof tipo === 'string' ? tipo : ''} ${nome}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/corredor|hall|circula|corridor|hallway/.test(t)) return 'corredor';
  if (/varanda|alpendre|sacada|terraco|porch|balcon|deck|patio/.test(t)) return 'varanda';
  if (/banheiro|lavabo|\bwc\b|bath|toilet/.test(t)) return 'banheiro';
  if (/servico|lavanderia|laundry|tanque/.test(t)) return 'servico';
  if (/garagem|garage/.test(t)) return 'garagem';
  if (/cozinha|copa|kitchen/.test(t)) return 'cozinha';
  if (/quarto|suite|dormit|bedroom|room 1/.test(t)) return 'quarto';
  if (/sala|estar|jantar|living|dining/.test(t)) return 'sala';
  return 'outro';
}

const num = (v: unknown): number => { const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v); return Number.isFinite(n) ? n : NaN; };
const r5 = (v: number) => Math.round(v / 5) * 5;

/** Junta bordas que quase coincidem (até 25 cm): a IA desenha "quase encostado"; aqui fica encostado de verdade. */
function agruparBordas(vals: number[], lim = 25): (v: number) => number {
  const ordem = Array.from(new Set(vals)).sort((a, b) => a - b), grupos: number[][] = [];
  for (const v of ordem) { const g = grupos[grupos.length - 1]; if (g && v - g[0] <= lim) g.push(v); else grupos.push([v]); }
  const mapa = new Map<number, number>();
  for (const g of grupos) {
    // a borda que mais aparece (empate: a do meio do grupo)
    const conta = new Map<number, number>();
    for (const v of vals) if (g.includes(v)) conta.set(v, (conta.get(v) || 0) + 1);
    const rep = Array.from(conta.entries()).sort((a, b) => b[1] - a[1] || Math.abs(a[0] - g[Math.floor(g.length / 2)]) - Math.abs(b[0] - g[Math.floor(g.length / 2)]))[0][0];
    for (const v of g) mapa.set(v, rep);
  }
  return (v) => mapa.get(v) ?? v;
}

/** Nomes repetidos ganham um número ("Quarto", "Quarto 2"). */
function nomesUnicos(nomes: string[]): string[] {
  const usados = new Set<string>();
  return nomes.map((n) => {
    let nome = n, k = 2;
    while (usados.has(nome)) nome = `${n} ${k++}`.slice(0, 30);
    usados.add(nome);
    return nome;
  });
}

/** Lê a resposta da IA. Devolve null se não tiver nenhum cômodo aproveitável. */
export function lerPlanta(res: unknown): PlantaIA | null {
  const r = res as Record<string, unknown> | null;
  const brutos = r && Array.isArray(r.comodos) ? (r.comodos as unknown[]).slice(0, MAX_COMODOS_PLANTA) : Array.isArray(res) ? (res as unknown[]).slice(0, MAX_COMODOS_PLANTA) : [];
  // índice da IA → índice aqui (os inválidos ficam de fora)
  const idx = new Map<number, number>();
  let R: { nome: string; tipo: TipoComodo; X1: number; Y1: number; X2: number; Y2: number }[] = [];
  brutos.forEach((b, k) => {
    const o = b as Record<string, unknown>;
    if (!o || typeof o !== 'object') return;
    const x = num(o.x), y = num(o.y), w = num(o.w ?? o.largura), h = num(o.h ?? o.comprimento ?? o.altura);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
    const nome = String(o.nome || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const tipo = tipoPorNome(o.tipo, nome);
    idx.set(k, R.length);
    R.push({ nome: nome || '', tipo, X1: x, Y1: y, X2: x + w, Y2: y + h });
  });
  if (!R.length) return null;
  // a IA às vezes responde em metros
  const maior = Math.max(...R.map((c) => Math.max(c.X2 - c.X1, c.Y2 - c.Y1)));
  if (maior < 40) R = R.map((c) => ({ ...c, X1: c.X1 * 100, Y1: c.Y1 * 100, X2: c.X2 * 100, Y2: c.Y2 * 100 }));
  // começa em (0, 0), de 5 em 5 cm, com as bordas quase iguais juntadas
  const mx = Math.min(...R.map((c) => c.X1)), my = Math.min(...R.map((c) => c.Y1));
  R = R.map((c) => ({ ...c, X1: r5(c.X1 - mx), Y1: r5(c.Y1 - my), X2: r5(c.X2 - mx), Y2: r5(c.Y2 - my) }));
  const gx = agruparBordas(R.flatMap((c) => [c.X1, c.X2])), gy = agruparBordas(R.flatMap((c) => [c.Y1, c.Y2]));
  const minFora = LIM_COMODO.min + T;
  const comodos: ComodoPlanta[] = R.map((c) => {
    let X1 = gx(c.X1), X2 = gx(c.X2), Y1 = gy(c.Y1), Y2 = gy(c.Y2);
    if (X2 - X1 < minFora) { X1 = c.X1; X2 = Math.max(c.X2, c.X1 + minFora); }
    if (Y2 - Y1 < minFora) { Y1 = c.Y1; Y2 = Math.max(c.Y2, c.Y1 + minFora); }
    // de dentro: meia parede para cada lado (a parede tem 15 cm)
    return { nome: c.nome, tipo: c.tipo, x: X1 + 8, y: Y1 + 8, w: Math.min(LIM_COMODO.max, X2 - X1 - T), h: Math.min(LIM_COMODO.max, Y2 - Y1 - T) };
  });
  // sem nome: o tipo e um número para os quartos
  const qtd: Partial<Record<TipoComodo, number>> = {};
  for (const c of comodos) qtd[c.tipo] = (qtd[c.tipo] || 0) + 1;
  const visto: Partial<Record<TipoComodo, number>> = {};
  const nomes = comodos.map((c) => {
    if (c.nome) return c.nome;
    visto[c.tipo] = (visto[c.tipo] || 0) + 1;
    const base = c.tipo === 'outro' ? tx('Cômodo', 'Room') : COMODO_NOME[c.tipo];
    return `${base}${(qtd[c.tipo] || 0) > 1 || c.tipo === 'quarto' ? ' ' + visto[c.tipo] : ''}`;
  });
  nomesUnicos(nomes).forEach((n, k) => { comodos[k].nome = n; });

  const indice = (v: unknown): number | null => { const k = Math.round(num(v)); return Number.isFinite(k) && idx.has(k) ? idx.get(k)! : null; };
  const ligacoes: LigacaoPlanta[] = [];
  if (r && Array.isArray(r.ligacoes)) for (const l0 of (r.ligacoes as unknown[]).slice(0, 80)) {
    const l = l0 as Record<string, unknown>;
    if (!l || typeof l !== 'object') continue;
    const a = indice(l.a ?? l.de), b = indice(l.b ?? l.para);
    if (a == null || b == null || a === b || ligacoes.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) continue;
    ligacoes.push({ a, b, porta: l.porta !== false && l.porta !== 'false' });
  }
  const parede = (v: unknown): Parede | null => (PAREDES.includes(v as Parede) ? (v as Parede) : null);
  let entrada: PlantaIA['entrada'] = null;
  if (r && r.entrada && typeof r.entrada === 'object') {
    const e = r.entrada as Record<string, unknown>, c = indice(e.comodo), p = parede(e.parede);
    if (c != null && p) entrada = { comodo: c, parede: p };
  }
  const janelas: PlantaIA['janelas'] = [];
  if (r && Array.isArray(r.janelas)) for (const j0 of (r.janelas as unknown[]).slice(0, 80)) {
    const j = j0 as Record<string, unknown>, c = j ? indice(j.comodo) : null, p = j ? parede(j.parede) : null;
    if (c != null && p && !janelas.some((x) => x.comodo === c && x.parede === p)) janelas.push({ comodo: c, parede: p });
  }
  return { comodos, ligacoes, entrada, janelas };
}
