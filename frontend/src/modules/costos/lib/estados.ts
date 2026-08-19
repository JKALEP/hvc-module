import type { EstadoRequerimiento, RolCostos } from '@/modules/costos/types';

/**
 * Todo lo visual de los 13 estados, en UN SOLO SITIO.
 *
 * Es la lección de `personal/lib/umbrales.ts`: allí las mismas tres
 * clases de Tailwind estaban repetidas en seis funciones con seis
 * nombres distintos, y bastaba que una se quedara atrás para que dos
 * pantallas dijeran cosas diferentes del mismo dato. Aquí no hay
 * `switch` de estado fuera de este archivo.
 *
 * Los tonos salen de los que ya usa `Badge`, no de colores nuevos:
 *
 *   · `secondary`   — todavía no ha salido de casa (borrador)
 *   · `default`     — el proceso avanza y el turno es de otro
 *   · `warning`     — la pelota está en tu tejado, o hay que rehacer algo
 *   · `success`     — terminó bien
 *   · `destructive` — terminó sin comprar, o se devolvió
 */
type Tono = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

interface Presentacion {
  etiqueta: string;
  tono: Tono;
  /** Una línea que explica de quién es el turno. Para el detalle. */
  significa: string;
}

const ESTADOS: Record<EstadoRequerimiento, Presentacion> = {
  BORRADOR: {
    etiqueta: 'Borrador',
    tono: 'secondary',
    significa: 'Todavía no lo ha visto nadie. Puedes editarlo entero.',
  },
  PENDIENTE_REVISION: {
    etiqueta: 'En revisión',
    tono: 'default',
    significa: 'El gestor de cotizaciones lo está revisando.',
  },
  OBSERVADO: {
    etiqueta: 'Observado',
    tono: 'warning',
    significa:
      'El gestor pidió corregir algo. Confirma las observaciones y devuélvelo.',
  },
  PENDIENTE_COTIZACION: {
    etiqueta: 'Esperando cotizaciones',
    tono: 'default',
    significa: 'Se pidió precio a los proveedores y falta que respondan.',
  },
  COTIZACIONES_RECIBIDAS: {
    etiqueta: 'Cotizaciones recibidas',
    tono: 'default',
    significa: 'Hay precios sobre la mesa; el gestor tiene que compararlos.',
  },
  EN_EVALUACION: {
    etiqueta: 'En evaluación',
    tono: 'default',
    significa: 'El gestor está comparando las cotizaciones.',
  },
  PENDIENTE_APROBACION: {
    etiqueta: 'Esperando aprobación',
    tono: 'default',
    significa: 'Hay una cotización recomendada esperando la decisión del jefe.',
  },
  // Sin transición hacia él: el hecho de aprobar vive en `Aprobacion`.
  // Se mantiene para que el tipo case con la base.
  APROBADO: {
    etiqueta: 'Aprobado',
    tono: 'success',
    significa: 'Aprobado.',
  },
  RECHAZADO: {
    etiqueta: 'Rechazado',
    tono: 'destructive',
    significa:
      'El jefe devolvió la recomendación. El gestor tiene que volver a evaluar.',
  },
  SIN_ACUERDO: {
    etiqueta: 'Sin acuerdo',
    tono: 'destructive',
    significa: 'Se cerró sin llegar a acuerdo con los proveedores.',
  },
  PENDIENTE_REGISTRO_COSTO: {
    etiqueta: 'Registra el costo',
    tono: 'warning',
    significa: 'Ya está aprobado: falta que registres cuánto costó cada ítem.',
  },
  FINALIZADO: {
    etiqueta: 'Finalizado',
    tono: 'success',
    significa: 'El costo quedó registrado. El proceso terminó.',
  },
  CANCELADO: {
    etiqueta: 'Cancelado',
    tono: 'destructive',
    significa: 'Se abandonó.',
  },
};

export function presentacionDe(estado: EstadoRequerimiento): Presentacion {
  return ESTADOS[estado];
}

/**
 * En qué estados la pelota está en el tejado de cada rol.
 *
 * Sirve para destacar en las bandejas lo que a uno le toca hacer, que es
 * lo que §26, §46 y §59 quieren que salte a la vista. NO se usa para
 * permitir ni bloquear nada: eso lo dice `acciones`, que viene del
 * backend y sale de la misma tabla que lo hace cumplir.
 *
 * Un Record COMPLETO y una sola función para los tres, en vez de un
 * `esMiTurno` por pantalla: es la misma pregunta —«¿me toca?»— hecha
 * desde tres sitios, y tres listas sueltas se habrían desincronizado en
 * cuanto se añadiera un estado.
 *
 * ⚠️ Turno NO es lo mismo que «puede hacer algo». El Gestor puede
 * corregir su recomendación mientras el requerimiento está
 * PENDIENTE_APROBACION, y aun así ese estado NO es suyo: el turno es del
 * Aprobador. Marcarlo como pendiente del Gestor llenaría su bandeja de
 * cosas que están esperando a otro.
 */
const TURNO_DE: Record<RolCostos, EstadoRequerimiento[]> = {
  SOLICITANTE: ['BORRADOR', 'OBSERVADO', 'PENDIENTE_REGISTRO_COSTO'],
  GESTOR_COTIZACIONES: [
    'PENDIENTE_REVISION',
    'PENDIENTE_COTIZACION',
    'COTIZACIONES_RECIBIDAS',
    'EN_EVALUACION',
    // §44: el Aprobador lo devolvió y la vuelta siguiente es del Gestor.
    'RECHAZADO',
  ],
  APROBADOR: ['PENDIENTE_APROBACION'],
};

export function esTurnoDe(
  rol: RolCostos,
  estado: EstadoRequerimiento,
): boolean {
  return TURNO_DE[rol].includes(estado);
}

/**
 * Qué tiene que hacer ESTE rol ahora mismo, o null si no le toca.
 *
 * Distinto de `significa`, que describe dónde está el proceso en
 * tercera persona («el gestor lo está revisando»). Esa frase es
 * correcta para quien mira desde fuera y absurda para el gestor mismo,
 * que no necesita que le cuenten lo que está haciendo él: necesita
 * saber qué se espera de él. Son dos textos porque son dos preguntas.
 *
 * Solo hay entradas para los estados que SON turno de cada rol —las que
 * `TURNO_DE` lista—; para el resto se devuelve null y la pantalla no
 * pinta nada.
 */
const TAREA_DE: Record<
  RolCostos,
  Partial<Record<EstadoRequerimiento, string>>
> = {
  SOLICITANTE: {
    BORRADOR: 'Termínalo y emítelo.',
    OBSERVADO: 'Corrige lo observado y devuélvelo.',
    PENDIENTE_REGISTRO_COSTO: 'Registra cuánto costó cada ítem.',
  },
  GESTOR_COTIZACIONES: {
    PENDIENTE_REVISION: 'Revísalo: dale paso a proveedores u obsérvalo.',
    PENDIENTE_COTIZACION: 'Esperando respuestas: registra las que lleguen.',
    COTIZACIONES_RECIBIDAS: 'Hay precios sobre la mesa: compáralos.',
    EN_EVALUACION: 'Elige una y justifica por qué.',
    RECHAZADO: 'El aprobador lo devolvió: vuelve a evaluar.',
  },
  APROBADOR: {
    PENDIENTE_APROBACION: 'Hay una recomendación esperando tu decisión.',
  },
};

export function tareaDe(
  rol: RolCostos,
  estado: EstadoRequerimiento,
): string | null {
  return TAREA_DE[rol][estado] ?? null;
}
