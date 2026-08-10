import { api } from './api';
import type {
  AlbumDetalle,
  AlbumResumen,
  AutorFeed,
  ContenidoCarpeta,
  EstadoAlbum,
  EstadoSede,
  FeedAlbum,
  FiltrosFeed,
  InvitacionAbierta,
  ListaCompartidos,
  NodoSede,
  RespuestaLogin,
  ResultadoCompartir,
  ResultadoSubida,
  TipoCompartible,
} from '@/types/models';

// Módulo Fotos: navegación, sedes, álbumes, acceso de colaboradores y feed.
// La escritura de sedes y la administración de álbumes exigen ADMIN_FOTOS;
// navegar y ver el feed, solo tener acceso.

// ── Navegación por carpetas ──

/**
 * Contenido de una carpeta. `sedeId` nulo es la raíz.
 * Es la única lectura del módulo que un COLABORADOR puede hacer sobre el
 * árbol; el resto de `/fotos/sede` sigue siendo de administración.
 */
export async function navegar(
  sedeId: number | null,
): Promise<ContenidoCarpeta> {
  const { data } = await api.get<ContenidoCarpeta>('/fotos/navegacion', {
    params: sedeId !== null ? { sedeId } : undefined,
  });
  return data;
}

// ── Sedes ──

export async function crearSede(payload: {
  nombre: string;
  parentId: number | null;
}): Promise<NodoSede> {
  const { data } = await api.post<NodoSede>('/fotos/sede', payload);
  return data;
}

export async function editarSede(
  id: number,
  payload: { nombre?: string; parentId?: number | null; estado?: EstadoSede },
): Promise<NodoSede> {
  const { data } = await api.put<NodoSede>(`/fotos/sede/${id}`, payload);
  return data;
}

export async function eliminarSede(id: number): Promise<void> {
  await api.delete(`/fotos/sede/${id}`);
}

// ── Álbumes ──

export async function listarAlbumes(
  sedeId?: number | null,
): Promise<AlbumResumen[]> {
  const { data } = await api.get<AlbumResumen[]>('/fotos/album', {
    params: sedeId ? { sedeId } : undefined,
  });
  return data;
}

export async function obtenerAlbum(id: number): Promise<AlbumDetalle> {
  const { data } = await api.get<AlbumDetalle>(`/fotos/album/${id}`);
  return data;
}

export async function crearAlbum(payload: {
  sedeId: number;
  nombre: string;
  descripcion?: string | null;
}): Promise<AlbumDetalle> {
  const { data } = await api.post<AlbumDetalle>('/fotos/album', payload);
  return data;
}

export async function editarAlbum(
  id: number,
  payload: {
    nombre?: string;
    descripcion?: string | null;
    sedeId?: number;
    estado?: EstadoAlbum;
  },
): Promise<AlbumDetalle> {
  const { data } = await api.put<AlbumDetalle>(`/fotos/album/${id}`, payload);
  return data;
}

// ── Compartir ──
// Un solo flujo para carpetas y álbumes. Quien comparte escribe un correo
// y el backend decide: si la cuenta existe, acceso directo; si no,
// invitación con enlace de activación.

export async function listarCompartidos(
  tipo: TipoCompartible,
  id: number,
): Promise<ListaCompartidos> {
  const { data } = await api.get<ListaCompartidos>(
    `/fotos/compartir/${tipo}/${id}`,
  );
  return data;
}

export async function compartirCon(
  tipo: TipoCompartible,
  id: number,
  email: string,
): Promise<ResultadoCompartir> {
  const { data } = await api.post<ResultadoCompartir>(
    `/fotos/compartir/${tipo}/${id}`,
    { email },
  );
  return data;
}

export async function dejarDeCompartir(
  tipo: TipoCompartible,
  id: number,
  usuarioId: number,
): Promise<void> {
  await api.delete(`/fotos/compartir/${tipo}/${id}/acceso/${usuarioId}`);
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

// ── Invitación (público, sin sesión) ──

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

export async function navegarPortal(
  sedeId: number | null,
): Promise<ContenidoCarpeta> {
  const { data } = await api.get<ContenidoCarpeta>('/portal/navegacion', {
    params: sedeId !== null ? { sedeId } : undefined,
  });
  return data;
}

export async function feedPortal(
  albumId: number,
  filtros: FiltrosFeed,
): Promise<FeedAlbum> {
  const { data } = await api.get<FeedAlbum>(`/portal/album/${albumId}/foto`, {
    params: {
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
    },
  });
  return data;
}

/** URL firmada que el navegador descarga en vez de abrir. */
export async function urlDeDescarga(
  albumId: number,
  fotoId: number,
): Promise<{ url: string; nombreArchivo: string }> {
  const { data } = await api.get<{ url: string; nombreArchivo: string }>(
    `/portal/album/${albumId}/foto/${fotoId}/descarga`,
  );
  return data;
}

// ── Feed ──

export async function obtenerFeed(
  albumId: number,
  filtros: FiltrosFeed,
): Promise<FeedAlbum> {
  const { data } = await api.get<FeedAlbum>(`/fotos/album/${albumId}/foto`, {
    params: {
      ...(filtros.subidaPorId !== null
        ? { subidaPorId: filtros.subidaPorId }
        : {}),
      ...(filtros.desde ? { desde: filtros.desde } : {}),
      ...(filtros.hasta ? { hasta: filtros.hasta } : {}),
    },
  });
  return data;
}

/** Quiénes han publicado en el álbum, para el filtro. */
export async function listarAutores(albumId: number): Promise<AutorFeed[]> {
  const { data } = await api.get<AutorFeed[]>(`/fotos/album/${albumId}/autores`);
  return data;
}

/**
 * Sube fotos. Se manda multipart: el navegador pone el boundary del
 * Content-Type solo, así que NO se fija a mano.
 */
export async function subirFotos(
  albumId: number,
  archivos: File[],
  descripcion: string,
): Promise<ResultadoSubida> {
  const form = new FormData();
  for (const archivo of archivos) form.append('fotos', archivo);
  if (descripcion.trim()) form.append('descripcion', descripcion.trim());

  const { data } = await api.post<ResultadoSubida>(
    `/fotos/album/${albumId}/foto`,
    form,
  );
  return data;
}

export async function eliminarFoto(
  albumId: number,
  fotoId: number,
): Promise<void> {
  await api.delete(`/fotos/album/${albumId}/foto/${fotoId}`);
}
