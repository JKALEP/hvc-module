// Punto único de configuración de la API y de las query keys de TanStack Query.

import type { FiltrosGaleria } from '@/modules/fotos/types';

export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const QUERY_KEYS = {
  // Módulo Costos
  baseCostos: (q: string, pagina: number) =>
    ['base-costos', q, pagina] as const,
  opcionesRequerimiento: ['opciones-requerimiento'] as const,
  requerimientos: (grupo: string) => ['requerimientos', grupo] as const,
  requerimiento: (id: number) => ['requerimiento', id] as const,
  observaciones: (requerimientoId: number) =>
    ['observaciones', requerimientoId] as const,
  plantillaCosto: (requerimientoId: number) =>
    ['plantilla-costo', requerimientoId] as const,
  costo: (requerimientoId: number) => ['costo', requerimientoId] as const,
  historialRequerimiento: (requerimientoId: number) =>
    ['historial-requerimiento', requerimientoId] as const,
  proveedores: (q: string) => ['proveedores', q] as const,
  solicitudes: (requerimientoId: number) =>
    ['solicitudes', requerimientoId] as const,
  cotizaciones: (requerimientoId: number) =>
    ['cotizaciones', requerimientoId] as const,
  comparacion: (requerimientoId: number) =>
    ['comparacion', requerimientoId] as const,
  evaluaciones: (requerimientoId: number) =>
    ['evaluaciones', requerimientoId] as const,
  aprobaciones: (requerimientoId: number) =>
    ['aprobaciones', requerimientoId] as const,
  opcionesCatalogo: (tipo: string) => ['opciones-catalogo', tipo] as const,
  clientesCostos: (q: string) => ['clientes-costos', q] as const,
  supervisoresCostos: (q: string) => ['supervisores-costos', q] as const,
  auditoriaEntidad: (entidad: string, entidadId: number) =>
    ['auditoria-entidad', entidad, entidadId] as const,
  plantillaCorreo: ['plantilla-correo'] as const,

  // Gestión de personal (listas SCTR)
  periodosPersonal: (tipo: string) => ['periodos-personal', tipo] as const,
  periodoPersonal: (anio: number, mes: number, tipo: string) =>
    ['periodo-personal', anio, mes, tipo] as const,
  catalogoPersonal: ['catalogo-personal'] as const,

  // Obra: carpetas, proyectos y jornadas
  obraNavegacion: (carpetaId: number | null) =>
    ['obra-navegacion', carpetaId] as const,
  obraCarpetas: ['obra-carpetas'] as const,
  obraProyecto: (id: number) => ['obra-proyecto', id] as const,
  obraJornadas: (proyectoId: number) => ['obra-jornadas', proyectoId] as const,
  obraEmpresas: (proyectoId: number) => ['obra-empresas', proyectoId] as const,
  obraParticipacion: (proyectoId: number) =>
    ['obra-participacion', proyectoId] as const,
  obraPersona: (proyectoId: number, documento: string) =>
    ['obra-persona', proyectoId, documento] as const,
  obraPersonalPara: (fecha: string, tipo: string, q: string) =>
    ['obra-personal', fecha, tipo, q] as const,

  // Gestión de equipos
  organizaciones: ['organizaciones'] as const,
  estructuraEquipos: (organizacionId: number) =>
    ['estructura-equipos', organizacionId] as const,
  camposEquipos: (organizacionId: number) =>
    ['campos-equipos', organizacionId] as const,
  equipo: (id: number) => ['equipo', id] as const,
  historialEquipo: (id: number) => ['historial-equipo', id] as const,
  historialIncidencia: (id: number) => ['historial-incidencia', id] as const,
  documento: (tipo: string, id: number) => ['documento', tipo, id] as const,
  // En reportes, `organizacionId: null` significa TODAS, no «sin cargar».
  resumenEquipos: (organizacionId: number | null) =>
    ['resumen-equipos', organizacionId] as const,
  dimensionesReporte: (organizacionId: number | null) =>
    ['dimensiones-reporte', organizacionId] as const,
  distribucion: (organizacionId: number | null, dimension: string) =>
    ['distribucion', organizacionId, dimension] as const,
  fichaEquipo: (id: number) => ['ficha-equipo', id] as const,

  // ── Módulo Fotos ──
  //
  // TODAS empiezan por 'fotos', y eso NO es cosmético: `useInvalidarFotos`
  // invalida esa única raíz tras cada mutación. Cuando las claves eran
  // sueltas —['carpeta'], ['galeria'], ['portal-carpeta']…— la invalidación
  // no coincidía con NINGUNA, y la pantalla se quedaba con datos viejos
  // hasta que alguien recargaba a mano. Si añades una clave de Fotos, va
  // bajo esta raíz.
  //
  // `q` y `orden` entran en la clave: buscar es pedir OTRA cosa, no filtrar
  // lo ya pedido, y sin ellos la caché devolvería el listado sin buscar.
  carpeta: (id: number | null, q = '', orden = 'nombre') =>
    ['fotos', 'carpeta', id, q, orden] as const,
  carpetasRecientes: ['fotos', 'recientes'] as const,
  portalCarpeta: (id: number | null) =>
    ['fotos', 'portal', 'carpeta', id] as const,
  galeria: (carpetaId: number, f: FiltrosGaleria) =>
    [
      'fotos',
      'galeria',
      carpetaId,
      f.desde,
      f.hasta,
      f.subidaPorId ?? null,
    ] as const,
  portalGaleria: (carpetaId: number, f: FiltrosGaleria) =>
    [
      'fotos',
      'portal',
      'galeria',
      carpetaId,
      f.desde,
      f.hasta,
      f.subidaPorId ?? null,
    ] as const,
  autores: (carpetaId: number) => ['fotos', 'autores', carpetaId] as const,
  carpetasCompartibles: ['fotos', 'carpetas-compartibles'] as const,
  compartidos: (carpetaId: number | null) =>
    ['fotos', 'compartidos', carpetaId] as const,
  // Catálogo de equipos visto desde Fotos (§12). Bajo la misma raíz: una
  // mutación de Fotos lo refresca también, que es lo que hace falta tras
  // registrar un equipo con el atajo.
  catalogoOrganizaciones: ['fotos', 'catalogo-organizaciones'] as const,
  catalogoUbicaciones: (organizacionId: number) =>
    ['fotos', 'catalogo-ubicaciones', organizacionId] as const,
  catalogoEquipos: (organizacionId: number, q = '') =>
    ['fotos', 'catalogo-equipos', organizacionId, q] as const,
  // Tareas (§13) y comentarios (§14). Bajo la misma raíz 'fotos', así que
  // `useInvalidarFotos` las refresca sin tener que enumerarlas.
  tareas: (carpetaId: number, estado = '') =>
    ['fotos', 'tareas', carpetaId, estado] as const,
  comentarios: (entidad: string, entidadId: number) =>
    ['fotos', 'comentarios', entidad, entidadId] as const,
  // La bandeja de §18 no lleva id de usuario en la clave: es siempre la de
  // quien pregunta, y el token ya lo dice.
  bandeja: ['fotos', 'bandeja'] as const,
  // Administración del módulo (§19, §20, §23). Los filtros entran en la
  // clave de auditoría: filtrar es pedir OTRA cosa, no recortar lo ya pedido.
  auditoriaFotos: (filtros: Record<string, unknown>) =>
    ['fotos', 'auditoria', JSON.stringify(filtros)] as const,
  plantillasFotos: (soloActivas: boolean) =>
    ['fotos', 'plantillas', soloActivas] as const,
  plantillaFotos: (id: number) => ['fotos', 'plantilla', id] as const,
};

// Debounce de los buscadores (ms).
export const SEARCH_DEBOUNCE_MS = 300;
