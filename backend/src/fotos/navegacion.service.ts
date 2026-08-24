import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import type { Alcance } from './acceso.service';
import type {
  PermisoCarpeta,
  TipoCarpetaFotos,
} from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { estaEnRama, idsDeRuta } from '../common/arbol-ruta';
import { limpiar } from '../common/texto';

/**
 * Navegación por carpetas. Service de solo lectura: `CarpetaService`
 * administra el árbol y este solo lo recorre.
 *
 * ── Quién ve el árbol entero ────────────────────────────────────────
 * Cualquiera con nivel global (§3), no solo el administrador: un
 * LECTURA_GLOBAL ve todas las carpetas sin que nadie le comparta nada, y
 * eso es literalmente §3.2 y el punto 26 de §27. Quien NO tiene nivel
 * —el supervisor de §4 y el cliente externo— ve lo que le compartieron.
 *
 * No hay parámetro que lo diga: se deriva de `Alcance`. En v2 sí lo había
 * (`Visibilidad: 'admin' | 'alcance'`) y lo ponía el controller, que es
 * exactamente donde se puede poner mal — y donde había que acordarse de
 * tocarlo al añadir un nivel.
 *
 * ── Camino ancestral lineal ─────────────────────────────────────────
 * Quien recibe una carpeta compartida ve el camino COMPLETO hasta la raíz
 * como contexto ("UPN › UPN Villa › Pabellón 1"), pero **ningún hermano en
 * ningún nivel**. Eso no se consigue filtrando: se consigue no
 * preguntando. Los ancestros se piden por id —los que ya vienen en la
 * `ruta`— y nunca se hace un `WHERE parentId = …` sobre ellos, así que sus
 * hijos no llegan a existir en la respuesta. La fuga es imposible por
 * construcción, no por un filtro que alguien pueda olvidar.
 *
 * Los ancestros por encima de lo alcanzado se marcan `navegable: false`:
 * son texto, no enlace.
 *
 * ── §8: ni siquiera como elementos bloqueados ───────────────────────
 * Toda fila que sale de aquí ha pasado por `permisoSobre`. El `where` de
 * Prisma es solo un PREFILTRO: no sabe expresar que una concesión más
 * profunda con `SIN_ACCESO` niega lo que la madre concedía, así que la
 * decisión se toma en memoria, fila por fila, contra el alcance ya
 * cargado. Filtrar solo en SQL habría dejado pasar justo el caso de §7.
 */

/** Una carpeta tal como sale en el explorador. */
export interface CarpetaListada {
  id: number;
  nombre: string;
  cerrada: boolean;
  subcarpetas: number;
  albumes: number;
  fotos: number;
  /** Para "Act. hace 2 días": se propaga desde lo que pasa dentro. */
  actualizadoEn: Date;
  /** Lo que este usuario puede hacer aquí. Lo usa la UI para las acciones. */
  permiso: PermisoCarpeta;
  /**
   * `CARPETA` o `EQUIPO`.
   *
   * ⚠️ Aquí viajaba también un `equipo` con el código del catálogo de
   * Gestión de Equipos. Se retiró en la Fase 1a de «Gestión de contenido»
   * junto con la FK: Fotos ya no referencia ese módulo. Los campos propios
   * del equipo llegan en la Fase 1b, y NO por aquí —son de la carpeta que
   * se abre, no de cada tarjeta del listado, igual que `tipo` se carga en
   * `carpetaPorId` y no para las hijas—.
   */
  tipo: TipoCarpetaFotos;
}

/**
 * Un grupo de carpetas con su rótulo.
 *
 * La respuesta trae SIEMPRE secciones, también dentro de una carpeta —donde
 * hay exactamente una—, para que el frontend recorra una sola forma. La
 * alternativa era `carpetas` a veces y `secciones` otras, y eso obliga a
 * quien la consume a preguntar en qué caso está.
 *
 * Las secciones vacías NO se envían: «Mis carpetas» no existe para un
 * cliente, y un rótulo sobre un hueco solo hace pensar que algo se perdió.
 */
export interface SeccionCarpetas {
  clave: 'todas' | 'propias' | 'compartidas' | 'contenido' | 'busqueda';
  etiqueta: string;
  carpetas: CarpetaListada[];
}

/** Cómo ordenar un listado (§11). */
export type Orden = 'nombre' | 'nombre-desc' | 'reciente' | 'antiguo';

const ORDENES: readonly Orden[] = [
  'nombre',
  'nombre-desc',
  'reciente',
  'antiguo',
] as const;

/** Traduce el orden del listado al `orderBy` de Prisma. */
const ORDEN_PRISMA: Record<
  Orden,
  { nombre: 'asc' | 'desc' } | { actualizadoEn: 'asc' | 'desc' }
> = {
  nombre: { nombre: 'asc' },
  'nombre-desc': { nombre: 'desc' },
  reciente: { actualizadoEn: 'desc' },
  antiguo: { actualizadoEn: 'asc' },
};

/** Cuántas carpetas devuelve una búsqueda o el listado de recientes. */
const TOPE_LISTADO = 60;

/** Lo que se selecciona de una carpeta para poder decidir y pintarla. */
const CAMPOS_CARPETA = {
  id: true,
  nombre: true,
  ruta: true,
  cerrada: true,
  actualizadoEn: true,
  tipo: true,
} as const;

interface FilaCarpeta {
  id: number;
  nombre: string;
  ruta: string;
  cerrada: boolean;
  actualizadoEn: Date;
  tipo: TipoCarpetaFotos;
}

/** Opciones de listado que vienen de la query string (§11). */
export interface OpcionesListado {
  q?: string | null;
  orden?: string | null;
}

@Injectable()
export class NavegacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  /** ¿Este alcance recorre el árbol completo? */
  private veTodo(alcance: Alcance): boolean {
    return alcance.esSuperAdmin || alcance.nivel !== null;
  }

  /** El orden pedido, o el de por defecto si no es uno de los válidos. */
  private ordenValido(valor: unknown): Orden {
    const s = limpiar(valor);
    return s && ORDENES.includes(s as Orden) ? (s as Orden) : 'nombre';
  }

  /**
   * Contenido de una carpeta. `carpetaId` nulo es la raíz.
   *
   * Con `q`, el listado deja de ser el contenido de una carpeta y pasa a ser
   * el resultado de buscar en TODO el árbol visible, como en Drive: buscar
   * solo dentro de la carpeta abierta obligaría a acertar antes dónde está
   * lo que buscas, que es justo lo que no sabes.
   */
  async contenido(
    usuario: UsuarioAutenticado,
    carpetaId: number | null,
    opciones: OpcionesListado = {},
  ) {
    const alcance = await this.acceso.alcanceDe(usuario);
    const orden = this.ordenValido(opciones.orden);
    const q = limpiar(opciones.q);

    // ── Búsqueda: el árbol visible entero, sin importar dónde estés ──
    if (q) {
      return {
        ancestros: [],
        carpetaActual: null,
        puedeEscribir: false,
        permiso: null,
        ramaCerrada: false,
        busqueda: q,
        secciones: await this.seccionesDe(alcance, [
          {
            clave: 'busqueda',
            etiqueta: `Resultados de «${q}»`,
            filas: await this.buscar(alcance, q, orden),
          },
        ]),
      };
    }

    // ── Raíz ──
    if (carpetaId === null) {
      return {
        ancestros: [],
        carpetaActual: null,
        // Crear en la raíz no es un permiso de carpeta: no hay carpeta.
        puedeEscribir: this.acceso.puedeCrearRaiz(usuario),
        permiso: null,
        ramaCerrada: false,
        busqueda: null,
        secciones: await this.seccionesDe(
          alcance,
          await this.raiz(alcance, orden),
        ),
      };
    }

    // ── Dentro de una carpeta ──
    //
    // La negativa la da `AccesoService`, no este service: «no existe» y «no
    // la ves» tienen que ser LA MISMA respuesta, y con el mensaje escrito en
    // un solo sitio no pueden divergir.
    const actual = await this.acceso.exigirSobreCarpeta(
      alcance,
      await this.acceso.carpetaPorId(carpetaId),
      'LECTURA',
    );
    const { permiso, ramaCerrada } = actual;

    return {
      ancestros: await this.caminoAncestral(actual.ruta, alcance),
      carpetaActual: {
        id: actual.id,
        nombre: actual.nombre,
        cerrada: actual.cerrada,
        actualizadoEn: actual.actualizadoEn,
        // Desde la Fase 5: quien abre la carpeta necesita saber si es un
        // EQUIPO para ofrecer las tareas de §13.
        tipo: actual.tipo ?? 'CARPETA',
      },
      permiso,
      puedeEscribir: this.acceso.alcanza(permiso, 'EDICION') && !ramaCerrada,
      ramaCerrada,
      busqueda: null,
      secciones: await this.seccionesDe(alcance, [
        {
          clave: 'contenido',
          etiqueta: 'Carpetas',
          filas: await this.hijasDe(carpetaId, orden),
        },
      ]),
    };
  }

  /**
   * Las secciones de la raíz (§8, §21).
   *
   * Quien tiene nivel global recorre el árbol entero, así que se le da UNA
   * sección con el primer nivel completo: separarle «Mis carpetas» de
   * «Compartido conmigo» le pondría en la segunda carpetas que nadie le
   * compartió —llega a ellas por su nivel—, y eso es mentira.
   *
   * Al resto se le derivan las dos secciones de §21 del alcance que ya está
   * cargado, sin tabla ni consulta extra: es SUYA si es propietario, y
   * COMPARTIDA si la alcanza sin serlo.
   */
  private async raiz(alcance: Alcance, orden: Orden) {
    if (this.veTodo(alcance))
      return [
        {
          clave: 'todas' as const,
          etiqueta: 'Todas las carpetas',
          filas: await this.hijasDe(null, orden),
        },
      ];

    const raices = await this.raicesCompartidas(alcance, orden);
    const esPropia = (c: FilaCarpeta) =>
      alcance.rutasPropias.some((propia) => estaEnRama(c.ruta, propia));

    return [
      {
        clave: 'propias' as const,
        etiqueta: 'Mis carpetas',
        filas: raices.filter(esPropia),
      },
      {
        clave: 'compartidas' as const,
        etiqueta: 'Compartido conmigo',
        filas: raices.filter((c) => !esPropia(c)),
      },
    ];
  }

  /**
   * Pone contadores a cada sección y descarta las que quedan vacías.
   *
   * Los contadores se calculan por sección y no de una vez para todas: son
   * listas disjuntas, y juntarlas para volver a separarlas después no
   * ahorraría consultas —cada sección ya resuelve las suyas en tres—.
   */
  private async seccionesDe(
    alcance: Alcance,
    grupos: {
      clave: SeccionCarpetas['clave'];
      etiqueta: string;
      filas: FilaCarpeta[];
    }[],
  ): Promise<SeccionCarpetas[]> {
    const secciones: SeccionCarpetas[] = [];
    for (const g of grupos) {
      const carpetas = await this.conContadores(g.filas, alcance);
      if (carpetas.length > 0)
        secciones.push({
          clave: g.clave,
          etiqueta: g.etiqueta,
          carpetas,
        });
    }
    return secciones;
  }

  /**
   * Busca por nombre en todo el árbol visible (§11).
   *
   * El `where` lleva el prefiltro de permisos para que descarte Postgres, y
   * `conContadores` remata con la cascada: el prefiltro no sabe de
   * restricciones más profundas.
   */
  private async buscar(
    alcance: Alcance,
    q: string,
    orden: Orden,
  ): Promise<FilaCarpeta[]> {
    return this.prisma.carpetaFotos.findMany({
      where: {
        AND: [
          this.acceso.prefiltroDeCarpetas(alcance),
          { nombre: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: ORDEN_PRISMA[orden],
      take: TOPE_LISTADO,
      select: CAMPOS_CARPETA,
    });
  }

  /**
   * Lo que cambió hace menos (§21, «Recientes»).
   *
   * Sale gratis porque `actualizadoEn` se propaga hacia arriba cuando algo
   * pasa dentro (`AccesoService.marcarActividad`): sin esa propagación esto
   * habría exigido un agregado por carpeta.
   */
  async recientes(usuario: UsuarioAutenticado) {
    const alcance = await this.acceso.alcanceDe(usuario);
    const filas = await this.prisma.carpetaFotos.findMany({
      where: this.acceso.prefiltroDeCarpetas(alcance),
      orderBy: { actualizadoEn: 'desc' },
      take: TOPE_LISTADO,
      select: CAMPOS_CARPETA,
    });
    return { carpetas: await this.conContadores(filas, alcance) };
  }

  /**
   * El camino hacia arriba, sin hermanos.
   *
   * UNA consulta con los ids que ya están en la ruta. Quien ve todo navega
   * el camino completo; el resto solo desde donde empieza su acceso — lo de
   * más arriba es contexto, y responder a su contenido sería revelar
   * hermanos.
   */
  private async caminoAncestral(ruta: string, alcance: Alcance) {
    // Sin el propio nodo: ese va aparte, como carpeta actual.
    const idsAncestros = idsDeRuta(ruta).slice(0, -1);
    if (idsAncestros.length === 0) return [];

    const filas = await this.prisma.carpetaFotos.findMany({
      where: { id: { in: idsAncestros } },
      select: { id: true, nombre: true, ruta: true },
    });
    const porId = new Map(filas.map((f) => [f.id, f]));

    return idsAncestros
      .map((id) => porId.get(id))
      .filter((c): c is (typeof filas)[number] => c !== undefined)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        navegable: this.acceso.permisoSobre(alcance, c.ruta) !== 'SIN_ACCESO',
      }));
  }

  /** Hijas directas de una carpeta (o del primer nivel si es null). */
  private hijasDe(
    parentId: number | null,
    orden: Orden = 'nombre',
  ): Promise<FilaCarpeta[]> {
    return this.prisma.carpetaFotos.findMany({
      where: { parentId },
      orderBy: ORDEN_PRISMA[orden],
      select: CAMPOS_CARPETA,
    });
  }

  /**
   * Lo más alto que alcanza quien no tiene nivel global (§8).
   *
   * Las rutas las decide `AccesoService.raicesVisibles` —lo más alto que
   * alcanza, ya descontadas las negadas—; aquí solo se traen las filas.
   * `raiz()` las reparte después entre «Mis carpetas» y «Compartido
   * conmigo» según sea propietario o no.
   */
  private async raicesCompartidas(
    alcance: Alcance,
    orden: Orden = 'nombre',
  ): Promise<FilaCarpeta[]> {
    const raices = this.acceso.raicesVisibles(alcance);
    if (raices.length === 0) return [];

    return this.prisma.carpetaFotos.findMany({
      where: { ruta: { in: raices } },
      orderBy: ORDEN_PRISMA[orden],
      select: CAMPOS_CARPETA,
    });
  }

  /**
   * Descarta lo que este alcance no ve y añade los contadores de subárbol.
   *
   * Una carpeta que dice "0 fotos" cuando abajo hay 40 invita a no entrar,
   * así que los contadores son del SUBÁRBOL.
   *
   * ── Los contadores son POR USUARIO, y exactos ──────────────────────
   * Solo cuentan lo que ESTE usuario puede ver: se resuelve el permiso de
   * cada descendiente con `permisoSobre` y las negadas quedan fuera, junto
   * con sus álbumes y sus fotos. Dos personas mirando la misma carpeta
   * pueden ver números distintos, y eso es lo correcto — un total que
   * incluye lo que no puedes abrir filtra cuánto hay al otro lado de una
   * restricción de §7, y además promete contenido que no vas a encontrar.
   *
   * ── Y no hace falta caché ──────────────────────────────────────────
   * Son TRES agregados, y los tres están acotados al subárbol que se está
   * listando, no a la tabla entera:
   *   1. las descendientes de las tarjetas (una consulta, con `_count` de
   *      álbumes por carpeta);
   *   2. los álbumes de las carpetas VISIBLES, para poder ir de álbum a
   *      carpeta;
   *   3. las fotos agrupadas por álbum, acotadas a esos álbumes.
   * El coste no crece con el número de tarjetas ni con el tamaño del
   * módulo, así que precalcular sería añadir una caché con clave
   * usuario × carpeta que habría que invalidar al compartir, revocar,
   * mover, subir y borrar — cinco caminos para quedarse desincronizada, a
   * cambio de ahorrar tres consultas indexadas.
   *
   * Prisma no agrupa por campo de una relación, y de ahí el paso 2: no hay
   * `groupBy` de fotos por `carpetaId`, así que se pasa por `albumId`.
   */
  private async conContadores(
    carpetas: FilaCarpeta[],
    alcance: Alcance,
  ): Promise<CarpetaListada[]> {
    // §8: fuera lo que no alcanza, antes de contar nada.
    const visibles = carpetas
      .map((c) => ({ c, permiso: this.acceso.permisoSobre(alcance, c.ruta) }))
      .filter((x) => x.permiso !== 'SIN_ACCESO');

    if (visibles.length === 0) return [];

    // 1. Todas las descendientes de golpe, para no consultar por tarjeta.
    const descendientes = await this.prisma.carpetaFotos.findMany({
      where: {
        OR: visibles.map(({ c }) => ({
          OR: [{ ruta: c.ruta }, { ruta: { startsWith: `${c.ruta}/` } }],
        })),
      },
      select: {
        id: true,
        ruta: true,
        parentId: true,
        _count: { select: { albumes: true } },
      },
    });

    // Y de esas, las que este usuario ve. Todo lo que sigue se cuenta solo
    // sobre este conjunto.
    const ramaVisible = descendientes.filter(
      (d) => this.acceso.permisoSobre(alcance, d.ruta) !== 'SIN_ACCESO',
    );
    const idsVisibles = ramaVisible.map((d) => d.id);

    // 2. Los álbumes de esas carpetas: hacen de puente para las fotos.
    const albumes = await this.prisma.albumFotos.findMany({
      where: { carpetaId: { in: idsVisibles } },
      select: { id: true, carpetaId: true },
    });
    const carpetaDeAlbum = new Map(albumes.map((a) => [a.id, a.carpetaId]));

    // 3. Fotos por álbum, acotadas a esos álbumes. Las fotos sin álbum son
    // la bandeja de §18: no cuelgan de ninguna carpeta y no cuentan aquí.
    const fotosPorAlbum =
      albumes.length === 0
        ? []
        : await this.prisma.foto.groupBy({
            by: ['albumId'],
            where: { albumId: { in: albumes.map((a) => a.id) } },
            _count: { _all: true },
          });

    const fotosDe = new Map<number, number>();
    for (const f of fotosPorAlbum) {
      // `by: ['albumId']` lo tipa nullable aunque el where ya lo excluya.
      if (f.albumId === null) continue;
      const carpeta = carpetaDeAlbum.get(f.albumId);
      if (carpeta === undefined) continue;
      fotosDe.set(carpeta, (fotosDe.get(carpeta) ?? 0) + f._count._all);
    }

    const albumesDe = new Map<number, number>();
    for (const d of ramaVisible) albumesDe.set(d.id, d._count.albumes);

    return visibles.map(({ c, permiso }) => {
      const rama = ramaVisible.filter((d) => estaEnRama(d.ruta, c.ruta));
      return {
        id: c.id,
        nombre: c.nombre,
        cerrada: c.cerrada,
        // Las hijas directas que se ven, no todas las que hay.
        subcarpetas: ramaVisible.filter((d) => d.parentId === c.id).length,
        albumes: rama.reduce((t, d) => t + (albumesDe.get(d.id) ?? 0), 0),
        fotos: rama.reduce((t, d) => t + (fotosDe.get(d.id) ?? 0), 0),
        actualizadoEn: c.actualizadoEn,
        permiso,
        tipo: c.tipo,
      };
    });
  }
}
