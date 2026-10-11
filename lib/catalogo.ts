// Catálogo: tipos de móvel, itens de parede e nomes das paredes.
import { bilingue, registro, tx } from './i18n';
import type { Abertura, LadoCadeiras, Parede, Ponto, TipoMovel, TipoParede } from './tipos';
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
  grupo: 'quarto' | 'sala' | 'cozinha' | 'outro';
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

export const TIPOS: Record<TipoMovel, InfoTipo> = {
  'cama': tipo({ rot: 'Cama', chip: 'Cama', novo: 'Nova cama', ...COMPR }, { rot: 'Bed', chip: 'Bed', novo: 'New bed', ...LENGTH }, { alto: false, ea: 162, eb: 202, grupo: 'quarto' }),
  'guarda-roupa': tipo({ rot: 'Guarda-roupa', chip: 'Guarda-roupa', novo: 'Novo guarda-roupa', ...FRENTE_PT }, { rot: 'Wardrobe', chip: 'Wardrobe', novo: 'New wardrobe', ...FRENTE_EN }, { alto: true, ea: 180, eb: 55, ab: ['abrir', 'correr'], grupo: 'quarto' }),
  'berco': tipo({ rot: 'Berço', chip: 'Berço', novo: 'Novo berço', ...COMPR }, { rot: 'Crib', chip: 'Crib', novo: 'New crib', ...LENGTH }, { alto: false, ea: 70, eb: 130, grupo: 'quarto' }),
  'comoda': tipo({ rot: 'Cômoda', chip: 'Cômoda', novo: 'Nova cômoda', ...FRENTE_PT }, { rot: 'Dresser', chip: 'Dresser', novo: 'New dresser', ...FRENTE_EN }, { alto: false, ea: 100, eb: 45, ab: ['gavetas', 'abrir'], grupo: 'quarto' }),
  'mesa': tipo({ rot: 'Mesa', chip: 'Mesa', novo: 'Nova mesa', ...LARG }, { rot: 'Table', chip: 'Table / desk', novo: 'New table', ...WIDTH }, { alto: false, ea: 100, eb: 50, grupo: 'sala' }),
  'cadeira': tipo({ rot: 'Cadeira', chip: 'Cadeira', novo: 'Nova cadeira', ...LARG }, { rot: 'Chair', chip: 'Chair', novo: 'New chair', ...WIDTH }, { alto: false, ea: 45, eb: 50, grupo: 'sala' }),
  'sofa': tipo({ rot: 'Sofá', chip: 'Sofá', novo: 'Novo sofá', ...LARG, uso: 'sentar' }, { rot: 'Sofa', chip: 'Sofa', novo: 'New sofa', ...WIDTH, uso: 'sit down' }, { alto: false, ea: 210, eb: 90, frente: 50, grupo: 'sala' }),
  'rack': tipo({ rot: 'Rack', chip: 'Rack / TV', novo: 'Novo rack', ...LARG }, { rot: 'TV stand', chip: 'TV stand', novo: 'New TV stand', ...WIDTH }, { alto: false, ea: 180, eb: 45, grupo: 'sala' }),
  'estante': tipo({ rot: 'Estante', chip: 'Estante', novo: 'Nova estante', ...LARG }, { rot: 'Bookcase', chip: 'Bookcase', novo: 'New bookcase', ...WIDTH }, { alto: true, ea: 80, eb: 35, grupo: 'sala' }),
  'geladeira': tipo({ rot: 'Geladeira', chip: 'Geladeira', novo: 'Nova geladeira', ...LARG }, { rot: 'Fridge', chip: 'Fridge', novo: 'New fridge', ...WIDTH }, { alto: true, ea: 70, eb: 75, ab: ['abrir'], grupo: 'cozinha' }),
  'fogao': tipo({ rot: 'Fogão', chip: 'Fogão', novo: 'Novo fogão', ...LARG, uso: 'abrir o forno' }, { rot: 'Stove', chip: 'Stove', novo: 'New stove', ...WIDTH, uso: 'open the oven' }, { alto: false, ea: 76, eb: 60, frente: 70, grupo: 'cozinha' }),
  'pia': tipo({ rot: 'Pia', chip: 'Pia / bancada', novo: 'Nova pia', ...LARG, uso: 'usar a pia' }, { rot: 'Sink', chip: 'Sink / counter', novo: 'New sink', ...WIDTH, uso: 'use the sink' }, { alto: false, ea: 120, eb: 55, frente: 60, grupo: 'cozinha' }),
  'lavadora': tipo({ rot: 'Máquina de lavar', chip: 'Máquina de lavar', novo: 'Nova máquina de lavar', ...LARG, uso: 'usar a máquina' }, { rot: 'Washing machine', chip: 'Washing machine', novo: 'New washing machine', ...WIDTH, uso: 'use the machine' }, { alto: false, ea: 60, eb: 65, frente: 60, grupo: 'cozinha' }),
  'armario': tipo({ rot: 'Armário', chip: 'Armário', novo: 'Novo armário', ...FRENTE_PT }, { rot: 'Cabinet', chip: 'Cabinet', novo: 'New cabinet', ...FRENTE_EN }, { alto: true, ea: 80, eb: 45, ab: ['abrir', 'correr'], grupo: 'cozinha' }),
  'outro': tipo({ rot: 'Móvel', chip: 'Outro móvel', novo: 'Novo móvel', ...FRENTE_PT }, { rot: 'Furniture', chip: 'Other', novo: 'New piece', ...FRENTE_EN }, { alto: false, ea: 80, eb: 40, ab: ['nenhuma', 'abrir', 'correr', 'gavetas'], grupo: 'outro' })
};
export const ORDEM_TIPOS = Object.keys(TIPOS) as TipoMovel[];
const GRUPO_NOME = registro<InfoTipo['grupo']>(
  { quarto: 'Quarto', sala: 'Sala e escritório', cozinha: 'Cozinha e serviço', outro: 'Outro' },
  { quarto: 'Bedroom', sala: 'Living room and office', cozinha: 'Kitchen and laundry', outro: 'Other' }
);
export const GRUPOS_TIPOS: { id: InfoTipo['grupo']; rot: string }[] = (['quarto', 'sala', 'cozinha', 'outro'] as const).map((id) => ({ id, get rot() { return GRUPO_NOME[id]; } }));

export const AB_NOME = registro<Abertura>(
  { nenhuma: 'Não tem portas', abrir: 'Portas de abrir', correr: 'Portas de correr', gavetas: 'Gavetas' },
  { nenhuma: 'No doors', abrir: 'Hinged doors', correr: 'Sliding doors', gavetas: 'Drawers' }
);
export const VERBO_AB = registro<Abertura>(
  { nenhuma: '', abrir: 'abrir as portas', correr: 'usar as portas de correr', gavetas: 'abrir as gavetas' },
  { nenhuma: '', abrir: 'open the doors', correr: 'use the sliding doors', gavetas: 'open the drawers' }
);
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
  interruptor: itemParede({ rot: 'Interruptor / tomada', novo: 'Novo interruptor ou tomada', rotLarg: 'Largura' }, { rot: 'Switch / outlet', novo: 'New switch or outlet', rotLarg: 'Width' }, { larg: 10, min: 5, max: 40, parede: 'cima' })
};
export const ORDEM_PAREDE = Object.keys(TIPOS_PAREDE) as TipoParede[];

/** Ponto elétrico na parede: interruptor, tomada ou os dois juntos. */
export const PONTO_NOME = registro<Ponto>(
  { interruptor: 'Interruptor', tomada: 'Tomada', ambos: 'Interruptor + tomada' },
  { interruptor: 'Light switch', tomada: 'Outlet', ambos: 'Switch + outlet' }
);
/** Nome padrão de um ponto novo ("Tomada 2"). */
export const PONTO_BASE = registro<Ponto>(
  { interruptor: 'Interruptor', tomada: 'Tomada', ambos: 'Interruptor e tomada' },
  { interruptor: 'Switch', tomada: 'Outlet', ambos: 'Switch and outlet' }
);
export const pontoDe = (e: { ponto?: Ponto }): Ponto => (e.ponto === 'tomada' || e.ponto === 'ambos' ? e.ponto : 'interruptor');

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

export const LIM_COMODO = { min: 100, max: 3000 };
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
