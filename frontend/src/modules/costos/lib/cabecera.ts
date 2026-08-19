import type {
  GuardarRequerimientoPayload,
  Requerimiento,
} from '@/modules/costos/types';

/**
 * El estado del formulario de cabecera (§13) y sus conversiones.
 *
 * Viven aquí y no junto al componente porque `react-refresh` exige que
 * un archivo de componentes exporte SOLO componentes: mezclar constantes
 * y funciones rompe el recarga en caliente durante el desarrollo.
 *
 * Todo es texto: es lo que devuelve un `<input>`, y convertir a número
 * solo al enviar evita que un campo a medio escribir se vuelva `NaN`.
 */
export interface Cabecera {
  tipoMantenimientoId: string;
  tipoRequerimientoId: string;
  supervisorId: string;
  clienteId: string;
  lugarEntrega: string;
  fechaEntrega: string;
}

export const CABECERA_VACIA: Cabecera = {
  tipoMantenimientoId: '',
  tipoRequerimientoId: '',
  supervisorId: '',
  clienteId: '',
  lugarEntrega: '',
  fechaEntrega: '',
};

/** Los seis campos de §13 son obligatorios. */
export function cabeceraCompleta(c: Cabecera): boolean {
  return Object.values(c).every((v) => v.trim() !== '');
}

/** Lo que espera el backend: los ids como número. */
export function aPayload(c: Cabecera): GuardarRequerimientoPayload {
  return {
    tipoMantenimientoId: Number(c.tipoMantenimientoId),
    tipoRequerimientoId: Number(c.tipoRequerimientoId),
    supervisorId: Number(c.supervisorId),
    clienteId: Number(c.clienteId),
    lugarEntrega: c.lugarEntrega.trim(),
    fechaEntrega: c.fechaEntrega,
  };
}

/**
 * Solo lo que §54 deja tocar con el requerimiento ya emitido.
 *
 * Mandar el resto haría que el backend rechazara la petición entera por
 * campos que ni siquiera se quieren cambiar.
 */
export function aPayloadLogistico(c: Cabecera): GuardarRequerimientoPayload {
  return {
    lugarEntrega: c.lugarEntrega.trim(),
    fechaEntrega: c.fechaEntrega,
  };
}

/**
 * El formulario tal como está guardado.
 *
 * Se DERIVA del requerimiento en cada render en vez de sembrarse con un
 * efecto: `setState` dentro de `useEffect` provoca un render en cascada
 * y, sobre todo, deja una copia que se queda atrás cuando el servidor
 * devuelve otra cosa.
 */
export function cabeceraDe(req: Requerimiento): Cabecera {
  return {
    tipoMantenimientoId: String(req.tipoMantenimientoId),
    tipoRequerimientoId: String(req.tipoRequerimientoId),
    supervisorId: String(req.supervisorId),
    clienteId: String(req.clienteId),
    lugarEntrega: req.lugarEntrega,
    // Llega ISO completo; el `<input type="date">` quiere solo el día.
    fechaEntrega: req.fechaEntrega.slice(0, 10),
  };
}
