// Utilidades pequenas: medidas, números e textos.
import { idioma } from './i18n';

/** Centímetros para metros: 162 → "1,62" (em inglês, "1.62"). */
export const fmtM = (cm: number): string => { const t = (Math.round(cm) / 100).toFixed(2); return idioma() === 'en' ? t : t.replace('.', ','); };
/** Arredonda para uma casa decimal (coordenadas do desenho). */
export const n1 = (v: number): number => Math.round(v * 10) / 10;
export const clamp = (v: number, a: number, b: number): number => Math.min(Math.max(v, a), b);
export const num = (x: unknown, d: number): number => {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
};
/** "1 móvel", "2 móveis". */
export const pl = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;
export const tem = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

export function novoId(prefixo = ''): string {
  return prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Medida em metros (1,62) ou centímetros (162). Até 10 é lido como metros. */
export function parseMedida(s: unknown): number {
  if (s == null) return NaN;
  let t = String(s).trim().toLowerCase().replace(/\s+/g, '').replace(/(cm|m)$/, '');
  if (!t) return NaN;
  t = t.replace(',', '.');
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return Math.round(n <= 10 ? n * 100 : n);
}

/** Distância: vazio = null, "0" = 0, o resto como medida. */
export function parseDist(s: unknown): number | null {
  const t = String(s == null ? '' : s).trim();
  if (!t) return null;
  if (/^0+([.,]0*)?\s*(cm|m)?$/i.test(t)) return 0;
  const v = parseMedida(t);
  return Number.isFinite(v) ? v : NaN;
}

/** Posição sempre em centímetros (modo avançado). Aceita negativos quando pedido. */
export function parseCm(s: unknown, negativo = false): number | null {
  const t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '').replace(/cm$/, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || (!negativo && n < 0)) return NaN;
  return Math.round(n);
}

/** Número inteiro de um campo de texto, ou null se vazio. */
export function parseInteiro(s: unknown): number | null {
  const t = String(s == null ? '' : s).trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const dataCurta = (ts: number): string => {
  try {
    return new Date(ts).toLocaleString(idioma() === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/** Primeira letra minúscula (para juntar frases). */
export const minuscula = (s: string): string => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
