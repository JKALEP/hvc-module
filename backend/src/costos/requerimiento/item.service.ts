import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { EstadoRequerimiento } from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';
import { describir } from '../../common/texto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aTexto, aTextoOpcional } from '../validacion';
import { admiteCambios, ETIQUETA_ESTADO } from './estados';
import { RequerimientoService } from './requerimiento.service';
import type { GuardarItemDto } from './dto';

/** Cliente de Prisma dentro de una transacción. */
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * Una cotización DESCARTADA ya está fuera de la comparación: marcarla
 * como pendiente de revisar sería pedirle al Gestor que vuelva a
 * preguntar por algo que él mismo dejó fuera.
 */
const ESTADOS_QUE_SE_MARCAN = [
  'REGISTRADA',
  'RECOMENDADA',
  'APROBADA',
  'RECHAZADA',
] as const;

/**
 * Los ítems del requerimiento: las cinco columnas de §19 y las reglas de
 * edición de §54.
 *
 * Service aparte del de la cabecera, no por capa sino por pregunta: uno
 * responde «qué se pide y a quién», el otro «qué cosas concretas».
 *
 * §20 es explícito en que NO se escribe sobre una fila vacía: se pulsa
 * «+ Añadir» y se llena un modal. Aquí eso se traduce en que cada ítem
 * entra completo y validado de una vez, no campo a campo.
 *
 * ── §54: qué pasa cuando se toca algo ya cotizado ────────────────────
 * Los ítems se pueden cambiar mientras el requerimiento siga vivo,
 * incluso después de emitido y de aprobado. Lo que NO se puede es
 * fingir que las cotizaciones recibidas siguen valiendo:
 *
 *   · **editar** un ítem que alguien cotizó marca esas cotizaciones como
 *     `requiereRevision` — el proveedor puso precio a otra cosa.
 *   · **añadir** no toca nada: ese ítem simplemente no está cotizado
 *     todavía, que es el estado normal de algo recién pedido.
 *   · **eliminar** deja las líneas cotizadas HUÉRFANAS, no las borra: que
 *     un proveedor puso precio a eso es un hecho, y §53 no admite
 *     perderlo en silencio.
 *
 * Y si la cotización afectada era la que sostenía el estado —la
 * RECOMENDADA esperando decisión, o la APROBADA esperando costo—, el
 * requerimiento retrocede a COTIZACIONES_RECIBIDAS: el turno pasó al
 * Gestor, y el estado tiene que decirlo.
 */
@Injectable()
export class ItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly requerimientos: RequerimientoService,
  ) {}

  /**
   * Carga el requerimiento y comprueba que quien pide puede tocar sus
   * ítems: que es suyo y que todavía no está cerrado.
   */
  private async requerimientoAbierto(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
  ) {
    const req = await this.prisma.requerimiento.findUnique({
      where: { id: requerimientoId },
      select: { id: true, estado: true, solicitanteId: true, numero: true },
    });
    if (!req) throw new NotFoundException('Ese requerimiento ya no existe.');

    const rol =
      usuario.permisos.find((p) => p.modulo === 'COSTOS')?.rolCostos ?? null;
    if (rol === 'SOLICITANTE' && req.solicitanteId !== usuario.id)
      throw new ForbiddenException(
        'Ese requerimiento es de otra persona: solo puedes modificar los tuyos.',
      );

    if (!admiteCambios(req.estado))
      throw new BadRequestException(
        `No se pueden cambiar los ítems: el requerimiento está ${ETIQUETA_ESTADO[req.estado]}. ` +
          'Un requerimiento cerrado ya es registro.',
      );

    return req;
  }

  /**
   * §21: la cantidad es un número ENTERO y mayor que cero.
   *
   * Entero porque se piden 3 rollos, no 3,25 — el decimal es cosa de la
   * cotización, donde el proveedor puede vender por metro. Y mayor que
   * cero porque pedir «0 unidades» de algo no es pedirlo: si no hace
   * falta, se quita la línea.
   */
  private aCantidad(valor: unknown): number {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0)
      throw new BadRequestException(
        `La cantidad debe ser un número entero mayor que 0. Recibido: "${describir(valor)}".`,
      );
    return n;
  }

  /** Los campos de §21, validados. */
  private campos(dto: GuardarItemDto, parcial: boolean) {
    const exige = (clave: keyof GuardarItemDto) => !parcial || clave in dto;
    const data: {
      descripcion?: string;
      unidad?: string;
      cantidad?: number;
      codigoProducto?: string | null;
      detalleObservacion?: string | null;
      referencias?: string | null;
    } = {};

    if (exige('descripcion'))
      data.descripcion = aTexto(dto.descripcion, 'La descripción');

    // Texto y no FK al catálogo: el catálogo SUGIERE lo que ofrece el
    // selector, no restringe lo guardado. Mismo criterio que
    // `FichaPersonal` con sus siete campos.
    if (exige('unidad')) data.unidad = aTexto(dto.unidad, 'La unidad');

    if (exige('cantidad')) data.cantidad = this.aCantidad(dto.cantidad);

    if ('codigoProducto' in dto)
      data.codigoProducto = aTextoOpcional(dto.codigoProducto);
    if ('detalleObservacion' in dto)
      data.detalleObservacion = aTextoOpcional(dto.detalleObservacion);
    if ('referencias' in dto)
      data.referencias = aTextoOpcional(dto.referencias);

    return data;
  }

  /** Las cotizaciones vivas que pusieron precio a este ítem. */
  private async cotizacionesDelItem(itemId: number) {
    return this.prisma.cotizacionProveedor.findMany({
      where: {
        estado: { in: [...ESTADOS_QUE_SE_MARCAN] },
        items: { some: { requerimientoItemId: itemId } },
      },
      select: {
        id: true,
        estado: true,
        requiereRevision: true,
        proveedor: { select: { razonSocial: true } },
      },
    });
  }

  /**
   * Marca como pendientes de revisar las cotizaciones afectadas y, si
   * hacía falta, devuelve el requerimiento al Gestor.
   *
   * Devuelve si el estado se movió, para poder contárselo a quien editó:
   * un cambio de ítem que además deshace una aprobación no puede
   * responder «listo» y ya.
   */
  private async invalidarCotizaciones(
    usuario: UsuarioAutenticado,
    tx: Tx,
    req: { id: number; estado: EstadoRequerimiento },
    afectadas: {
      id: number;
      estado: string;
      proveedor: { razonSocial: string };
    }[],
    motivo: string,
  ): Promise<boolean> {
    if (afectadas.length === 0) return false;

    await tx.cotizacionProveedor.updateMany({
      where: { id: { in: afectadas.map((c) => c.id) } },
      data: { requiereRevision: true, revisionMotivo: motivo },
    });

    await this.auditoria.registrar(
      usuario,
      afectadas.map((c) => ({
        requerimientoId: req.id,
        entidad: 'COTIZACION' as const,
        entidadId: c.id,
        accion: 'CAMBIO_ESTADO' as const,
        campoAfectado: 'requiereRevision',
        valorAnterior: 'false',
        valorNuevo: 'true',
        motivo,
        descripcion:
          `La cotización de ${c.proveedor.razonSocial} quedó pendiente de revisar: ` +
          'hay que volver a pedirle precio.',
      })),
      tx,
    );

    // ¿Alguna de las invalidadas era la que sostenía el estado?
    const sostiene = afectadas.some(
      (c) =>
        (c.estado === 'RECOMENDADA' && req.estado === 'PENDIENTE_APROBACION') ||
        (c.estado === 'APROBADA' && req.estado === 'PENDIENTE_REGISTRO_COSTO'),
    );
    if (!sostiene) return false;

    await this.requerimientos.aplicarTransicion(
      usuario,
      tx,
      req,
      'REABRIR_POR_EDICION',
      motivo,
    );
    return true;
  }

  /**
   * Agrega un ítem al final (§22).
   *
   * §54 lo permite en cualquier momento mientras el requerimiento siga
   * vivo, incluso después de compartirlo con proveedores. No invalida
   * nada: el ítem nuevo simplemente todavía no está cotizado, que es el
   * estado normal de algo recién pedido, y la comparación ya lo muestra
   * como «nadie ofreció esto».
   *
   * El `orden` se calcula aquí y no lo manda el cliente: es la posición
   * en el documento, y dejar que la fije quien llama abre la puerta a dos
   * ítems en la misma fila.
   */
  async agregar(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    dto: GuardarItemDto,
  ) {
    const req = await this.requerimientoAbierto(usuario, requerimientoId);
    const data = this.campos(dto, false);

    const ultimo = await this.prisma.requerimientoItem.findFirst({
      where: { requerimientoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    const item = await this.prisma.requerimientoItem.create({
      data: {
        requerimientoId,
        orden: (ultimo?.orden ?? -1) + 1,
        descripcion: data.descripcion as string,
        unidad: data.unidad as string,
        cantidad: data.cantidad as number,
        codigoProducto: data.codigoProducto ?? null,
        detalleObservacion: data.detalleObservacion ?? null,
        referencias: data.referencias ?? null,
      },
    });

    // Que se añadió DESPUÉS de pedir cotizaciones es información: explica
    // por qué nadie lo cotizó cuando alguien lea la comparación.
    const tarde = req.estado !== 'BORRADOR' && req.estado !== 'OBSERVADO';

    await this.auditoria.registrarUno(usuario, {
      requerimientoId,
      entidad: 'REQUERIMIENTO_ITEM',
      entidadId: item.id,
      accion: 'CREACION',
      descripcion:
        `Se agregó "${item.descripcion}" (${item.cantidad} ${item.unidad})` +
        (tarde
          ? ` con el requerimiento ya ${ETIQUETA_ESTADO[req.estado]}: falta cotizarlo.`
          : '.'),
    });

    return item;
  }

  /**
   * Edita un ítem (§54).
   *
   * Se permite en cualquier momento mientras el requerimiento no esté
   * cerrado, pero si alguien ya le había puesto precio, esas cotizaciones
   * quedan marcadas: el proveedor cotizó otra cosa.
   *
   * Solo se marcan si cambió algo que ALTERA LO QUE SE PIDE —descripción,
   * unidad, cantidad o el código de producto—. Corregir una errata en las
   * referencias o añadir un detalle no invalida ningún precio, y marcarlo
   * por eso obligaría al Gestor a perseguir a tres proveedores por una
   * coma.
   *
   * ⚠️ El código entra en esa lista con un matiz: SUSTITUIR un código por
   * otro es pedir otro artículo y sí invalida, pero RELLENAR el que estaba
   * vacío no —es la misma pieza, ahora identificada—. Sin esa distinción,
   * completar los códigos de un requerimiento ya cotizado mandaría a pedir
   * precio otra vez por un dato que solo precisa lo que ya se pidió.
   */
  async editar(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    itemId: number,
    dto: GuardarItemDto,
  ) {
    const req = await this.requerimientoAbierto(usuario, requerimientoId);

    const actual = await this.prisma.requerimientoItem.findFirst({
      where: { id: itemId, requerimientoId },
    });
    if (!actual)
      throw new NotFoundException('Ese ítem no existe en este requerimiento.');

    const data = this.campos(dto, true);
    if (Object.keys(data).length === 0) return actual;

    // Rellenar un código que estaba vacío no cambia el artículo, solo lo
    // identifica; sustituir uno por otro sí. De ahí el `actual !== null`.
    const cambiaElCodigo =
      data.codigoProducto !== undefined &&
      actual.codigoProducto !== null &&
      data.codigoProducto !== actual.codigoProducto;

    const cambiaLoPedido =
      (data.descripcion !== undefined &&
        data.descripcion !== actual.descripcion) ||
      (data.unidad !== undefined && data.unidad !== actual.unidad) ||
      (data.cantidad !== undefined && data.cantidad !== actual.cantidad) ||
      cambiaElCodigo;

    const afectadas = cambiaLoPedido
      ? await this.cotizacionesDelItem(itemId)
      : [];

    const motivo =
      `Cambió el ítem "${actual.descripcion}" ` +
      `(${actual.cantidad} ${actual.unidad} → ` +
      `${data.cantidad ?? actual.cantidad} ${data.unidad ?? actual.unidad}).`;

    let reabierto = false;

    const item = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.requerimientoItem.update({
        where: { id: itemId },
        data,
      });

      await this.auditoria.registrar(
        usuario,
        this.auditoria.diferencias(
          {
            descripcion: actual.descripcion,
            unidad: actual.unidad,
            cantidad: String(actual.cantidad),
            codigoProducto: actual.codigoProducto,
            detalleObservacion: actual.detalleObservacion,
            referencias: actual.referencias,
          },
          {
            descripcion: actualizado.descripcion,
            unidad: actualizado.unidad,
            cantidad: String(actualizado.cantidad),
            codigoProducto: actualizado.codigoProducto,
            detalleObservacion: actualizado.detalleObservacion,
            referencias: actualizado.referencias,
          },
          {
            requerimientoId,
            entidad: 'REQUERIMIENTO_ITEM',
            entidadId: itemId,
          },
        ),
        tx,
      );

      reabierto = await this.invalidarCotizaciones(
        usuario,
        tx,
        req,
        afectadas,
        motivo,
      );

      return actualizado;
    });

    return {
      ...item,
      /**
       * Lo que el cambio arrastró. Va en la respuesta y no solo en la
       * bitácora porque quien edita tiene que enterarse en el momento:
       * «se guardó» a secas ocultaría que acaba de deshacer el camino
       * hasta una aprobación.
       */
      efectos: {
        cotizacionesPendientesDeRevision: afectadas.length,
        proveedoresAConsultar: afectadas.map((c) => c.proveedor.razonSocial),
        requerimientoReabierto: reabierto,
      },
    };
  }

  /**
   * Quita un ítem y cierra el hueco que deja en el orden (§54).
   *
   * Si nadie lo había cotizado, se va sin más. Si ya tenía precio, las
   * líneas de cotización quedan HUÉRFANAS —la FK es `SetNull`— pero NO se
   * borran: que un proveedor puso precio a eso es un hecho, y §53 no
   * admite perderlo. Esas líneas siguen sumando al total de su cotización
   * y aparecen en la comparación como líneas sin ítem, junto al flete y
   * lo demás que nadie pidió.
   *
   * Retirar un ítem NO marca las cotizaciones como pendientes de revisar:
   * el precio que dieron por lo que queda sigue siendo válido. Lo que sí
   * hace es dejar constancia de que se retiró algo ya cotizado.
   *
   * Renumerar en vez de dejar un salto: el `orden` es la posición en el
   * documento impreso, y una tabla que va 1, 2, 4 hace dudar de si se
   * perdió una línea.
   */
  async eliminar(
    usuario: UsuarioAutenticado,
    requerimientoId: number,
    itemId: number,
  ) {
    await this.requerimientoAbierto(usuario, requerimientoId);

    const item = await this.prisma.requerimientoItem.findFirst({
      where: { id: itemId, requerimientoId },
      select: {
        id: true,
        descripcion: true,
        unidad: true,
        cantidad: true,
        orden: true,
      },
    });
    if (!item)
      throw new NotFoundException('Ese ítem no existe en este requerimiento.');

    const cotizado = await this.cotizacionesDelItem(itemId);

    await this.prisma.$transaction(async (tx) => {
      await tx.requerimientoItem.delete({ where: { id: itemId } });
      await tx.requerimientoItem.updateMany({
        where: { requerimientoId, orden: { gt: item.orden } },
        data: { orden: { decrement: 1 } },
      });

      await this.auditoria.registrarUno(
        usuario,
        {
          requerimientoId,
          entidad: 'REQUERIMIENTO_ITEM',
          entidadId: itemId,
          accion: 'ELIMINACION',
          descripcion:
            cotizado.length === 0
              ? `Se quitó "${item.descripcion}".`
              : `Se quitó "${item.descripcion}" (${item.cantidad} ${item.unidad}) ` +
                `DESPUÉS de haber sido cotizado por ${cotizado.length} proveedor(es): ` +
                `${cotizado.map((c) => c.proveedor.razonSocial).join(', ')}. ` +
                'Sus líneas quedan en las cotizaciones, ya sin ítem.',
        },
        tx,
      );
    });

    return {
      ok: true,
      id: itemId,
      lineasHuerfanas: cotizado.length,
      proveedoresQueLoCotizaron: cotizado.map((c) => c.proveedor.razonSocial),
    };
  }
}
