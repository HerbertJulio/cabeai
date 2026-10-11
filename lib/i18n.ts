// Dois idiomas: português (padrão) e inglês.
// tx('texto em português', 'English text') devolve o texto do idioma atual, na hora em que é chamado.
export type Idioma = 'pt' | 'en';

let atual: Idioma = 'pt';

export const idioma = (): Idioma => atual;
export function definirIdioma(i: Idioma): void { atual = i === 'en' ? 'en' : 'pt'; }
export const tx = (pt: string, en: string): string => (atual === 'en' ? en : pt);
export const ehIdioma = (v: unknown): v is Idioma => v === 'pt' || v === 'en';

/** Português para quem usa o navegador em português; inglês para o resto. */
export function idiomaDoNavegador(): Idioma {
  try {
    const l = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^pt\b/i.test(l) || /^pt-/i.test(l) ? 'pt' : 'en';
  } catch {
    return 'pt';
  }
}

/** Objeto com campos de texto que mudam com o idioma (os outros campos ficam como estão). */
export function bilingue<T extends object, K extends keyof T>(base: Omit<T, K>, pt: Pick<T, K>, en: Pick<T, K>): T {
  const o = { ...base } as T;
  for (const k of Object.keys(pt) as K[]) {
    Object.defineProperty(o, k, { get: () => (atual === 'en' ? en[k] : pt[k]), enumerable: true, configurable: true });
  }
  return o;
}

/** Record cujos valores são textos que mudam com o idioma. */
export function registro<K extends string>(pt: Record<K, string>, en: Record<K, string>): Record<K, string> {
  const o = {} as Record<K, string>;
  for (const k of Object.keys(pt) as K[]) Object.defineProperty(o, k, { get: () => (atual === 'en' ? en[k] : pt[k]), enumerable: true, configurable: true });
  return o;
}
