import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ESTADOS = ['ACTIVA', 'INACTIVA'] as const;

export interface CrearSedeDto {
  nombre?: string | null;
  parentId?: number | string | null;
}

export interface EditarSedeDto {
  nombre?: string | null;
  parentId?: number | string | null;
  estado?: string | null;
}

@Injectable()
export class SedeService {
  constructor(private readonly prisma: PrismaService) {}

  private limpiar(valor: unknown): string | null {
    if (typeof valor !== 'string') return null;
    const s = valor.trim();
    return s === '' ? null : s;
  }

  /** Representación segura de un valor para incluirlo en un mensaje de error. */
  private describir(valor: unknown): string {
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    return JSON.stringify(valor) ?? 'null';
  }

  private aIdOpcional(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0)
      throw new BadRequestException('La carpeta que indicaste no es válida.');
    return n;
  }

  private estadoValido(valor: unknown): (typeof ESTADOS)[number] {
    const s = this.limpiar(valor)?.toUpperCase();
    // Sin `!s` un valor que no sea texto caería en el default y dejaría la
    // sede en ACTIVA sin avisar: un estado ilegible es un error, no un
    // "déjalo como estaba".
    if (!s || !ESTADOS.includes(s as (typeof ESTADOS)[number]))
      throw new BadRequestException(
        `Estado inválido: "${this.describir(valor)}". Valores permitidos: ${ESTADOS.join(', ')}.`,
      );
    return s as (typeof ESTADOS)[number];
  }

  /** Ruta materializada del nodo: la de su madre más su propio id. */
  private async calcularRuta(id: number, parentId: number | null) {
    if (parentId === null) return String(id);
    const padre = await this.prisma.sede.findUnique({
      where: { id: parentId },
      select: { ruta: true },
    });
    if (!padre)
      throw new NotFoundException(
        'La carpeta donde quieres crearla ya no existe.',
      );
    return `${padre.ruta}/${id}`;
  }

  async crear(dto: CrearSedeDto) {
    const nombre = this.limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException('El nombre de la carpeta es obligatorio.');
    const parentId = this.aIdOpcional(dto.parentId);

    if (parentId !== null) {
      const padre = await this.prisma.sede.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!padre)
        throw new NotFoundException(
          'La carpeta donde quieres crearla ya no existe.',
        );
    }

    const repetida = await this.prisma.sede.findFirst({
      where: { parentId, nombre },
      select: { id: true },
    });
    if (repetida)
      throw new ConflictException(
        `Ya existe una carpeta llamada "${nombre}" en este mismo sitio.`,
      );

    // La ruta necesita el id, que no existe hasta insertar: se crea con
    // ruta provisional y se corrige en la misma transacción.
    return this.prisma.$transaction(async (tx) => {
      const sede = await tx.sede.create({
        data: { nombre, parentId, ruta: '' },
      });
      const ruta = await this.calcularRuta(sede.id, parentId);
      return tx.sede.update({ where: { id: sede.id }, data: { ruta } });
    });
  }

  async editar(id: number, dto: EditarSedeDto) {
    const actual = await this.prisma.sede.findUnique({
      where: { id },
      select: { id: true, ruta: true, parentId: true },
    });
    if (!actual) throw new NotFoundException('Esa carpeta ya no existe.');

    const data: Record<string, unknown> = {};
    if ('nombre' in dto) {
      const nombre = this.limpiar(dto.nombre);
      if (!nombre)
        throw new BadRequestException(
          'El nombre de la carpeta es obligatorio.',
        );
      data.nombre = nombre;
    }
    // Omitir el campo deja el estado como está; mandarlo obliga a que sea válido.
    if ('estado' in dto && dto.estado !== null && dto.estado !== undefined)
      data.estado = this.estadoValido(dto.estado);

    // ¿Se mueve de sitio?
    const mueve = 'parentId' in dto;
    const nuevoPadre = mueve ? this.aIdOpcional(dto.parentId) : actual.parentId;

    if (mueve && nuevoPadre !== actual.parentId) {
      if (nuevoPadre === id)
        throw new BadRequestException(
          'Una carpeta no puede estar dentro de sí misma.',
        );

      if (nuevoPadre !== null) {
        const padre = await this.prisma.sede.findUnique({
          where: { id: nuevoPadre },
          select: { ruta: true },
        });
        if (!padre)
          throw new NotFoundException('La carpeta de destino ya no existe.');
        // Mover una sede dentro de su propia descendencia desconectaría
        // esa rama del árbol. La ruta materializada lo detecta de un vistazo.
        if (
          padre.ruta.startsWith(`${actual.ruta}/`) ||
          padre.ruta === actual.ruta
        )
          throw new BadRequestException(
            'No se puede mover una carpeta dentro de otra que está por debajo de ella.',
          );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (mueve && nuevoPadre !== actual.parentId) {
        const rutaNueva = await this.calcularRuta(id, nuevoPadre);
        // Toda la descendencia hereda el cambio de prefijo.
        const descendientes = await tx.sede.findMany({
          where: { ruta: { startsWith: `${actual.ruta}/` } },
          select: { id: true, ruta: true },
        });
        for (const d of descendientes) {
          await tx.sede.update({
            where: { id: d.id },
            data: { ruta: rutaNueva + d.ruta.slice(actual.ruta.length) },
          });
        }
        data.parentId = nuevoPadre;
        data.ruta = rutaNueva;
      }

      return tx.sede.update({ where: { id }, data: data as never });
    });
  }

  /**
   * Borra una sede. Las FK son Restrict a propósito: una sede con
   * subsedes o álbumes no se puede borrar sin decidir antes qué pasa con
   * ellos, y borrar en cascada se llevaría fotos por delante.
   */
  async eliminar(id: number) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
      select: { _count: { select: { hijas: true, albumes: true } } },
    });
    if (!sede) throw new NotFoundException('Esa carpeta ya no existe.');

    if (sede._count.hijas > 0)
      throw new BadRequestException(
        `No se puede eliminar: esta carpeta tiene ${sede._count.hijas} carpeta(s) dentro. Muévelas o elimínalas primero.`,
      );
    if (sede._count.albumes > 0)
      throw new BadRequestException(
        `No se puede eliminar: esta carpeta tiene ${sede._count.albumes} álbum(es) dentro. Desactívala en su lugar.`,
      );

    await this.prisma.sede.delete({ where: { id } });
    return { ok: true, id };
  }
}
