export interface MetadataEvidencia {
  fecha: Date;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  direccion: string[] | null;
}

const MESES_ES = [
  'ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.',
  'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.',
];

function formatearFecha(fecha: Date): string {
  const dia = fecha.getDate().toString().padStart(2, '0');
  const mes = MESES_ES[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} ${mes} ${anio}`;
}

function formatearHora(fecha: Date): string {
  const horas = fecha.getHours().toString().padStart(2, '0');
  const minutos = fecha.getMinutes().toString().padStart(2, '0');
  const segundos = fecha.getSeconds().toString().padStart(2, '0');
  return `${horas}:${minutos}:${segundos}`;
}

function formatearCoordenada(
  valor: number,
  letraPositivo: string,
  letraNegativo: string,
): string {
  const letra = valor >= 0 ? letraPositivo : letraNegativo;
  return `${Math.abs(valor).toFixed(4)}${letra}`;
}

function construirLineasMetadata(metadata: MetadataEvidencia): string[] {
  const lineas: string[] = [];

  lineas.push(formatearFecha(metadata.fecha));
  lineas.push(formatearHora(metadata.fecha));

  if (metadata.latitude !== null && metadata.longitude !== null) {
    const lat = formatearCoordenada(metadata.latitude, 'N', 'S');
    const lon = formatearCoordenada(metadata.longitude, 'E', 'W');
    lineas.push(`${lat} ${lon}`);

    if (metadata.accuracy !== null && Number.isFinite(metadata.accuracy)) {
      lineas.push(`±${metadata.accuracy.toFixed(2)} m`);
    }
  }

  if (metadata.direccion && metadata.direccion.length > 0) {
    lineas.push(...metadata.direccion);
  }

  return lineas;
}

/**
 * Dibuja el logo (esquina superior derecha) y la metadata de evidencia
 * (esquina inferior derecha) directamente sobre un canvas que ya
 * contiene la fotografía capturada.
 *
 * Todos los tamaños se calculan proporcionalmente al tamaño del
 * canvas, por lo que funciona igual en portrait/landscape y en
 * cualquier resolución (720x1280, 1080x1920, 1440x2560, etc.).
 */
export function dibujarEvidenciaSobreCanvas(
  contexto: CanvasRenderingContext2D,
  ancho: number,
  alto: number,
  logo: HTMLImageElement | null,
  metadata: MetadataEvidencia,
): void {
  const dimensionBase = Math.min(ancho, alto);
  const padding = Math.max(dimensionBase * 0.035, 14);

  // ---- LOGO (esquina superior derecha) ----
  if (logo && logo.naturalWidth > 0 && logo.naturalHeight > 0) {
    const anchoMaximoLogo = Math.min(ancho * 0.28, 220);
    const relacion = logo.naturalWidth / logo.naturalHeight;

    let logoAncho = anchoMaximoLogo;
    let logoAlto = logoAncho / relacion;

    const altoMaximoLogo = alto * 0.14;

    if (logoAlto > altoMaximoLogo) {
      logoAlto = altoMaximoLogo;
      logoAncho = logoAlto * relacion;
    }

    const logoX = ancho - logoAncho - padding;
    const logoY = padding;

    contexto.save();
    contexto.shadowColor = 'rgba(0, 0, 0, 0.35)';
    contexto.shadowBlur = dimensionBase * 0.01;
    contexto.drawImage(logo, logoX, logoY, logoAncho, logoAlto);
    contexto.restore();
  }

  // ---- METADATA (esquina inferior derecha) ----
  const lineas = construirLineasMetadata(metadata);

  if (lineas.length === 0) {
    return;
  }

  const fontSize = Math.max(Math.min(dimensionBase * 0.026, 30), 14);
  const alturaLinea = fontSize * 1.35;

  contexto.save();
  contexto.textAlign = 'right';
  contexto.textBaseline = 'alphabetic';
  contexto.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  contexto.fillStyle = '#FFFFFF';
  contexto.shadowColor = 'rgba(0, 0, 0, 0.85)';
  contexto.shadowBlur = fontSize * 0.3;
  contexto.shadowOffsetX = 1;
  contexto.shadowOffsetY = 1;

  const xTexto = ancho - padding;
  let yTexto = alto - padding;

  for (let i = lineas.length - 1; i >= 0; i -= 1) {
    contexto.fillText(lineas[i], xTexto, yTexto);
    yTexto -= alturaLinea;
  }

  contexto.restore();
}