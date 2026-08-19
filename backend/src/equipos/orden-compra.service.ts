import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoOrdenCompra,
  TipoEventoHistorial,
} from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aId, aIdOpcional } from '../common/validacion';
import { LineasService } from '../common/lineas.service';
import { siguienteCodigo } from '../common/correlativo';
import { HistorialService } from './historial.service';

export interface GuardarOrdenDto {
  organizacionId?: number | string | null;
  cotizacionId?: number | string | null;
  equipoId?: number | string | null;
  incidenciaId?: number | string | null;
  proveedor?: string | null;
  lineas?: unknown;
}

export type EditarOrdenDto = Partial<GuardarOrdenDto> & {
  estado?: string | null;
};

/**
 * Órdenes de compra. Mismo criterio que las cotizaciones: datos
 * editables, sin adjunto y sin columna de monto.
 *
 * Service propio y no una variante del de cotizaciones porque tienen
 * estados distintos y una relación más —la cotización de la que
 * vienen—; lo que sí comparten (líneas, subtotales, total, correlativo)
 * vive en `LineasService`, en `common/`.
 */
@Injectable()
export class OrdenCompraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineas: LineasService,
    private readonly historial: HistorialService,
  ) {}

  private aEstado(valor: unknown): EstadoOrdenCompra {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(EstadoOrdenCompra) as string[];
    if (s && validos.includes(s)) return s as EstadoOrdenCompra;
    throw new BadRequestException(
      `Estado inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  private get incluir() {
    return {
      lineas: { orderBy: { orden: 'asc' as const } },
      organizacion: { select: { id: true, nombre: true } },
      cotizacion: { select: { id: true, codigo: true } },
      equipo: { select: { id: true, codigoInterno: true } },
      incidencia: { select: { id: true, codigo: true, tipo: true } },
      creadoPor: { select: { id: true, nombre: true } },
    };
  }

  private conTotales<
    T extends {
      lineas: {
        id: number;
        orden: number;
        descripcion: string;
        cantidad: { toString(): string };
        precioUnitario: { toString(): string };
      }[];
    },
  >(fila: T) {
    const lineas = this.lineas.calcularLineas(fila.lineas);
    return { ...fila, lineas, total: this.lineas.total(lineas) };
  }

  async listar(
    organizacionId: number,
    filtros: { estado?: string; q?: string },
  ) {
    const q = limpiar(filtros.q);
    const filas = await this.prisma.ordenCompra.findMany({
      where: {
        organizacionId,
        ...(filtros.estado ? { estado: this.aEstado(filtros.estado) } : {}),
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { proveedor: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ creadoEn: 'desc' }],
      include: this.incluir,
      take: 300,
    });
    return filas.map((f) => this.conTotales(f));
  }

  async detalle(id: number) {
    const fila = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: this.incluir,
    });
    if (!fila) throw new NotFoundException('Esa orden de compra ya no existe.');
    return this.conTotales(fila);
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarOrdenDto) {
    const organizacionId = aId(
      dto.organizacionId,
      'La organización indicada no es válida.',
    );
    const proveedor = limpiar(dto.proveedor);
    if (!proveedor)
      throw new BadRequestException('El proveedor es obligatorio.');

    const cotizacionId = aIdOpcional(
      dto.cotizacionId,
      'La cotización no es válida.',
    );
    const equipoId = aIdOpcional(dto.equipoId, 'El equipo no es válido.');
    const incidenciaId = aIdOpcional(
      dto.incidenciaId,
      'La incidencia no es válida.',
    );
    const lineas = this.lineas.normalizarLineas(dto.lineas);

    const ultima = await this.prisma.ordenCompra.findFirst({
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const codigo = siguienteCodigo('OC', ultima?.codigo ?? null);

    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.create({
        data: {
          codigo,
          organizacionId,
          cotizacionId,
          equipoId,
          incidenciaId,
          proveedor,
          creadoPorId: usuario.id,
          lineas: { create: lineas },
        },
        select: { id: true },
      });

      await this.historial.registrar(
        tx,
        [
          equipoId !== null
            ? {
                equipoId,
                tipo: TipoEventoHistorial.RELACION_ORDEN_COMPRA,
                usuarioId: usuario.id,
                descripcion: `Se emitió la orden de compra ${codigo} (${proveedor}).`,
              }
            : null,
          incidenciaId !== null
            ? {
                incidenciaId,
                tipo: TipoEventoHistorial.RELACION_ORDEN_COMPRA,
                usuarioId: usuario.id,
                descripcion: `Se emitió la orden de compra ${codigo} (${proveedor}).`,
              }
            : null,
        ].filter((e) => e !== null),
      );

      return orden;
    });
  }

  /**
   * Copia una cotización a una orden de compra.
   *
   * Se copian las líneas TAL CUAL están: la orden es un documento nuevo
   * y editable, no una vista de la cotización. Si después se corrige la
   * cotización, la orden ya emitida no cambia — que es justo lo que se
   * espera de algo que ya se mandó al proveedor.
   */
  async desdeCotizacion(usuario: UsuarioAutenticado, cotizacionId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      include: { lineas: { orderBy: { orden: 'asc' } } },
    });
    if (!cot) throw new NotFoundException('Esa cotización ya no existe.');

    return this.crear(usuario, {
      organizacionId: cot.organizacionId,
      cotizacionId: cot.id,
      equipoId: cot.equipoId,
      incidenciaId: cot.incidenciaId,
      proveedor: cot.proveedor,
      lineas: cot.lineas.map((l) => ({
        descripcion: l.descripcion,
        cantidad: l.cantidad.toString(),
        precioUnitario: l.precioUnitario.toString(),
      })),
    });
  }

  async editar(usuario: UsuarioAutenticado, id: number, dto: EditarOrdenDto) {
    const actual = await this.prisma.ordenCompra.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        estado: true,
        equipoId: true,
        incidenciaId: true,
      },
    });
    if (!actual)
      throw new NotFoundException('Esa orden de compra ya no existe.');

    const data: Record<string, unknown> = {};
    const eventos: Parameters<HistorialService['registrar']>[1] = [];

    if ('proveedor' in dto) {
      const proveedor = limpiar(dto.proveedor);
      if (!proveedor)
        throw new BadRequestException('El proveedor es obligatorio.');
      data.proveedor = proveedor;
    }
    if ('equipoId' in dto)
      data.equipoId = aIdOpcional(dto.equipoId, 'El equipo no es válido.');
    if ('incidenciaId' in dto)
      data.incidenciaId = aIdOpcional(
        dto.incidenciaId,
        'La incidencia no es válida.',
      );

    if ('estado' in dto && dto.estado !== null && dto.estado !== undefined) {
      const estado = this.aEstado(dto.estado);
      if (estado !== actual.estado) {
        data.estado = estado;
        const donde =
          actual.incidenciaId !== null
            ? { incidenciaId: actual.incidenciaId }
            : actual.equipoId !== null
              ? { equipoId: actual.equipoId }
              : null;
        if (donde)
          eventos.push({
            ...donde,
            tipo: TipoEventoHistorial.CAMBIO_ESTADO,
            usuarioId: usuario.id,
            descripcion: `La orden ${actual.codigo} pasó a ${estado.replace('_', ' ').toLowerCase()}.`,
          });
      }
    }

    const lineas =
      dto.lineas === undefined
        ? null
        : this.lineas.normalizarLineas(dto.lineas);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0)
        await tx.ordenCompra.update({ where: { id }, data: data as never });
      if (lineas !== null) {
        await tx.lineaOrdenCompra.deleteMany({ where: { ordenCompraId: id } });
        if (lineas.length > 0)
          await tx.lineaOrdenCompra.createMany({
            data: lineas.map((l) => ({ ...l, ordenCompraId: id })),
          });
      }
      await this.historial.registrar(tx, eventos);
    });

    return this.detalle(id);
  }

  async eliminar(id: number) {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { id },
      select: { codigo: true },
    });
    if (!orden)
      throw new NotFoundException('Esa orden de compra ya no existe.');
    await this.prisma.ordenCompra.delete({ where: { id } });
    return { ok: true, id, codigo: orden.codigo };
  }
}
