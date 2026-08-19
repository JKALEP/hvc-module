import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoCotizacion,
  TipoEventoHistorial,
} from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aId, aIdOpcional } from '../common/validacion';
import { LineasService } from '../common/lineas.service';
import { siguienteCodigo } from '../common/correlativo';
import { HistorialService } from './historial.service';

export interface GuardarCotizacionDto {
  organizacionId?: number | string | null;
  equipoId?: number | string | null;
  incidenciaId?: number | string | null;
  proveedor?: string | null;
  lineas?: unknown;
}

export type EditarCotizacionDto = Partial<GuardarCotizacionDto> & {
  estado?: string | null;
};

/**
 * Cotizaciones: datos editables, nunca un archivo.
 *
 * El documento se arma en pantalla desde estas filas y sus líneas; los
 * botones de exportar generan el Excel o el PDF en el momento, sin
 * guardar nada. Por eso no hay columna de adjunto ni de monto.
 */
@Injectable()
export class CotizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineas: LineasService,
    private readonly historial: HistorialService,
  ) {}

  private aEstado(valor: unknown): EstadoCotizacion {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(EstadoCotizacion) as string[];
    if (s && validos.includes(s)) return s as EstadoCotizacion;
    throw new BadRequestException(
      `Estado inválido: "${describir(valor)}". Valores permitidos: ${validos.join(', ')}.`,
    );
  }

  private get incluir() {
    return {
      lineas: { orderBy: { orden: 'asc' as const } },
      organizacion: { select: { id: true, nombre: true } },
      equipo: { select: { id: true, codigoInterno: true } },
      incidencia: { select: { id: true, codigo: true, tipo: true } },
      creadoPor: { select: { id: true, nombre: true } },
      _count: { select: { ordenesCompra: true } },
    };
  }

  /** Añade a la fila lo que se calcula: líneas con subtotal y total. */
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
    const filas = await this.prisma.cotizacion.findMany({
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
    const fila = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: this.incluir,
    });
    if (!fila) throw new NotFoundException('Esa cotización ya no existe.');
    return this.conTotales(fila);
  }

  async crear(usuario: UsuarioAutenticado, dto: GuardarCotizacionDto) {
    const organizacionId = aId(
      dto.organizacionId,
      'La organización indicada no es válida.',
    );
    const proveedor = limpiar(dto.proveedor);
    if (!proveedor)
      throw new BadRequestException('El proveedor es obligatorio.');

    const equipoId = aIdOpcional(dto.equipoId, 'El equipo no es válido.');
    const incidenciaId = aIdOpcional(
      dto.incidenciaId,
      'La incidencia no es válida.',
    );
    const lineas = this.lineas.normalizarLineas(dto.lineas);

    const ultima = await this.prisma.cotizacion.findFirst({
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    const codigo = siguienteCodigo('COT', ultima?.codigo ?? null);

    return this.prisma.$transaction(async (tx) => {
      const cotizacion = await tx.cotizacion.create({
        data: {
          codigo,
          organizacionId,
          equipoId,
          incidenciaId,
          proveedor,
          creadoPorId: usuario.id,
          lineas: { create: lineas },
        },
        select: { id: true },
      });

      // Queda constancia donde importa: en el equipo y en la incidencia
      // de los que cuelga, para que su bitácora cuente la historia
      // completa sin abrir la lista de cotizaciones.
      await this.historial.registrar(
        tx,
        [
          equipoId !== null
            ? {
                equipoId,
                tipo: TipoEventoHistorial.RELACION_COTIZACION,
                usuarioId: usuario.id,
                descripcion: `Se registró la cotización ${codigo} (${proveedor}).`,
              }
            : null,
          incidenciaId !== null
            ? {
                incidenciaId,
                tipo: TipoEventoHistorial.RELACION_COTIZACION,
                usuarioId: usuario.id,
                descripcion: `Se registró la cotización ${codigo} (${proveedor}).`,
              }
            : null,
        ].filter((e) => e !== null),
      );

      return cotizacion;
    });
  }

  /**
   * Reescribe la cotización.
   *
   * Las líneas se reemplazan enteras cuando llegan: la lista que manda
   * el formulario ES la del documento, así que borrar un renglón en
   * pantalla tiene que borrarlo de verdad y no dejarlo huérfano.
   */
  async editar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: EditarCotizacionDto,
  ) {
    const actual = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        estado: true,
        proveedor: true,
        equipoId: true,
        incidenciaId: true,
      },
    });
    if (!actual) throw new NotFoundException('Esa cotización ya no existe.');

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
            descripcion: `La cotización ${actual.codigo} pasó a ${estado.toLowerCase()}.`,
          });
      }
    }

    const lineas =
      dto.lineas === undefined
        ? null
        : this.lineas.normalizarLineas(dto.lineas);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0)
        await tx.cotizacion.update({ where: { id }, data: data as never });
      if (lineas !== null) {
        await tx.lineaCotizacion.deleteMany({ where: { cotizacionId: id } });
        if (lineas.length > 0)
          await tx.lineaCotizacion.createMany({
            data: lineas.map((l) => ({ ...l, cotizacionId: id })),
          });
      }
      await this.historial.registrar(tx, eventos);
    });

    return this.detalle(id);
  }

  async eliminar(id: number) {
    const cotizacion = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: { codigo: true, _count: { select: { ordenesCompra: true } } },
    });
    if (!cotizacion)
      throw new NotFoundException('Esa cotización ya no existe.');

    if (cotizacion._count.ordenesCompra > 0)
      throw new BadRequestException(
        `No se puede eliminar ${cotizacion.codigo}: tiene ${cotizacion._count.ordenesCompra} orden(es) de compra que vienen de ella.`,
      );

    await this.prisma.cotizacion.delete({ where: { id } });
    return { ok: true, id, codigo: cotizacion.codigo };
  }
}
