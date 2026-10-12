// Planta pelo desenho em papel: a foto do rascunho (e/ou a descrição da casa) vai para uma IA que lê imagem
// (o Gemini, com a chave grátis do Google AI Studio). A resposta volta só se tiver cômodos aproveitáveis;
// o navegador confere de novo e monta a casa.
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { extrairJson } from '@/lib/ia';
import { lerPlanta, montarPromptPlanta } from '@/lib/planta';
import { criarLimite, ipDe, lerCorpo, mesmaOrigem, modelos, perguntar, resposta, tipoDeFalha, type CodigoFalha } from '@/lib/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** A foto chega reduzida pelo navegador (até 1600 px); 3 MB de texto em base64 dão folga. */
const MAX_CORPO = 3_000_000;
const passouDoLimite = criarLimite(5, 120);
const IMAGEM = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const Pedido = z.object({
  imagem: z.string().max(MAX_CORPO).regex(IMAGEM).optional(),
  texto: z.string().max(2000).optional(),
  idioma: z.enum(['pt', 'en']).optional()
}).refine((p) => !!p.imagem || (p.texto || '').trim().length >= 10, 'sem foto e sem descrição');

export async function POST(req: Request) {
  if (!mesmaOrigem(req)) return resposta(403, { codigo: 'erro' });
  const lido = await lerCorpo(req, MAX_CORPO);
  if ('status' in lido) return resposta(lido.status, { codigo: lido.codigo });
  const p = Pedido.safeParse(lido.corpo);
  if (!p.success) return resposta(400, { codigo: 'invalido' });
  if (passouDoLimite(ipDe(req))) return resposta(429, { codigo: 'limite' });

  const foto = p.data.imagem ? IMAGEM.exec(p.data.imagem) : null;
  const lista = await modelos(req, { visao: !!foto });
  if (!lista.length) return resposta(503, { codigo: 'sem-ia' });

  const pedido = montarPromptPlanta(p.data.texto || '', !!foto, p.data.idioma || 'pt');
  const msgs: ModelMessage[] = [{
    role: 'user',
    content: foto ? [{ type: 'text', text: pedido }, { type: 'image', image: foto[2], mediaType: 'image/' + foto[1] }] : pedido
  }];
  const inicio = Date.now(), resta = () => 56_000 - (Date.now() - inicio);
  let ultimaFalha: CodigoFalha = 'erro';
  for (const m of lista) {
    if (resta() < 10_000) break;
    try {
      const txt = await perguntar(m, msgs, resta() - 3_000, req.signal, 0.2);
      const bruto = extrairJson(txt);
      if (!lerPlanta(bruto)) { ultimaFalha = 'invalido'; continue; }
      return resposta(200, { bruto, modelo: m.nome });
    } catch (e) {
      if (req.signal.aborted) return resposta(499, { codigo: 'erro' });
      ultimaFalha = tipoDeFalha(e);
      console.warn('[planta]', m.nome, ultimaFalha, String((e as Error)?.message || e).slice(0, 300));
    }
  }
  const status = ultimaFalha === 'limite' ? 429 : ultimaFalha === 'sem-ia' ? 503 : ultimaFalha === 'invalido' ? 422 : 502;
  return resposta(status, { codigo: ultimaFalha });
}
