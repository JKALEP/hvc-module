import type {
  Aprobacion,
  EvaluacionCotizacion,
} from '@/modules/costos/types';

/**
 * El ciclo de §44 armado: cada recomendación con lo que se decidió
 * sobre ella.
 *
 * El backend devuelve las dos mitades por separado y con razón —son dos
 * tablas y dos actos de dos personas—, pero leer el expediente es leer
 * la conversación: «el gestor recomendó a X porque…, el aprobador la
 * rechazó porque…, el gestor volvió con Y…». Emparejarlas es una
 * derivación, así que vive aquí y no dentro de una pantalla, igual que
 * los umbrales de Personal o los estados del requerimiento.
 *
 * Se empareja por `evaluacionId`, que es justamente para lo que la fila
 * de `Aprobacion` lo guarda. NO por ronda ni por orden de llegada: una
 * decisión puede tener `evaluacionId` null.
 *
 * ⚠️ `decisiones` es una LISTA y no una sola decisión. Parece que
 * sobra —lo normal es cero o una— pero una misma ronda puede recibir
 * dos: la máquina de estados admite `CERRAR_SIN_ACUERDO` desde
 * RECHAZADO, así que rechazar y después cerrar sin acuerdo deja dos
 * filas colgando de la misma evaluación. Con un solo hueco, la segunda
 * desaparecería del expediente.
 */
export interface Ronda {
  ronda: number;
  evaluacion: EvaluacionCotizacion;
  /** De la más antigua a la más reciente, como se sucedieron. */
  decisiones: Aprobacion[];
  /** La de ronda más alta: la que está sobre la mesa. */
  vigente: boolean;
  /** Nadie se ha pronunciado todavía sobre ella. */
  pendiente: boolean;
}

export interface HistorialRondas {
  /** De la más reciente a la más antigua. */
  rondas: Ronda[];
  /**
   * Decisiones que no cuelgan de ninguna recomendación.
   *
   * Son los cierres tempranos de §45: no se llegó a acuerdo con los
   * proveedores y eso se sabe sin que nadie haya recomendado nada.
   * Tienen que verse igual, o el expediente no explicaría por qué está
   * cerrado.
   */
  sueltas: Aprobacion[];
  /** ¿Ha habido ya alguna vuelta rechazada? Dispara el aviso de §44. */
  huboRechazo: boolean;
}

export function construirRondas(
  evaluaciones: EvaluacionCotizacion[],
  aprobaciones: Aprobacion[],
): HistorialRondas {
  const porEvaluacion = new Map<number, Aprobacion[]>();
  const sueltas: Aprobacion[] = [];

  // El backend las manda de la más reciente hacia atrás; dentro de una
  // ronda se leen al derecho, en el orden en que ocurrieron.
  for (const a of [...aprobaciones].reverse()) {
    if (a.evaluacionId === null) {
      sueltas.push(a);
      continue;
    }
    const previas = porEvaluacion.get(a.evaluacionId) ?? [];
    previas.push(a);
    porEvaluacion.set(a.evaluacionId, previas);
  }

  const ordenadas = [...evaluaciones].sort((a, b) => b.ronda - a.ronda);
  const mayor = ordenadas[0]?.ronda;

  const rondas = ordenadas.map((evaluacion) => {
    const decisiones = porEvaluacion.get(evaluacion.id) ?? [];
    return {
      ronda: evaluacion.ronda,
      evaluacion,
      decisiones,
      vigente: evaluacion.ronda === mayor,
      pendiente: decisiones.length === 0,
    };
  });

  return {
    rondas,
    sueltas,
    huboRechazo: aprobaciones.some((a) => a.decision === 'RECHAZADA'),
  };
}
