// IA do próprio navegador (Chrome no computador, com Gemini Nano): grátis, sem servidor e sem enviar nada.
import { idioma } from './i18n';
import { ESQUEMA_RESPOSTA, extrairJson, lerOpcoesIA, montarPrompt, type OpcaoIA } from './ia';
import type { ComodoCompleto, Movel } from './tipos';

type Disponibilidade = 'unavailable' | 'downloadable' | 'downloading' | 'available';
interface Sessao { prompt(texto: string, o?: { signal?: AbortSignal; responseConstraint?: unknown }): Promise<string>; destroy?(): void }
interface ApiLM {
  availability(o?: unknown): Promise<Disponibilidade>;
  create(o?: { signal?: AbortSignal; monitor?: (m: EventTarget) => void; initialPrompts?: { role: string; content: string }[] }): Promise<Sessao>;
}
const api = (): ApiLM | null => {
  const g = globalThis as unknown as { LanguageModel?: ApiLM };
  return g.LanguageModel && typeof g.LanguageModel.availability === 'function' ? g.LanguageModel : null;
};

/** "available" ou "downloadable" (precisa baixar o modelo uma vez) quando dá para usar. */
export async function iaNavegadorDisponivel(): Promise<Disponibilidade> {
  const lm = api();
  if (!lm) return 'unavailable';
  try { return await lm.availability(); } catch { return 'unavailable'; }
}

export async function pedirIANavegador(q: ComodoCompleto, todos: Movel[], o: { signal?: AbortSignal; progresso?: (p: number) => void }): Promise<OpcaoIA[]> {
  const lm = api();
  if (!lm) throw Object.assign(new Error('sem IA no navegador'), { codigo: 'indisponivel' });
  const sessao = await lm.create({
    signal: o.signal,
    monitor(m) { m.addEventListener('downloadprogress', (e) => { const ev = e as unknown as { loaded?: number }; if (o.progresso && typeof ev.loaded === 'number') o.progresso(ev.loaded); }); }
  });
  try {
    const lista = todos.filter((m) => !m.fixo), fixos = todos.filter((m) => m.fixo);
    const txt = await sessao.prompt(montarPrompt(q, lista, fixos, idioma()), { signal: o.signal, responseConstraint: ESQUEMA_RESPOSTA });
    return lerOpcoesIA(q, todos, extrairJson(txt));
  } finally {
    try { sessao.destroy?.(); } catch { /* ok */ }
  }
}
