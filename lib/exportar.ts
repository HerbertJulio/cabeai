// Salvar a planta como imagem (PNG): copia o desenho da tela, junta os estilos e as fontes dentro dele (a imagem
// não carrega nada de fora), desenha numa tela do navegador e baixa o arquivo ou abre o compartilhar do celular.
// Só roda no navegador.
import { tx } from './i18n';
import { areaDaCasa, fmtArea } from './resumo';
import { toast, useApp } from './store';

type Vb = [number, number, number, number];
let fonte: (() => { svg: SVGSVGElement; vb: Vb } | null) | null = null;
/** Antes de copiar o desenho, a planta põe os textos no tamanho de perto (e depois volta). */
let preparo: ((fixo: boolean) => Promise<void>) | null = null;
/** A planta avisa onde está o desenho dela e a área que ele ocupa. */
export function registrarPlanta(f: typeof fonte, preparar?: (fixo: boolean) => Promise<void>) { fonte = f; preparo = f ? preparar || null : null; }

const paraDataUrl = (b: Blob) => new Promise<string>((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => erro(r.error); r.readAsDataURL(b); });

/** Os estilos da página, com as fontes embutidas. */
async function estilos(): Promise<string> {
  let css = '';
  const fontes = new Map<string, string>();
  for (const sh of Array.from(document.styleSheets)) {
    let regras: CSSRuleList;
    try { regras = sh.cssRules; } catch { continue; }
    const base = sh.href || location.href;
    for (const r of Array.from(regras)) {
      let t = r.cssText;
      if (r instanceof CSSFontFaceRule) {
        t = t.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (_m, u: string) => { const abs = new URL(u, base).href; fontes.set(abs, ''); return `url("${abs}")`; });
      }
      css += t + '\n';
    }
  }
  await Promise.all([...fontes.keys()].map(async (u) => { try { fontes.set(u, await paraDataUrl(await (await fetch(u)).blob())); } catch { /* fica sem essa fonte */ } }));
  for (const [u, dado] of fontes) if (dado) css = css.split(`url("${u}")`).join(`url("${dado}")`);
  return css;
}

/** Monta o PNG da planta inteira (não só o pedaço que está na tela), com o título embaixo. */
export async function pngDaPlanta(titulo: string): Promise<Blob | null> {
  if (!fonte) return null;
  const pronto = preparo;
  if (pronto) await pronto(true);
  let f: ReturnType<NonNullable<typeof fonte>> = null, copia0: SVGSVGElement | null = null;
  try { f = fonte ? fonte() : null; copia0 = f ? (f.svg.cloneNode(true) as SVGSVGElement) : null; } finally { if (pronto) void pronto(false); }
  if (!f || !copia0) return null;
  const m = 40, vb: Vb = [f.vb[0] - m, f.vb[1] - m, f.vb[2] + 2 * m, f.vb[3] + 2 * m];
  const esc = Math.min(4, Math.max(1.2, 2600 / Math.max(vb[2], vb[3]))), W = Math.round(vb[2] * esc), H = Math.round(vb[3] * esc);
  const copia = copia0;
  copia.querySelectorAll('.alcas, .paredes-btns, .risco-g, .grade-desenho, .juntas, .trena-g, .trena-p, .sala-foco, .corte-g, .corte-sel, .linha-viva, .divisao').forEach((el) => el.remove());
  copia.querySelectorAll('.sel, .ativo').forEach((el) => el.classList.remove('sel', 'ativo'));
  copia.setAttribute('viewBox', vb.join(' '));
  copia.setAttribute('width', String(W)); copia.setAttribute('height', String(H));
  copia.setAttribute('data-theme', 'light');
  copia.classList.remove('arrastando', 'desenhando', 'ferr-parede', 'com-dividir', 'cortando', 'medindo', 'pan-espaco');
  const raiz = getComputedStyle(document.documentElement);
  copia.setAttribute('style', `--fonte-titulo:${raiz.getPropertyValue('--fonte-titulo')};--fonte-corpo:${raiz.getPropertyValue('--fonte-corpo')}`);
  const fundo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  fundo.setAttribute('x', String(vb[0])); fundo.setAttribute('y', String(vb[1])); fundo.setAttribute('width', String(vb[2])); fundo.setAttribute('height', String(vb[3]));
  fundo.setAttribute('style', 'fill:var(--paper-2)');
  copia.insertBefore(fundo, copia.firstChild);
  const estilo = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  estilo.textContent = (await estilos()) + `\n#planta{position:static;width:${W}px;height:${H}px;cursor:default}`;
  copia.insertBefore(estilo, copia.firstChild);
  const texto = new XMLSerializer().serializeToString(copia);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((ok, erro) => { img.onload = () => ok(); img.onerror = () => erro(new Error('svg')); img.src = url; });
    const rodape = 64, tela = document.createElement('canvas');
    tela.width = W; tela.height = H + rodape;
    const c = tela.getContext('2d');
    if (!c) return null;
    c.fillStyle = '#F6F7F4'; c.fillRect(0, 0, tela.width, tela.height);
    c.drawImage(img, 0, 0, W, H);
    c.fillStyle = '#1B1F24';
    c.font = `700 30px ${raiz.getPropertyValue('--fonte-titulo') || 'sans-serif'}, 'Arial Narrow', sans-serif`;
    c.textBaseline = 'middle';
    c.fillText(titulo, 28, H + rodape / 2);
    c.fillStyle = '#6B7280'; c.textAlign = 'right';
    c.font = `600 22px ${raiz.getPropertyValue('--fonte-corpo') || 'sans-serif'}, sans-serif`;
    c.fillText('cabeai.howlks.com', W - 28, H + rodape / 2);
    return await new Promise<Blob | null>((ok) => tela.toBlob((b) => ok(b), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Salva (ou compartilha, no celular) a imagem da planta. */
export async function salvarImagem(titulo: string, nome: string): Promise<'baixou' | 'compartilhou' | 'erro'> {
  let blob: Blob | null = null;
  try { blob = await pngDaPlanta(titulo); } catch { blob = null; }
  if (!blob) return 'erro';
  const arquivo = new File([blob], nome, { type: 'image/png' });
  const toque = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: 'Cabeaí', text: titulo }); return 'compartilhou'; } catch (e) { if ((e as Error)?.name === 'AbortError') return 'compartilhou'; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'baixou';
}

export const nomeImagem = () => tx('cabeai-planta-', 'cabeai-plan-') + new Date().toISOString().slice(0, 10) + '.png';

/** O botão "Salvar a planta como imagem": título com a área da casa (ou o nome do cômodo, vendo um só). */
export async function imagemDaPlanta() {
  const s = useApp.getState(), d = s.dados, q = s.comodo ? d.comodos[s.comodo] : null;
  const titulo = s.vista === 'um' && q ? `Cabeaí · ${q.nome}` : `Cabeaí · ${tx('Casa', 'Home')} · ${fmtArea(areaDaCasa(d))}`;
  toast(tx('Preparando a imagem…', 'Preparing the image…'));
  const r = await salvarImagem(titulo, nomeImagem());
  if (r === 'erro') toast(tx('Não deu para montar a imagem neste navegador.', 'Couldn’t make the image in this browser.'), 'erro');
  else if (r === 'baixou') toast(tx('Imagem da planta salva nos downloads.', 'Floor plan image saved to your downloads.'));
}
