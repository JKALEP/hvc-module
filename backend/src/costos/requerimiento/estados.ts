import { BadRequestException } from '@nestjs/common';
import type {
  EstadoRequerimiento,
  RolCostos,
} from '../../../generated/prisma/enums';

/**
 * La máquina de estados del requerimiento (§10, §11).
 *
 * Vive suelta y sin dependencias —ni Prisma, ni Nest, ni la petición—
 * por lo mismo que `auth/guards/reglas-autorizacion.ts`: así la matriz
 * completa de estado × acción × rol se puede leer de un vistazo y
 * comprobar sin levantar un servidor. Un `if` repartido por tres
 * services no es una máquina de estados, es una costumbre.
 *
 * **Esta tabla ES la política.** Si una acción no está aquí, no se puede
 * hacer; abrirla es añadir una fila, no un `if` en el service.
 */

/** Lo que alguien puede intentar hacerle a un requerimiento. */
export type AccionRequerimiento =
  | 'EMITIR' // el Solicitante lo manda a revisión (§25)
  | 'CANCELAR' // se abandona (§11 CANCELADO)
  | 'OBSERVAR' // el Gestor pide corregir (§27)
  | 'PASAR_A_COTIZACION' // el Gestor lo da por bueno y busca proveedores (§30)
  | 'REGISTRAR_COTIZACION' // entra la primera cotización (§34)
  | 'EVALUAR' // el Gestor empieza a comparar (§37)
  | 'RECOMENDAR' // el Gestor elige una y justifica (§38-39)
  | 'ACEPTAR' // el Aprobador acepta (§42)
  | 'RECHAZAR' // el Aprobador devuelve al Gestor (§43)
  | 'CERRAR_SIN_ACUERDO' // el Aprobador cierra sin compra (§45)
  | 'REEVALUAR' // el Gestor vuelve tras un rechazo (§44)
  | 'REGISTRAR_COSTO' // el Solicitante cierra el ciclo (§51)
  | 'REABRIR_POR_EDICION'; // se editó un ítem que ya estaba cotizado (§54)

interface Transicion {
  desde: EstadoRequerimiento[];
  hasta: EstadoRequerimiento;
  /** Quién puede dispararla. El SUPERADMIN pasa por encima de todo. */
  rol: RolCostos;
  /** Para el mensaje de error, en primera persona del proceso. */
  etiqueta: string;
  /**
   * No la pulsa nadie: es la consecuencia de otra cosa. No sale en
   * `accionesPosibles`, porque ofrecerla como botón sería mentir sobre
   * quién la provoca.
   */
  automatica?: boolean;
}

/**
 * Las transiciones legales, y solo ellas.
 *
 * ── Notas de lectura ────────────────────────────────────────────────
 *
 * `EMITIR` sale de BORRADOR **y de OBSERVADO**: corregir lo observado y
 * devolverlo es la misma acción del Solicitante, no una distinta (§28).
 * Lo que cambia es que la segunda vez ya tiene número y no se le pide
 * otro.
 *
 * `RECHAZAR` no es cierre (§43): deja el requerimiento en RECHAZADO, y
 * desde ahí el Gestor puede volver a evaluar tantas vueltas como hagan
 * falta (§44). Lo que cierra de verdad es SIN_ACUERDO.
 *
 * `ACEPTAR` lleva a PENDIENTE_REGISTRO_COSTO y no a APROBADO. El HECHO
 * de la aprobación vive en su propia fila de `Aprobacion` —con quién,
 * cuándo y con qué comentario—, así que el estado del requerimiento
 * puede decir lo único que el estado sirve para decir: de quién es el
 * turno. Y tras aceptar, el turno es del Solicitante.
 *
 * ⚠️ Por eso `APROBADO` NO aparece como destino de ninguna transición.
 * Sigue en el enum porque §11 lo lista y quitarlo sería otra migración,
 * pero hoy es inalcanzable. **Pendiente de confirmar con HVC antes de la
 * Fase 5**: si prefieren que el estado diga «aprobado» y que lo pendiente
 * se derive de que no haya costo, es cambiar este `hasta` y nada más.
 */
const TRANSICIONES: Record<AccionRequerimiento, Transicion> = {
  EMITIR: {
    desde: ['BORRADOR', 'OBSERVADO'],
    hasta: 'PENDIENTE_REVISION',
    rol: 'SOLICITANTE',
    etiqueta: 'emitir',
  },
  CANCELAR: {
    // Todo lo que no está cerrado. Un requerimiento FINALIZADO,
    // SIN_ACUERDO o ya CANCELADO no se cancela: eso sería reescribir un
    // cierre.
    desde: [
      'BORRADOR',
      'PENDIENTE_REVISION',
      'OBSERVADO',
      'PENDIENTE_COTIZACION',
      'COTIZACIONES_RECIBIDAS',
      'EN_EVALUACION',
      'PENDIENTE_APROBACION',
      'RECHAZADO',
    ],
    hasta: 'CANCELADO',
    rol: 'SOLICITANTE',
    etiqueta: 'cancelar',
  },
  OBSERVAR: {
    desde: ['PENDIENTE_REVISION'],
    hasta: 'OBSERVADO',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'observar',
  },
  PASAR_A_COTIZACION: {
    // También DESDE PENDIENTE_COTIZACION: §33 dice que no se asuma que
    // todos responderán, así que sumar proveedores a los que ya se les
    // pidió es corriente. Al ser origen y destino el mismo estado, la
    // transición no hace nada — y eso es justo lo que debe pasar.
    desde: ['PENDIENTE_REVISION', 'PENDIENTE_COTIZACION'],
    hasta: 'PENDIENTE_COTIZACION',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'compartir con proveedores',
  },
  REGISTRAR_COTIZACION: {
    // EN_EVALUACION incluido a propósito: una cotización que llega tarde
    // devuelve el requerimiento a COTIZACIONES_RECIBIDAS. Es un paso
    // atrás deliberado — si entra un precio nuevo, la comparación que se
    // estaba haciendo ya no es la misma y el Gestor tiene que volver a
    // mirarla.
    desde: ['PENDIENTE_COTIZACION', 'COTIZACIONES_RECIBIDAS', 'EN_EVALUACION'],
    hasta: 'COTIZACIONES_RECIBIDAS',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'registrar una cotización',
  },
  EVALUAR: {
    desde: ['COTIZACIONES_RECIBIDAS'],
    hasta: 'EN_EVALUACION',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'evaluar',
  },
  RECOMENDAR: {
    // PENDIENTE_APROBACION incluido: mientras el Aprobador no se haya
    // pronunciado, el Gestor puede corregir su propia recomendación —se
    // equivocó de cotización, o quiere mejorar la justificación—. Origen
    // y destino son el mismo estado, así que la transición no mueve nada.
    //
    // Eso NO es una vuelta del ciclo de §44: corregir sustituye la
    // recomendación vigente y deja el cambio en la bitácora; una vuelta
    // nueva solo la abre un pronunciamiento del Aprobador. Quién decide
    // cuál de las dos cosas es, lo hace `EvaluacionService` mirando si la
    // evaluación vigente ya tiene una `Aprobacion`.
    desde: ['EN_EVALUACION', 'PENDIENTE_APROBACION'],
    hasta: 'PENDIENTE_APROBACION',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'recomendar una cotización',
  },
  ACEPTAR: {
    desde: ['PENDIENTE_APROBACION'],
    hasta: 'PENDIENTE_REGISTRO_COSTO',
    rol: 'APROBADOR',
    etiqueta: 'aceptar',
  },
  RECHAZAR: {
    desde: ['PENDIENTE_APROBACION'],
    hasta: 'RECHAZADO',
    rol: 'APROBADOR',
    etiqueta: 'rechazar',
  },
  CERRAR_SIN_ACUERDO: {
    // También desde PENDIENTE_COTIZACION: §45 existe justamente para
    // cuando NO se llegó a acuerdo con los proveedores, y eso se sabe
    // antes de que haya nada que aprobar.
    desde: [
      'PENDIENTE_COTIZACION',
      'COTIZACIONES_RECIBIDAS',
      'EN_EVALUACION',
      'PENDIENTE_APROBACION',
      'RECHAZADO',
    ],
    hasta: 'SIN_ACUERDO',
    rol: 'APROBADOR',
    etiqueta: 'cerrar sin acuerdo',
  },
  REEVALUAR: {
    desde: ['RECHAZADO'],
    hasta: 'EN_EVALUACION',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'volver a evaluar',
  },
  REGISTRAR_COSTO: {
    desde: ['PENDIENTE_REGISTRO_COSTO'],
    hasta: 'FINALIZADO',
    rol: 'SOLICITANTE',
    etiqueta: 'registrar el costo',
  },
  /**
   * §54: se editó un ítem que la cotización RECOMENDADA o APROBADA ya
   * cotizaba, así que esa cotización dejó de cotizar lo que se pide.
   *
   * El requerimiento vuelve a COTIZACIONES_RECIBIDAS porque el turno
   * cambió de dueño: ya no es del Aprobador ni del Solicitante, es del
   * Gestor, que tiene que volver a pedirle precio a ese proveedor. En
   * este sistema el estado dice DE QUIÉN ES EL TURNO —por eso `APROBADO`
   * no existe como destino, el hecho vive en `Aprobacion`—, así que
   * dejarlo donde estaba habría sido dejarlo mintiendo.
   *
   * Lo que NO se deshace es la decisión: la fila de `Aprobacion` sigue
   * ahí diciendo quién aprobó y cuándo. Se rehace el camino, no se borra
   * la historia.
   */
  REABRIR_POR_EDICION: {
    desde: ['PENDIENTE_APROBACION', 'PENDIENTE_REGISTRO_COSTO'],
    hasta: 'COTIZACIONES_RECIBIDAS',
    rol: 'GESTOR_COTIZACIONES',
    etiqueta: 'reabrir por edición de un ítem',
    automatica: true,
  },
};

/** Etiquetas de estado para los mensajes de error, en lenguaje de persona. */
export const ETIQUETA_ESTADO: Record<EstadoRequerimiento, string> = {
  BORRADOR: 'borrador',
  PENDIENTE_REVISION: 'pendiente de revisión',
  OBSERVADO: 'observado',
  PENDIENTE_COTIZACION: 'pendiente de cotización',
  COTIZACIONES_RECIBIDAS: 'con cotizaciones recibidas',
  EN_EVALUACION: 'en evaluación',
  PENDIENTE_APROBACION: 'pendiente de aprobación',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  SIN_ACUERDO: 'cerrado sin acuerdo',
  PENDIENTE_REGISTRO_COSTO: 'pendiente de registrar el costo',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado',
};

/**
 * Los estados en los que se puede cambiar la CONFIGURACIÓN del
 * requerimiento: cliente, supervisor y los dos tipos.
 *
 * Solo mientras es del Solicitante y no lo ha visto nadie más, o cuando
 * se lo han devuelto para corregir. Cambiar el cliente de un
 * requerimiento que ya salió a proveedores no es corregir un dato, es
 * otro requerimiento.
 *
 * ⚠️ NO confundir con lo que se puede editar en general: §54 abre el
 * lugar y la fecha de entrega en cualquier momento, y los ítems mientras
 * el requerimiento no esté cerrado. Ver `CAMPOS_SIEMPRE_EDITABLES` y
 * `admiteCambios`.
 */
export const ESTADOS_EDITABLES: EstadoRequerimiento[] = [
  'BORRADOR',
  'OBSERVADO',
];

/**
 * Los campos de cabecera que §54 deja tocar SIEMPRE, sin mirar el estado.
 *
 * Son datos logísticos: a dónde se lleva y para cuándo. Cambian por
 * razones que no tienen nada que ver con lo que se pidió ni con lo que
 * cotizó nadie, así que bloquearlos habría obligado a cancelar y rehacer
 * un requerimiento entero para mover una entrega tres días.
 *
 * **SIEMPRE quiere decir siempre, también en un requerimiento cerrado.**
 * Lectura literal de §54, confirmada por HVC: una dirección mal escrita
 * no deja de estar mal porque el requerimiento se haya cancelado o
 * finalizado, y congelarla obligaba a convivir con el error para
 * siempre. Lo que evita que sea una puerta trasera es que cada cambio
 * pasa por la bitácora con quién, cuándo y el valor anterior y nuevo.
 *
 * `fechaEmision` NO está aquí: es la fecha del documento y va con la
 * configuración, no con la logística.
 */
export const CAMPOS_SIEMPRE_EDITABLES = [
  'lugarEntrega',
  'fechaEntrega',
] as const;

/** Los estados de los que ya no se sale. */
export const ESTADOS_CERRADOS: EstadoRequerimiento[] = [
  'FINALIZADO',
  'SIN_ACUERDO',
  'CANCELADO',
];

/** ¿Se puede cambiar la configuración (cliente, supervisor, tipos)? */
export function esEditable(estado: EstadoRequerimiento): boolean {
  return ESTADOS_EDITABLES.includes(estado);
}

/**
 * ¿Admite cambios de ÍTEMS?
 *
 * §54: sí mientras el requerimiento siga vivo. Uno cerrado —FINALIZADO,
 * SIN_ACUERDO o CANCELADO— ya no cambia lo que se pidió: eso es
 * registro, y encima los ítems de un finalizado sostienen las líneas del
 * costo (§53).
 *
 * ⚠️ **Solo los ítems.** El lugar y la fecha de entrega NO pasan por
 * aquí: §54 los abre «sin restricción por estado» y HVC confirmó la
 * lectura literal, así que se corrigen incluso en un requerimiento
 * cerrado. Quien lo hace cumplir es `RequerimientoService.editar`, que
 * mira `esEditable` para la configuración y deja pasar los de
 * `CAMPOS_SIEMPRE_EDITABLES` siempre. Si algún día se llama a esta
 * función para la cabecera, se estará volviendo a congelar la logística
 * sin querer.
 */
export function admiteCambios(estado: EstadoRequerimiento): boolean {
  return !esCerrado(estado);
}

/** ¿Este estado es un cierre? Sirve para poner `cerradoEn`. */
export function esCerrado(estado: EstadoRequerimiento): boolean {
  return ESTADOS_CERRADOS.includes(estado);
}

/**
 * Comprueba que la acción es legal desde este estado, y devuelve a dónde
 * lleva.
 *
 * NO comprueba el rol: de eso se encarga `@RequiereRolCostos` en la ruta,
 * que es donde §57 exige que esté —en el backend, antes de tocar nada—.
 * Aquí se responde solo «¿el proceso admite esto ahora?», que es otra
 * pregunta: un Aprobador tampoco puede aceptar dos veces.
 */
export function transicion(
  estadoActual: EstadoRequerimiento,
  accion: AccionRequerimiento,
): EstadoRequerimiento {
  const t = TRANSICIONES[accion];

  if (!t.desde.includes(estadoActual))
    throw new BadRequestException(
      `No se puede ${t.etiqueta}: el requerimiento está ${ETIQUETA_ESTADO[estadoActual]}. ` +
        `Solo se puede desde ${t.desde.map((e) => ETIQUETA_ESTADO[e]).join(', ')}.`,
    );

  return t.hasta;
}

/** Qué rol le corresponde a una acción. Lo usan las rutas y las pruebas. */
export function rolDe(accion: AccionRequerimiento): RolCostos {
  return TRANSICIONES[accion].rol;
}

/**
 * Las acciones que caben ahora mismo, para un rol dado.
 *
 * Es lo que la pantalla necesita para decidir qué botones pintar (Fase
 * 7). Se deriva de la MISMA tabla que las hace cumplir, así que la UI no
 * puede ofrecer una puerta que el backend después cierra con un 400.
 */
export function accionesPosibles(
  estado: EstadoRequerimiento,
  rol: RolCostos | null,
): AccionRequerimiento[] {
  return (Object.keys(TRANSICIONES) as AccionRequerimiento[]).filter((a) => {
    const t = TRANSICIONES[a];
    // Las automáticas no son botones: las provoca otra cosa.
    if (t.automatica) return false;
    // rol null = SuperAdmin, que pasa por encima de los roles.
    return t.desde.includes(estado) && (rol === null || t.rol === rol);
  });
}
