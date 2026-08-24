const cache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Carga y cachea una imagen (por ejemplo, el logo desde assets)
 * como HTMLImageElement, para poder dibujarla con Canvas.
 *
 * Se cachea por URL para no volver a cargarla en cada fotografía.
 */
export function cargarImagen(src: string): Promise<HTMLImageElement> {
  const existente = cache.get(src);

  if (existente) {
    return existente;
  }

  const promesa = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`No se pudo cargar la imagen: ${src}`));
    img.src = src;
  });

  cache.set(src, promesa);

  return promesa;
}