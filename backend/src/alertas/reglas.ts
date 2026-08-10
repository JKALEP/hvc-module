/**
 * Umbrales y construcción de las alertas operativas.
 *
 * Están aislados aquí (y se devuelven en la respuesta) para que la UI pueda
 * decir "menor a 70 %" sin hardcodearlo y para que ajustarlos sea tocar un
 * solo archivo.
 *
 * El criterio de severidad no es el tamaño del número sino qué tan pronto
 * alguien tiene que actuar.
 */

export const UMBRALES = {
  /** Días trabajados por debajo de los cuales se alerta subutilización. */
  diasMinimos: 3,
  /**
   * Días con reporte que debe tener el período para que la regla de
   * "pocos días" signifique algo. Con menos, TODOS los trabajadores caerían
   * bajo el mínimo y la alerta sería ruido puro.
   */
  diasConReporteMinimos: 5,

  /** Cobertura de empresa contratista: bajo esto se alerta. */
  coberturaEmpresa: 70,
  /** Bajo esto el contrato está sobredimensionado: decisión comercial. */
  coberturaEmpresaCritica: 50,

  /** Producción promedio de proyecto: bajo esto se alerta. */
  produccionProyecto: 90,
  /** Bajo esto el proyecto está materialmente atrasado. */
  produccionProyectoCritica: 70,

  /**
   * Brecha de técnicos, medida en PORCENTAJE de lo programado, nunca en
   * diferencia absoluta: faltar 1 en una cuadrilla de 3 es 33 %; faltar 1
   * en 20 es 5 %. Alertar por el número crudo llenaría el tablero de ruido
   * en las obras grandes.
   */
  brechaTecnicosAlta: 50,
  brechaTecnicosMedia: 25,
} as const;

export type Severidad = 'ALTA' | 'MEDIA' | 'BAJA';

export type TipoAlerta =
  | 'SIN_PARTICIPACION'
  | 'POCA_PARTICIPACION'
  | 'UTILIZACION_EMPRESA'
  | 'BRECHA_TECNICOS'
  | 'EXCEDENTE_TECNICOS'
  | 'PRODUCCION_PROYECTO';

export const ETIQUETAS_TIPO: Record<TipoAlerta, string> = {
  SIN_PARTICIPACION: 'Personal sin participación',
  POCA_PARTICIPACION: 'Personal con baja participación',
  UTILIZACION_EMPRESA: 'Utilización de contratista',
  BRECHA_TECNICOS: 'Falta de personal en obra',
  EXCEDENTE_TECNICOS: 'Excedente de personal en obra',
  PRODUCCION_PROYECTO: 'Producción bajo objetivo',
};

export const ORDEN_SEVERIDAD: Record<Severidad, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAJA: 2,
};

export interface Alerta {
  /** Clave estable: sirve de key en React y evita duplicados. */
  id: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  titulo: string;
  /** Mensaje ya armado en español, listo para mostrar. */
  mensaje: string;
  valor: number | null;
  umbral: number | null;
  // Para poder navegar al detalle afectado.
  proyectoId?: number;
  trabajadorId?: number;
  empresaId?: number;
  reporteId?: number;
  fecha?: string;
}

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

// ── Constructores por tipo ──

export function alertaSinParticipacion(t: {
  trabajadorId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  empresaId: number;
  empresa: string | null;
  diasConReporte: number;
}): Alerta {
  return {
    id: `SIN_PARTICIPACION-${t.trabajadorId}`,
    tipo: 'SIN_PARTICIPACION',
    severidad: 'ALTA',
    titulo: `${t.apellidos}, ${t.nombres}`,
    mensaje:
      `No participó ningún día del período (${t.diasConReporte} día(s) con reporte). ` +
      `DNI ${t.dni}${t.empresa ? ` · ${t.empresa}` : ''}.`,
    valor: 0,
    umbral: 1,
    trabajadorId: t.trabajadorId,
    empresaId: t.empresaId,
  };
}

export function alertaPocaParticipacion(t: {
  trabajadorId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  empresaId: number;
  empresa: string | null;
  diasTrabajados: number;
  diasConReporte: number;
}): Alerta {
  return {
    id: `POCA_PARTICIPACION-${t.trabajadorId}`,
    tipo: 'POCA_PARTICIPACION',
    severidad: 'MEDIA',
    titulo: `${t.apellidos}, ${t.nombres}`,
    mensaje:
      `Solo trabajó ${t.diasTrabajados} día(s) de ${t.diasConReporte} con reporte ` +
      `(mínimo esperado: ${UMBRALES.diasMinimos}). DNI ${t.dni}${t.empresa ? ` · ${t.empresa}` : ''}.`,
    valor: t.diasTrabajados,
    umbral: UMBRALES.diasMinimos,
    trabajadorId: t.trabajadorId,
    empresaId: t.empresaId,
  };
}

export function alertaUtilizacionEmpresa(e: {
  empresaId: number;
  empresa: string;
  cobertura: number;
  contratados: number;
  participaron: number;
}): Alerta {
  const critica = e.cobertura < UMBRALES.coberturaEmpresaCritica;
  return {
    id: `UTILIZACION_EMPRESA-${e.empresaId}`,
    tipo: 'UTILIZACION_EMPRESA',
    severidad: critica ? 'ALTA' : 'MEDIA',
    titulo: e.empresa,
    mensaje:
      `Utilización de ${pct(e.cobertura)}: solo ${e.participaron} de ${e.contratados} ` +
      `trabajadores contratados participaron. Mínimo esperado: ${UMBRALES.coberturaEmpresa}%.` +
      (critica ? ' Menos de la mitad de la planilla en uso.' : ''),
    valor: e.cobertura,
    umbral: UMBRALES.coberturaEmpresa,
    empresaId: e.empresaId,
  };
}

export function alertaBrechaTecnicos(r: {
  reporteId: number;
  proyectoId: number;
  proyecto: string;
  fecha: string;
  programados: number;
  laborando: number;
  supervisor: string;
}): Alerta {
  const faltan = r.programados - r.laborando;
  // Proporción del faltante sobre lo programado.
  const porcentajeFaltante =
    r.programados === 0
      ? 100
      : Number(((faltan / r.programados) * 100).toFixed(1));

  const severidad: Severidad =
    porcentajeFaltante >= UMBRALES.brechaTecnicosAlta
      ? 'ALTA'
      : porcentajeFaltante >= UMBRALES.brechaTecnicosMedia
        ? 'MEDIA'
        : 'BAJA';

  return {
    id: `BRECHA_TECNICOS-${r.reporteId}`,
    tipo: 'BRECHA_TECNICOS',
    severidad,
    titulo: `${r.proyecto} · ${r.fecha}`,
    mensaje:
      `Faltaron ${faltan} técnico(s): laboraron ${r.laborando} de ${r.programados} ` +
      `programados (${porcentajeFaltante}% de la dotación). Supervisor: ${r.supervisor}.`,
    valor: porcentajeFaltante,
    umbral: UMBRALES.brechaTecnicosMedia,
    proyectoId: r.proyectoId,
    reporteId: r.reporteId,
    fecha: r.fecha,
  };
}

export function alertaExcedenteTecnicos(r: {
  reporteId: number;
  proyectoId: number;
  proyecto: string;
  fecha: string;
  programados: number;
  laborando: number;
  supervisor: string;
}): Alerta {
  const sobran = r.laborando - r.programados;
  return {
    id: `EXCEDENTE_TECNICOS-${r.reporteId}`,
    tipo: 'EXCEDENTE_TECNICOS',
    // No es una falla de dotación, pero sí un sobrecosto que conviene ver.
    severidad: 'BAJA',
    titulo: `${r.proyecto} · ${r.fecha}`,
    mensaje:
      `Hubo ${sobran} técnico(s) más de lo programado: laboraron ${r.laborando} ` +
      `frente a ${r.programados} planificados. Supervisor: ${r.supervisor}.`,
    valor: sobran,
    umbral: 0,
    proyectoId: r.proyectoId,
    reporteId: r.reporteId,
    fecha: r.fecha,
  };
}

export function alertaProduccionProyecto(p: {
  proyectoId: number;
  proyecto: string;
  produccionPromedio: number;
  diasConReporte: number;
}): Alerta {
  const critica = p.produccionPromedio < UMBRALES.produccionProyectoCritica;
  return {
    id: `PRODUCCION_PROYECTO-${p.proyectoId}`,
    tipo: 'PRODUCCION_PROYECTO',
    severidad: critica ? 'ALTA' : 'MEDIA',
    titulo: p.proyecto,
    mensaje:
      `Producción promedio de ${pct(p.produccionPromedio)} en ${p.diasConReporte} ` +
      `día(s) con reporte. Objetivo: ${UMBRALES.produccionProyecto}%.` +
      (critica ? ' El proyecto está materialmente atrasado.' : ''),
    valor: p.produccionPromedio,
    umbral: UMBRALES.produccionProyecto,
    proyectoId: p.proyectoId,
  };
}
