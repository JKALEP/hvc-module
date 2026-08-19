import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { EstadoRequerimiento } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { aId } from '../../common/validacion';
import { aFechaUTC } from '../../common/fechas';
import { NumeracionService } from '../../common/numeracion.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { OpcionService } from '../catalogo/opcion.service';
import { ClienteService } from '../catalogo/cliente.service';
import { SupervisorService } from '../catalogo/supervisor.service';
import { aTexto } from '../validacion';
// `admiteCambios` NO se importa a propósito: es la regla de los ÍTEMS y
// la aplica `item.service`. La cabecera se rige por `esEditable` para la
// configuración, y los `CAMPOS_SIEMPRE_EDITABLES` pasan sin mirar el
// estado (§54, lectura literal).
import {
  transicion,
  esEditable,
  esCerrado,
  accionesPosibles,
  CAMPOS_SIEMPRE_EDITABLES,
  ETIQUETA_ESTADO,
  type AccionRequerimiento,
} from './estados';
import type { GuardarRequerimientoDto } from './dto';

/** Los estados que la interfaz agrupa como «Pendientes» (§26). */
const PENDIENTES: EstadoRequerimiento[] = [
  'BORRADOR',
  'PENDIENTE_REVISION',
  'OBSERVADO',
  'PENDIENTE_COTIZACION',
  'COTIZACIONES_RECIBIDAS',
  'EN_EVALUACION',
  'PENDIENTE_APROBACION',
  'APROBADO',
  'RECHAZADO',
  'PENDIENTE_REGISTRO_COSTO',
];

/**
 * Las columnas de la cabecera que salen de validar el DTO.
 *
 * Todas opcionales porque la edición es parcial. `crear` las exige
 * todas, y de eso se encarga `campos(dto, false)`.
 */
interface CamposCabecera {
  tipoMantenimientoId?: number;
  tipoMantenimientoNombre?: string;
  tipoRequerimientoId?: number;
  tipoRequerimientoNombre?: string;
  supervisorId?: number;
  supervisorNombre?: string;
  clienteId?: number;
  clienteNombre?: string;
  lugarEntrega?: string;
  fechaEntrega?: Date;
  fechaEmision?: Date;
}

/** Lo mismo, pero con todo puesto: lo que `crear` necesita. */
type CabeceraCompleta = Required<Omit<CamposCabecera, 'fechaEmision'>>;

/**
 * El requerimiento: cabecera, ciclo de vida y numeración.
 *
 * §26 agrupa la interfaz en «Pendientes» y «Finalizados», pero por dentro
 * el estado es siempre el específico (§11): agrupar es cosa de la
 * pantalla, y guardar solo dos valores habría hecho imposible saber de
 * quién es el turno.
 *
 * Los cuatro selectores de §13 se validan contra los services de los
 * maestros (`OpcionService`, `ClienteService`, `SupervisorService`), no
 * repitiendo la consulta aquí: quién decide si algo se puede elegir es
 * el dueño de ese catálogo.
 */
@Injectable()
export class RequerimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numeracion: NumeracionService,
    private readonly auditoria: AuditoriaService,
    private readonly opciones: OpcionService,
    private readonly clientes: ClienteService,
    private readonly supervisores: SupervisorService,
  ) {}

  // ── Lectura ──

  private get incluir() {
    return {
      items: { orderBy: { orden: 'asc' as const } },
      solicitante: { select: { id: true, nombre: true } },
      _count: {
        select: { observaciones: true, cotizaciones: true, solicitudes: true },
      },
    };
  }

  /**
   * ¿Qué requerimientos ve quien pregunta?
   *
   * Un SOLICITANTE ve los SUYOS —§26 dice «sus requerimientos»—; el
   * Gestor y el Aprobador ven todos, porque su trabajo es justamente
   * atender los de los demás. El SuperAdmin no tiene rol dentro del
   * módulo y ve todo.
   */
  private alcance(usuario: UsuarioAutenticado) {
    const rol =
      usuario.permisos.find((p) => p.modulo === 'COSTOS')?.rolCostos ?? null;
    return rol === 'SOLICITANTE' ? { solicitanteId: usuario.id } : {};
  }

  private rolDe(usuario: UsuarioAutenticado) {
    return (
      usuario.permisos.find((p) => p.modulo === 'COSTOS')?.rolCostos ?? null
    );
  }

  async listar(
    usuario: UsuarioAutenticado,
    filtros: { grupo?: string; estado?: string },
  ) {
    // El conmutador de §26. Sin grupo, todo.
    const porGrupo =
      filtros.grupo === 'pendientes'
        ? { estado: { in: PENDIENTES } }
        : filtros.grupo === 'finalizados'
          ? { estado: { notIn: PENDIENTES } }
          : {};

    return this.prisma.requerimiento.findMany({
      where: {
        ...this.alcance(usuario),
        ...porGrupo,
        ...(filtros.estado
          ? { estado: filtros.estado as EstadoRequerimiento }
          : {}),
      },
      orderBy: [{ creadoEn: 'desc' }],
      include: this.incluir,
      take: 300,
    });
  }

  /**
   * El detalle, con las acciones que caben ahora para quien pregunta.
   *
   * `accionesPosibles` sale de la MISMA tabla que las hace cumplir, así
   * que la pantalla (Fase 7) no puede ofrecer un botón que el backend
   * después rechace con un 400.
   */
  async detalle(usuario: UsuarioAutenticado, id: number) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id },
      include: this.incluir,
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const rol = this.rolDe(usuario);
    // §57: ocultar no es proteger. Un Solicitante no lee los de otro
    // aunque adivine el id.
    if (rol === 'SOLICITANTE' && req.solicitanteId !== usuario.id)
      throw new ForbiddenException(
        'Ese requerimiento es de otra persona: solo puedes ver los tuyos.',
      );

    return { ...req, acciones: accionesPosibles(req.estado, rol) };
  }

  /** Lo carga y comprueba que quien pide puede tocarlo. */
  private async suyo(usuario: UsuarioAutenticado, id: number) {
    const req = await this.prisma.requerimiento.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const rol = this.rolDe(usuario);
    if (rol === 'SOLICITANTE' && req.solicitanteId !== usuario.id)
      throw new ForbiddenException(
        'Ese requerimiento es de otra persona: solo puedes modificar los tuyos.',
      );

    return req;
  }

  // ── Validación de la cabecera (§13, §14) ──

  /**
   * Valida los campos que llegan y devuelve las columnas a escribir,
   * incluidos los snapshots de nombre.
   *
   * Los cuatro selectores guardan FK **y** nombre: el documento emitido
   * tiene que seguir diciendo lo que decía, aunque después renombren al
   * cliente. Mismo criterio que `Proyecto` en Obra.
   */
  private async campos(
    dto: GuardarRequerimientoDto,
    parcial: boolean,
  ): Promise<CamposCabecera> {
    const data: CamposCabecera = {};
    const exige = (clave: keyof GuardarRequerimientoDto) =>
      !parcial || clave in dto;

    if (exige('tipoMantenimientoId')) {
      const id = aId(
        dto.tipoMantenimientoId,
        'El tipo de mantenimiento no es válido.',
      );
      const opcion = await this.opciones.exigirActiva(id, 'TIPO_MANTENIMIENTO');
      data.tipoMantenimientoId = opcion.id;
      data.tipoMantenimientoNombre = opcion.valor;
    }

    if (exige('tipoRequerimientoId')) {
      const id = aId(
        dto.tipoRequerimientoId,
        'El tipo de requerimiento no es válido.',
      );
      const opcion = await this.opciones.exigirActiva(id, 'TIPO_REQUERIMIENTO');
      data.tipoRequerimientoId = opcion.id;
      data.tipoRequerimientoNombre = opcion.valor;
    }

    if (exige('supervisorId')) {
      const id = aId(dto.supervisorId, 'El supervisor no es válido.');
      const sup = await this.supervisores.exigirActivo(id);
      data.supervisorId = sup.id;
      data.supervisorNombre = sup.nombre;
    }

    if (exige('clienteId')) {
      const id = aId(dto.clienteId, 'El cliente no es válido.');
      const cli = await this.clientes.exigirActivo(id);
      data.clienteId = cli.id;
      data.clienteNombre = cli.nombre;
    }

    if (exige('lugarEntrega'))
      data.lugarEntrega = aTexto(dto.lugarEntrega, 'El lugar de entrega');

    if (exige('fechaEntrega'))
      data.fechaEntrega = aFechaUTC(
        aTexto(dto.fechaEntrega, 'La fecha de entrega'),
        'fechaEntrega',
      );

    // §18: nace igual a la de creación y se puede mover. Se guarda a
    // medianoche UTC porque es @db.Date, igual que en Obra.
    if ('fechaEmision' in dto && dto.fechaEmision)
      data.fechaEmision = aFechaUTC(dto.fechaEmision, 'fechaEmision');

    return data;
  }

  /**
   * La entrega no puede ser anterior a la emisión.
   *
   * Se comprueba sobre los valores YA FUSIONADOS (los que llegan más los
   * que ya estaban): en una edición parcial puede venir solo una de las
   * dos, y compararla contra nada dejaría pasar la incoherencia.
   */
  private exigirFechasCoherentes(emision: Date, entrega: Date) {
    if (entrega < emision)
      throw new BadRequestException(
        'La fecha de entrega no puede ser anterior a la de emisión.',
      );
  }

  // ── Escritura ──

  /**
   * Crea el requerimiento en BORRADOR.
   *
   * SIN número: §25 dice que los identificadores se generan AL EMITIR, y
   * así un borrador que se abandona no se lleva por delante un número de
   * la serie —que no se recicla, porque `nextval()` no se deshace—.
   */
  async crear(usuario: UsuarioAutenticado, dto: GuardarRequerimientoDto) {
    // Con `parcial = false`, `campos` exige los cinco campos de §13 y
    // lanza si falta alguno. El cast solo se lo cuenta a TypeScript, que
    // no puede deducirlo de un booleano.
    const data = (await this.campos(dto, false)) as CabeceraCompleta &
      CamposCabecera;

    const fechaEmision = data.fechaEmision ?? hoyUTC();
    this.exigirFechasCoherentes(fechaEmision, data.fechaEntrega);

    const req = await this.prisma.requerimiento.create({
      data: {
        tipoMantenimientoId: data.tipoMantenimientoId,
        tipoMantenimientoNombre: data.tipoMantenimientoNombre,
        tipoRequerimientoId: data.tipoRequerimientoId,
        tipoRequerimientoNombre: data.tipoRequerimientoNombre,
        supervisorId: data.supervisorId,
        supervisorNombre: data.supervisorNombre,
        clienteId: data.clienteId,
        clienteNombre: data.clienteNombre,
        lugarEntrega: data.lugarEntrega,
        fechaEntrega: data.fechaEntrega,
        fechaEmision,
        estado: 'BORRADOR',
        solicitanteId: usuario.id,
      },
      include: this.incluir,
    });

    await this.auditoria.registrarUno(usuario, {
      requerimientoId: req.id,
      entidad: 'REQUERIMIENTO',
      entidadId: req.id,
      accion: 'CREACION',
      descripcion: `Se creó el borrador para ${req.clienteNombre}.`,
    });

    return {
      ...req,
      acciones: accionesPosibles(req.estado, this.rolDe(usuario)),
    };
  }

  /**
   * Edita la cabecera, con las reglas de §54.
   *
   * Dos grupos de campos y dos reglas distintas:
   *
   *   · **Logísticos** (`lugarEntrega`, `fechaEntrega`): siempre, sin
   *     mirar el estado. Cambian por razones ajenas a lo que se pidió —
   *     la obra se movió de nave, la parada de planta se corrió— y
   *     bloquearlos obligaría a cancelar y rehacer un requerimiento
   *     entero para mover una entrega tres días.
   *
   *   · **De configuración** (cliente, supervisor, los dos tipos y la
   *     fecha de emisión): solo en BORRADOR u OBSERVADO. Cambiar el
   *     cliente de algo que ya salió a proveedores no es corregir un
   *     dato: es otro requerimiento.
   *
   * Se comprueba qué campos TRAE el DTO, no qué valores: mandar el mismo
   * cliente que ya tenía sigue siendo tocar un campo bloqueado, y dejarlo
   * pasar convertiría la regla en «depende de si acertaste».
   */
  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: GuardarRequerimientoDto,
  ) {
    const actual = await this.suyo(usuario, id);

    /**
     * §54, en su lectura literal: el lugar y la fecha de entrega se
     * corrigen **sin restricción por estado**, incluso en un
     * requerimiento cerrado.
     *
     * No hay un guard previo de «está cerrado, no se toca» porque la
     * única puerta que hace falta es la de abajo: `esEditable` solo
     * admite BORRADOR y OBSERVADO, y ningún estado cerrado está ahí, así
     * que la configuración —cliente, supervisor, los dos tipos— sigue
     * bloqueada en cuanto el requerimiento sale de casa. Lo que se abre
     * es exclusivamente la logística.
     *
     * El motivo lo puso HVC: una dirección mal escrita o una fecha que
     * quedó archivada mal no dejan de ser un error por que el
     * requerimiento se haya cerrado, y congelarlas obligaba a convivir
     * con el dato equivocado para siempre. Lo que impide que esto sea
     * una puerta trasera es la bitácora: cada cambio queda con quién,
     * cuándo y el valor anterior y nuevo, igual que los demás campos.
     */
    const bloqueados = (
      Object.keys(dto) as (keyof GuardarRequerimientoDto)[]
    ).filter(
      (c) => !(CAMPOS_SIEMPRE_EDITABLES as readonly string[]).includes(c),
    );

    if (bloqueados.length > 0 && !esEditable(actual.estado))
      throw new BadRequestException(
        `El requerimiento está ${ETIQUETA_ESTADO[actual.estado]}: a estas alturas ` +
          'solo se pueden cambiar el lugar y la fecha de entrega. ' +
          `Quita ${bloqueados.join(', ')} de la petición.`,
      );

    const data = await this.campos(dto, true);
    if (Object.keys(data).length === 0) return this.detalle(usuario, id);

    this.exigirFechasCoherentes(
      data.fechaEmision ?? actual.fechaEmision,
      data.fechaEntrega ?? actual.fechaEntrega,
    );

    const req = await this.prisma.requerimiento.update({
      where: { id },
      data,
    });

    await this.auditoria.registrar(
      usuario,
      this.auditoria.diferencias(instantanea(actual), instantanea(req), {
        requerimientoId: id,
        entidad: 'REQUERIMIENTO',
        entidadId: id,
      }),
    );

    return this.detalle(usuario, id);
  }

  /**
   * Emite el requerimiento (§25): lo manda al Gestor.
   *
   * Es también la acción de devolverlo corregido tras una observación
   * (§28): la misma cosa desde el punto de vista del Solicitante. La
   * diferencia es que la segunda vez YA TIENE número y no se pide otro —
   * reemitir no puede consumir un correlativo, ni cambiar el que el
   * proveedor ya vio.
   *
   * Todo va en una transacción con la reserva del número: si el alta
   * falla, el número se pierde (queda un hueco) pero no se duplica.
   */
  async emitir(usuario: UsuarioAutenticado, id: number) {
    const actual = await this.suyo(usuario, id);
    const nuevoEstado = transicion(actual.estado, 'EMITIR');

    const items = await this.prisma.requerimientoItem.count({
      where: { requerimientoId: id },
    });
    if (items === 0)
      throw new BadRequestException(
        'No se puede emitir un requerimiento sin ítems. Agrega al menos uno.',
      );

    // §29: devolverlo corregido exige haber dejado constancia de que se
    // leyó cada observación. Sin esta puerta, la acción de confirmar
    // sería opcional y el Gestor no tendría forma de saber si lo que
    // escribió llegó a alguien — solo que algo cambió.
    const sinConfirmar = await this.prisma.observacion.count({
      where: { requerimientoId: id, estado: 'PENDIENTE' },
    });
    if (sinConfirmar > 0)
      throw new BadRequestException(
        `Quedan ${sinConfirmar} observación(es) sin confirmar. ` +
          'Confírmalas antes de devolver el requerimiento.',
      );

    const reemision = actual.numero !== null;

    await this.prisma.$transaction(async (tx) => {
      const numero =
        actual.numero ??
        (await this.numeracion.siguienteNumeroRequerimiento(tx));

      await tx.requerimiento.update({
        where: { id },
        data: {
          numero,
          estado: nuevoEstado,
          // Se sella la PRIMERA emisión. Reemitir tras corregir no
          // reescribe cuándo salió por primera vez.
          emitidoEn: actual.emitidoEn ?? new Date(),
        },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId: id,
          entidad: 'REQUERIMIENTO',
          entidadId: id,
          accion: 'EMISION',
          campoAfectado: 'estado',
          valorAnterior: actual.estado,
          valorNuevo: nuevoEstado,
          descripcion: reemision
            ? `Se reenvió ${numero} corregido, con ${items} ítem(s).`
            : `Se emitió ${numero} con ${items} ítem(s).`,
        },
        tx,
      );
    });

    return this.detalle(usuario, id);
  }

  /**
   * Cancela el requerimiento (§11 CANCELADO).
   *
   * NO lo borra: un requerimiento emitido es un hecho, y §53 dice que un
   * valor histórico no se pierde en silencio. Para deshacer un borrador
   * que nunca salió está `eliminarBorrador`.
   */
  async cancelar(usuario: UsuarioAutenticado, id: number, motivo?: string) {
    const actual = await this.suyo(usuario, id);
    const nuevoEstado = transicion(actual.estado, 'CANCELAR');

    const razon = aTexto(motivo, 'El motivo de la cancelación');

    await this.prisma.$transaction(async (tx) => {
      await tx.requerimiento.update({
        where: { id },
        data: {
          estado: nuevoEstado,
          cerradoEn: esCerrado(nuevoEstado) ? new Date() : null,
        },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId: id,
          entidad: 'REQUERIMIENTO',
          entidadId: id,
          accion: 'CAMBIO_ESTADO',
          campoAfectado: 'estado',
          valorAnterior: actual.estado,
          valorNuevo: nuevoEstado,
          motivo: razon,
        },
        tx,
      );
    });

    return this.detalle(usuario, id);
  }

  /**
   * Borra un borrador. Solo un borrador.
   *
   * Es el «Cancelar» de §15 y §23, el que abandona la creación sin dejar
   * rastro: mientras no se ha emitido, no hay nada que auditar porque
   * nadie más lo ha visto y no tiene número. Emitido ya, la salida es
   * `cancelar`.
   */
  async eliminarBorrador(usuario: UsuarioAutenticado, id: number) {
    const actual = await this.suyo(usuario, id);

    if (actual.estado !== 'BORRADOR')
      throw new BadRequestException(
        `Solo se borra un borrador. Este está ${ETIQUETA_ESTADO[actual.estado]}: ` +
          'usa cancelar, que deja constancia.',
      );

    // Los ítems se van en cascada; los eventos del borrador, también.
    await this.prisma.requerimiento.delete({ where: { id } });
    return { ok: true, id };
  }

  /** La cadena completa de §64, para auditar el proceso. */
  async historial(usuario: UsuarioAutenticado, id: number) {
    await this.detalle(usuario, id); // aplica el mismo control de acceso
    return this.auditoria.deRequerimiento(id);
  }

  /**
   * Aplica una transición disparada por otro submódulo (Gestor,
   * Aprobador) dentro de SU transacción.
   *
   * Existe para que las fases siguientes no reimplementen el paso de
   * estado ni escriban en `costos_requerimientos` por su cuenta: la
   * máquina de estados tiene un solo sitio donde se obedece.
   */
  async aplicarTransicion(
    usuario: UsuarioAutenticado,
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    requerimiento: { id: number; estado: EstadoRequerimiento },
    accion: AccionRequerimiento,
    motivo?: string | null,
  ) {
    const nuevoEstado = transicion(requerimiento.estado, accion);
    if (nuevoEstado === requerimiento.estado) return nuevoEstado;

    await tx.requerimiento.update({
      where: { id: requerimiento.id },
      data: {
        estado: nuevoEstado,
        ...(esCerrado(nuevoEstado) ? { cerradoEn: new Date() } : {}),
      },
    });

    await this.auditoria.registrarUno(
      usuario,
      {
        requerimientoId: requerimiento.id,
        entidad: 'REQUERIMIENTO',
        entidadId: requerimiento.id,
        accion: 'CAMBIO_ESTADO',
        campoAfectado: 'estado',
        valorAnterior: requerimiento.estado,
        valorNuevo: nuevoEstado,
        motivo: motivo ?? null,
      },
      tx,
    );

    return nuevoEstado;
  }
}

/** Hoy a medianoche UTC, para los campos @db.Date. */
function hoyUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * La cabecera en texto legible, para comparar en la auditoría.
 *
 * Se guardan los NOMBRES y no los ids: a quien audita le interesa que el
 * cliente pasó de «Alicorp» a «Backus», no que `clienteId` pasó de 4 a 9.
 */
function instantanea(r: {
  tipoMantenimientoNombre: string;
  tipoRequerimientoNombre: string;
  supervisorNombre: string;
  clienteNombre: string;
  lugarEntrega: string;
  fechaEntrega: Date;
  fechaEmision: Date;
}): Record<string, string | null> {
  const dia = (f: Date) => f.toISOString().slice(0, 10);
  return {
    tipoMantenimiento: r.tipoMantenimientoNombre,
    tipoRequerimiento: r.tipoRequerimientoNombre,
    supervisor: r.supervisorNombre,
    cliente: r.clienteNombre,
    lugarEntrega: r.lugarEntrega,
    fechaEntrega: dia(r.fechaEntrega),
    fechaEmision: dia(r.fechaEmision),
  };
}
