// Tipos del módulo Costos.
//
// Los Decimal de Prisma llegan como string, SALVO donde el backend ya
// hizo la cuenta (totales, costos calculados): esos vienen como number.
// Cada campo dice cuál es.

/** Rol dentro del módulo. Vive en `auth/types.ts`; se reexporta por comodidad. */
export type { RolCostos } from '@/modules/auth/types';

/**
 * Los 13 estados del proceso (§11 + OBSERVADO).
 *
 * `APROBADO` está en el enum del backend pero ninguna transición lleva a
 * él: el hecho de la aprobación vive en la tabla `Aprobacion`, y el
 * estado dice de quién es el turno. Se declara para que el tipo case con
 * la base, no porque se vaya a ver.
 */
export type EstadoRequerimiento =
  | 'BORRADOR'
  | 'PENDIENTE_REVISION'
  | 'OBSERVADO'
  | 'PENDIENTE_COTIZACION'
  | 'COTIZACIONES_RECIBIDAS'
  | 'EN_EVALUACION'
  | 'PENDIENTE_APROBACION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'SIN_ACUERDO'
  | 'PENDIENTE_REGISTRO_COSTO'
  | 'FINALIZADO'
  | 'CANCELADO';

/**
 * Lo que se puede hacer ahora mismo, según estado y rol.
 *
 * Lo calcula el backend con la MISMA tabla que lo hace cumplir, así que
 * la pantalla no puede ofrecer un botón que después devuelva 400.
 */
export type AccionRequerimiento =
  | 'EMITIR'
  | 'CANCELAR'
  | 'OBSERVAR'
  | 'PASAR_A_COTIZACION'
  | 'REGISTRAR_COTIZACION'
  | 'EVALUAR'
  | 'RECOMENDAR'
  | 'ACEPTAR'
  | 'RECHAZAR'
  | 'CERRAR_SIN_ACUERDO'
  | 'REEVALUAR'
  | 'REGISTRAR_COSTO';

// ── Selectores del formulario inicial (§13) ──

export interface OpcionCatalogo {
  id: number;
  valor: string;
}

export interface ClienteCostos {
  id: number;
  nombre: string;
  ruc: string | null;
}

export interface Supervisor {
  id: number;
  nombre: string;
  documento: string | null;
  cargo: string | null;
}

/** Las cinco listas de §13, que llegan en una sola llamada. */
export interface OpcionesRequerimiento {
  tiposMantenimiento: OpcionCatalogo[];
  tiposRequerimiento: OpcionCatalogo[];
  unidades: OpcionCatalogo[];
  clientes: ClienteCostos[];
  supervisores: Supervisor[];
}

// ── Requerimiento ──

/** Las cinco columnas de §19. */
export interface RequerimientoItem {
  id: number;
  orden: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  /** Número de parte contra el que cotiza el proveedor. Opcional. */
  codigoProducto: string | null;
  detalleObservacion: string | null;
  referencias: string | null;
}

export interface Requerimiento {
  id: number;
  /** Null mientras es BORRADOR: el número se asigna al emitir (§25). */
  numero: string | null;
  estado: EstadoRequerimiento;

  tipoMantenimientoId: number;
  tipoMantenimientoNombre: string;
  tipoRequerimientoId: number;
  tipoRequerimientoNombre: string;
  supervisorId: number;
  supervisorNombre: string;
  clienteId: number;
  clienteNombre: string;

  lugarEntrega: string;
  /** ISO. Es @db.Date: se lee en UTC para no correr el día. */
  fechaEntrega: string;
  fechaEmision: string;

  creadoEn: string;
  actualizadoEn: string;
  emitidoEn: string | null;
  cerradoEn: string | null;

  solicitante: { id: number; nombre: string } | null;
  items: RequerimientoItem[];
  _count: {
    observaciones: number;
    cotizaciones: number;
    solicitudes: number;
  };
  /** Solo en el detalle, no en el listado. */
  acciones?: AccionRequerimiento[];
}

export interface GuardarRequerimientoPayload {
  tipoMantenimientoId?: number;
  tipoRequerimientoId?: number;
  supervisorId?: number;
  clienteId?: number;
  lugarEntrega?: string;
  /** "YYYY-MM-DD". */
  fechaEntrega?: string;
  fechaEmision?: string;
}

/**
 * A quién se le pide cotización y a qué dirección.
 *
 * El correo es opcional: sin él se usa el de la ficha del proveedor. Se
 * manda cuando la ficha no tiene ninguno —y entonces se guarda ahí— o
 * cuando esta vez hay que escribir a otro buzón.
 */
export interface DestinoCotizacion {
  proveedorId: number;
  correo?: string;
}

export interface GuardarItemPayload {
  descripcion?: string;
  unidad?: string;
  cantidad?: number;
  codigoProducto?: string | null;
  detalleObservacion?: string | null;
  referencias?: string | null;
}

/**
 * Lo que arrastró editar un ítem (§54).
 *
 * Viene en la respuesta del PATCH y no solo en la bitácora porque quien
 * edita tiene que enterarse en el momento: un cambio que además deshace
 * una aprobación no puede responder «guardado» y ya.
 */
export interface EfectosEdicionItem {
  cotizacionesPendientesDeRevision: number;
  proveedoresAConsultar: string[];
  requerimientoReabierto: boolean;
}

export interface ItemConEfectos extends RequerimientoItem {
  efectos: EfectosEdicionItem;
}

/** Lo que dejó eliminar un ítem ya cotizado (§54.4). */
export interface ResultadoBorrarItem {
  ok: boolean;
  id: number;
  lineasHuerfanas: number;
  proveedoresQueLoCotizaron: string[];
}

// ── Observaciones (§27-29) ──

export interface Observacion {
  id: number;
  requerimientoId: number;
  texto: string;
  estado: 'PENDIENTE' | 'ATENDIDA';
  respuesta: string | null;
  confirmadaEn: string | null;
  creadoEn: string;
  creadoPor: { id: number; nombre: string } | null;
  confirmadaPor: { id: number; nombre: string } | null;
}

// ── Administración: los maestros de §58 ──
//
// Ojo: `OpcionCatalogo`, `ClienteCostos` y `Supervisor` de más arriba son
// las PROYECCIONES que devuelve `/requerimiento/opciones` para llenar los
// selectores de §13 —solo lo que hace falta para elegir—. Lo de aquí son
// las filas COMPLETAS que devuelve `/costos/admin/*`, con estado, orden y
// los datos de contacto. Son dos formas distintas del mismo dato a
// propósito: un endpoint de administración y uno de consulta no son el
// mismo endpoint aunque hoy lean la misma tabla.

export type TipoCatalogo =
  | 'TIPO_MANTENIMIENTO'
  | 'TIPO_REQUERIMIENTO'
  | 'UNIDAD_MEDIDA';

export interface OpcionCatalogoCompleta {
  id: number;
  tipo: TipoCatalogo;
  valor: string;
  orden: number;
  estado: EstadoCatalogo;
  creadoEn: string;
  actualizadoEn: string;
}

/** Al editar NO viaja el tipo: cambiarlo movería la opción de catálogo. */
export interface GuardarOpcionPayload {
  tipo?: TipoCatalogo;
  valor?: string;
  orden?: number;
  estado?: EstadoCatalogo;
}

export interface ClienteCostosCompleto {
  id: number;
  nombre: string;
  ruc: string | null;
  contacto: string | null;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  estado: EstadoCatalogo;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SupervisorCompleto {
  id: number;
  nombre: string;
  documento: string | null;
  cargo: string | null;
  correo: string | null;
  telefono: string | null;
  estado: EstadoCatalogo;
  creadoEn: string;
  actualizadoEn: string;
}

export interface GuardarProveedorPayload {
  ruc?: string | null;
  razonSocial?: string;
  nombreComercial?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: EstadoCatalogo;
}

/**
 * Lo que devuelve borrar un maestro.
 *
 * Cuando algo está en uso el backend responde 400 con el texto de
 * `exigirSinUso`, que ya dice cuántos lo usan y que se puede desactivar
 * en su lugar. La pantalla lo muestra tal cual: rehacer ese mensaje aquí
 * sería tener dos versiones de la misma regla.
 */
export interface ResultadoEliminar {
  ok: boolean;
  id: number;
}

// ── Plantillas de correo (§32, §68) ──

export interface VariablePlantilla {
  clave: string;
  descripcion: string;
}

/**
 * Una versión publicada. NO se edita ni se borra: cada solicitud guarda
 * con qué versión salió, y reescribirla cambiaría lo que dice un correo
 * ya enviado.
 */
export interface VersionPlantilla {
  id: number;
  plantillaId: number;
  version: number;
  asunto: string;
  cuerpo: string;
  /** Solo una por plantilla. Lo hace cumplir el service. */
  activa: boolean;
  creadoEn: string;
  creadoPor: { id: number; nombre: string } | null;
}

/**
 * Qué texto se usaría ahora mismo.
 *
 * `origen: 'DEFECTO'` significa que nadie ha publicado una versión y se
 * usa la del código. No es un fallo, y la pantalla lo dice con esas
 * palabras para que no se confunda con «el correo no funciona».
 */
export interface PlantillaEnUso {
  origen: 'VERSION' | 'DEFECTO';
  versionId: number | null;
  version: number | null;
  asunto: string;
  cuerpo: string;
}

export interface PlantillaCorreo {
  id: number;
  tipo: 'SOLICITUD_COTIZACION';
  nombre: string;
  creadoEn: string;
  actualizadoEn: string;
  versiones: VersionPlantilla[];
  variables: VariablePlantilla[];
  enUso: PlantillaEnUso;
}

export interface CrearVersionPayload {
  asunto: string;
  cuerpo: string;
  /** Por defecto true: quien escribe una versión suele querer estrenarla. */
  activar?: boolean;
}

export interface PrevisualizacionPlantilla {
  asunto: string;
  cuerpo: string;
  /** Marcadores que no son ninguna variable conocida. */
  desconocidas: string[];
}

// ── Proveedores (§31) ──

export type EstadoCatalogo = 'ACTIVO' | 'INACTIVO';

export interface Proveedor {
  id: number;
  ruc: string | null;
  razonSocial: string;
  nombreComercial: string | null;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
  estado: EstadoCatalogo;
  creadoEn: string;
  actualizadoEn: string;
}

// ── Solicitudes de cotización (§30-33) ──

export type EstadoEnvio = 'PENDIENTE' | 'ENVIADO' | 'FALLIDO';

/**
 * Un envío a un proveedor. Hay una fila POR ENVÍO, no por proveedor:
 * §44 admite volver a pedirle a alguien en una segunda vuelta.
 */
export interface SolicitudCotizacion {
  id: number;
  requerimientoId: number;
  proveedorId: number;
  /** El correo al que fue, congelado (§33). */
  destinatario: string;
  estadoEnvio: EstadoEnvio;
  /** Qué dijo el servidor de correo si falló (§67). */
  errorEnvio: string | null;
  creadoEn: string;
  enviadoEn: string | null;
  proveedor: { id: number; razonSocial: string; ruc: string | null; correo: string | null };
  enviadoPor: { id: number; nombre: string } | null;
  _count: { cotizaciones: number };
}

/**
 * Lo que responde compartir.
 *
 * `correoConfigurado` viene del backend a propósito: en desarrollo no
 * sale ningún correo de verdad y la pantalla tiene que decirlo, no
 * dejar que se dé por hecho.
 */
export interface ResultadoCompartir {
  solicitudes: { proveedor: string; enviado: boolean }[];
  correoConfigurado: boolean;
}

// ── Cotizaciones recibidas (§34-37) ──

export type EstadoCotizacionProveedor =
  | 'REGISTRADA'
  | 'RECOMENDADA'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'DESCARTADA';

/**
 * Una línea de la cotización, ya con su subtotal calculado.
 *
 * `requerimientoItemId` es null cuando la línea no contesta a ningún
 * ítem pedido: §36 admite que el proveedor añada flete o instalación.
 */
export interface CotizacionItem {
  id: number;
  orden: number;
  descripcion: string;
  unidad: string | null;
  requerimientoItemId: number | null;
  /** Decimal(14,4) ya convertido por el backend. */
  cantidad: number;
  precioUnitario: number;
  /** cantidad × precioUnitario, calculado en lectura. */
  subtotal: number;
}

export interface CotizacionProveedor {
  id: number;
  requerimientoId: number;
  proveedorId: number;
  solicitudId: number | null;
  estado: EstadoCotizacionProveedor;
  garantia: string | null;
  plazoEntrega: string | null;
  condicionesPago: string | null;
  observaciones: string | null;
  /** ISO. Es @db.Date: la del documento del proveedor, no la de registro (§65). */
  fechaCotizacion: string;
  validaHasta: string | null;
  /** §54: un ítem cambió después de recibirla. No se puede recomendar así. */
  requiereRevision: boolean;
  revisionMotivo: string | null;
  creadoEn: string;
  proveedor: {
    id: number;
    razonSocial: string;
    nombreComercial: string | null;
    ruc: string | null;
    correo: string | null;
    telefono: string | null;
  };
  registradaPor: { id: number; nombre: string } | null;
  items: CotizacionItem[];
  /** Suma de los subtotales. No se guarda: se calcula en lectura. */
  total: number;
}

export interface GuardarCotizacionPayload {
  /** Solo al crear: editar no cambia de proveedor, eso sería otra cotización. */
  proveedorId?: number;
  solicitudId?: number | null;
  /** "YYYY-MM-DD". */
  fechaCotizacion?: string;
  validaHasta?: string | null;
  garantia?: string | null;
  plazoEntrega?: string | null;
  condicionesPago?: string | null;
  observaciones?: string | null;
  items?: {
    requerimientoItemId: number | null;
    descripcion: string;
    unidad: string | null;
    cantidad: number;
    precioUnitario: number;
  }[];
}

// ── Comparación entre proveedores (§37) ──

/** Una fila por cotización: sirve para elegir con quién trabajar. */
export interface FilaComparacionProveedor {
  cotizacionId: number;
  proveedorId: number;
  proveedor: string;
  ruc: string | null;
  estado: EstadoCotizacionProveedor;
  requiereRevision: boolean;
  revisionMotivo: string | null;
  fechaCotizacion: string;
  validaHasta: string | null;
  garantia: string | null;
  plazoEntrega: string | null;
  condicionesPago: string | null;
  observaciones: string | null;
  lineas: number;
  total: number;
  /** Cuántos de los ítems pedidos cubre. Cotizar 3 de 8 no es competir. */
  itemsCubiertos: number;
}

/** Lo que un proveedor ofreció para un ítem concreto. */
export interface OfertaItem {
  cotizacionId: number;
  proveedor: string;
  estado: EstadoCotizacionProveedor;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface FilaComparacionItem {
  requerimientoItemId: number;
  orden: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  detalleObservacion: string | null;
  referencias: string | null;
  ofertas: OfertaItem[];
  /** El más bajo entre las que compiten. Null = nadie lo cotizó, NO cero. */
  mejorPrecioUnitario: number | null;
}

export interface Comparacion {
  totalItemsPedidos: number;
  /** Null si no queda ninguna compitiendo (todas descartadas o a revisar). */
  totalMasBajo: number | null;
  proveedores: FilaComparacionProveedor[];
  items: FilaComparacionItem[];
  /** Líneas que ningún ítem pedido reclama: flete, instalación (§36). */
  extras: OfertaItem[];
}

// ── Recomendación (§38-39) ──

/**
 * Una recomendación del Gestor. La VIGENTE es la de `ronda` más alta:
 * no hay booleano que apagar, se deriva.
 */
export interface EvaluacionCotizacion {
  id: number;
  requerimientoId: number;
  cotizacionId: number;
  ronda: number;
  justificacion: string;
  creadoEn: string;
  gestor: { id: number; nombre: string } | null;
  cotizacion: {
    id: number;
    estado: EstadoCotizacionProveedor;
    fechaCotizacion: string;
    proveedor: { id: number; razonSocial: string; ruc: string | null };
  };
}

export interface RecomendarPayload {
  cotizacionId: number;
  justificacion: string;
}

// ── Decisión del Aprobador (§41-45) ──

/**
 * Los tres desenlaces de §41-45.
 *
 * `RECHAZADA` NO es un cierre: devuelve el requerimiento al Gestor, que
 * puede volver a evaluar cuantas vueltas haga falta (§44). La única que
 * cierra sin compra es `SIN_ACUERDO`.
 */
export type DecisionAprobacion = 'ACEPTADA' | 'RECHAZADA' | 'SIN_ACUERDO';

/**
 * Una fila POR DECISIÓN, no una por requerimiento.
 *
 * `evaluacionId` dice sobre QUÉ recomendación se pronunció, y es
 * nullable porque cerrar sin acuerdo no exige que nadie haya
 * recomendado nada. Es lo que permite emparejar cada ronda con su
 * desenlace al leer el expediente.
 */
export interface Aprobacion {
  id: number;
  requerimientoId: number;
  evaluacionId: number | null;
  decision: DecisionAprobacion;
  /** Obligatorio al rechazar y al cerrar sin acuerdo (§43, §45). */
  comentario: string | null;
  creadoEn: string;
  aprobador: { id: number; nombre: string } | null;
  /** Resumen de la recomendación sobre la que se decidió. */
  evaluacion: {
    id: number;
    ronda: number;
    justificacion: string;
    cotizacion: {
      id: number;
      proveedor: { id: number; razonSocial: string };
    };
  } | null;
}

export interface DecidirPayload {
  decision: DecisionAprobacion;
  /** Opcional solo al aceptar. */
  comentario?: string | null;
}

// ── Registrar costo (§47-52) ──

/** La plantilla precargada de §48-49. */
export interface PlantillaCosto {
  requerimiento: {
    id: number;
    numero: string | null;
    cliente: string;
    lugarEntrega: string;
  };
  proveedor: {
    id: number;
    razonSocial: string;
    ruc: string | null;
    telefono: string | null;
  };
  cotizacionId: number;
  items: {
    requerimientoItemId: number;
    orden: number;
    descripcion: string;
    unidad: string;
    cantidad: number;
    detalleObservacion: string | null;
    referencias: string | null;
    /** Lo que cotizó el proveedor. Referencia, NO se precarga como costo. */
    precioCotizado: number | null;
  }[];
}

export interface CostoItem {
  id: number;
  orden: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  detalleObservacion: string | null;
  referencias: string | null;
  /** Ya convertido a number por el backend. Es POR UNIDAD. */
  costoUnitario: number;
  /** cantidad × costoUnitario, calculado en lectura. */
  costoTotal: number;
}

export interface Costo {
  id: number;
  requerimientoId: number;
  proveedorRazonSocial: string;
  proveedorRuc: string | null;
  proveedorTelefono: string | null;
  creadoEn: string;
  registradoPor: { id: number; nombre: string } | null;
  items: CostoItem[];
  total: number;
}

export interface RegistrarCostoPayload {
  items: { requerimientoItemId: number; costoUnitario: number }[];
}

// ── Auditoría (§64) ──

/** Las trece clases de fila sobre las que la bitácora puede hablar. */
export type EntidadCostos =
  | 'REQUERIMIENTO'
  | 'REQUERIMIENTO_ITEM'
  | 'OBSERVACION'
  | 'SOLICITUD_COTIZACION'
  | 'COTIZACION'
  | 'EVALUACION'
  | 'APROBACION'
  | 'COSTO'
  | 'PROVEEDOR'
  | 'CLIENTE'
  | 'SUPERVISOR'
  | 'CATALOGO'
  | 'PLANTILLA';

export type AccionCostos =
  | 'CREACION'
  | 'EDICION'
  | 'CAMBIO_ESTADO'
  | 'ELIMINACION'
  | 'EMISION'
  | 'OBSERVACION_EMITIDA'
  | 'OBSERVACION_CONFIRMADA'
  | 'ENVIO_CORREO'
  | 'RECOMENDACION'
  | 'DECISION'
  | 'REGISTRO_COSTO';

export interface EventoCostos {
  id: number;
  /** Null en las acciones de administración: no cuelgan de ninguno. */
  requerimientoId?: number | null;
  entidad: EntidadCostos;
  entidadId: number;
  accion: AccionCostos;
  usuarioNombre: string | null;
  campoAfectado: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  motivo: string | null;
  descripcion: string | null;
  creadoEn: string;
}

// ── Base de Costos (§52) ──

export interface FilaBaseCostos {
  id: number;
  descripcion: string;
  unidad: string;
  cantidad: number;
  detalleObservacion: string | null;
  referencias: string | null;
  costoUnitario: number;
  costoTotal: number;
  registradoEn: string;
  proveedor: string;
  proveedorRuc: string | null;
  requerimientoId: number;
  requerimientoNumero: string | null;
  cliente: string;
  registradoPor: string | null;
}

export interface RespuestaBaseCostos {
  total: number;
  pagina: number;
  porPagina: number;
  filas: FilaBaseCostos[];
}
