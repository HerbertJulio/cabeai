// Modelo de dados do Cabeaí. Tudo em centímetros.
// Casa → andares → cômodos (com posição na planta do andar) → móveis e itens de parede.

export type Parede = 'cima' | 'baixo' | 'esquerda' | 'direita';
export type TipoMovel =
  | 'cama' | 'guarda-roupa' | 'berco' | 'comoda' | 'cabeceira' | 'mesa' | 'cadeira' | 'sofa' | 'poltrona' | 'estante' | 'rack'
  | 'geladeira' | 'fogao' | 'pia' | 'lavadora' | 'tanque' | 'armario' | 'vaso' | 'lavatorio' | 'box' | 'banheira' | 'escada' | 'outro';
/** Escada reta (degraus em linha) ou caracol (redonda). */
export type FormaEscada = 'reta' | 'caracol';
export type Abertura = 'nenhuma' | 'abrir' | 'correr' | 'gavetas';
export type LadoCadeiras = 'frente' | 'dois' | 'volta';
/** Onde fica o baú em relação à cama: no meio, alinhado à esquerda ou à direita (mais um ajuste em cm). */
export type AlinhaBau = 'centro' | 'esq' | 'dir';
export type TipoParede = 'porta' | 'janela' | 'ar' | 'interruptor';
/** Ponto na parede (o item de parede "interruptor"): elétrico (interruptor, tomada, os dois, arandela),
 *  de sinal (TV, internet) ou de água e gás (água, esgoto, gás). */
export type Ponto = 'interruptor' | 'tomada' | 'ambos' | 'luz' | 'tv' | 'rede' | 'agua' | 'esgoto' | 'gas';
/** O que é o cômodo (para o nome padrão, a cor do piso e as portas automáticas). */
export type TipoComodo = 'sala' | 'quarto' | 'banheiro' | 'cozinha' | 'corredor' | 'varanda' | 'servico' | 'garagem' | 'outro';
export type Vista = 'um' | 'lado' | 'casa';
export type Modo = 'simples' | 'avancado';
export type Escopo = 'casa' | 'comodo';

export interface Andar {
  id: string;
  nome: string;
  ordem: number;
  criado: number;
}

export interface Comodo {
  id: string;
  nome: string;
  /** Medidas de dentro, de parede a parede. */
  w: number;
  h: number;
  andar: string;
  /** Canto interno de cima à esquerda, na planta do andar. */
  x: number;
  y: number;
  criado: number;
  /** Corredor: um cômodo comprido que liga outros. */
  corredor?: boolean;
  /** Sala, quarto, banheiro… (cômodos antigos não têm). */
  tipo?: TipoComodo;
}

export interface Movel {
  id: string;
  tipo: TipoMovel;
  nome: string;
  /** Largura (frente) e profundidade, sem girar. */
  larg: number;
  prof: number;
  alto: boolean;
  comodo: string;
  /** Canto de cima à esquerda do retângulo ocupado, dentro do cômodo. */
  x: number;
  y: number;
  /** 0, 90, 180 ou 270: para onde ficam as costas (0 = parede de cima). */
  rot: number;
  criado: number;
  fixo: boolean;
  abertura: Abertura;
  nPortas: number;
  /** Espaço livre na frente (cm) escolhido pela pessoa; null = automático (pelo tipo e pelas portas/gavetas). */
  frente: number | null;
  /** Mesa: cadeiras que já vêm com ela (0 = nenhuma). */
  cadeiras: number;
  ladoCadeiras: LadoCadeiras;
  cadLarg: number;
  cadProf: number;
  /** Cama: baú na cabeceira (profundidade 0 = sem baú). */
  bauCab: number;
  bauCabLarg: number;
  bauCabAl: AlinhaBau;
  bauCabDx: number;
  /** Cama: baú nos pés. */
  bauPe: number;
  bauPeLarg: number;
  bauPeAl: AlinhaBau;
  bauPeDx: number;
  /** Escada: reta ou caracol (no caracol, largura = profundidade = diâmetro). */
  escada?: FormaEscada;
}

export interface ElParede {
  id: string;
  tipo: TipoParede;
  nome: string;
  comodo: string;
  parede: Parede;
  /** Distância do canto esquerdo (paredes de cima/baixo) ou de cima (esquerda/direita). */
  inicio: number;
  largura: number;
  criado: number;
  dobradica?: 'a' | 'b';
  /** Para onde a folha abre; "vao" = vão livre, sem porta (passagem). */
  abre?: 'dentro' | 'fora' | 'vao';
  abertura?: 'correr' | 'abrir';
  folhas?: 1 | 2;
  folga?: number;
  /** Que ponto é: interruptor, tomada, TV, água, gás… (só no item "interruptor"). */
  ponto?: Ponto;
  /** Porta de um vizinho que fica na parede dividida (só para conferir e desenhar o vão). */
  herdada?: boolean;
  origem?: string;
  origemComodo?: string;
  /** Porta posta sozinha quando dois cômodos se encostaram (sai se eles se separarem). */
  auto?: boolean;
  /** O cômodo vizinho que esta porta (ou a parede tirada) liga. */
  liga?: string;
  /** A parede entre os dois cômodos foi tirada: o espaço continua no vizinho (a "porta" ocupa a parede dividida inteira). */
  semParede?: boolean;
}

export interface ItemCenario {
  comodo: string;
  x: number;
  y: number;
  rot: number;
}

export interface Cenario {
  id: string;
  nome: string;
  escopo: Escopo;
  comodo: string | null;
  criado: number;
  itens: Record<string, ItemCenario>;
  sugestao: boolean;
  origem: 'auto' | 'ia';
  explicacao: string;
}

export interface Dados {
  andares: Record<string, Andar>;
  comodos: Record<string, Comodo>;
  moveis: Record<string, Movel>;
  els: Record<string, ElParede>;
  cenarios: Record<string, Cenario>;
}

/** Cômodo com os itens de parede já separados (o que a geometria usa). */
export interface ComodoCompleto extends Comodo {
  els: ElParede[];
  portas: ElParede[];
  janelas: ElParede[];
  ares: ElParede[];
  interruptores: ElParede[];
}

export interface Ret {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RetMedida extends Ret {
  w: number;
  h: number;
}

/** Problema encontrado na arrumação: aponta o móvel (mid) e/ou o item de parede (eid). */
export interface Problema {
  t: string;
  mid: string | null;
  eid: string | null;
}

export interface Avaliacao {
  problemas: string[];
  itens: Problema[];
  conflitos: Set<string>;
  portasBloq: Set<string>;
  elsRuins: Set<string>;
}

export const vazio = (): Dados => ({ andares: {}, comodos: {}, moveis: {}, els: {}, cenarios: {} });
