// Catálogo: tipos de móvel, itens de parede e nomes das paredes.
import { bilingue, registro, tx } from './i18n';
import type { Abertura, FormaEscada, JeitoPorta, LadoCadeiras, Parede, Ponto, TipoComodo, TipoMovel, TipoParede } from './tipos';
import { fmtM, tem } from './util';

export interface InfoTipo {
  rot: string;
  chip: string;
  novo: string;
  /** Rótulos das duas medidas. */
  a: string;
  b: string;
  alto: boolean;
  /** Exemplos de medida (já no formato do idioma, "1,62" ou "1.62"). */
  exA: string;
  exB: string;
  /** Jeitos de abrir que o móvel pode ter (o primeiro é o padrão). */
  ab?: Abertura[];
  /** Espaço livre mínimo na frente para usar o móvel (cm). */
  frente?: number;
  /** O que a pessoa faz na frente (para as mensagens). */
  uso?: string;
  grupo: 'quarto' | 'sala' | 'cozinha' | 'banheiro' | 'outro';
}

type TextosTipo = { rot: string; chip: string; novo: string; a: string; b: string; uso?: string };
function tipo(pt: TextosTipo, en: TextosTipo, d: { alto: boolean; ea: number; eb: number; ab?: Abertura[]; frente?: number; grupo: InfoTipo['grupo'] }): InfoTipo {
  const { ea, eb, ...resto } = d;
  const o = bilingue<InfoTipo, keyof TextosTipo>(resto as Omit<InfoTipo, keyof TextosTipo>, pt, en);
  Object.defineProperty(o, 'exA', { get: () => fmtM(ea), enumerable: true });
  Object.defineProperty(o, 'exB', { get: () => fmtM(eb), enumerable: true });
  return o;
}
const LARG = { a: 'Largura', b: 'Profundidade' }, WIDTH = { a: 'Width', b: 'Depth' };
const FRENTE_PT = { a: 'Largura (frente)', b: 'Profundidade' }, FRENTE_EN = { a: 'Width (front)', b: 'Depth' };
const COMPR = { a: 'Largura', b: 'Comprimento' }, LENGTH = { a: 'Width', b: 'Length' };
/** Banheira: o comprimento fica ao longo da parede (é a frente). */
const BANHEIRA_PT = { a: 'Comprimento', b: 'Largura' }, BANHEIRA_EN = { a: 'Length', b: 'Width' };

export const TIPOS: Record<TipoMovel, InfoTipo> = {
  'cama': tipo({ rot: 'Cama', chip: 'Cama', novo: 'Nova cama', ...COMPR }, { rot: 'Bed', chip: 'Bed', novo: 'New bed', ...LENGTH }, { alto: false, ea: 162, eb: 202, grupo: 'quarto' }),
  'guarda-roupa': tipo({ rot: 'Guarda-roupa', chip: 'Guarda-roupa', novo: 'Novo guarda-roupa', ...FRENTE_PT }, { rot: 'Wardrobe', chip: 'Wardrobe', novo: 'New wardrobe', ...FRENTE_EN }, { alto: true, ea: 180, eb: 55, ab: ['abrir', 'correr'], grupo: 'quarto' }),
  'berco': tipo({ rot: 'Berço', chip: 'Berço', novo: 'Novo berço', ...COMPR }, { rot: 'Crib', chip: 'Crib', novo: 'New crib', ...LENGTH }, { alto: false, ea: 70, eb: 130, grupo: 'quarto' }),
  'comoda': tipo({ rot: 'Cômoda', chip: 'Cômoda', novo: 'Nova cômoda', ...FRENTE_PT }, { rot: 'Dresser', chip: 'Dresser', novo: 'New dresser', ...FRENTE_EN }, { alto: false, ea: 100, eb: 45, ab: ['gavetas', 'abrir'], grupo: 'quarto' }),
  'cabeceira': tipo({ rot: 'Criado-mudo', chip: 'Criado-mudo', novo: 'Novo criado-mudo', ...LARG }, { rot: 'Nightstand', chip: 'Nightstand', novo: 'New nightstand', ...WIDTH }, { alto: false, ea: 45, eb: 40, grupo: 'quarto' }),
  'mesa': tipo({ rot: 'Mesa', chip: 'Mesa', novo: 'Nova mesa', ...LARG }, { rot: 'Table', chip: 'Table / desk', novo: 'New table', ...WIDTH }, { alto: false, ea: 100, eb: 50, grupo: 'sala' }),
  'cadeira': tipo({ rot: 'Cadeira', chip: 'Cadeira', novo: 'Nova cadeira', ...LARG }, { rot: 'Chair', chip: 'Chair', novo: 'New chair', ...WIDTH }, { alto: false, ea: 45, eb: 50, grupo: 'sala' }),
  'sofa': tipo({ rot: 'Sofá', chip: 'Sofá', novo: 'Novo sofá', ...LARG, uso: 'sentar' }, { rot: 'Sofa', chip: 'Sofa', novo: 'New sofa', ...WIDTH, uso: 'sit down' }, { alto: false, ea: 210, eb: 90, frente: 50, grupo: 'sala' }),
  'poltrona': tipo({ rot: 'Poltrona', chip: 'Poltrona', novo: 'Nova poltrona', ...LARG, uso: 'sentar' }, { rot: 'Armchair', chip: 'Armchair', novo: 'New armchair', ...WIDTH, uso: 'sit down' }, { alto: false, ea: 80, eb: 80, frente: 40, grupo: 'sala' }),
  'rack': tipo({ rot: 'Rack', chip: 'Rack / TV', novo: 'Novo rack', ...LARG }, { rot: 'TV stand', chip: 'TV stand', novo: 'New TV stand', ...WIDTH }, { alto: false, ea: 180, eb: 45, grupo: 'sala' }),
  'estante': tipo({ rot: 'Estante', chip: 'Estante', novo: 'Nova estante', ...LARG }, { rot: 'Bookcase', chip: 'Bookcase', novo: 'New bookcase', ...WIDTH }, { alto: true, ea: 80, eb: 35, grupo: 'sala' }),
  'geladeira': tipo({ rot: 'Geladeira', chip: 'Geladeira', novo: 'Nova geladeira', ...LARG }, { rot: 'Fridge', chip: 'Fridge', novo: 'New fridge', ...WIDTH }, { alto: true, ea: 70, eb: 75, ab: ['abrir'], grupo: 'cozinha' }),
  'fogao': tipo({ rot: 'Fogão', chip: 'Fogão', novo: 'Novo fogão', ...LARG, uso: 'abrir o forno' }, { rot: 'Stove', chip: 'Stove', novo: 'New stove', ...WIDTH, uso: 'open the oven' }, { alto: false, ea: 76, eb: 60, frente: 70, grupo: 'cozinha' }),
  'pia': tipo({ rot: 'Pia', chip: 'Pia / bancada', novo: 'Nova pia', ...LARG, uso: 'usar a pia' }, { rot: 'Sink', chip: 'Sink / counter', novo: 'New sink', ...WIDTH, uso: 'use the sink' }, { alto: false, ea: 120, eb: 55, frente: 60, grupo: 'cozinha' }),
  'lavadora': tipo({ rot: 'Máquina de lavar', chip: 'Máquina de lavar', novo: 'Nova máquina de lavar', ...LARG, uso: 'usar a máquina' }, { rot: 'Washing machine', chip: 'Washing machine', novo: 'New washing machine', ...WIDTH, uso: 'use the machine' }, { alto: false, ea: 60, eb: 65, frente: 60, grupo: 'cozinha' }),
  'tanque': tipo({ rot: 'Tanque', chip: 'Tanque', novo: 'Novo tanque', ...LARG, uso: 'usar o tanque' }, { rot: 'Utility sink', chip: 'Utility sink', novo: 'New utility sink', ...WIDTH, uso: 'use the sink' }, { alto: false, ea: 60, eb: 55, frente: 60, grupo: 'cozinha' }),
  'armario': tipo({ rot: 'Armário', chip: 'Armário', novo: 'Novo armário', ...FRENTE_PT }, { rot: 'Cabinet', chip: 'Cabinet', novo: 'New cabinet', ...FRENTE_EN }, { alto: true, ea: 80, eb: 45, ab: ['abrir', 'correr'], grupo: 'cozinha' }),
  'vaso': tipo({ rot: 'Vaso sanitário', chip: 'Vaso sanitário', novo: 'Novo vaso sanitário', ...LARG, uso: 'usar o vaso' }, { rot: 'Toilet', chip: 'Toilet', novo: 'New toilet', ...WIDTH, uso: 'use the toilet' }, { alto: false, ea: 40, eb: 65, frente: 60, grupo: 'banheiro' }),
  'lavatorio': tipo({ rot: 'Pia do banheiro', chip: 'Pia do banheiro', novo: 'Nova pia do banheiro', ...LARG, uso: 'usar a pia' }, { rot: 'Bathroom sink', chip: 'Bathroom sink', novo: 'New bathroom sink', ...WIDTH, uso: 'use the sink' }, { alto: false, ea: 60, eb: 45, frente: 60, grupo: 'banheiro' }),
  'box': tipo({ rot: 'Box do chuveiro', chip: 'Box / chuveiro', novo: 'Novo box', ...LARG, uso: 'entrar no box' }, { rot: 'Shower', chip: 'Shower', novo: 'New shower', ...WIDTH, uso: 'step into the shower' }, { alto: false, ea: 90, eb: 90, frente: 60, grupo: 'banheiro' }),
  'banheira': tipo({ rot: 'Banheira', chip: 'Banheira', novo: 'Nova banheira', ...BANHEIRA_PT, uso: 'entrar na banheira' }, { rot: 'Bathtub', chip: 'Bathtub', novo: 'New bathtub', ...BANHEIRA_EN, uso: 'get into the tub' }, { alto: false, ea: 170, eb: 75, frente: 60, grupo: 'banheiro' }),
  'escada': tipo({ rot: 'Escada', chip: 'Escada', novo: 'Nova escada', ...COMPR, uso: 'subir a escada' }, { rot: 'Stairs', chip: 'Stairs', novo: 'New stairs', ...LENGTH, uso: 'use the stairs' }, { alto: false, ea: 90, eb: 300, frente: 80, grupo: 'outro' }),
  'outro': tipo({ rot: 'Móvel', chip: 'Outro móvel', novo: 'Novo móvel', ...FRENTE_PT }, { rot: 'Furniture', chip: 'Other', novo: 'New piece', ...FRENTE_EN }, { alto: false, ea: 80, eb: 40, ab: ['nenhuma', 'abrir', 'correr', 'gavetas'], grupo: 'outro' })
};
export const ORDEM_TIPOS = Object.keys(TIPOS) as TipoMovel[];
const GRUPO_NOME = registro<InfoTipo['grupo']>(
  { quarto: 'Quarto', sala: 'Sala e escritório', cozinha: 'Cozinha e serviço', banheiro: 'Banheiro', outro: 'Outro' },
  { quarto: 'Bedroom', sala: 'Living room and office', cozinha: 'Kitchen and laundry', banheiro: 'Bathroom', outro: 'Other' }
);
export const GRUPOS_TIPOS: { id: InfoTipo['grupo']; rot: string }[] = (['quarto', 'sala', 'cozinha', 'banheiro', 'outro'] as const).map((id) => ({ id, get rot() { return GRUPO_NOME[id]; } }));
/** Os grupos de móveis que combinam com cada tipo de cômodo (o menu de "adicionar aqui" mostra esses primeiro). */
export const GRUPOS_DO_COMODO: Record<TipoComodo, InfoTipo['grupo'][]> = {
  sala: ['sala'], quarto: ['quarto'], banheiro: ['banheiro'], cozinha: ['cozinha'], servico: ['cozinha'],
  corredor: ['sala', 'outro'], varanda: ['sala'], garagem: ['outro', 'cozinha'], outro: []
};
/** O primeiro móvel sugerido ao adicionar num cômodo desse tipo. */
export const MOVEL_DO_COMODO: Partial<Record<TipoComodo, TipoMovel>> = { sala: 'sofa', quarto: 'cama', banheiro: 'vaso', cozinha: 'geladeira', servico: 'lavadora', varanda: 'poltrona' };

export const AB_NOME = registro<Abertura>(
  { nenhuma: 'Não tem portas', abrir: 'Portas de abrir', correr: 'Portas de correr', gavetas: 'Gavetas' },
  { nenhuma: 'No doors', abrir: 'Hinged doors', correr: 'Sliding doors', gavetas: 'Drawers' }
);
export const VERBO_AB = registro<Abertura>(
  { nenhuma: '', abrir: 'abrir as portas', correr: 'usar as portas de correr', gavetas: 'abrir as gavetas' },
  { nenhuma: '', abrir: 'open the doors', correr: 'use the sliding doors', gavetas: 'open the drawers' }
);
export const ESCADA_NOME = registro<FormaEscada>({ reta: 'Reta', caracol: 'Caracol' }, { reta: 'Straight', caracol: 'Spiral' });
/** Medidas comuns de escada (cm): reta 0,90 × 3,00; caracol com 1,50 de diâmetro. */
export const ESCADA_PADRAO: Record<FormaEscada, { larg: number; prof: number }> = { reta: { larg: 90, prof: 300 }, caracol: { larg: 150, prof: 150 } };
export const LADO_CAD_NOME = registro<LadoCadeiras>(
  { frente: 'Na frente', dois: 'Dos dois lados', volta: 'Em volta' },
  { frente: 'In front', dois: 'On both sides', volta: 'All around' }
);

export interface InfoParede {
  rot: string;
  novo: string;
  larg: number;
  ex: string;
  min: number;
  max: number;
  parede: Parede;
  rotLarg: string;
}

type TextosParede = { rot: string; novo: string; rotLarg: string };
function itemParede(pt: TextosParede, en: TextosParede, d: { larg: number; min: number; max: number; parede: Parede }): InfoParede {
  const o = bilingue<InfoParede, keyof TextosParede>(d as Omit<InfoParede, keyof TextosParede>, pt, en);
  Object.defineProperty(o, 'ex', { get: () => fmtM(d.larg), enumerable: true });
  return o;
}

export const TIPOS_PAREDE: Record<TipoParede, InfoParede> = {
  porta: itemParede({ rot: 'Porta', novo: 'Nova porta', rotLarg: 'Largura da porta' }, { rot: 'Door', novo: 'New door', rotLarg: 'Door width' }, { larg: 80, min: 40, max: 300, parede: 'cima' }),
  janela: itemParede({ rot: 'Janela', novo: 'Nova janela', rotLarg: 'Largura da janela' }, { rot: 'Window', novo: 'New window', rotLarg: 'Window width' }, { larg: 120, min: 20, max: 800, parede: 'cima' }),
  ar: itemParede({ rot: 'Ar-condicionado', novo: 'Novo ar-condicionado', rotLarg: 'Largura do aparelho' }, { rot: 'Air conditioner', novo: 'New air conditioner', rotLarg: 'Unit width' }, { larg: 85, min: 20, max: 200, parede: 'direita' }),
  interruptor: itemParede({ rot: 'Tomada e outros pontos', novo: 'Novo ponto na parede', rotLarg: 'Largura' }, { rot: 'Outlet or hookup', novo: 'New outlet or hookup', rotLarg: 'Width' }, { larg: 10, min: 5, max: 40, parede: 'cima' })
};
export const ORDEM_PAREDE = Object.keys(TIPOS_PAREDE) as TipoParede[];

/* ---------- jeitos de porta ---------- */
export const JEITOS_PORTA: JeitoPorta[] = ['abrir', 'dupla', 'correr', 'vao'];
export const JEITO_NOME = registro<JeitoPorta>(
  { abrir: 'De abrir', dupla: 'Dupla', correr: 'De correr', vao: 'Passagem' },
  { abrir: 'Hinged', dupla: 'Double', correr: 'Sliding', vao: 'Opening' }
);
export const JEITO_LONGO = registro<JeitoPorta>(
  { abrir: 'Porta de abrir (uma folha)', dupla: 'Porta dupla (duas folhas)', correr: 'Porta de correr', vao: 'Passagem (vão livre, sem porta)' },
  { abrir: 'Hinged door (one leaf)', dupla: 'Double door (two leaves)', correr: 'Sliding door', vao: 'Opening (no door)' }
);
/** "virou porta dupla" / "is now a double door". */
export const JEITO_VIROU = registro<JeitoPorta>(
  { abrir: 'porta de abrir', dupla: 'porta dupla', correr: 'porta de correr', vao: 'passagem sem porta' },
  { abrir: 'a hinged door', dupla: 'a double door', correr: 'a sliding door', vao: 'an opening with no door' }
);

/* ---------- pontos na parede: elétrica, TV e internet, água e gás ---------- */
export const PONTOS: Ponto[] = ['interruptor', 'tomada', 'ambos', 'luz', 'tv', 'rede', 'agua', 'esgoto', 'gas'];
const GRUPO_PONTO_NOME = registro<'eletrica' | 'sinal' | 'agua'>(
  { eletrica: 'Elétrica', sinal: 'TV e internet', agua: 'Água e gás' },
  { eletrica: 'Electrical', sinal: 'TV and internet', agua: 'Water and gas' }
);
export const GRUPOS_PONTO: { rot: string; pontos: Ponto[] }[] = ([
  ['eletrica', ['interruptor', 'tomada', 'ambos', 'luz']], ['sinal', ['tv', 'rede']], ['agua', ['agua', 'esgoto', 'gas']]
] as const).map(([g, pontos]) => ({ get rot() { return GRUPO_PONTO_NOME[g]; }, pontos: [...pontos] }));
/** O que é o ponto (no formulário e no painel). */
export const PONTO_NOME = registro<Ponto>(
  {
    interruptor: 'Interruptor', tomada: 'Tomada', ambos: 'Interruptor + tomada', luz: 'Ponto de luz na parede (arandela)',
    tv: 'Ponto de TV (antena ou cabo)', rede: 'Ponto de internet (cabo de rede)', agua: 'Ponto de água', esgoto: 'Esgoto (da pia ou da máquina)', gas: 'Ponto de gás'
  },
  {
    interruptor: 'Light switch', tomada: 'Outlet', ambos: 'Switch + outlet', luz: 'Wall light',
    tv: 'TV outlet (antenna or cable)', rede: 'Network jack (internet)', agua: 'Water hookup', esgoto: 'Drain (sink or washer)', gas: 'Gas hookup'
  }
);
/** Nome padrão de um ponto novo ("Tomada 2"), nos dois idiomas. */
const BASE_PT: Record<Ponto, string> = {
  interruptor: 'Interruptor', tomada: 'Tomada', ambos: 'Interruptor e tomada', luz: 'Arandela',
  tv: 'Ponto de TV', rede: 'Ponto de internet', agua: 'Ponto de água', esgoto: 'Esgoto', gas: 'Ponto de gás'
};
const BASE_EN: Record<Ponto, string> = {
  interruptor: 'Switch', tomada: 'Outlet', ambos: 'Switch and outlet', luz: 'Wall light',
  tv: 'TV outlet', rede: 'Network jack', agua: 'Water hookup', esgoto: 'Drain', gas: 'Gas hookup'
};
export const PONTO_BASE = registro<Ponto>(BASE_PT, BASE_EN);
/** O nome ainda é o padrão do ponto ("Tomada", "Tomada 2", "Outlet 3")? */
export const nomePadraoPonto = (nome: string, p: Ponto): boolean => {
  const base = nome.replace(/\s+\d+$/, '').trim();
  return base === BASE_PT[p] || base === BASE_EN[p];
};
export const ehPonto = (v: unknown): v is Ponto => typeof v === 'string' && (PONTOS as string[]).includes(v);
export const pontoDe = (e: { ponto?: unknown }): Ponto => (ehPonto(e.ponto) ? e.ponto : 'interruptor');
/** Interruptor precisa de espaço na frente para a mão alcançar; os outros pontos só não podem ficar atrás de móvel alto. */
export const ehInterruptor = (p: Ponto): boolean => p === 'interruptor' || p === 'ambos';
/** Móveis que usam o ponto: as sugestões tentam pôr esses móveis na frente dele, e um móvel alto que usa o ponto
 *  (a geladeira na tomada ou na água, a estante da TV) não conta como tapando. */
export const PONTO_USA: Record<Ponto, TipoMovel[]> = {
  interruptor: [], ambos: [], luz: ['cama'],
  tomada: ['geladeira', 'lavadora', 'cabeceira'],
  tv: ['rack', 'estante'],
  rede: ['rack', 'mesa'],
  agua: ['pia', 'lavadora', 'geladeira', 'tanque', 'vaso', 'lavatorio', 'box', 'banheira'],
  esgoto: ['pia', 'lavadora', 'tanque', 'vaso', 'lavatorio', 'box', 'banheira'],
  gas: ['fogao']
};
/** "do ponto de TV", "do esgoto" (para as explicações das sugestões). */
export const PONTO_DO = registro<Ponto>(
  { interruptor: 'do interruptor', tomada: 'da tomada', ambos: 'do interruptor', luz: 'das arandelas', tv: 'do ponto de TV', rede: 'do ponto de internet', agua: 'do ponto de água', esgoto: 'do esgoto', gas: 'do ponto de gás' },
  { interruptor: 'the switch', tomada: 'the outlet', ambos: 'the switch', luz: 'the wall lights', tv: 'the TV outlet', rede: 'the network jack', agua: 'the water hookup', esgoto: 'the drain', gas: 'the gas hookup' }
);

/* ---------- tipos de cômodo (desenhar a planta e montar pela foto do desenho) ---------- */
export const TIPOS_COMODO: TipoComodo[] = ['sala', 'quarto', 'banheiro', 'cozinha', 'corredor', 'varanda', 'servico', 'garagem', 'outro'];
export const COMODO_NOME = registro<TipoComodo>(
  { sala: 'Sala', quarto: 'Quarto', banheiro: 'Banheiro', cozinha: 'Cozinha', corredor: 'Corredor', varanda: 'Varanda', servico: 'Área de serviço', garagem: 'Garagem', outro: 'Outro' },
  { sala: 'Living room', quarto: 'Bedroom', banheiro: 'Bathroom', cozinha: 'Kitchen', corredor: 'Hallway', varanda: 'Porch', servico: 'Laundry', garagem: 'Garage', outro: 'Other' }
);
export const ehTipoComodo = (v: unknown): v is TipoComodo => typeof v === 'string' && (TIPOS_COMODO as string[]).includes(v);
/** O tipo pelo que veio escrito (o tipo ou o nome: "Suíte" é quarto, "Lavabo" é banheiro, "Alpendre" é varanda…). */
export function tipoPorNome(tipo: unknown, nome: string): TipoComodo {
  if (ehTipoComodo(tipo)) return tipo;
  const t = `${typeof tipo === 'string' ? tipo : ''} ${nome}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
/** O tipo de um cômodo, mesmo dos antigos: corredor pela marca e, sem tipo, pelo nome ("Cozinha", "Suíte"…). */
export const tipoDoComodo = (c: { tipo?: TipoComodo; corredor?: boolean; nome?: string }): TipoComodo =>
  c.corredor ? 'corredor' : c.tipo || (c.nome && !/^(c[oô]modo|room)\s*\d*$/i.test(c.nome.trim()) ? tipoPorNome(undefined, c.nome) : 'outro');

export const ehParede = (tipo: string): tipo is TipoParede => tem(TIPOS_PAREDE, tipo);
export const tipoMovel = (tipo: string): tipo is TipoMovel => tem(TIPOS, tipo);

export const PAREDES: Parede[] = ['cima', 'baixo', 'esquerda', 'direita'];
/** "de cima" / "top": para "parede de cima" e "top wall". */
export const NOME_PAREDE = registro<Parede>(
  { cima: 'de cima', baixo: 'de baixo', esquerda: 'da esquerda', direita: 'da direita' },
  { cima: 'top', baixo: 'bottom', esquerda: 'left', direita: 'right' }
);
/** "Parede de cima" / "Top wall". */
export const PAREDE_NOME = registro<Parede>(
  { cima: 'Parede de cima', baixo: 'Parede de baixo', esquerda: 'Parede da esquerda', direita: 'Parede da direita' },
  { cima: 'Top wall', baixo: 'Bottom wall', esquerda: 'Left wall', direita: 'Right wall' }
);
export const PAREDE_CURTA = registro<Parede>(
  { cima: 'em cima', baixo: 'embaixo', esquerda: 'esquerda', direita: 'direita' },
  { cima: 'top', baixo: 'bottom', esquerda: 'left', direita: 'right' }
);
export const horizontal = (parede: Parede): boolean => parede === 'cima' || parede === 'baixo';
export const rotDist = (parede: Parede): string => (horizontal(parede) ? tx('Distância do canto esquerdo', 'Distance from the left corner') : tx('Distância do canto de cima', 'Distance from the top corner'));

export const LIM_COMODO = { min: 60, max: 3000 };
export const LIM_MOVEL = { min: 10, max: 600 };
export const LIM_CADEIRA = { min: 25, max: 120 };
export const LIM_BAU = { min: 10, max: 150 };
export const MAX_CADEIRAS = 12;
/** Espessura das paredes no desenho (cm). */
export const T = 15;
/** Profundidade do aparelho de ar-condicionado (cm). */
export const AR_PROF = 22;
/** Espaço para puxar a cadeira, além da profundidade dela (cm). */
export const PUXAR_CADEIRA = 25;
