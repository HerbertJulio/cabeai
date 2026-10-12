// Fotos no navegador: reduz a foto do desenho antes de mandar para a IA (menos dados, mesma leitura).
/** Lê a foto, respeita a orientação do celular, diminui para no máximo "max" pixels no lado maior e devolve um JPEG (data URL). */
export async function reduzirImagem(f: Blob, max = 1600, qualidade = 0.85): Promise<string> {
  let fonte: CanvasImageSource, w0 = 0, h0 = 0;
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
    fonte = bmp; w0 = bmp.width; h0 = bmp.height;
  } catch {
    const url = URL.createObjectURL(f);
    try {
      const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
      fonte = img; w0 = img.naturalWidth; h0 = img.naturalHeight;
    } finally { URL.revokeObjectURL(url); }
  }
  if (!w0 || !h0) throw new Error('imagem vazia');
  const k = Math.min(1, max / Math.max(w0, h0)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const g = c.getContext('2d');
  if (!g) throw new Error('sem canvas');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(fonte, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', qualidade);
}
