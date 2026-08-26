// Punto único de configuración de la API y de las query keys de TanStack Query.

import type { FiltrosGaleria } from '@/modules/fotos/types';

/**
 * La API a la que apunta este build, desde `VITE_API_URL`.
 *
 * ⚠️ **Sin valor por defecto en el código, y es deliberado.** Antes era
 * `import.meta.env.VITE_API_URL || 'http://localhost:3000'`, y ese respaldo
 * es exactamente lo que impide desplegar con confianza: Vite sustituye estas
 * variables EN TIEMPO DE BUILD, así que un despliegue hecho sin la variable
 * no fallaba —se publicaba un frontend que llamaba a `localhost:3000` desde
 * el navegador del usuario, es decir a su propia máquina—. El síntoma serían
 * errores de red inexplicables en producción, no un error de configuración.
 *
 * Ahora falta la variable → el build o el arranque se detienen y dicen qué
 * falta. Mismo criterio que `FRONTEND_URL` en el backend.
 */
const API_CONFIGURADA = import.meta.env.VITE_API_URL?.trim();

if (!API_CONFIGURADA)
  throw new Error(
    'Falta VITE_API_URL: la URL base de la API. ' +
      'Ejemplo: VITE_API_URL=http://localhost:3000. Ver frontend/.env.example.',
  );

/** Sin barra final: todas las rutas del cliente empiezan por «/». */
export const API_URL = API_CONFIGURADA.replace(/\/$/, '');

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
  // Campos configurables del equipo (Fase 1b). Las DEFINICIONES son
  // globales al módulo; los VALORES cuelgan de una carpeta.
  // El color por tipo (Fase 1c). Cambia una vez cada mucho, así que la
  // pantalla lo pide una vez y lo reutiliza.
  coloresCarpeta: ['fotos', 'colores-carpeta'] as const,
  camposEquipo: ['fotos', 'campos-equipo'] as const,
  camposDeCarpeta: (carpetaId: number) =>
    ['fotos', 'campos-carpeta', carpetaId] as const,
  // Actividades (§13) y comentarios (§14). Bajo la misma raíz 'fotos', así que
  // `useInvalidarFotos` las refresca sin tener que enumerarlas.
  // ⚠️ La clave es por CICLO desde la Fase 1 del rediseño, no por carpeta:
  // el mismo equipo repite «Revisar filtros» en cada visita, y con la carpeta
  // por clave las dos visitas compartían caché.
  actividades: (cicloId: number, estado = '') =>
    ['fotos', 'actividades', cicloId, estado] as const,
  // Ciclos (visitas) de un equipo, y el catálogo de estados (§7). El catálogo
  // no lleva parámetros: es el mismo para todo el módulo.
  ciclos: (carpetaId: number) => ['fotos', 'ciclos', carpetaId] as const,
  // El vocabulario de la Fase 2. `catalogoActividades` lleva el tipo en la
  // clave porque acotar es pedir OTRA cosa, no recortar lo ya pedido — el
  // mismo criterio que los filtros de auditoría.
  sistemas: (soloActivos = false) => ['fotos', 'sistemas', soloActivos] as const,
  catalogoActividades: (tipoSistemaId: number | null = null, soloActivas = false) =>
    ['fotos', 'catalogo-actividad', tipoSistemaId, soloActivas] as const,
  estadosEquipo: (soloActivos = false) =>
    ['fotos', 'estados-equipo', soloActivos] as const,
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
  // Actividades completas (§13). `asignables` no lleva parámetros: es la misma
  // lista para todo el módulo.
  asignablesFotos: ['fotos', 'asignables'] as const,
  fotosDeActividad: (actividadId: number) => ['fotos', 'actividad-fotos', actividadId] as const,
  // Las del portal (§22) van con `'portal'` en 2.ª posición, como
  // `portalCarpeta` y `portalGaleria`. Clave distinta y no la misma con un
  // parámetro: lo que devuelve el portal está ANONIMIZADO en la galería, así
  // que compartir caché con la vista interna daría datos distintos bajo la
  // misma clave según quién preguntara primero.
  portalCiclos: (carpetaId: number) =>
    ['fotos', 'portal', 'ciclos', carpetaId] as const,
  portalActividades: (cicloId: number) =>
    ['fotos', 'portal', 'actividades', cicloId] as const,
  portalComentarios: (entidad: string, entidadId: number) =>
    ['fotos', 'portal', 'comentarios', entidad, entidadId] as const,
  portalFotosDeActividad: (actividadId: number) =>
    ['fotos', 'portal', 'actividad-fotos', actividadId] as const,
};

// Debounce de los buscadores (ms).
export const SEARCH_DEBOUNCE_MS = 300;
