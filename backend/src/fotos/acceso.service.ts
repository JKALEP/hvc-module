import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Qué ve cada quien dentro de Fotos. Es la ÚNICA fuente de la respuesta.
 *
 * La cascada no está materializada: compartir una carpeta es una sola
 * fila en `AccesoCompartido`, y sus descendientes se resuelven aquí
 * comparando prefijos de `Sede.ruta`. Por eso crear una subsede o mover
 * una rama no obliga a tocar ninguna fila de acceso — no hay caché que
 * pueda desincronizarse.
 */

/** Lo que le han compartido a alguien, ya resuelto. */
export interface Alcance {
  /** `ruta` de cada sede compartida. Cubre toda su descendencia. */
  rutas: string[];
  /** Álbumes compartidos uno a uno. */
  albumIds: number[];
}

@Injectable()
export class AccesoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Un ADMIN_FOTOS ve todo por su nivel; el SuperAdmin, por su rol. */
  esAdminFotos(usuario: UsuarioAutenticado): boolean {
    if (usuario.rol === 'SUPERADMIN') return true;
    return usuario.permisos.some(
      (p) => p.modulo === 'FOTOS' && p.nivelFotos === 'ADMIN_FOTOS',
    );
  }

  /** Un cliente externo: solo ve lo compartido y nunca escribe. */
  esCliente(usuario: UsuarioAutenticado): boolean {
    return usuario.rol === 'CLIENTE';
  }

  async alcance(usuarioId: number): Promise<Alcance> {
    const filas = await this.prisma.accesoCompartido.findMany({
      where: { usuarioId },
      select: { albumId: true, sede: { select: { ruta: true } } },
    });

    return {
      rutas: filas
        .map((f) => f.sede?.ruta)
        .filter((r): r is string => r !== undefined && r !== null),
      albumIds: filas
        .map((f) => f.albumId)
        .filter((id): id is number => id !== null),
    };
  }

  /** ¿La sede cae dentro de alguna rama compartida? */
  dentroDelAlcance(ruta: string, alcance: Alcance): boolean {
    return alcance.rutas.some((r) => ruta === r || ruta.startsWith(`${r}/`));
  }

  /**
   * Condición Prisma de "álbumes que este usuario ve".
   *
   * Se devuelve como `where` y no como lista de ids para que el filtrado
   * lo haga Postgres: materializar los ids obligaría a leer todos los
   * álbumes del subárbol antes de poder consultarlos.
   */
  filtroAlbumes(alcance: Alcance) {
    const condiciones: object[] = [];
    if (alcance.albumIds.length > 0)
      condiciones.push({ id: { in: alcance.albumIds } });
    for (const ruta of alcance.rutas)
      condiciones.push({
        sede: { OR: [{ ruta }, { ruta: { startsWith: `${ruta}/` } }] },
      });

    // Sin nada compartido no se ve nada. `OR: []` en Prisma no filtra,
    // así que hay que decirlo explícitamente.
    if (condiciones.length === 0) return { id: { in: [] as number[] } };
    return { OR: condiciones };
  }

  /** ¿Puede ver este álbum concreto? */
  async puedeVerAlbum(
    usuario: UsuarioAutenticado,
    albumId: number,
  ): Promise<boolean> {
    if (this.esAdminFotos(usuario)) return true;

    const alcance = await this.alcance(usuario.id);
    if (alcance.albumIds.includes(albumId)) return true;
    if (alcance.rutas.length === 0) return false;

    const album = await this.prisma.albumFotos.findUnique({
      where: { id: albumId },
      select: { sede: { select: { ruta: true } } },
    });
    return album ? this.dentroDelAlcance(album.sede.ruta, alcance) : false;
  }

  /** ¿Puede entrar a esta carpeta? Los álbumes sueltos no abren carpeta. */
  async puedeVerSede(
    usuario: UsuarioAutenticado,
    ruta: string,
  ): Promise<boolean> {
    if (this.esAdminFotos(usuario)) return true;
    return this.dentroDelAlcance(ruta, await this.alcance(usuario.id));
  }
}
