import { leerToken } from '@/shared/services/api';
import { API_URL } from '@/shared/lib/constants';

/**
 * Pide un archivo al backend y lo baja con su nombre.
 *
 * Va por `fetch` y no por axios porque hace falta leer la cabecera
 * `Content-Disposition`: el nombre lo decide el servidor, que es quien
 * sabe el código del documento o la dimensión del reporte.
 *
 * El archivo se genera en el momento de pedirlo. No hay copia guardada
 * en el sistema que pueda quedar desfasada de los datos.
 */
export async function descargarArchivo(
  ruta: string,
  nombrePorDefecto: string,
): Promise<string> {
  const token = leerToken();
  const res = await fetch(`${API_URL}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(cuerpo?.message ?? 'No se pudo generar el archivo.');
  }

  const disposicion = res.headers.get('content-disposition') ?? '';
  const nombre =
    /filename="([^"]+)"/.exec(disposicion)?.[1] ?? nombrePorDefecto;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
  return nombre;
}
