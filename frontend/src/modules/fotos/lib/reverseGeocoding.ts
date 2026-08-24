interface CacheEntrada {
  clave: string;
  lineas: string[];
}

const DECIMALES_CACHE = 4;
let cacheUltimaConsulta: CacheEntrada | null = null;

function clavePosicion(lat: number, lon: number): string {
  return `${lat.toFixed(DECIMALES_CACHE)},${lon.toFixed(DECIMALES_CACHE)}`;
}

/**
 * Obtiene una dirección legible a partir de coordenadas GPS usando
 * el servicio público de Nominatim (OpenStreetMap), 100% frontend.
 *
 * Tolerante a fallos: ante cualquier error, timeout, o falta de red,
 * devuelve `null` y NUNCA debe bloquear la generación de la fotografía.
 *
 * Cachea la última consulta exitosa para evitar llamadas repetidas
 * cuando el usuario toma varias fotos seguidas en el mismo lugar.
 */
export async function obtenerDireccionLegible(
  latitude: number,
  longitude: number,
  timeoutMs = 5000,
): Promise<string[] | null> {
  const clave = clavePosicion(latitude, longitude);

  if (cacheUltimaConsulta?.clave === clave) {
    return cacheUltimaConsulta.lineas;
  }

  const controlador = new AbortController();
  const timer = window.setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

    const respuesta = await fetch(url, {
      signal: controlador.signal,
      headers: { Accept: 'application/json' },
    });

    if (!respuesta.ok) {
      return null;
    }

    const datos = await respuesta.json();
    const direccion = datos?.address;

    if (!direccion) {
      return null;
    }

    const lineaVia = [direccion.house_number, direccion.road]
      .filter(Boolean)
      .join(' ');

    const lineaBarrio =
      direccion.suburb ||
      direccion.neighbourhood ||
      direccion.quarter ||
      null;

    const lineaCiudad =
      direccion.city_district ||
      direccion.city ||
      direccion.town ||
      direccion.municipality ||
      null;

    const lineaRegion =
      direccion.state || direccion.state_district || direccion.region || null;

    const lineas = [lineaVia, lineaBarrio, lineaCiudad, lineaRegion].filter(
      (linea): linea is string =>
        typeof linea === 'string' && linea.trim().length > 0,
    );

    if (lineas.length === 0) {
      return null;
    }

    cacheUltimaConsulta = { clave, lineas };

    return lineas;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}