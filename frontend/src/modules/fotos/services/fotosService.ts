import { api } from '@/shared/services/api';
import type { RespuestaLogin } from '@/modules/auth/types';
import type { EventoFotos, Plantilla, PlantillaResumen, NodoPlantillaNuevo, PreviaImportacion, DecisionImportacion, Album, Bandeja, DestinoFotos, Comentario, EntidadComentable, EstadoTarea, NuevaTarea, Tarea, AutorDeCarpeta, BusquedaDeEquipos, CarpetaCompartible, CarpetaListada, ContenidoCarpeta, EquipoDeCatalogo, FiltrosGaleria, Galeria, InvitacionAbierta, ListaCompartidos, Orden, OrganizacionDeCatalogo, PermisoCarpeta, UbicacionDeCatalogo, ResultadoCompartir, ResultadoSubida } from '@/modules/fotos/types';

// Módulo Fotos v3. Un recurso, un nombre: las carpetas se leen y se
// escriben en `/fotos/carpeta`. La `/fotos/sede` de v2 desapareció —creaba
// lo que otra ruta devolvía con otro nombre—.

// ── Navegación ──

/**
 * Contenido de una carpeta. `null` es la raíz.
 *
 * Con `q` deja de ser el contenido de la carpeta y pasa a ser una búsqueda
 * en todo el árbol visible, igual que en Drive.
 */
export async function verCarpeta(
  carpetaId: number | null,
  opciones: { q?: string; orden?: Orden } = {},
): Promise<ContenidoCarpeta> {
  const { data } = await api.get<ContenidoCarpeta>(
    carpetaId === null ? '/fotos/carpeta' : `/fotos/carpeta/${carpetaId}`,
    {
      params: {
        ...(opciones.q?.trim() ? { q: opciones.q.trim() } : {}),
        ...(opciones.orden ? { orden: opciones.orden } : {}),
      },
    },
  );
  return data;
}

/** Lo que cambió hace menos, de todo lo que este usuario alcanza. */
export async function verRecientes(): Promise<{ carpetas: CarpetaListada[] }> {
  const { data } = await api.get<{ carpetas: CarpetaListada[] }>(
    '/fotos/recientes',
  );
  return data;
}

// ── Álbumes y fotos ──

/** Galería paginada POR ÁLBUM: un álbum son 10 fotos como máximo. */
export async function verGaleria(
  carpetaId: number,
  filtros: FiltrosGaleria,
  cursor?: number,
): Promise<Galeria> {
  const { data } = await api.get<Galeria>(
    `/fotos/carpeta/${carpetaId}/album`,
    {
      params: {
        ...(cursor !== undefined ? { cursor } : {}),
        ...(filtros.subidaPorId !== null
          ? { subidaPorId: filtros.subidaPorId }
          : {}),
        ...(filtros.desde ? { desde: filtros.desde } : {}),
        ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
      },
    },
  );
  return data;
}

export async function verAutores(carpetaId: number): Promise<AutorDeCarpeta[]> {
  const { data } = await api.get<AutorDeCarpeta[]>(
    `/fotos/carpeta/${carpetaId}/autores`,
  );
  return data;
}

/**
 * Sube fotos a una carpeta. El álbum se crea solo — no hay paso previo de
 * "crear álbum". Se manda multipart: el navegador pone el boundary del
 * Content-Type, así que NO se fija a mano.
 */
export async function subirFotos(
  carpetaId: number,
  archivos: File[],
  descripcion: string,
): Promise<ResultadoSubida> {
  const form = new FormData();
  for (const archivo of archivos) form.append('fotos', archivo);
  if (descripcion.trim()) form.append('descripcion', descripcion.trim());

  const { data } = await api.post<ResultadoSubida>(
    `/fotos/carpeta/${carpetaId}/album`,
    form,
  );
  return data;
}

export async function eliminarFoto(fotoId: number): Promise<void> {
  await api.delete(`/fotos/foto/${fotoId}`);
}

export async function descargarFoto(
  fotoId: number,
  portal = false,
): Promise<{ url: string; nombreArchivo: string }> {
  const { data } = await api.get<{ url: string; nombreArchivo: string }>(
    portal
      ? `/portal/foto/${fotoId}/descarga`
      : `/fotos/foto/${fotoId}/descarga`,
  );
  return data;
}

// ── Carpetas: administrar ──

export async function crearCarpeta(payload: {
  nombre: string;
  parentId: number | null;
  /** `EQUIPO` obliga a mandar `equipoId` (§12); por defecto, `CARPETA`. */
  tipo?: 'CARPETA' | 'EQUIPO';
  equipoId?: number;
}) {
  const { data } = await api.post('/fotos/carpeta', payload);
  return data as { id: number; nombre: string };
}

/** Renombrar y/o mover. Archivar tiene su propia ruta: otra regla. */
export async function editarCarpeta(
  id: number,
  payload: { nombre?: string; parentId?: number | null },
) {
  const { data } = await api.patch(`/fotos/carpeta/${id}`, payload);
  return data as { id: number; nombre: string; cerrada: boolean };
}

export async function archivarCarpeta(id: number, cerrada: boolean) {
  const { data } = await api.post(
    `/fotos/carpeta/${id}/${cerrada ? 'archivar' : 'reabrir'}`,
  );
  return data as { id: number; nombre: string; cerrada: boolean };
}

export async function eliminarCarpeta(id: number): Promise<void> {
  await api.delete(`/fotos/carpeta/${id}`);
}

// ── Catálogo de equipos (§12) ──
// Puerta de solo lectura al catálogo de Gestión de equipos, más el atajo de
// registro. Fotos no administra equipos: los referencia.

export async function organizacionesDeCatalogo(): Promise<
  OrganizacionDeCatalogo[]
> {
  const { data } = await api.get<OrganizacionDeCatalogo[]>(
    '/fotos/catalogo-equipos/organizacion',
  );
  return data;
}

export async function ubicacionesDeCatalogo(
  organizacionId: number,
): Promise<UbicacionDeCatalogo[]> {
  const { data } = await api.get<UbicacionDeCatalogo[]>(
    `/fotos/catalogo-equipos/organizacion/${organizacionId}/ubicacion`,
  );
  return data;
}

export async function buscarEquipos(
  organizacionId: number,
  q: string,
): Promise<BusquedaDeEquipos> {
  const { data } = await api.get<BusquedaDeEquipos>(
    `/fotos/catalogo-equipos/organizacion/${organizacionId}/equipo`,
    { params: { ...(q.trim() ? { q: q.trim() } : {}) } },
  );
  return data;
}

/**
 * El atajo de §12: registra un equipo sin salir de Fotos.
 *
 * `valores` va indexado por la clave del campo dinámico, igual que lo espera
 * Gestión de equipos — este atajo llama a su mismo service.
 */
export async function crearEquipoDesdeFotos(payload: {
  organizacionId: number;
  nodoId: number;
  codigoInterno?: string;
  valores?: Record<string, string>;
}): Promise<EquipoDeCatalogo> {
  const { data } = await api.post<EquipoDeCatalogo>(
    '/fotos/catalogo-equipos/equipo',
    payload,
  );
  return data;
}

// ── Compartir ──
// Correo primero, carpetas después: un solo paso, sin tener que navegar
// hasta cada carpeta para compartirla desde dentro.

/** Árbol que quien comparte puede ofrecer en el selector. */
export async function carpetasCompartibles(): Promise<CarpetaCompartible[]> {
  const { data } = await api.get<CarpetaCompartible[]>(
    '/fotos/compartir/carpetas',
  );
  return data;
}

export async function verCompartidos(
  carpetaId: number,
): Promise<ListaCompartidos> {
  const { data } = await api.get<ListaCompartidos>(
    `/fotos/compartir/carpeta/${carpetaId}`,
  );
  return data;
}

export async function compartir(
  email: string,
  carpetaIds: number[],
  permiso: PermisoCarpeta,
  /** Los dos opcionales del formulario «Agregar colaborador» de §9. */
  extra: { expiraEn?: string; nombre?: string } = {},
): Promise<ResultadoCompartir> {
  const { data } = await api.post<ResultadoCompartir>('/fotos/compartir', {
    email,
    carpetaIds,
    permiso,
    ...(extra.expiraEn?.trim() ? { expiraEn: extra.expiraEn.trim() } : {}),
    ...(extra.nombre?.trim() ? { nombre: extra.nombre.trim() } : {}),
  });
  return data;
}

/**
 * Cambiar el grado de alguien sobre una carpeta (§10).
 *
 * Admite `SIN_ACCESO`, que no es un grado sino la restricción de §7 sobre
 * una subcarpeta que se heredaba.
 */
export async function cambiarGrado(
  carpetaId: number,
  usuarioId: number,
  permiso: PermisoCarpeta,
): Promise<{ permiso: PermisoCarpeta; anterior: PermisoCarpeta | null }> {
  const { data } = await api.patch<{
    permiso: PermisoCarpeta;
    anterior: PermisoCarpeta | null;
  }>(`/fotos/compartir/carpeta/${carpetaId}/acceso/${usuarioId}`, { permiso });
  return data;
}

export async function dejarDeCompartir(
  carpetaId: number,
  usuarioId: number,
): Promise<void> {
  await api.delete(`/fotos/compartir/carpeta/${carpetaId}/acceso/${usuarioId}`);
}

export async function reenviarInvitacion(
  invitacionId: number,
): Promise<ResultadoCompartir> {
  const { data } = await api.post<ResultadoCompartir>(
    `/fotos/compartir/invitacion/${invitacionId}/reenviar`,
  );
  return data;
}

export async function cancelarInvitacion(
  invitacionId: number,
): Promise<void> {
  await api.delete(`/fotos/compartir/invitacion/${invitacionId}`);
}

// ── Invitación (pública, sin sesión) ──

export async function abrirInvitacion(
  token: string,
): Promise<InvitacionAbierta> {
  const { data } = await api.get<InvitacionAbierta>(`/invitacion/${token}`);
  return data;
}

export async function activarInvitacion(
  token: string,
  payload: { nombre: string; password: string },
): Promise<RespuestaLogin> {
  const { data } = await api.post<RespuestaLogin>(
    `/invitacion/${token}/activar`,
    payload,
  );
  return data;
}

// ── Portal del cliente externo ──

export async function verCarpetaPortal(
  sedeId: number | null,
): Promise<ContenidoCarpeta> {
  const { data } = await api.get<ContenidoCarpeta>(
    sedeId === null ? '/portal/carpeta' : `/portal/carpeta/${sedeId}`,
  );
  return data;
}

export async function verGaleriaPortal(
  sedeId: number,
  filtros: FiltrosGaleria,
  cursor?: number,
): Promise<Galeria> {
  const { data } = await api.get<Galeria>(`/portal/carpeta/${sedeId}/foto`, {
    params: {
      ...(cursor !== undefined ? { cursor } : {}),
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
    },
  });
  return data;
}

// ── Tareas (§13) ──

export async function verTareas(
  carpetaId: number,
  estado?: EstadoTarea,
): Promise<Tarea[]> {
  const { data } = await api.get<Tarea[]>(`/fotos/carpeta/${carpetaId}/tarea`, {
    params: estado ? { estado } : {},
  });
  return data;
}

export async function crearTarea(
  carpetaId: number,
  payload: NuevaTarea,
): Promise<Tarea> {
  const { data } = await api.post<Tarea>(
    `/fotos/carpeta/${carpetaId}/tarea`,
    payload,
  );
  return data;
}

export async function editarTarea(
  id: number,
  payload: Partial<NuevaTarea>,
): Promise<Tarea> {
  const { data } = await api.patch<Tarea>(`/fotos/tarea/${id}`, payload);
  return data;
}

/**
 * El check rápido de §13. Dos rutas y no un PATCH con `{estado}`: escribe
 * tres columnas a la vez —estado, cuándo y quién— y se dispara desde una
 * casilla, no desde el formulario.
 */
export async function marcarTarea(
  id: number,
  completada: boolean,
): Promise<Tarea> {
  const { data } = await api.post<Tarea>(
    `/fotos/tarea/${id}/${completada ? 'completar' : 'reabrir'}`,
  );
  return data;
}

export async function eliminarTarea(id: number): Promise<void> {
  await api.delete(`/fotos/tarea/${id}`);
}

// ── Comentarios (§14) ──

export async function verComentarios(
  entidad: EntidadComentable,
  entidadId: number,
): Promise<Comentario[]> {
  const { data } = await api.get<Comentario[]>(
    `/fotos/comentario/${entidad}/${entidadId}`,
  );
  return data;
}

export async function comentar(
  entidad: EntidadComentable,
  entidadId: number,
  texto: string,
): Promise<Comentario> {
  const { data } = await api.post<Comentario>(
    `/fotos/comentario/${entidad}/${entidadId}`,
    { texto },
  );
  return data;
}

export async function editarComentario(
  id: number,
  texto: string,
): Promise<Comentario> {
  const { data } = await api.patch<Comentario>(`/fotos/comentario/${id}`, {
    texto,
  });
  return data;
}

export async function eliminarComentario(id: number): Promise<void> {
  await api.delete(`/fotos/comentario/${id}`);
}

// ── Álbumes con nombre (§16) ──

export async function crearAlbum(
  carpetaId: number,
  payload: {
    nombre: string;
    descripcion?: string | null;
    fecha?: string | null;
  },
): Promise<Album> {
  const { data } = await api.post<Album>(
    `/fotos/album/carpeta/${carpetaId}`,
    payload,
  );
  return data;
}

export async function editarAlbum(
  id: number,
  payload: { nombre?: string | null; descripcion?: string | null; fecha?: string | null },
): Promise<Album> {
  const { data } = await api.patch<Album>(`/fotos/album/${id}`, payload);
  return data;
}

// ── Subir a cualquiera de los cuatro destinos (§15-§18) ──

/**
 * La ruta de subida sale del destino, no de un `if` en cada pantalla.
 *
 * Un solo sitio traduce «a dónde va» a «qué URL es», así que añadir un
 * destino no obliga a repasar las pantallas que suben.
 */
function rutaDeSubida(destino: DestinoFotos): string {
  switch (destino.tipo) {
    case 'carpeta':
      return `/fotos/carpeta/${destino.carpetaId}/album`;
    case 'album':
      return `/fotos/album/${destino.albumId}/foto`;
    case 'tarea':
      return `/fotos/tarea/${destino.tareaId}/foto`;
    case 'bandeja':
      return '/fotos/bandeja';
  }
}

export async function subirA(
  destino: DestinoFotos,
  archivos: File[],
  descripcion: string,
): Promise<ResultadoSubida> {
  const form = new FormData();
  for (const archivo of archivos) form.append('fotos', archivo);
  if (descripcion.trim()) form.append('descripcion', descripcion.trim());

  const { data } = await api.post<ResultadoSubida>(
    rutaDeSubida(destino),
    form,
  );
  return data;
}

// ── Bandeja de pendientes (§18) ──

export async function verBandeja(): Promise<Bandeja> {
  const { data } = await api.get<Bandeja>('/fotos/bandeja');
  return data;
}

export async function clasificarFotos(
  fotoIds: number[],
  destino: DestinoFotos,
): Promise<{ clasificadas: number; albumId: number | null }> {
  if (destino.tipo === 'bandeja')
    throw new Error('Clasificar es sacarlas de la bandeja, no devolverlas.');

  const { data } = await api.post<{ clasificadas: number; albumId: number | null }>(
    '/fotos/bandeja/clasificar',
    {
      fotoIds,
      ...(destino.tipo === 'carpeta' ? { carpetaId: destino.carpetaId } : {}),
      ...(destino.tipo === 'album' ? { albumId: destino.albumId } : {}),
      ...(destino.tipo === 'tarea' ? { tareaId: destino.tareaId } : {}),
    },
  );
  return data;
}

// ── Auditoría (§23) ──

export async function verAuditoria(filtros: {
  usuarioId?: number | null;
  accion?: string;
  desde?: string;
  hasta?: string;
  cursor?: number;
}): Promise<{ eventos: EventoFotos[]; siguiente: number | null }> {
  const { data } = await api.get<{
    eventos: EventoFotos[];
    siguiente: number | null;
  }>('/fotos/auditoria', {
    params: {
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
      ...(filtros.accion ? { accion: filtros.accion } : {}),
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
      ...(filtros.cursor ? { cursor: filtros.cursor } : {}),
    },
  });
  return data;
}

// ── Plantillas de estructura (§20) ──

export async function verPlantillas(
  soloActivas = false,
): Promise<PlantillaResumen[]> {
  const { data } = await api.get<PlantillaResumen[]>('/fotos/plantilla', {
    params: soloActivas ? { activas: 'true' } : {},
  });
  return data;
}

export async function verPlantilla(id: number): Promise<Plantilla> {
  const { data } = await api.get<Plantilla>(`/fotos/plantilla/${id}`);
  return data;
}

export async function crearPlantilla(payload: {
  nombre: string;
  descripcion?: string | null;
  nodos?: NodoPlantillaNuevo[];
}): Promise<Plantilla> {
  const { data } = await api.post<Plantilla>('/fotos/plantilla', payload);
  return data;
}

export async function editarPlantilla(
  id: number,
  payload: {
    nombre?: string;
    descripcion?: string | null;
    activa?: boolean;
    nodos?: NodoPlantillaNuevo[];
  },
): Promise<Plantilla> {
  const { data } = await api.patch<Plantilla>(`/fotos/plantilla/${id}`, payload);
  return data;
}

export async function eliminarPlantilla(id: number): Promise<void> {
  await api.delete(`/fotos/plantilla/${id}`);
}

export async function aplicarPlantilla(
  plantillaId: number,
  carpetaId: number,
): Promise<{
  plantilla: string;
  carpetas: number;
  tareas: number;
  albumes: number;
  aviso: string | null;
}> {
  const { data } = await api.post<{
    plantilla: string;
    carpetas: number;
    tareas: number;
    albumes: number;
    aviso: string | null;
  }>(`/fotos/plantilla/${plantillaId}/aplicar/${carpetaId}`);
  return data;
}

// ── Importación por Excel (§19) ──
//
// El archivo se manda DOS veces —previa y confirmar— a propósito: así el
// servidor no guarda estado de sesión entre los dos pasos.

export async function previaImportacion(
  carpetaId: number,
  archivo: File,
): Promise<PreviaImportacion> {
  const form = new FormData();
  form.append('archivo', archivo);
  const { data } = await api.post<PreviaImportacion>(
    `/fotos/importacion/carpeta/${carpetaId}/previa`,
    form,
  );
  return data;
}

export async function confirmarImportacion(
  carpetaId: number,
  archivo: File,
  decisiones: Record<number, DecisionImportacion>,
): Promise<{
  creado: { carpetas: number; tareas: number; albumes: number };
  omitido: { tareas: number; albumes: number };
  actualizado: { tareas: number; albumes: number };
}> {
  const form = new FormData();
  form.append('archivo', archivo);
  form.append('decisiones', JSON.stringify(decisiones));
  const { data } = await api.post<{
    creado: { carpetas: number; tareas: number; albumes: number };
    omitido: { tareas: number; albumes: number };
    actualizado: { tareas: number; albumes: number };
  }>(`/fotos/importacion/carpeta/${carpetaId}/confirmar`, form);
  return data;
}
