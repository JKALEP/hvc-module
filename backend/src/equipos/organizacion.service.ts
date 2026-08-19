import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { limpiar, describir } from '../common/texto';

export interface CrearOrganizacionDto {
  nombre?: string | null;
}

export interface EditarOrganizacionDto {
  nombre?: string | null;
  /** Visibilidad, no borrado: ver la nota del modelo. */
  activo?: boolean | null;
}

/**
 * Las organizaciones cuyo inventario administra HVC.
 *
 * `activo` NO es soft-delete: una organización inactiva deja de
 * ofrecerse al registrar equipos, pero sus equipos, su árbol y su
 * historial siguen existiendo y consultándose. En este módulo borrar es
 * borrar, y solo se puede si no queda nada colgando.
 */
@Injectable()
export class OrganizacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas, con cuánto tiene cada una. Las inactivas van al final. */
  async listar(incluirInactivas = true) {
    const filas = await this.prisma.organizacion.findMany({
      where: incluirInactivas ? {} : { activo: true },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        activo: true,
        actualizadoEn: true,
        _count: {
          select: { nodos: true, equipos: true, definicionesCampo: true },
        },
      },
    });

    return filas.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      activo: o.activo,
      actualizadoEn: o.actualizadoEn,
      nodos: o._count.nodos,
      equipos: o._count.equipos,
      campos: o._count.definicionesCampo,
    }));
  }

  async detalle(id: number) {
    const organizacion = await this.prisma.organizacion.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        activo: true,
        creadoEn: true,
        actualizadoEn: true,
        _count: {
          select: { nodos: true, equipos: true, definicionesCampo: true },
        },
      },
    });
    if (!organizacion)
      throw new NotFoundException('Esa organización ya no existe.');
    return organizacion;
  }

  async crear(dto: CrearOrganizacionDto) {
    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException(
        'El nombre de la organización es obligatorio.',
      );

    const repetida = await this.prisma.organizacion.findFirst({
      where: { nombre },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(
        `Ya existe una organización llamada "${nombre}".`,
      );

    return this.prisma.organizacion.create({ data: { nombre } });
  }

  async editar(id: number, dto: EditarOrganizacionDto) {
    const actual = await this.prisma.organizacion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!actual) throw new NotFoundException('Esa organización ya no existe.');

    const data: { nombre?: string; activo?: boolean } = {};

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException(
          'El nombre de la organización es obligatorio.',
        );
      const repetida = await this.prisma.organizacion.findFirst({
        where: { nombre, NOT: { id } },
        select: { id: true },
      });
      if (repetida)
        throw new ConflictException(
          `Ya existe una organización llamada "${nombre}".`,
        );
      data.nombre = nombre;
    }

    if ('activo' in dto && dto.activo !== null && dto.activo !== undefined) {
      if (typeof dto.activo !== 'boolean')
        throw new BadRequestException(
          `Valor inválido para "activo": "${describir(dto.activo)}".`,
        );
      data.activo = dto.activo;
    }

    return this.prisma.organizacion.update({ where: { id }, data });
  }

  /**
   * Borra la organización. Solo si está vacía.
   *
   * Las FK son Restrict a propósito: llevarse en cascada el inventario
   * entero de un cliente por un clic no es una operación que deba
   * existir. Para dejar de usarla, se desactiva.
   */
  async eliminar(id: number) {
    const organizacion = await this.prisma.organizacion.findUnique({
      where: { id },
      select: {
        nombre: true,
        _count: {
          select: { nodos: true, equipos: true, definicionesCampo: true },
        },
      },
    });
    if (!organizacion)
      throw new NotFoundException('Esa organización ya no existe.');

    const { nodos, equipos, definicionesCampo } = organizacion._count;
    if (equipos > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${organizacion.nombre}" tiene ${equipos} equipo(s). Desactívala en su lugar.`,
      );
    if (nodos > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${organizacion.nombre}" tiene ${nodos} ubicación(es) en su estructura. Bórralas primero.`,
      );
    if (definicionesCampo > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${organizacion.nombre}" tiene ${definicionesCampo} campo(s) configurados. Bórralos primero.`,
      );

    await this.prisma.organizacion.delete({ where: { id } });
    return { ok: true, id, nombre: organizacion.nombre };
  }

  /** Existe y está activa. Lo usan estructura, campos y equipos. */
  async exigir(id: number) {
    const organizacion = await this.prisma.organizacion.findUnique({
      where: { id },
      select: { id: true, nombre: true, activo: true },
    });
    if (!organizacion)
      throw new NotFoundException('Esa organización ya no existe.');
    return organizacion;
  }
}
