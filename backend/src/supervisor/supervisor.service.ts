import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ESTADOS_SUPERVISOR = ['ACTIVO', 'INACTIVO'] as const;
type EstadoSupervisor = (typeof ESTADOS_SUPERVISOR)[number];

export interface CrearSupervisorDto {
  nombre?: string | null;
  estado?: string | null;
}

export type EditarSupervisorDto = CrearSupervisorDto;

@Injectable()
export class SupervisorService {
  constructor(private readonly prisma: PrismaService) {}

  private limpiar(valor: unknown): string | null {
    if (typeof valor === 'string') {
      const s = valor.trim();
      return s === '' ? null : s;
    }
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    // null, undefined, objetos y arrays: no son texto válido.
    return null;
  }

  private estadoValido(valor: unknown): EstadoSupervisor {
    const s = this.limpiar(valor);
    if (!s) return 'ACTIVO';
    const norm = s.toUpperCase();
    if (!ESTADOS_SUPERVISOR.includes(norm as EstadoSupervisor))
      throw new BadRequestException(
        `Estado inválido: "${s}". Valores permitidos: ${ESTADOS_SUPERVISOR.join(', ')}.`,
      );
    return norm as EstadoSupervisor;
  }

  /** Lista supervisores. Por defecto solo ACTIVO (para poblar el select del formulario). */
  async listar(estado?: string, q?: string) {
    const termino = (q ?? '').trim();
    const filtroEstado = this.limpiar(estado);

    return this.prisma.supervisor.findMany({
      where: {
        ...(filtroEstado === 'TODOS'
          ? {}
          : { estado: this.estadoValido(filtroEstado) }),
        ...(termino
          ? { nombre: { contains: termino, mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { reportes: true } } },
    });
  }

  async crear(dto: CrearSupervisorDto) {
    const nombre = this.limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del supervisor es obligatorio.');

    return this.prisma.supervisor.create({
      data: { nombre, estado: this.estadoValido(dto.estado) },
    });
  }

  async editar(id: number, dto: EditarSupervisorDto) {
    const existe = await this.prisma.supervisor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException(`Supervisor ${id} no encontrado.`);

    const data: Record<string, unknown> = {};
    if ('nombre' in dto) {
      const nombre = this.limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException(
          'El nombre del supervisor es obligatorio.',
        );
      data.nombre = nombre;
    }
    if ('estado' in dto) data.estado = this.estadoValido(dto.estado);

    return this.prisma.supervisor.update({
      where: { id },
      data: data as never,
    });
  }

  async eliminar(id: number) {
    const supervisor = await this.prisma.supervisor.findUnique({
      where: { id },
      select: { _count: { select: { reportes: true } } },
    });
    if (!supervisor)
      throw new NotFoundException(`Supervisor ${id} no encontrado.`);

    // FK Restrict: no se borra un supervisor con reportes firmados.
    if (supervisor._count.reportes > 0)
      throw new BadRequestException(
        `No se puede eliminar el supervisor ${id}: tiene ${supervisor._count.reportes} reporte(s) diario(s). ` +
          'Cámbialo a estado INACTIVO en su lugar.',
      );

    await this.prisma.supervisor.delete({ where: { id } });
    return { ok: true, id };
  }
}
