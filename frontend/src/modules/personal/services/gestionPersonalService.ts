import { api, leerToken } from '@/shared/services/api';
import { API_URL } from '@/shared/lib/constants';
import type {
  DetallePeriodo,
  ResumenPeriodo,
  Catalogo,
  FichaPersonal,
  GrupoPersonal,
  HojaDetectada,
  HojaAImportar,
  ResultadoImportacion,
  ResolucionConflicto,
  TipoPersonal,
  DatosFicha,
  CampoPersonal,
} from '@/modules/personal/types';

const RAIZ = '/gestion-personal';

// ── Periodos ──

export async function listarPeriodos(tipo: TipoPersonal) {
  const { data } = await api.get<ResumenPeriodo[]>(`${RAIZ}/periodo`, {
    params: { tipo },
  });
  return data;
}

export async function obtenerPeriodo(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const { data } = await api.get<DetallePeriodo>(
    `${RAIZ}/periodo/${anio}/${mes}/${tipo}`,
  );
  return data;
}

export async function crearPeriodo(payload: {
  anio: number;
  mes: number;
  tipo: TipoPersonal;
}) {
  const { data } = await api.post(`${RAIZ}/periodo`, payload);
  return data as { id: number };
}

export async function copiarPeriodo(payload: {
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  desdePeriodoId?: number;
}) {
  const { data } = await api.post(`${RAIZ}/periodo/copiar`, payload);
  return data as { id: number };
}

export async function eliminarPeriodo(id: number) {
  const { data } = await api.delete(`${RAIZ}/periodo/${id}`);
  return data as { ok: true; personasEliminadas: number };
}

// ── Grupos ──

export async function crearGrupo(payload: {
  periodoId: number;
  nombre: string;
}) {
  const { data } = await api.post<GrupoPersonal>(`${RAIZ}/grupo`, payload);
  return data;
}

export async function editarGrupo(id: number, nombre: string) {
  const { data } = await api.patch<GrupoPersonal>(`${RAIZ}/grupo/${id}`, {
    nombre,
  });
  return data;
}

export async function eliminarGrupo(id: number) {
  const { data } = await api.delete(`${RAIZ}/grupo/${id}`);
  return data as { ok: true; nombre: string; personasEliminadas: number };
}

// ── Fichas ──

export async function crearFicha(payload: { grupoId: number } & DatosFicha) {
  const { data } = await api.post<FichaPersonal>(`${RAIZ}/ficha`, payload);
  return data;
}

/** Edición inline: se manda SOLO el campo que cambió. */
export async function editarFicha(
  id: number,
  cambios: Partial<DatosFicha> & { grupoId?: number },
) {
  const { data } = await api.patch<FichaPersonal>(
    `${RAIZ}/ficha/${id}`,
    cambios,
  );
  return data;
}

export async function duplicarFicha(id: number) {
  const { data } = await api.post<FichaPersonal>(`${RAIZ}/ficha/${id}/duplicar`);
  return data;
}

export async function moverFichas(fichaIds: number[], grupoDestinoId: number) {
  const { data } = await api.post(`${RAIZ}/ficha/mover`, {
    fichaIds,
    grupoDestinoId,
  });
  return data as { ok: true; movidas: number };
}

export async function eliminarFichas(fichaIds: number[]) {
  const { data } = await api.post(`${RAIZ}/ficha/eliminar`, { fichaIds });
  return data as { ok: true; eliminadas: number };
}

// ── Catálogo ──

export async function obtenerCatalogo() {
  const { data } = await api.get<Catalogo>(`${RAIZ}/catalogo`);
  return data;
}

export async function crearOpcion(campo: CampoPersonal, valor: string) {
  const { data } = await api.post(`${RAIZ}/catalogo`, { campo, valor });
  return data;
}

export async function eliminarOpcion(id: number) {
  const { data } = await api.delete(`${RAIZ}/catalogo/${id}`);
  return data;
}

// ── Excel ──

export async function previsualizarExcel(archivo: File) {
  const fd = new FormData();
  fd.append('file', archivo);
  const { data } = await api.post<HojaDetectada[]>(
    `${RAIZ}/excel/previsualizar`,
    fd,
  );
  return data;
}

export async function importarExcel(
  archivo: File,
  hojas: HojaAImportar[],
  conflictos: ResolucionConflicto,
) {
  // El archivo se vuelve a mandar en el segundo paso: así el servidor no
  // tiene que guardarlo entre la vista previa y la confirmación.
  const fd = new FormData();
  fd.append('file', archivo);
  fd.append('hojas', JSON.stringify(hojas));
  fd.append('conflictos', conflictos);
  const { data } = await api.post<ResultadoImportacion[]>(
    `${RAIZ}/excel/importar`,
    fd,
  );
  return data;
}

/**
 * Descarga el Excel. Va por `fetch` y no por axios para poder leer el
 * nombre de archivo de la cabecera y disparar la descarga del navegador.
 */
export async function exportarExcel(
  anio: number,
  mes: number,
  tipo?: TipoPersonal,
) {
  const params = new URLSearchParams({ anio: String(anio), mes: String(mes) });
  if (tipo) params.set('tipo', tipo);

  const token = leerToken();
  const res = await fetch(`${API_URL}${RAIZ}/excel/exportar?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(cuerpo?.message ?? 'No se pudo generar el Excel.');
  }

  const disposicion = res.headers.get('content-disposition') ?? '';
  const nombre =
    /filename="([^"]+)"/.exec(disposicion)?.[1] ?? 'lista-sctr.xlsx';

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
  return nombre;
}
