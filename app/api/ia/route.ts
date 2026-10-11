// IA online, grátis: modelos gratuitos do AI Gateway da Vercel (autenticação automática na Vercel)
// ou o Gemini do Google AI Studio, quando GOOGLE_GENERATIVE_AI_API_KEY estiver configurada.
// O navegador manda só o necessário de um cômodo; a resposta volta conferida com as medidas.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { gateway, generateText, type LanguageModel, type ModelMessage } from 'ai';
import { z } from 'zod';
import { TIPOS_PAREDE } from '@/lib/catalogo';
import { normalizarComodo, normalizarEl, normalizarMovel } from '@/lib/dados';
import { extrairJson, lerOpcoesIA, montarPrompt, pedidoCorrecao, type OpcaoIA } from '@/lib/ia';
import type { ComodoCompleto, ElParede, Movel, TipoParede } from '@/lib/tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ID_OK = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_CORPO = 96 * 1024;
const PREFERIDOS = ['inclusionai/ling-3.1-flash-free', 'poolside/laguna-s-2.1-free'];

/* ---------- proteção: mesmo site, tamanho e limite de uso ---------- */
function mesmaOrigem(req: Request): boolean {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const origem = req.headers.get('origin');
  if (origem) { try { return new URL(origem).host === host; } catch { return false; } }
  const sfs = req.headers.get('sec-fetch-site');
  return !sfs || sfs === 'same-origin';
}

const JANELA = 10 * 60_000, POR_IP = 8, TOTAL = 240;
const usos = new Map<string, number[]>();
let usosTotal: number[] = [];
function passouDoLimite(ip: string): boolean {
  const agora = Date.now(), dentro = (t: number) => agora - t < JANELA;
  usosTotal = usosTotal.filter(dentro);
  const meus = (usos.get(ip) || []).filter(dentro);
  if (meus.length >= POR_IP || usosTotal.length >= TOTAL) { usos.set(ip, meus); return true; }
  meus.push(agora); usosTotal.push(agora); usos.set(ip, meus);
  if (usos.size > 5000) for (const [k, v] of usos) if (!v.some(dentro)) usos.delete(k);
  return false;
}
const ipDe = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';

const resposta = (status: number, corpo: Record<string, unknown>) =>
  Response.json(corpo, { status, headers: { 'cache-control': 'no-store' } });

/* ---------- o pedido: um cômodo com portas, janelas etc. e os móveis dele ---------- */
const registro = z.record(z.string(), z.unknown());
const Pedido = z.object({
  comodo: registro.refine((c) => typeof c.id === 'string' && ID_OK.test(c.id), 'cômodo sem id'),
  moveis: z.array(registro).min(1).max(40),
  idioma: z.enum(['pt', 'en']).optional()
});

function montar(p: z.infer<typeof Pedido>): { q: ComodoCompleto; moveis: Movel[] } {
  const id = String(p.comodo.id);
  const c = normalizarComodo(id, p.comodo, 'terreo');
  const brutos = Array.isArray(p.comodo.els) ? (p.comodo.els as unknown[]).slice(0, 60) : [];
  const els: ElParede[] = [];
  for (const e of brutos) {
    if (!e || typeof e !== 'object') continue;
    const v = e as Record<string, unknown>;
    if (typeof v.tipo !== 'string' || !(v.tipo in TIPOS_PAREDE) || typeof v.id !== 'string' || !ID_OK.test(v.id)) continue;
    const el = normalizarEl(v.tipo as TipoParede, v.id, { ...v, comodo: id });
    if (v.herdada) el.herdada = true;
    els.push(el);
  }
  const q: ComodoCompleto = {
    ...c, els, portas: els.filter((e) => e.tipo === 'porta'), janelas: els.filter((e) => e.tipo === 'janela'),
    ares: els.filter((e) => e.tipo === 'ar'), interruptores: els.filter((e) => e.tipo === 'interruptor')
  };
  const moveis = p.moveis
    .filter((m) => typeof m.id === 'string' && ID_OK.test(m.id))
    .map((m) => normalizarMovel(String(m.id), { ...m, comodo: id }));
  return { q, moveis };
}

/* ---------- qual IA usar ---------- */
interface Modelo { nome: string; modelo: LanguageModel }
let cacheGratis: { t: number; ids: string[]; lista: boolean } | null = null;

/** Os modelos gratuitos do AI Gateway (a lista muda com o tempo; guarda por 30 minutos). */
async function modelosGratis(): Promise<string[]> {
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

const temGateway = (req: Request) => !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || req.headers.get('x-vercel-oidc-token'));
const temGemini = () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

async function modelos(req: Request): Promise<Modelo[]> {
  const out: Modelo[] = [];
  if (temGemini()) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    const nome = process.env.CABEAI_GEMINI || 'gemini-flash-latest';
    out.push({ nome: 'google/' + nome, modelo: google(nome) });
  }
  if (temGateway(req)) for (const id of await modelosGratis()) out.push({ nome: id, modelo: gateway(id) });
  return out;
}

/* ---------- conversa com a IA ---------- */
const total = (ops: OpcaoIA[]) => ops.reduce((t, o) => t + o.problemas, 0);
const paraBruto = (ops: OpcaoIA[]) => ({
  opcoes: ops.map((o) => ({ titulo: o.titulo, explicacao: o.explicacao, moveis: Object.entries(o.itens).map(([id, i]) => ({ id, x: i.x, y: i.y, rot: i.rot })) }))
});
type Falha = { codigo: 'limite' | 'sem-ia' | 'invalido' | 'erro' };
function tipoDeFalha(e: unknown): Falha['codigo'] {
  const t = String((e as { name?: string })?.name || '') + ' ' + String((e as { message?: string })?.message || '');
  const st = Number((e as { statusCode?: number })?.statusCode || 0);
  if (st === 429 || /RateLimit|rate limit|quota|429/i.test(t)) return 'limite';
  if (st === 401 || st === 403 || /Authentication|OIDC|API key|Forbidden|credit|payment|billing/i.test(t)) return 'sem-ia';
  return 'erro';
}

async function perguntar(m: Modelo, messages: ModelMessage[], ms: number, sinal: AbortSignal): Promise<string> {
  const r = await generateText({
    model: m.modelo, messages, temperature: 0.5, maxOutputTokens: 4000, maxRetries: 0,
    abortSignal: AbortSignal.any([sinal, AbortSignal.timeout(ms)])
  });
  return r.text;
}

export async function POST(req: Request) {
  if (!mesmaOrigem(req)) return resposta(403, { codigo: 'erro', erro: 'Pedido de outro site.' });
  if (!(req.headers.get('content-type') || '').includes('application/json')) return resposta(415, { codigo: 'invalido', erro: 'Formato não aceito.' });
  const tam = Number(req.headers.get('content-length') || 0);
  if (tam > MAX_CORPO) return resposta(413, { codigo: 'grande' });
  const texto = await req.text();
  if (texto.length > MAX_CORPO) return resposta(413, { codigo: 'grande' });
  let corpo: unknown;
  try { corpo = JSON.parse(texto); } catch { return resposta(400, { codigo: 'invalido', erro: 'Pedido inválido.' }); }
  const p = Pedido.safeParse(corpo);
  if (!p.success) return resposta(p.error.issues.some((i) => i.code === 'too_big') ? 413 : 400, { codigo: p.error.issues.some((i) => i.code === 'too_big') ? 'grande' : 'invalido', erro: 'Pedido inválido.' });
  const { q, moveis } = montar(p.data);
  const soltos = moveis.filter((m) => !m.fixo);
  if (!soltos.length) return resposta(400, { codigo: 'invalido', erro: 'Todos os móveis estão travados.' });
  if (passouDoLimite(ipDe(req))) return resposta(429, { codigo: 'limite' });

  const lista = await modelos(req);
  if (!lista.length) return resposta(503, { codigo: 'sem-ia' });

  const inicio = Date.now(), resta = () => 55_000 - (Date.now() - inicio);
  const pedido = montarPrompt(q, soltos, moveis.filter((m) => m.fixo), p.data.idioma || 'pt');
  let ultimaFalha: Falha['codigo'] = 'erro';
  for (const m of lista) {
    if (resta() < 12_000) break;
    try {
      const msgs: ModelMessage[] = [{ role: 'user', content: pedido }];
      const txt = await perguntar(m, msgs, Math.min(30_000, resta() - 4_000), req.signal);
      let ops = lerOpcoesIA(q, moveis, extrairJson(txt));
      if (!ops.length) { ultimaFalha = 'invalido'; continue; }
      // uma rodada de correção quando alguma opção ficou com problema
      if (total(ops) > 0 && resta() > 16_000) {
        try {
          const txt2 = await perguntar(m, [...msgs, { role: 'assistant', content: txt }, { role: 'user', content: pedidoCorrecao(q, moveis, ops) }], Math.min(25_000, resta() - 3_000), req.signal);
          const ops2 = lerOpcoesIA(q, moveis, extrairJson(txt2));
          if (ops2.length && (ops2.length > ops.length || total(ops2) < total(ops))) ops = ops2;
        } catch { /* fica com a primeira resposta */ }
      }
      return resposta(200, { bruto: paraBruto(ops), modelo: m.nome });
    } catch (e) {
      if (req.signal.aborted) return resposta(499, { codigo: 'erro' });
      ultimaFalha = tipoDeFalha(e);
      console.warn('[ia]', m.nome, ultimaFalha, String((e as Error)?.message || e).slice(0, 300));
    }
  }
  const status = ultimaFalha === 'limite' ? 429 : ultimaFalha === 'sem-ia' ? 503 : 502;
  return resposta(status, { codigo: ultimaFalha });
}

/** Diagnóstico: /api/ia diz se a IA online está configurada; /api/ia?teste=1 faz uma pergunta curtinha a ela. */
export async function GET(req: Request) {
  const gemini = temGemini(), gw = temGateway(req);
  const modelosGw = gw ? await modelosGratis() : [];
  const info: Record<string, unknown> = { ia: gemini || gw, gemini, gateway: gw, listaDoGateway: !!cacheGratis?.lista, modelos: modelosGw };
  if (new URL(req.url).searchParams.get('teste') !== '1') return resposta(200, info);
  if (passouDoLimite(ipDe(req))) return resposta(429, { ...info, teste: 'limite' });
  for (const m of await modelos(req)) {
    try {
      const txt = await perguntar(m, [{ role: 'user', content: 'Responda apenas com a palavra: ok' }], 20_000, req.signal);
      return resposta(200, { ...info, teste: 'ok', modelo: m.nome, resposta: txt.trim().slice(0, 40) });
    } catch (e) {
      info[m.nome] = tipoDeFalha(e) + ': ' + String((e as Error)?.message || e).replace(/\s+/g, ' ').slice(0, 160);
    }
  }
  return resposta(200, { ...info, teste: 'falhou' });
}
