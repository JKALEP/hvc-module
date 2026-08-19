import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { limpiar } from '../../common/texto';
import { aId } from '../../common/validacion';
import type { CrearGrupoDto, EditarGrupoDto } from './dto';

/**
 * Un grupo es un Área (si el periodo es de supervisores) o una Empresa
 * Contratista (si es de contratistas). Una sola tabla para los dos: el
 * comportamiento es idéntico y lo que cambia es la etiqueta, que se
 * deriva del tipo del periodo.
 */
@Injectable()
export class GrupoService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearGrupoDto) {
    const periodoId = aId(dto.periodoId, 'El periodo indicado no es válido.');
    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre del grupo es obligatorio.');

    const periodo = await this.prisma.periodoPersonal.findUnique({
      where: { id: periodoId },
      select: { id: true },
    });
    if (!periodo) throw new NotFoundException('Ese periodo ya no existe.');

    const repetido = await this.prisma.grupoPersonal.findFirst({
      where: { periodoId, nombre },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(
        `Ya hay un grupo llamado "${nombre}" en este periodo.`,
      );

    // Al final de la lista: el orden refleja el del Excel.
    const ultimo = await this.prisma.grupoPersonal.findFirst({
      where: { periodoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.grupoPersonal.create({
      data: { periodoId, nombre, orden: (ultimo?.orden ?? -1) + 1 },
    });
  }

  async editar(id: number, dto: EditarGrupoDto) {
    const grupo = await this.prisma.grupoPersonal.findUnique({
      where: { id },
      select: { id: true, periodoId: true },
    });
    if (!grupo) throw new NotFoundException('Ese grupo ya no existe.');

    const data: { nombre?: string; orden?: number } = {};

    if ('nombre' in dto) {
      const nombre = limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException('El nombre del grupo es obligatorio.');
      const repetido = await this.prisma.grupoPersonal.findFirst({
        where: { periodoId: grupo.periodoId, nombre, NOT: { id } },
        select: { id: true },
      });
      if (repetido)
        throw new ConflictException(
          `Ya hay un grupo llamado "${nombre}" en este periodo.`,
        );
      data.nombre = nombre;
    }

    if ('orden' in dto && dto.orden !== null && dto.orden !== undefined) {
      const n = Number(dto.orden);
      if (!Number.isInteger(n) || n < 0)
        throw new BadRequestException('El orden debe ser un entero positivo.');
      data.orden = n;
    }

    return this.prisma.grupoPersonal.update({ where: { id }, data });
  }

  /**
   * Borra el grupo y, con él, su gente.
   *
   * El aviso lo da la UI antes de llamar: aquí se devuelve cuántas
   * fichas cayeron para que el mensaje de confirmación pueda decir el
   * número exacto y para dejar constancia de lo que se llevó por delante.
   */
  async eliminar(id: number) {
    const grupo = await this.prisma.grupoPersonal.findUnique({
      where: { id },
      select: { nombre: true, _count: { select: { fichas: true } } },
    });
    if (!grupo) throw new NotFoundException('Ese grupo ya no existe.');

    await this.prisma.grupoPersonal.delete({ where: { id } });
    return {
      ok: true,
      id,
      nombre: grupo.nombre,
      personasEliminadas: grupo._count.fichas,
    };
  }
}
