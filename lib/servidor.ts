// Partes comuns das rotas do servidor (/api/ia e /api/planta): conferência de origem, limite de uso,
// qual IA usar e como perguntar a ela. Só roda no servidor.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { gateway, generateText, type LanguageModel, type ModelMessage } from 'ai';

/* ---------- proteção: mesmo site e limite de uso ---------- */
export function mesmaOrigem(req: Request): boolean {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const origem = req.headers.get('origin');
  if (origem) { try { return new URL(origem).host === host; } catch { return false; } }
  const sfs = req.headers.get('sec-fetch-site');
  return !sfs || sfs === 'same-origin';
}

/** Limite de uso na memória da instância: tantos pedidos por endereço e no total, a cada 10 minutos. */
export function criarLimite(porIp: number, total: number, janela = 10 * 60_000): (ip: string) => boolean {
  const usos = new Map<string, number[]>();
  let usosTotal: number[] = [];
  return (ip: string) => {
    const agora = Date.now(), dentro = (t: number) => agora - t < janela;
    usosTotal = usosTotal.filter(dentro);
    const meus = (usos.get(ip) || []).filter(dentro);
    if (meus.length >= porIp || usosTotal.length >= total) { usos.set(ip, meus); return true; }
    meus.push(agora); usosTotal.push(agora); usos.set(ip, meus);
    if (usos.size > 5000) for (const [k, v] of usos) if (!v.some(dentro)) usos.delete(k);
    return false;
  };
}
export const ipDe = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';

export const resposta = (status: number, corpo: Record<string, unknown>) =>
  Response.json(corpo, { status, headers: { 'cache-control': 'no-store' } });

/** Lê o corpo JSON com limite de tamanho. */
export async function lerCorpo(req: Request, max: number): Promise<{ corpo: unknown } | { status: number; codigo: string }> {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return { status: 415, codigo: 'invalido' };
  if (Number(req.headers.get('content-length') || 0) > max) return { status: 413, codigo: 'grande' };
  const texto = await req.text();
  if (texto.length > max) return { status: 413, codigo: 'grande' };
  try { return { corpo: JSON.parse(texto) }; } catch { return { status: 400, codigo: 'invalido' }; }
}

/* ---------- qual IA usar ---------- */
export interface Modelo { nome: string; modelo: LanguageModel; visao: boolean }
const PREFERIDOS = ['inclusionai/ling-3.1-flash-free', 'poolside/laguna-s-2.1-free'];
let cacheGratis: { t: number; ids: string[]; lista: boolean } | null = null;
export const listaDoGateway = () => !!cacheGratis?.lista;

/** Os modelos gratuitos do AI Gateway (a lista muda com o tempo; guarda por 30 minutos). */
export async function modelosGratis(): Promise<string[]> {
  const fixo = (process.env.CABEAI_MODELOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (fixo.length) return fixo;
  if (cacheGratis && Date.now() - cacheGratis.t < 30 * 60_000) return cacheGratis.ids;
  let ids: string[] = [], lista = false;
  try {
    const { models } = await gateway.getAvailableModels();
    lista = true;
    ids = models
      .filter((m) => (m.modelType == null || m.modelType === 'language') && (/-free$/.test(m.id) || (!!m.pricing && Number(m.pricing.input) === 0 && Number(m.pricing.output) === 0)))
      .map((m) => m.id);
  } catch { /* sem lista: usa os conhecidos */ }
  const ordem = [...PREFERIDOS.filter((p) => !ids.length || ids.includes(p)), ...ids.filter((i) => !PREFERIDOS.includes(i))].slice(0, 4);
  cacheGratis = { t: Date.now() - (lista ? 0 : 25 * 60_000), ids: ordem.length ? ordem : PREFERIDOS, lista };
  return cacheGratis.ids;
}

export const temGateway = (req: Request) => !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers.get('x-vercel-oidc-token'));
export const temGemini = () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

/** As IAs disponíveis, na ordem de preferência. Com "visao", só as que leem imagem: o Gemini (chave grátis do
 *  Google AI Studio) ou um modelo do AI Gateway escolhido em CABEAI_MODELO_VISAO. */
export async function modelos(req: Request, o: { visao?: boolean } = {}): Promise<Modelo[]> {
  const out: Modelo[] = [];
  if (temGemini()) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const nome = process.env.CABEAI_GEMINI || 'gemini-flash-latest';
    out.push({ nome: 'google/' + nome, modelo: google(nome), visao: true });
  }
  if (temGateway(req)) {
    const visao = (process.env.CABEAI_MODELO_VISAO || '').trim();
    if (visao) out.push({ nome: visao, modelo: gateway(visao), visao: true });
    if (!o.visao) for (const id of await modelosGratis()) out.push({ nome: id, modelo: gateway(id), visao: false });
  }
  return o.visao ? out.filter((m) => m.visao) : out;
}

/* ---------- conversa com a IA ---------- */
export type CodigoFalha = 'limite' | 'sem-ia' | 'invalido' | 'erro';
export function tipoDeFalha(e: unknown): CodigoFalha {
  const t = String((e as { name?: string })?.name || '') + ' ' + String((e as { message?: string })?.message || '');
  const st = Number((e as { statusCode?: number })?.statusCode || 0);
  if (st === 429 || /RateLimit|rate limit|quota|429/i.test(t)) return 'limite';
  if (st === 401 || st === 403 || /Authentication|OIDC|API key|Forbidden|credit|payment|billing/i.test(t)) return 'sem-ia';
  return 'erro';
}

export async function perguntar(m: Modelo, messages: ModelMessage[], ms: number, sinal: AbortSignal, temperatura = 0.5): Promise<string> {
  const r = await generateText({
    model: m.modelo, messages, temperature: temperatura, maxOutputTokens: 4000, maxRetries: 0,
    abortSignal: AbortSignal.any([sinal, AbortSignal.timeout(ms)])
  });
  return r.text;
}
