// IA: o pedido (em português simples), a leitura da resposta e a conferência de cada opção.
// Usado no servidor (IA grátis da Vercel ou Gemini) e no navegador (IA do Chrome).
import { PONTO_USA, TIPOS, ehInterruptor, horizontal, pontoDe } from './catalogo';
import { tx, type Idioma } from './i18n';
import { avaliar, folgas, folhaDe, geoEl, geoPorta, normRot, nPortasDe, prender, precisaCadeira, precisaFrente, ret, tam, temCadeiras, uv2xy, zonaAr } from './geometria';
import type { ComodoCompleto, ItemCenario, Movel, Parede, Ponto } from './tipos';

const nomeParede = (q: ComodoCompleto, p: Parede) => ({ cima: 'de cima (y=0)', baixo: `de baixo (y=${q.h})`, esquerda: 'da esquerda (x=0)', direita: `da direita (x=${q.w})` })[p];
const eixo = (p: Parede) => (horizontal(p) ? 'x' : 'y');
/** O pedido é sempre em português (só a resposta muda de idioma). */
const PONTO_IA: Record<Ponto, string> = {
  interruptor: 'interruptor', ambos: 'interruptor e tomada', tomada: 'tomada', luz: 'arandela, luz na parede',
  tv: 'ponto de TV', rede: 'ponto de internet', agua: 'ponto de água', esgoto: 'esgoto', gas: 'ponto de gás'
};

export function montarPrompt(q: ComodoCompleto, lista: Movel[], fixos: Movel[], lingua: Idioma = 'pt'): string {
  const L: string[] = [];
  L.push('Você organiza móveis em um cômodo de uma casa. Monte TRÊS opções DIFERENTES de arrumação para os móveis abaixo, pensando no uso real por uma família: passar entre os móveis, abrir as portas do cômodo e dos móveis, deitar e levantar da cama, sentar à mesa e deixar janelas, interruptores e ar-condicionado livres.');
  L.push('', `CÔMODO "${q.nome}": medidas internas ${q.w} cm de largura (eixo x, da esquerda para a direita) × ${q.h} cm de profundidade (eixo y, de cima para baixo). Origem (0,0) = canto interno de cima à esquerda. Paredes: cima (y=0), baixo (y=${q.h}), esquerda (x=0), direita (x=${q.w}).`);
  if (q.portas.length) {
    L.push('', 'PORTAS DO CÔMODO:');
    for (const p of q.portas) {
      const g = geoPorta(q, p), e = eixo(p.parede);
      if (p.semParede) L.push(`- Parede ${nomeParede(q, p.parede)}, de ${e}=${g.a} a ${e}=${g.b}: SEM PAREDE (o espaço continua no cômodo vizinho). Móveis podem ficar perto, mas deixe uma passagem de 60 cm.`);
      else if (p.abre === 'dentro') { const c = uv2xy(q, p.parede, g.hu, 0); L.push(`- "${p.nome}": parede ${nomeParede(q, p.parede)}, vão de ${e}=${g.a} a ${e}=${g.b} (${g.r} cm). Abre para DENTRO: o quarto de círculo com centro em (${c[0]}, ${c[1]}) e raio ${g.r} cm precisa ficar livre.`); }
      else L.push(`- "${p.nome}": parede ${nomeParede(q, p.parede)}, vão de ${e}=${g.a} a ${e}=${g.b} (${g.r} cm). ${p.abre === 'vao' ? 'Sem porta (passagem livre)' : 'Abre para fora'}; deixe 40 cm livres na frente do vão.`);
    }
  }
  if (q.interruptores.length) {
    L.push('', 'PONTOS NA PAREDE (interruptores, tomadas, TV, internet, água, esgoto, gás):');
    for (const i of q.interruptores) {
      const g = geoEl(q, i), e = eixo(i.parede), p = pontoDe(i), usa = PONTO_USA[p].map((t) => `tipo ${t}`).join(' ou ');
      const onde = `- "${i.nome}" (${PONTO_IA[p]}): parede ${nomeParede(q, i.parede)}, de ${e}=${g.a} a ${e}=${g.b}.`;
      if (ehInterruptor(p)) L.push(`${onde} Deixe 30 cm livres na frente dele.`);
      else L.push(`${onde} Móvel baixo pode ficar na frente; móvel alto não pode tapar${usa ? `, a não ser o que usa o ponto` : ''}.${usa && p !== 'luz' ? ` Bom lugar para móvel do ${usa} (encostado na parede, na frente do ponto).` : ''}${p === 'luz' ? ' Bom lugar para a cabeceira da cama (arandela ao lado da cabeceira).' : ''}`);
    }
  }
  if (q.janelas.length) {
    L.push('', 'JANELAS (móvel alto não pode ficar na frente):');
    for (const j of q.janelas) {
      const g = geoEl(q, j), e = eixo(j.parede), lim = j.abertura === 'abrir' ? Math.max(40, folhaDe(q, j) + 5) : 40;
      L.push(`- "${j.nome}": parede ${nomeParede(q, j.parede)}, de ${e}=${g.a} a ${e}=${g.b}. Móvel alto não pode ficar a menos de ${lim} cm dessa parede nesse trecho; móvel baixo pode.`);
    }
  }
  if (q.ares.length) {
    L.push('', 'AR-CONDICIONADO (no alto da parede):');
    for (const a of q.ares) { const z = zonaAr(q, a), e = eixo(a.parede); L.push(`- "${a.nome}": parede ${nomeParede(q, a.parede)}; área proibida para móvel alto: de ${e}=${z.a} a ${e}=${z.b}, a menos de 40 cm dessa parede.`); }
  }
  if (fixos.length) {
    L.push('', 'MÓVEIS TRAVADOS (não mexa, mas desvie deles):');
    for (const m of fixos) { const r = ret(m); L.push(`- ${m.nome}: ocupa de x=${r.x1} a x=${r.x2} e de y=${r.y1} a y=${r.y2}.`); }
  }
  L.push('', 'MÓVEIS PARA ARRUMAR (medidas fixas em cm):');
  for (const m of lista) {
    const t = TIPOS[m.tipo], need = precisaFrente(m), n = nPortasDe(m);
    let extra = '';
    if (need && m.abertura === 'abrir') extra = ` Tem ${n} ${n === 1 ? 'porta' : 'portas'} de abrir: precisa de ${need} cm livres na frente.`;
    else if (need && m.abertura === 'correr') extra = ` Portas de correr: precisa de ${need} cm livres na frente.`;
    else if (need && m.abertura === 'gavetas') extra = ` Gavetas: precisa de ${need} cm livres na frente.`;
    else if (need) extra = ` Precisa de ${need} cm livres na frente.`;
    if (temCadeiras(m)) extra += ` Vem com ${m.cadeiras} cadeira(s) ${m.ladoCadeiras === 'frente' ? 'na frente' : m.ladoCadeiras === 'dois' ? 'na frente e atrás' : 'em volta'}: cada lado com cadeira precisa de ${precisaCadeira(m)} cm livres.`;
    const tt = tam(m);
    if (tt.larg !== m.larg || tt.prof !== m.prof) extra += ` Tem baú${m.bauCab && m.bauPe ? 's na cabeceira e nos pés' : m.bauCab ? ' na cabeceira' : ' nos pés'}: o conjunto ocupa ${tt.larg} × ${tt.prof} (use essas medidas como largura × profundidade).`;
    L.push(`- id "${m.id}": ${m.nome} (tipo ${m.tipo}), ${t.a.toLowerCase()} ${m.larg} × ${t.b.toLowerCase()} ${m.prof}, alto=${m.alto}.${extra} Posição atual: x=${m.x}, y=${m.y}, rot=${normRot(m.rot)}.`);
  }
  L.push('', `POSIÇÃO: rot é 0, 90, 180 ou 270. rot=0: as costas do móvel (cabeceira da cama, fundo do armário, encosto do sofá) ficam no lado de CIMA e a frente aponta para baixo; o retângulo ocupa w = largura e h = profundidade. rot=90: costas para a DIREITA (w = profundidade, h = largura). rot=180: costas para BAIXO. rot=270: costas para a ESQUERDA (w = profundidade, h = largura). x,y = canto de cima à esquerda do retângulo, em cm inteiros, com 0 ≤ x ≤ ${q.w} − w e 0 ≤ y ≤ ${q.h} − h.`);
  L.push('', 'REGRAS, em ordem de importância:',
    '1. Nenhum móvel sobreposto a outro, nem dentro do arco de uma porta do cômodo.',
    '2. Móvel alto nunca na área do ar-condicionado nem na frente de janela.',
    '3. Não bloquear interruptores.',
    '4. Respeitar o espaço livre na frente de portas, gavetas, forno, pia, sofá e cadeiras (nunca com a frente virada para a parede).',
    '5. Cama de casal (largura 120 ou mais): cabeceira numa parede e acesso pelos dois lados compridos (60 cm ou mais de cada lado, se der).',
    '6. Caminhos de pelo menos 60 cm (ideal 80) das portas do cômodo até os móveis principais.',
    '7. Prefira os móveis encostados nas paredes, com o meio livre.',
    '8. Se houver ponto de TV, internet, água, esgoto ou gás, ponha na frente dele o móvel que usa o ponto (rack no ponto de TV, pia e máquina de lavar na água e no esgoto, fogão no gás).');
  L.push('', 'As TRÊS opções precisam ser bem diferentes entre si (por exemplo: a cama ou o sofá em outra parede).');
  L.push('', 'Responda SOMENTE com JSON, sem texto antes ou depois, neste formato, com exatamente 3 itens em "opcoes" e TODOS os móveis para arrumar em cada um:',
    '{"opcoes":[{"titulo":"até 4 palavras","moveis":[{"id":"<id>","x":0,"y":0,"rot":0}],"explicacao":"2 ou 3 frases curtas, em português simples, dizendo onde ficou cada móvel e por quê."}]}');
  if (lingua === 'en') L.push('', 'IMPORTANTE: escreva "titulo" e "explicacao" em INGLÊS simples (a pessoa usa o app em inglês). Write "titulo" and "explicacao" in plain English.');
  return L.join('\n');
}

/** Esquema da resposta (para IAs que aceitam formato fixo, como a do Chrome). */
export const ESQUEMA_RESPOSTA = {
  type: 'object',
  properties: {
    opcoes: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          explicacao: { type: 'string' },
          moveis: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, rot: { type: 'number' } }, required: ['id', 'x', 'y', 'rot'] } }
        },
        required: ['titulo', 'moveis', 'explicacao']
      }
    }
  },
  required: ['opcoes']
} as const;

/** Pega o primeiro objeto JSON de um texto (a IA às vezes escreve algo em volta). */
export function extrairJson(texto: string): unknown {
  const t = String(texto || '').replace(/```(?:json)?/gi, '');
  const i = t.indexOf('{');
  if (i < 0) return null;
  let nivel = 0, dentroStr = false, esc = false;
  for (let k = i; k < t.length; k++) {
    const ch = t[k];
    if (dentroStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') dentroStr = false; continue; }
    if (ch === '"') dentroStr = true;
    else if (ch === '{') nivel++;
    else if (ch === '}') { nivel--; if (nivel === 0) { try { return JSON.parse(t.slice(i, k + 1)); } catch { return null; } } }
  }
  return null;
}

export interface OpcaoIA { titulo: string; itens: Record<string, ItemCenario>; explicacao: string; problemas: number; listaProblemas: string[] }

/** Transforma a resposta em até 3 opções conferidas (posições trazidas para dentro do cômodo). */
export function lerOpcoesIA(q: ComodoCompleto, todos: Movel[], res: unknown): OpcaoIA[] {
  const r = res as Record<string, unknown> | null;
  let arr: unknown[] | null = r && Array.isArray(r.opcoes) ? (r.opcoes as unknown[]) : Array.isArray(res) ? (res as unknown[]) : null;
  if (!arr && r && Array.isArray(r.moveis)) arr = [r];
  if (!arr) return [];
  const out: OpcaoIA[] = [];
  for (const o0 of arr) {
    if (out.length >= 3) break;
    const o = o0 as Record<string, unknown>;
    const movs = o && Array.isArray(o.moveis) ? (o.moveis as Record<string, unknown>[]) : null;
    if (!movs || !movs.length) continue;
    const itens: Record<string, ItemCenario> = {};
    for (const i of movs) {
      const m = todos.find((x) => x.id === String(i && i.id));
      if (!m || m.fixo) continue;
      const rot = normRot(i.rot), c = prender(q, m, Number(i.x) || 0, Number(i.y) || 0, rot);
      itens[m.id] = { comodo: q.id, x: c.x, y: c.y, rot };
    }
    if (!Object.keys(itens).length) continue;
    for (const m of todos) if (!itens[m.id]) itens[m.id] = { comodo: q.id, x: m.x, y: m.y, rot: normRot(m.rot) };
    const hip = todos.map((m) => ({ ...m, ...itens[m.id] }));
    const av = avaliar(q, hip);
    out.push({
      titulo: String(o.titulo || tx('Opção ', 'Option ') + (out.length + 1)).replace(/\s+/g, ' ').trim().slice(0, 30),
      itens, explicacao: String(o.explicacao || '').slice(0, 900), problemas: av.itens.length, listaProblemas: av.problemas.slice(0, 6)
    });
  }
  return out;
}

/** Mensagem para a IA corrigir as opções que ficaram com problema. */
export function pedidoCorrecao(q: ComodoCompleto, todos: Movel[], ops: OpcaoIA[]): string {
  const L = ['Conferi as opções com as medidas. Corrija as que têm problema, mantendo as três bem diferentes, e responda de novo SOMENTE com o JSON completo das 3 opções.'];
  ops.forEach((o, k) => {
    if (!o.problemas) { L.push(`Opção ${k + 1} ("${o.titulo}"): sem problemas, pode manter.`); return; }
    L.push(`Opção ${k + 1} ("${o.titulo}"): ${o.listaProblemas.join(' ')}`);
    const hip = todos.map((m) => ({ ...m, ...o.itens[m.id] }));
    for (const m of hip) {
      const f = folgas(q, m, hip.filter((x) => x.id !== m.id));
      L.push(`  - ${m.id}: x=${m.x}, y=${m.y}, rot=${m.rot}; livre: esquerda ${Math.round(f.esq.gap)}, direita ${Math.round(f.dir.gap)}, cima ${Math.round(f.cima.gap)}, baixo ${Math.round(f.baixo.gap)} cm.`);
    }
  });
  return L.join('\n');
}

/** O que vai do navegador para o servidor (só o necessário de um cômodo). */
export interface PedidoIA { comodo: ComodoCompleto; moveis: Movel[]; idioma?: Idioma }
export interface RespostaIA { opcoes?: OpcaoIA[]; erro?: string; codigo?: string; modelo?: string }
