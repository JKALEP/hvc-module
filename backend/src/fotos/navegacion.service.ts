import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlbumService } from './album.service';
import { AccesoService } from './acceso.service';
import type { Alcance } from './acceso.service';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * Navegación por carpetas del módulo Fotos.
 *
 * Service aparte y de solo lectura: `SedeService` administra el árbol y
 * este solo lo recorre. Mismo patrón que `proyecto-analitica` frente a
 * `proyecto`.
 *
 * El árbol se filtra a lo que cada quien alcanza, y eso se resuelve con
 * la `ruta` materializada: sin ella haría falta recursión en SQL para
 * saber si una carpeta contiene algo visible.
 */

/**
 * Qué puede ver quien navega.
 *
 * Solo hay dos casos, no tres: o ves el árbol entero, o ves lo que te
 * compartieron. Que quien recibe sea un interno o un cliente externo NO
 * cambia por dónde puede navegar —cambia lo que puede HACER dentro, y eso
 * lo deciden el rol y los guards, no este service—.
 */
export type Visibilidad = { tipo: 'admin' } | { tipo: 'alcance' };

export interface CarpetaSede {
  id: number;
  nombre: string;
  estado: string;
  subsedes: number;
  /** Álbumes de TODO el subárbol, no solo los colgados directamente. */
  albumes: number;
}

interface SedeCruda {
  id: number;
  nombre: string;
  parentId: number | null;
  ruta: string;
  estado: string;
  _count: { albumes: number };
}

@Injectable()
export class NavegacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly album: AlbumService,
    private readonly acceso: AccesoService,
  ) {}

  /**
   * Contenido de una carpeta.
   *
   * `sedeId` nulo es la raíz. Devuelve también los ancestros, porque el
   * breadcrumb necesita sus nombres y la `ruta` solo guarda ids.
   */
  async contenido(
    usuario: UsuarioAutenticado,
    visibilidad: Visibilidad,
    sedeId: number | null,
  ) {
    const sedes: SedeCruda[] = await this.prisma.sede.findMany({
      select: {
        id: true,
        nombre: true,
        parentId: true,
        ruta: true,
        estado: true,
        _count: { select: { albumes: true } },
      },
      orderBy: { nombre: 'asc' },
    });
    const porId = new Map(sedes.map((s) => [s.id, s]));

    const actual = sedeId !== null ? porId.get(sedeId) : undefined;
    if (sedeId !== null && !actual)
      throw new ForbiddenException('Esa carpeta no existe.');

    if (visibilidad.tipo === 'alcance')
      return this.porAlcance(usuario, sedes, porId, actual);

    const hijas = sedes.filter((s) => s.parentId === (sedeId ?? null));
    return {
      raizPlana: false,
      ancestros: actual ? this.ancestros(actual.ruta, porId, 0) : [],
      sedeActual: actual
        ? { id: actual.id, nombre: actual.nombre, estado: actual.estado }
        : null,
      subsedes: hijas.map((h) => this.aCarpeta(h, sedes)),
      // En la raíz no hay álbumes: siempre cuelgan de una carpeta.
      albumes: sedeId === null ? [] : await this.album.listar(usuario, sedeId),
    };
  }

  /**
   * Vista de quien solo ve lo compartido: cliente externo o colaborador
   * interno, da igual.
   *
   * Su raíz NO es la raíz real del árbol: son las carpetas que le
   * compartieron. Enseñarle "Fotos › Lima › Almacén" cuando solo le
   * dieron el almacén revelaría la estructura de HVC por encima de lo
   * compartido, así que el breadcrumb se recorta ahí.
   *
   * `raizPlana` se DERIVA: si no tiene ninguna carpeta compartida, lo
   * único que puede recibir son álbumes sueltos y no hay árbol que
   * recorrer. Antes era una rama aparte, y en cuanto se pudo compartir
   * una carpeta con un interno esa rama le negaba navegar lo que ya era
   * suyo.
   */
  private async porAlcance(
    usuario: UsuarioAutenticado,
    sedes: SedeCruda[],
    porId: Map<number, SedeCruda>,
    actual: SedeCruda | undefined,
  ) {
    const alcance = await this.acceso.alcance(usuario.id);

    if (!actual) {
      // Solo las carpetas compartidas que no cuelgan de otra compartida:
      // si le dieron "Lima" y "Lima/Almacén", en la raíz va solo "Lima".
      const raices = sedes.filter(
        (s) =>
          alcance.rutas.includes(s.ruta) &&
          !alcance.rutas.some(
            (r) => r !== s.ruta && s.ruta.startsWith(`${r}/`),
          ),
      );

      return {
        // Sin carpetas compartidas no hay nada que explorar.
        raizPlana: alcance.rutas.length === 0,
        ancestros: [],
        sedeActual: null,
        subsedes: raices.map((s) => this.aCarpeta(s, sedes)),
        // Los álbumes sueltos que le compartieron cuelgan de la raíz.
        albumes:
          alcance.albumIds.length > 0 ? await this.album.listar(usuario) : [],
      };
    }

    if (!this.acceso.dentroDelAlcance(actual.ruta, alcance))
      throw new ForbiddenException('No tienes acceso a esta carpeta.');

    return {
      raizPlana: false,
      ancestros: this.ancestros(
        actual.ruta,
        porId,
        this.profundidadRaiz(actual.ruta, alcance),
      ),
      sedeActual: {
        id: actual.id,
        nombre: actual.nombre,
        estado: actual.estado,
      },
      subsedes: sedes
        .filter((s) => s.parentId === actual.id)
        .map((s) => this.aCarpeta(s, sedes)),
      albumes: await this.album.listar(usuario, actual.id),
    };
  }

  /** Cuántos niveles hay que ocultar: los que están por encima de lo compartido. */
  private profundidadRaiz(ruta: string, alcance: Alcance): number {
    const raiz = alcance.rutas
      .filter((r) => ruta === r || ruta.startsWith(`${r}/`))
      // La más cercana gana: es la que el cliente reconoce como su raíz.
      .sort((a, b) => b.length - a.length)[0];
    return raiz ? raiz.split('/').length - 1 : 0;
  }

  private aCarpeta(sede: SedeCruda, todas: SedeCruda[]): CarpetaSede {
    return {
      id: sede.id,
      nombre: sede.nombre,
      estado: sede.estado,
      subsedes: todas.filter((s) => s.parentId === sede.id).length,
      // Todo el subárbol: una carpeta que dice "0 álbumes" cuando abajo
      // hay 40 invita a no entrar.
      albumes: todas
        .filter(
          (s) => s.ruta === sede.ruta || s.ruta.startsWith(`${sede.ruta}/`),
        )
        .reduce((total, s) => total + s._count.albumes, 0),
    };
  }

  /** Del "1/4/9" al breadcrumb, sin el propio nodo y sin lo oculto. */
  private ancestros(
    ruta: string,
    porId: Map<number, { id: number; nombre: string }>,
    desde: number,
  ) {
    return ruta
      .split('/')
      .slice(desde, -1)
      .map((id) => porId.get(Number(id)))
      .filter((s): s is SedeCruda => s !== undefined)
      .map((s) => ({ id: s.id, nombre: s.nombre }));
  }
}
