import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { aIdOpcional } from '../../common/validacion';
import {
  rutaDe,
  esDescendiente,
  estaEnRama,
  reprefijar,
} from '../../common/arbol-ruta';
import { aTexto } from './validacion';
import type { CrearCarpetaDto, EditarCarpetaDto } from './dto';

/**
 * El árbol de carpetas que organiza los proyectos.
 *
 * Mismo patrón que `SedeService` en Fotos: auto-relación más ruta
 * materializada. Aquí no hay archivado ni acceso compartido, así que se
 * queda en lo esencial — crear, renombrar, mover y borrar.
 *
 * Vive aparte del service de proyectos a propósito: la jerarquía es un
 * problema completo por sí mismo (ciclos, reprefijado de descendientes)
 * y mezclarlo con el CRUD de la obra es lo que convierte un service en
 * un mega-service.
 */
@Injectable()
export class CarpetaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ruta materializada del nodo: la de su madre más su propio id. */
  private async calcularRuta(id: number, parentId: number | null) {
    if (parentId === null) return rutaDe(id, null);
    const padre = await this.prisma.carpeta.findUnique({
      where: { id: parentId },
      select: { ruta: true },
    });
    if (!padre)
      throw new NotFoundException(
        'La carpeta donde quieres crearla ya no existe.',
      );
    return rutaDe(id, padre.ruta);
  }

  /** El árbol entero, plano y ordenado. Lo usa el selector de carpeta. */
  async listar() {
    return this.prisma.carpeta.findMany({
      orderBy: [{ ruta: 'asc' }],
      select: {
        id: true,
        nombre: true,
        parentId: true,
        ruta: true,
        _count: { select: { hijas: true, proyectos: true } },
      },
    });
  }

  async crear(dto: CrearCarpetaDto) {
    const nombre = aTexto(dto.nombre, 'nombre');
    const parentId = aIdOpcional(
      dto.parentId,
      'La carpeta que indicaste no es válida.',
    );

    const repetida = await this.prisma.carpeta.findFirst({
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
      const creada = await tx.carpeta.create({
        data: { nombre, parentId, ruta: '' },
      });
      const ruta = await this.calcularRuta(creada.id, parentId);
      return tx.carpeta.update({ where: { id: creada.id }, data: { ruta } });
    });
  }

  /** Renombrar y/o mover. */
  async editar(id: number, dto: EditarCarpetaDto) {
    const actual = await this.prisma.carpeta.findUnique({
      where: { id },
      select: { id: true, ruta: true, parentId: true, nombre: true },
    });
    if (!actual) throw new NotFoundException('Esa carpeta ya no existe.');

    const data: { nombre?: string; parentId?: number | null; ruta?: string } =
      {};
    const nombre =
      'nombre' in dto ? aTexto(dto.nombre, 'nombre') : actual.nombre;
    if ('nombre' in dto) data.nombre = nombre;

    const mueve = 'parentId' in dto;
    const nuevoPadre = mueve
      ? aIdOpcional(dto.parentId, 'La carpeta que indicaste no es válida.')
      : actual.parentId;

    if (nombre !== actual.nombre || nuevoPadre !== actual.parentId) {
      const repetida = await this.prisma.carpeta.findFirst({
        where: { parentId: nuevoPadre, nombre, NOT: { id } },
        select: { id: true },
      });
      if (repetida)
        throw new ConflictException(
          `Ya existe una carpeta llamada "${nombre}" en ese sitio.`,
        );
    }

    if (mueve && nuevoPadre !== actual.parentId) {
      if (nuevoPadre === id)
        throw new BadRequestException(
          'Una carpeta no puede estar dentro de sí misma.',
        );
      if (nuevoPadre !== null) {
        const padre = await this.prisma.carpeta.findUnique({
          where: { id: nuevoPadre },
          select: { ruta: true },
        });
        if (!padre)
          throw new NotFoundException('La carpeta de destino ya no existe.');
        // Meter una carpeta dentro de su propia descendencia desconectaría
        // esa rama del árbol. La ruta materializada lo ve de un vistazo.
        if (estaEnRama(padre.ruta, actual.ruta))
          throw new BadRequestException(
            'No se puede mover una carpeta dentro de otra que está por debajo de ella.',
          );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (mueve && nuevoPadre !== actual.parentId) {
        const rutaNueva = await this.calcularRuta(id, nuevoPadre);
        // Toda la descendencia hereda el cambio de prefijo.
        const descendientes = await tx.carpeta.findMany({
          where: { ruta: { startsWith: `${actual.ruta}/` } },
          select: { id: true, ruta: true },
        });
        for (const d of descendientes) {
          await tx.carpeta.update({
            where: { id: d.id },
            data: { ruta: reprefijar(d.ruta, actual.ruta, rutaNueva) },
          });
        }
        data.parentId = nuevoPadre;
        data.ruta = rutaNueva;
      }
      return tx.carpeta.update({ where: { id }, data });
    });
  }

  /**
   * Borra una carpeta vacía.
   *
   * Las FK son Restrict a propósito: una carpeta con subcarpetas o
   * proyectos dentro no se borra sin decidir antes qué pasa con ellos.
   * En cascada se llevaría obras enteras con todas sus jornadas.
   */
  async eliminar(id: number) {
    const carpeta = await this.prisma.carpeta.findUnique({
      where: { id },
      select: {
        nombre: true,
        _count: { select: { hijas: true, proyectos: true } },
      },
    });
    if (!carpeta) throw new NotFoundException('Esa carpeta ya no existe.');

    if (carpeta._count.hijas > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${carpeta.nombre}" tiene ${carpeta._count.hijas} carpeta(s) dentro.`,
      );
    if (carpeta._count.proyectos > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${carpeta.nombre}" tiene ${carpeta._count.proyectos} proyecto(s) dentro. Muévelos primero.`,
      );

    await this.prisma.carpeta.delete({ where: { id } });
    return { ok: true, id, nombre: carpeta.nombre };
  }

  /** Las carpetas del camino, de la raíz a ésta. Para el breadcrumb. */
  async camino(id: number) {
    const carpeta = await this.prisma.carpeta.findUnique({
      where: { id },
      select: { ruta: true },
    });
    if (!carpeta) throw new NotFoundException('Esa carpeta ya no existe.');

    const ids = carpeta.ruta.split('/').map(Number);
    const nodos = await this.prisma.carpeta.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true },
    });
    // Se ordenan por la ruta, no por id: el orden del camino es el del
    // árbol y no tiene por qué coincidir con el de creación.
    const porId = new Map(nodos.map((n) => [n.id, n]));
    return ids.map((i) => porId.get(i)).filter((n) => n !== undefined);
  }

  /** ¿Existe? Lo usan proyecto y navegación antes de colgar nada. */
  async exigir(id: number) {
    const carpeta = await this.prisma.carpeta.findUnique({
      where: { id },
      select: { id: true, nombre: true, ruta: true, parentId: true },
    });
    if (!carpeta) throw new NotFoundException('Esa carpeta ya no existe.');
    return carpeta;
  }

  /** Descendientes de una carpeta, ella incluida. Para contar en subárbol. */
  async idsDelSubarbol(ruta: string): Promise<number[]> {
    const nodos = await this.prisma.carpeta.findMany({
      where: { OR: [{ ruta }, { ruta: { startsWith: `${ruta}/` } }] },
      select: { id: true, ruta: true },
    });
    return nodos
      .filter((n) => n.ruta === ruta || esDescendiente(n.ruta, ruta))
      .map((n) => n.id);
  }
}
