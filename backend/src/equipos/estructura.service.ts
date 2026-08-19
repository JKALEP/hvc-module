import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { limpiar } from '../common/texto';
import { aId, aIdOpcional } from '../common/validacion';
import { OrganizacionService } from './organizacion.service';

export interface CrearNodoDto {
  organizacionId?: number | string | null;
  nombre?: string | null;
  /** null = va al primer nivel del árbol de esa organización. */
  padreId?: number | string | null;
}

export interface EditarNodoDto {
  nombre?: string | null;
  padreId?: number | string | null;
  orden?: number | string | null;
}

/** Un nodo con sus hijos dentro. Lo que consume el árbol de la pantalla. */
export interface NodoConHijos {
  id: number;
  nombre: string;
  orden: number;
  padreId: number | null;
  equipos: number;
  hijos: NodoConHijos[];
}

/**
 * El árbol de ubicaciones de una organización.
 *
 * Autorreferenciado y sin niveles fijos: un cliente usa «Lima → Sede
 * Norte» y otro «Torre → Piso → Zona → Área → Ambiente». Columnas fijas
 * obligarían a migrar el schema por cada cliente que organice distinto.
 *
 * Vive aparte de `OrganizacionService` porque la jerarquía es un
 * problema completo por sí mismo —ciclos, reordenamiento, borrado
 * seguro— y mezclarlo con el CRUD del cliente es lo que convierte un
 * service en un mega-service.
 *
 * A diferencia de `Sede` y `Carpeta`, aquí NO hay ruta materializada:
 * esos árboles se recorren por subárbol entero y éste se navega nivel a
 * nivel. El ciclo se detecta subiendo por los padres, que con la
 * profundidad real de estos árboles son cinco consultas como mucho.
 */
@Injectable()
export class EstructuraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizaciones: OrganizacionService,
  ) {}

  /**
   * El árbol completo de una organización, ya anidado.
   *
   * Se trae plano de una sola consulta y se arma en memoria: son
   * decenas de nodos, no miles, y así la pantalla recibe la forma que
   * necesita sin N+1 ni consultas recursivas.
   */
  async arbol(organizacionId: number): Promise<NodoConHijos[]> {
    await this.organizaciones.exigir(organizacionId);

    const planos = await this.prisma.nodoEstructura.findMany({
      where: { organizacionId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        orden: true,
        padreId: true,
        _count: { select: { equipos: true } },
      },
    });

    const porId = new Map<number, NodoConHijos>(
      planos.map((n) => [
        n.id,
        {
          id: n.id,
          nombre: n.nombre,
          orden: n.orden,
          padreId: n.padreId,
          equipos: n._count.equipos,
          hijos: [],
        },
      ]),
    );

    const raices: NodoConHijos[] = [];
    for (const n of planos) {
      const nodo = porId.get(n.id) as NodoConHijos;
      if (n.padreId === null) raices.push(nodo);
      else porId.get(n.padreId)?.hijos.push(nodo);
    }
    return raices;
  }

  /** El camino de la raíz a un nodo. Para el breadcrumb. */
  async camino(id: number) {
    const camino: { id: number; nombre: string }[] = [];
    let actual = await this.prisma.nodoEstructura.findUnique({
      where: { id },
      select: { id: true, nombre: true, padreId: true },
    });
    if (!actual) throw new NotFoundException('Esa ubicación ya no existe.');

    // Tope de seguridad: si alguna vez se colara un ciclo por SQL
    // directo, esto no puede quedarse girando.
    let guarda = 0;
    while (actual && guarda++ < 50) {
      camino.unshift({ id: actual.id, nombre: actual.nombre });
      if (actual.padreId === null) break;
      actual = await this.prisma.nodoEstructura.findUnique({
        where: { id: actual.padreId },
        select: { id: true, nombre: true, padreId: true },
      });
    }
    return camino;
  }

  async crear(dto: CrearNodoDto) {
    const organizacionId = aId(
      dto.organizacionId,
      'La organización indicada no es válida.',
    );
    await this.organizaciones.exigir(organizacionId);

    const nombre = limpiar(dto.nombre);
    if (!nombre)
      throw new BadRequestException(
        'El nombre de la ubicación es obligatorio.',
      );

    const padreId = aIdOpcional(
      dto.padreId,
      'La ubicación padre no es válida.',
    );
    if (padreId !== null) {
      const padre = await this.exigirNodo(padreId);
      // Un hijo no puede colgar del árbol de otra organización: sería un
      // nodo alcanzable desde dos inventarios distintos.
      if (padre.organizacionId !== organizacionId)
        throw new BadRequestException(
          'La ubicación padre pertenece a otra organización.',
        );
    }

    await this.exigirNombreLibre(padreId, nombre);

    const ultimo = await this.prisma.nodoEstructura.findFirst({
      where: { organizacionId, padreId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    });

    return this.prisma.nodoEstructura.create({
      data: {
        organizacionId,
        nombre,
        padreId,
        orden: (ultimo?.orden ?? -1) + 1,
      },
    });
  }

  /** Renombrar, reordenar y/o mover dentro del mismo árbol. */
  async editar(id: number, dto: EditarNodoDto) {
    const actual = await this.exigirNodo(id);

    const data: { nombre?: string; padreId?: number | null; orden?: number } =
      {};
    const nombre =
      'nombre' in dto ? (limpiar(dto.nombre) ?? '') : actual.nombre;
    if ('nombre' in dto) {
      if (!nombre)
        throw new BadRequestException(
          'El nombre de la ubicación es obligatorio.',
        );
      data.nombre = nombre;
    }

    if ('orden' in dto && dto.orden !== null && dto.orden !== undefined) {
      const n = Number(dto.orden);
      if (!Number.isInteger(n) || n < 0)
        throw new BadRequestException('El orden debe ser un entero positivo.');
      data.orden = n;
    }

    const mueve = 'padreId' in dto;
    const nuevoPadre = mueve
      ? aIdOpcional(dto.padreId, 'La ubicación padre no es válida.')
      : actual.padreId;

    if (mueve && nuevoPadre !== actual.padreId) {
      if (nuevoPadre === id)
        throw new BadRequestException(
          'Una ubicación no puede estar dentro de sí misma.',
        );
      if (nuevoPadre !== null) {
        const padre = await this.exigirNodo(nuevoPadre);
        if (padre.organizacionId !== actual.organizacionId)
          throw new BadRequestException(
            'La ubicación de destino pertenece a otra organización.',
          );
        if (await this.desciendeDe(nuevoPadre, id))
          throw new BadRequestException(
            'No se puede mover una ubicación dentro de otra que está por debajo de ella.',
          );
      }
      data.padreId = nuevoPadre;
    }

    if (nombre !== actual.nombre || nuevoPadre !== actual.padreId)
      await this.exigirNombreLibre(nuevoPadre, nombre, id);

    return this.prisma.nodoEstructura.update({ where: { id }, data });
  }

  /**
   * Borra una ubicación vacía.
   *
   * Restrict a propósito: una ubicación con sub-ubicaciones o equipos
   * dentro no se borra sin decidir antes qué pasa con ellos. En cascada
   * se llevaría inventario por delante.
   */
  async eliminar(id: number) {
    const nodo = await this.prisma.nodoEstructura.findUnique({
      where: { id },
      select: {
        nombre: true,
        _count: { select: { hijos: true, equipos: true } },
      },
    });
    if (!nodo) throw new NotFoundException('Esa ubicación ya no existe.');

    if (nodo._count.hijos > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${nodo.nombre}" tiene ${nodo._count.hijos} ubicación(es) dentro.`,
      );
    if (nodo._count.equipos > 0)
      throw new BadRequestException(
        `No se puede eliminar: "${nodo.nombre}" tiene ${nodo._count.equipos} equipo(s) dentro. Muévelos primero.`,
      );

    await this.prisma.nodoEstructura.delete({ where: { id } });
    return { ok: true, id, nombre: nodo.nombre };
  }

  // ── Interno ──

  private async exigirNodo(id: number) {
    const nodo = await this.prisma.nodoEstructura.findUnique({
      where: { id },
      select: { id: true, nombre: true, padreId: true, organizacionId: true },
    });
    if (!nodo) throw new NotFoundException('Esa ubicación ya no existe.');
    return nodo;
  }

  /** Sin dos hermanos con el mismo nombre bajo el mismo padre. */
  private async exigirNombreLibre(
    padreId: number | null,
    nombre: string,
    excepto?: number,
  ) {
    const repetido = await this.prisma.nodoEstructura.findFirst({
      where: {
        padreId,
        nombre,
        ...(excepto !== undefined ? { NOT: { id: excepto } } : {}),
      },
      select: { id: true },
    });
    if (repetido)
      throw new ConflictException(
        `Ya existe una ubicación llamada "${nombre}" en ese mismo sitio.`,
      );
  }

  /**
   * ¿`candidato` cuelga de `ancestro`?
   *
   * Sube por los padres en vez de usar una ruta materializada. Con la
   * profundidad real de estos árboles —cinco niveles en el peor caso—
   * son cinco consultas al mover un nodo, y mover es una operación rara.
   */
  private async desciendeDe(candidato: number, ancestro: number) {
    let actual: number | null = candidato;
    let guarda = 0;
    while (actual !== null && guarda++ < 50) {
      if (actual === ancestro) return true;
      const nodo: { padreId: number | null } | null =
        await this.prisma.nodoEstructura.findUnique({
          where: { id: actual },
          select: { padreId: true },
        });
      actual = nodo?.padreId ?? null;
    }
    return false;
  }
}
