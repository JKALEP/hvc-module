import { api } from '@/shared/services/api';
import type { RespuestaLogin } from '@/modules/auth/types';
import type { MomentoEvidencia, TipoEvidencia, FamiliaSistema, TipoSistema, DefinicionActividad, Ciclo, EstadoEquipo, ColorEstado, ColoresDeCarpeta, CampoEquipo, CampoDeCarpeta, Persona, FotoDeActividad, EventoFotos, Plantilla, PlantillaResumen, NodoPlantillaNuevo, PreviaImportacion, DecisionImportacion, Bandeja, DestinoFotos, Comentario, EntidadComentable, EstadoActividad, NuevaActividad, Actividad, AutorDeCarpeta, CarpetaCompartible, CarpetaListada, ContenidoCarpeta, FiltrosGaleria, Galeria, InvitacionAbierta, ListaCompartidos, Orden, PermisoCarpeta, ResultadoCompartir, ResultadoSubida } from '@/modules/fotos/types';

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

// ── Las fotos de una visita ──

/**
 * Galería de un CICLO: lista plana de fotos, paginada por cursor.
 *
 * ⚠️ Paginaba por ÁLBUM y devolvía las fotos anidadas. Los álbumes se
 * retiraron en la Fase 4 y el agrupador pasó a ser el ciclo, que la pantalla
 * ya eligió antes de pedir esto.
 */
export async function verGaleria(
  cicloId: number,
  filtros: FiltrosGaleria,
  cursor?: number,
): Promise<Galeria> {
  const { data } = await api.get<Galeria>(
    `/fotos/ciclo/${cicloId}/foto`,
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

export async function verAutores(cicloId: number): Promise<AutorDeCarpeta[]> {
  const { data } = await api.get<AutorDeCarpeta[]>(
    `/fotos/ciclo/${cicloId}/autores`,
  );
  return data;
}

/**
 * Sube fotos sueltas a una visita.
 *
 * Sin paso previo de «crear álbum» — ya no hay ninguno: el destino existe
 * desde que el equipo se dio de alta. Se manda multipart: el navegador pone
 * el boundary del Content-Type, así que NO se fija a mano.
 */
export async function subirFotos(
  cicloId: number,
  archivos: File[],
  descripcion: string,
): Promise<ResultadoSubida> {
  const form = new FormData();
  for (const archivo of archivos) form.append('fotos', archivo);
  if (descripcion.trim()) form.append('descripcion', descripcion.trim());

  const { data } = await api.post<ResultadoSubida>(
    `/fotos/ciclo/${cicloId}/foto`,
    form,
  );
  return data;
}

/**
 * Corrige la descripción de una foto ya subida.
 *
 * Lo ÚNICO que se puede cambiar de una foto: la imagen no se reemplaza
 * —eso permitiría cambiar la prueba de una inspección sin que se note— y su
 * sitio se mueve por otra ruta.
 */
export async function editarDescripcionFoto(
  fotoId: number,
  descripcion: string | null,
): Promise<{ ok: boolean; id: number; descripcion: string | null }> {
  const { data } = await api.patch<{
    ok: boolean;
    id: number;
    descripcion: string | null;
  }>(`/fotos/foto/${fotoId}`, { descripcion });
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
  /**
   * `CARPETA` por defecto.
   *
   * ⚠️ `EQUIPO` ya NO lleva `equipoId`: desde la Fase 1a de «Gestión de
   * contenido» no hay enlace con el catálogo de Gestión de Equipos.
   */
  tipo?: 'CARPETA' | 'EQUIPO';
  /**
   * Los campos configurables del equipo, por CLAVE (Fase 1b). Solo con
   * `tipo = 'EQUIPO'`. Van en la misma llamada —y en la misma transacción
   * del servidor— que la carpeta: crear y rellenar en dos pasos deja una
   * carpeta a medias si el segundo falla, que en obra es el que se pierde.
   */
  valores?: Record<string, unknown>;
  /** Qué clase de sistema es (Fase 2). Solo con `tipo = 'EQUIPO'`. */
  tipoSistemaId?: number | null;
  /**
   * Qué actividades del catálogo estampar en el Ciclo 1 (Fase 2).
   *
   * ⚠️ Omitirlo y mandar `[]` NO es lo mismo: sin el campo el servidor
   * estampa la preselección del tipo de sistema; con lista vacía, ninguna.
   * El formulario manda SIEMPRE la lista, porque enseña las casillas.
   */
  actividades?: number[];
}) {
  const { data } = await api.post('/fotos/carpeta', payload);
  return data as { id: number; nombre: string };
}

/** Renombrar y/o mover. Archivar tiene su propia ruta: otra regla. */
export async function editarCarpeta(
  id: number,
  payload: {
    nombre?: string;
    parentId?: number | null;
    /** Corregir el tipo de sistema de un equipo (Fase 2). */
    tipoSistemaId?: number | null;
  },
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

// ── Catálogo de equipos — RETIRADO ──
//
// Aquí vivían `organizacionesDeCatalogo`, `ubicacionesDeCatalogo`,
// `buscarEquipos` y `crearEquipoDesdeFotos`: las cuatro llamadas a
// `/fotos/catalogo-equipos`, que era la puerta autorizada de Fotos al
// catálogo de Gestión de Equipos (§12). Se retiraron enteras en la Fase 1a
// de «Gestión de contenido», junto con el controller del backend, el
// selector de tres pasos y el atajo «Registrar y elegir».

// ── Color por tipo de carpeta (Fase 1c) ──

export async function coloresDeCarpeta(): Promise<ColoresDeCarpeta> {
  const { data } = await api.get<ColoresDeCarpeta>('/fotos/configuracion/color');
  return data;
}

/** De ADMIN_GLOBAL. Devuelve el mapa completo ya actualizado. */
export async function cambiarColorDeCarpeta(payload: {
  tipo: 'CARPETA' | 'EQUIPO';
  color: string;
}): Promise<ColoresDeCarpeta> {
  const { data } = await api.patch<ColoresDeCarpeta>(
    '/fotos/configuracion/color',
    payload,
  );
  return data;
}

// ── Campos configurables del EQUIPO (Fase 1b) ──
//
// Dos grupos con dos permisos: las DEFINICIONES las administra un
// ADMIN_GLOBAL y son globales al módulo; los VALORES los rellena quien
// tiene EDICION en la carpeta. Por eso unas cuelgan de `/fotos/campo` y
// los otros de `/fotos/carpeta/:id/campo`.

export async function listarCamposEquipo(
  soloActivos = false,
): Promise<CampoEquipo[]> {
  const { data } = await api.get<CampoEquipo[]>('/fotos/campo', {
    params: soloActivos ? { activos: 'true' } : {},
  });
  return data;
}

export async function crearCampoEquipo(payload: {
  nombre: string;
  tipo: string;
  orden?: number;
  opciones?: string[];
}): Promise<CampoEquipo> {
  const { data } = await api.post<CampoEquipo>('/fotos/campo', payload);
  return data;
}

/** Renombrar, reordenar y activar/desactivar. El `tipo` no se puede cambiar. */
export async function editarCampoEquipo(
  id: number,
  payload: { nombre?: string; orden?: number; activo?: boolean },
): Promise<CampoEquipo> {
  const { data } = await api.patch<CampoEquipo>(`/fotos/campo/${id}`, payload);
  return data;
}

export async function eliminarCampoEquipo(id: number) {
  const { data } = await api.delete<{ ok: boolean }>(`/fotos/campo/${id}`);
  return data;
}

export async function agregarOpcionCampo(
  id: number,
  etiqueta: string,
): Promise<CampoEquipo> {
  const { data } = await api.post<CampoEquipo>(`/fotos/campo/${id}/opcion`, {
    etiqueta,
  });
  return data;
}

export async function eliminarOpcionCampo(
  opcionId: number,
): Promise<CampoEquipo> {
  const { data } = await api.delete<CampoEquipo>(
    `/fotos/campo/opcion/${opcionId}`,
  );
  return data;
}

/** La ficha del equipo: cada campo con lo que tenga rellenado. */
export async function camposDeCarpeta(
  carpetaId: number,
): Promise<CampoDeCarpeta[]> {
  const { data } = await api.get<CampoDeCarpeta[]>(
    `/fotos/carpeta/${carpetaId}/campo`,
  );
  return data;
}

/**
 * Guarda los campos indicados.
 *
 * ⚠️ Es PARCIAL, no un reemplazo: una clave ausente se deja como está y
 * una con `null` se vacía. Un campo FOTO no viaja aquí —el backend lo
 * rechaza— porque una imagen no cabe en un JSON.
 */
export async function guardarCamposDeCarpeta(
  carpetaId: number,
  valores: Record<string, unknown>,
): Promise<CampoDeCarpeta[]> {
  const { data } = await api.put<CampoDeCarpeta[]>(
    `/fotos/carpeta/${carpetaId}/campo`,
    { valores },
  );
  return data;
}

export async function subirImagenDeCampo(
  carpetaId: number,
  campoId: number,
  archivo: File,
) {
  const form = new FormData();
  form.append('foto', archivo);
  const { data } = await api.post<{ url: string; urlMiniatura: string }>(
    `/fotos/carpeta/${carpetaId}/campo/${campoId}/imagen`,
    form,
  );
  return data;
}

export async function quitarImagenDeCampo(carpetaId: number, campoId: number) {
  const { data } = await api.delete<{ ok: boolean }>(
    `/fotos/carpeta/${carpetaId}/campo/${campoId}/imagen`,
  );
  return data;
}

// ── Compartir ──// ── Compartir ──
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
  cicloId: number,
  filtros: FiltrosGaleria,
  cursor?: number,
): Promise<Galeria> {
  // ⚠️ Desde la Fase 4 la galería del portal es la de un CICLO, igual que la
  // interna. Y sigue habiendo un motivo para mirar esta línea con atención:
  // antes pedía `carpeta/:id/foto`, que el backend nunca expuso, así que el
  // cliente veía CERO fotos en silencio. No se detectó en la Fase 7 porque la
  // carpeta con la que se probó el portal no tenía ninguna.
  const { data } = await api.get<Galeria>(`/portal/ciclo/${cicloId}/foto`, {
    params: {
      ...(cursor !== undefined ? { cursor } : {}),
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
    },
  });
  return data;
}

// ── Tipo de sistema y catálogo de actividades (Fase 2 del rediseño) ──

/** Las familias con sus tipos dentro: es como se pinta el desplegable. */
export async function verSistemas(
  soloActivos = false,
): Promise<FamiliaSistema[]> {
  const { data } = await api.get<FamiliaSistema[]>('/fotos/sistema', {
    params: soloActivos ? { activos: 'true' } : {},
  });
  return data;
}

export async function crearFamiliaSistema(payload: {
  nombre: string;
  orden?: number;
}): Promise<FamiliaSistema> {
  const { data } = await api.post<FamiliaSistema>(
    '/fotos/sistema/familia',
    payload,
  );
  return data;
}

export async function editarFamiliaSistema(
  id: number,
  payload: { nombre?: string; orden?: number; activo?: boolean },
): Promise<FamiliaSistema> {
  const { data } = await api.patch<FamiliaSistema>(
    `/fotos/sistema/familia/${id}`,
    payload,
  );
  return data;
}

export async function eliminarFamiliaSistema(id: number): Promise<void> {
  await api.delete(`/fotos/sistema/familia/${id}`);
}

export async function crearTipoSistema(payload: {
  familiaId: number;
  nombre: string;
  orden?: number;
}): Promise<TipoSistema> {
  const { data } = await api.post<TipoSistema>('/fotos/sistema/tipo', payload);
  return data;
}

export async function editarTipoSistema(
  id: number,
  payload: {
    familiaId?: number;
    nombre?: string;
    orden?: number;
    activo?: boolean;
  },
): Promise<TipoSistema> {
  const { data } = await api.patch<TipoSistema>(
    `/fotos/sistema/tipo/${id}`,
    payload,
  );
  return data;
}

export async function eliminarTipoSistema(id: number): Promise<void> {
  await api.delete(`/fotos/sistema/tipo/${id}`);
}

/**
 * El catálogo de actividades.
 *
 * `tipoSistemaId` lo acota a lo que se propone para ese tipo, que es
 * exactamente la preselección del formulario de alta de un equipo.
 */
export async function verCatalogoActividades(opciones: {
  soloActivas?: boolean;
  tipoSistemaId?: number | null;
} = {}): Promise<DefinicionActividad[]> {
  const { data } = await api.get<DefinicionActividad[]>(
    '/fotos/catalogo-actividad',
    {
      params: {
        ...(opciones.soloActivas ? { activas: 'true' } : {}),
        ...(opciones.tipoSistemaId ? { tipoSistema: opciones.tipoSistemaId } : {}),
      },
    },
  );
  return data;
}

export async function crearDefinicionActividad(payload: {
  nombre: string;
  descripcion?: string | null;
  orden?: number;
  evidencia?: TipoEvidencia;
  tiposSistema?: number[];
}): Promise<DefinicionActividad> {
  const { data } = await api.post<DefinicionActividad>(
    '/fotos/catalogo-actividad',
    payload,
  );
  return data;
}

export async function editarDefinicionActividad(
  id: number,
  payload: {
    nombre?: string;
    descripcion?: string | null;
    orden?: number;
    activo?: boolean;
    evidencia?: TipoEvidencia;
    tiposSistema?: number[];
  },
): Promise<DefinicionActividad> {
  const { data } = await api.patch<DefinicionActividad>(
    `/fotos/catalogo-actividad/${id}`,
    payload,
  );
  return data;
}

export async function eliminarDefinicionActividad(id: number): Promise<void> {
  await api.delete(`/fotos/catalogo-actividad/${id}`);
}

/** Trae actividades del catálogo a un ciclo abierto. */
export async function anadirDesdeCatalogo(
  cicloId: number,
  definiciones: number[],
): Promise<{ anadidas: number; omitidas: number }> {
  const { data } = await api.post<{ anadidas: number; omitidas: number }>(
    `/fotos/ciclo/${cicloId}/actividad/desde-catalogo`,
    { definiciones },
  );
  return data;
}

// ── Ciclos y estado del equipo (Fase 1 del rediseño) ──

/** El historial de visitas de un equipo, del más reciente al más antiguo. */
export async function verCiclos(carpetaId: number): Promise<Ciclo[]> {
  const { data } = await api.get<Ciclo[]>(`/fotos/carpeta/${carpetaId}/ciclo`);
  return data;
}

/** Abre una visita nueva, heredando el checklist de la anterior (§4.3). */
export async function abrirCiclo(carpetaId: number): Promise<Ciclo> {
  const { data } = await api.post<Ciclo>(`/fotos/carpeta/${carpetaId}/ciclo`);
  return data;
}

export async function cerrarCiclo(cicloId: number): Promise<Ciclo> {
  const { data } = await api.post<Ciclo>(`/fotos/ciclo/${cicloId}/cerrar`);
  return data;
}

export async function reabrirCiclo(cicloId: number): Promise<Ciclo> {
  const { data } = await api.post<Ciclo>(`/fotos/ciclo/${cicloId}/reabrir`);
  return data;
}

/** `null` lo deja sin definir, que es como nace cada ciclo. */
export async function cambiarEstadoCiclo(
  cicloId: number,
  estadoId: number | null,
): Promise<Ciclo> {
  const { data } = await api.patch<Ciclo>(`/fotos/ciclo/${cicloId}/estado`, {
    estadoId,
  });
  return data;
}

/**
 * El catálogo de estados (§7).
 *
 * Leerlo NO exige ser administrador: hace falta para elegir el estado de una
 * visita. `soloActivos` es lo que se ofrece en el formulario; la pantalla de
 * administración los quiere todos, retirados incluidos.
 */
export async function verEstadosEquipo(
  soloActivos = false,
): Promise<EstadoEquipo[]> {
  const { data } = await api.get<EstadoEquipo[]>('/fotos/estado-equipo', {
    params: soloActivos ? { activos: 'true' } : {},
  });
  return data;
}

export async function crearEstadoEquipo(payload: {
  nombre: string;
  color: ColorEstado;
  orden?: number;
}): Promise<EstadoEquipo> {
  const { data } = await api.post<EstadoEquipo>('/fotos/estado-equipo', payload);
  return data;
}

export async function editarEstadoEquipo(
  id: number,
  payload: {
    nombre?: string;
    color?: ColorEstado;
    orden?: number;
    activo?: boolean;
  },
): Promise<EstadoEquipo> {
  const { data } = await api.patch<EstadoEquipo>(
    `/fotos/estado-equipo/${id}`,
    payload,
  );
  return data;
}

export async function eliminarEstadoEquipo(id: number): Promise<void> {
  await api.delete(`/fotos/estado-equipo/${id}`);
}

// ── Actividades (§13) ──
//
// ⚠️ Cuelgan de un CICLO desde la Fase 1, no de la carpeta: un equipo repite
// la misma actividad en cada visita, así que «las actividades de esta
// carpeta» dejó de tener una respuesta única.

export async function verActividades(
  cicloId: number,
  estado?: EstadoActividad,
): Promise<Actividad[]> {
  const { data } = await api.get<Actividad[]>(`/fotos/ciclo/${cicloId}/actividad`, {
    params: estado ? { estado } : {},
  });
  return data;
}

export async function crearActividad(
  cicloId: number,
  payload: NuevaActividad,
): Promise<Actividad> {
  const { data } = await api.post<Actividad>(
    `/fotos/ciclo/${cicloId}/actividad`,
    payload,
  );
  return data;
}

export async function editarActividad(
  id: number,
  payload: Partial<NuevaActividad>,
): Promise<Actividad> {
  const { data } = await api.patch<Actividad>(`/fotos/actividad/${id}`, payload);
  return data;
}

/**
 * El check rápido de §13. Dos rutas y no un PATCH con `{estado}`: escribe
 * tres columnas a la vez —estado, cuándo y quién— y se dispara desde una
 * casilla, no desde el formulario.
 */
export async function marcarActividad(
  id: number,
  completada: boolean,
): Promise<Actividad> {
  const { data } = await api.post<Actividad>(
    `/fotos/actividad/${id}/${completada ? 'completar' : 'reabrir'}`,
  );
  return data;
}

export async function eliminarActividad(id: number): Promise<void> {
  await api.delete(`/fotos/actividad/${id}`);
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

// ⚠️ Aquí vivían `crearAlbum`, `editarAlbum` y `eliminarAlbum` (§16). Se
// fueron con los álbumes en la Fase 4: no hay ninguna ruta detrás, y el
// agrupador que hacía falta —la visita— ya existe sin que nadie lo cree.

// ── Subir a cualquiera de los TRES destinos (§15-§18) ──

/**
 * La ruta de subida sale del destino, no de un `if` en cada pantalla.
 *
 * Un solo sitio traduce «a dónde va» a «qué URL es», así que añadir un
 * destino no obliga a repasar las pantallas que suben.
 */
function rutaDeSubida(destino: DestinoFotos): string {
  switch (destino.tipo) {
    case 'ciclo':
      return `/fotos/ciclo/${destino.cicloId}/foto`;
    case 'actividad':
      return `/fotos/actividad/${destino.actividadId}/foto`;
    case 'bandeja':
      return '/fotos/bandeja';
  }
}

export async function subirA(
  destino: DestinoFotos,
  archivos: File[],
  descripcion: string,
  /**
   * El hueco del antes/después (Fase 3). Solo lo admite —y lo exige— una
   * actividad de tipo ANTES_DESPUES; el servidor rechaza lo demás.
   */
  momento?: MomentoEvidencia | null,
): Promise<ResultadoSubida> {
  const form = new FormData();
  for (const archivo of archivos) form.append('fotos', archivo);
  if (descripcion.trim()) form.append('descripcion', descripcion.trim());
  if (momento) form.append('momento', momento);

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

/** Traduce el destino tipado a los ids sueltos que espera el cuerpo JSON. */
function idsDeDestino(destino: DestinoFotos) {
  return {
    ...(destino.tipo === 'ciclo' ? { cicloId: destino.cicloId } : {}),
    ...(destino.tipo === 'actividad' ? { actividadId: destino.actividadId } : {}),
    ...(destino.tipo === 'bandeja' ? { bandeja: true } : {}),
  };
}

/**
 * Saca fotos de la bandeja y las mete en una visita o en una actividad.
 *
 * ⚠️ Ya no lleva nombre ni descripción: eran del ÁLBUM que se creaba al
 * clasificar hacia una carpeta (Fase 2c), y con los álbumes retirados el
 * destino ya existe y ya tiene nombre — es la visita.
 */
export async function clasificarFotos(
  fotoIds: number[],
  destino: DestinoFotos,
): Promise<{ clasificadas: number; cicloId: number | null }> {
  if (destino.tipo === 'bandeja')
    throw new Error('Clasificar es sacarlas de la bandeja, no devolverlas.');

  const { data } = await api.post<{
    clasificadas: number;
    cicloId: number | null;
  }>('/fotos/bandeja/clasificar', { fotoIds, ...idsDeDestino(destino) });
  return data;
}

/**
 * Mover UNA foto de sitio.
 *
 * El servidor exige EDICION en origen Y en destino: no basta con poder
 * escribir en uno de los dos.
 */
export async function moverFoto(
  fotoId: number,
  destino: DestinoFotos,
): Promise<{ ok: boolean; id: number; sinCambios: boolean }> {
  const { data } = await api.post<{
    ok: boolean;
    id: number;
    sinCambios: boolean;
  }>(`/fotos/foto/${fotoId}/mover`, idsDeDestino(destino));
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
  actividades: number;
  aviso: string | null;
}> {
  const { data } = await api.post<{
    plantilla: string;
    carpetas: number;
    actividades: number;
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
  creado: { carpetas: number; actividades: number };
  omitido: { actividades: number };
  actualizado: { actividades: number };
}> {
  const form = new FormData();
  form.append('archivo', archivo);
  form.append('decisiones', JSON.stringify(decisiones));
  const { data } = await api.post<{
    creado: { carpetas: number; actividades: number };
    omitido: { actividades: number };
    actualizado: { actividades: number };
  }>(`/fotos/importacion/carpeta/${carpetaId}/confirmar`, form);
  return data;
}

// ── Actividades completas (§13) — 9b ──

/** Quién puede ser responsable. Solo id y nombre: sin correos. */
export async function verAsignables(): Promise<Persona[]> {
  const { data } = await api.get<Persona[]>('/fotos/actividad-asignables');
  return data;
}

/**
 * Las fotos de una actividad (§15).
 *
 * Sin paginar: son las de UN trabajo concreto, no las del proyecto entero.
 */
export async function verFotosDeActividad(
  actividadId: number,
): Promise<FotoDeActividad[]> {
  const { data } = await api.get<FotoDeActividad[]>(`/fotos/actividad/${actividadId}/foto`);
  return data;
}

// ── Portal: actividades y comentarios en solo lectura (§22) ──
//
// Funciones gemelas de las internas, como ya lo son `verCarpetaPortal` y
// `verGaleriaPortal`. Se prefiere eso a una bandera porque lo que cambia no
// es un parámetro sino el CONJUNTO de rutas: el portal no tiene escrituras,
// así que no hay una función «crear actividad del portal» que pudiera existir.

/** Las visitas del equipo, en solo lectura (§22). */
export async function verCiclosPortal(carpetaId: number): Promise<Ciclo[]> {
  const { data } = await api.get<Ciclo[]>(`/portal/carpeta/${carpetaId}/ciclo`);
  return data;
}

export async function verActividadesPortal(cicloId: number): Promise<Actividad[]> {
  const { data } = await api.get<Actividad[]>(
    `/portal/ciclo/${cicloId}/actividad`,
  );
  return data;
}

export async function verFotosDeActividadPortal(
  actividadId: number,
): Promise<FotoDeActividad[]> {
  const { data } = await api.get<FotoDeActividad[]>(
    `/portal/actividad/${actividadId}/foto`,
  );
  return data;
}

export async function verComentariosPortal(
  entidad: EntidadComentable,
  entidadId: number,
): Promise<Comentario[]> {
  const { data } = await api.get<Comentario[]>(
    `/portal/comentario/${entidad}/${entidadId}`,
  );
  return data;
}
