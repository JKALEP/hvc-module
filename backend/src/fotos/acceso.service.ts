import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  NivelFotos,
  PermisoCarpeta,
  TipoCarpetaFotos,
} from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { estaEnRama, idsDeRuta } from '../common/arbol-ruta';

/**
 * Qué puede hacer cada quien en cada carpeta. Es el ÚNICO sitio donde se
 * responde eso, y §25 lo pide con esas palabras: «diseñar esta lógica de
 * manera centralizada, no repetirla manualmente en cada endpoint».
 *
 * Los DOS sistemas de §2 se cruzan aquí y solo aquí:
 *   A. el nivel global de `PermisoModulo.nivelFotos` — qué alcanzas sin que
 *      nadie te comparta nada;
 *   B. el grado de `AccesoCompartido.permiso` — qué puedes hacer dentro de
 *      una carpeta concreta.
 *
 * Todo se apoya en `CarpetaFotos.ruta`. Compartir una carpeta es UNA fila y
 * sus descendientes se resuelven comparando prefijos; archivar es UN
 * booleano y la rama entera queda de solo lectura por el mismo mecanismo;
 * la herencia de §7 y la restricción explícita de `SIN_ACCESO` salen del
 * mismo camino. Nada se materializa, así que mover una rama no obliga a
 * reescribir filas de acceso ni de estado.
 */

/**
 * La escala de §5, de menor a mayor. El ORDEN es la jerarquía: comparar dos
 * permisos es comparar sus índices, y añadir un grado intermedio el día que
 * HVC lo pida es insertarlo en su sitio y nada más.
 *
 * `SIN_ACCESO` está DENTRO de la escala, en el suelo, y eso es lo que hace
 * que la negación explícita de §7 no necesite un camino aparte: quedarse
 * con el máximo de varios permisos ya la trata como lo que es —el mínimo—.
 */
const ESCALA = ['SIN_ACCESO', 'LECTURA', 'EDICION', 'TOTAL'] as const;

/**
 * Qué concede cada nivel global sobre TODO el árbol (§3).
 *
 * Record completo a propósito: añadir un nivel al enum no compila hasta
 * decidir qué alcanza, que es justo la decisión que no debe quedar
 * implícita.
 */
const PERMISO_DE_NIVEL: Record<NivelFotos, PermisoCarpeta> = {
  LECTURA_GLOBAL: 'LECTURA', // §3.2 — ve todo, no toca nada
  EDITOR_GLOBAL: 'EDICION', // §3.3 — trabaja sobre todo el contenido
  ADMIN_GLOBAL: 'TOTAL', // §3.4 — acceso absoluto
};

/**
 * Los niveles globales, de menor a mayor. El índice ES la jerarquía.
 *
 * Hace falta porque los tres de §3 están ORDENADOS y hay decisiones que se
 * toman por nivel y no por carpeta —crear en la raíz, el atajo de §12—.
 * `reglaNivelFotos` del guard sigue comparando por igualdad exacta, que con
 * dos valores bastaba; aquí no se puede, y por eso la escala vive en el
 * service, que es quien toma esas decisiones.
 */
const ESCALA_NIVEL = [
  'LECTURA_GLOBAL',
  'EDITOR_GLOBAL',
  'ADMIN_GLOBAL',
] as const;

/** Qué exige cada clase de operación. Se pasa a `exigirPermiso`. */
export type PermisoMinimo = Exclude<PermisoCarpeta, 'SIN_ACCESO'>;

/**
 * La respuesta a «no llegas a esta carpeta», y a «esta carpeta no existe».
 *
 * Es LA MISMA a propósito, y con el mismo 404: §24 dice que cambiar un id
 * en la URL no debe dar acceso, pero si «no existe» contestara 404 y «no
 * autorizado» 403, **el código de estado ya delataría la existencia** por
 * mucho que el texto fuera vago. Quien prueba ids sabría cuántas carpetas
 * hay y en qué rangos, que es justo lo que no debe averiguar.
 *
 * Solo aplica al escalón de LECTURA. A quien SÍ ve la carpeta pero le falta
 * grado se le dice qué le falta —ya sabe que existe, y ocultárselo solo
 * serviría para que no entienda por qué no puede—.
 */
const NO_EXISTE_O_SIN_ACCESO =
  'Esa carpeta no existe o no tienes acceso a ella.';

/**
 * La misma negativa, para lo que cuelga de una carpeta (tareas, álbumes,
 * comentarios).
 *
 * El nombre del recurso SÍ varía, y eso no filtra nada: quien pregunta ya
 * sabe qué pidió, porque lo puso en la URL. Lo que no puede variar es el
 * par (código de estado, «existe o no»), y eso se conserva — 404 idéntico
 * tanto si la fila no está como si su carpeta no se ve.
 */
export function noExisteOSinAcceso(recurso: string) {
  return `${recurso} no existe o no tienes acceso.`;
}

/**
 * Todo lo que hace falta para decidir sobre CUALQUIER carpeta, cargado de
 * una vez.
 *
 * Se carga entero y no por carpeta porque las dos preguntas grandes del
 * módulo —«¿qué contiene esta carpeta que yo pueda ver?» y la matriz de
 * pruebas— evalúan MUCHAS rutas contra UN alcance. Con una consulta por
 * carpeta, listar 40 subcarpetas serían 40 viajes a la BD.
 */
export interface Alcance {
  /** null = sin alcance global; es el supervisor de §4, el caso corriente. */
  nivel: NivelFotos | null;
  esSuperAdmin: boolean;
  /** Las filas de `AccesoCompartido`: la ruta de su carpeta y el grado. */
  concesiones: { ruta: string; permiso: PermisoCarpeta }[];
  /** Rutas de las carpetas que este usuario creó (§6). */
  rutasPropias: string[];
}

/**
 * Datos mínimos de una carpeta para decidir sobre ella.
 *
 * Lleva `actualizadoEn` aunque no haga falta para decidir: quien exige un
 * permiso casi siempre va a devolver la carpeta, y sin él tendría que
 * consultar la misma fila otra vez solo para pintarla.
 */
export interface CarpetaMinima {
  id: number;
  nombre: string;
  ruta: string;
  parentId: number | null;
  cerrada: boolean;
  actualizadoEn: Date;
  /**
   * OPCIONALES porque no todos los caminos los cargan: `carpetaPorId` sí
   * —es la carpeta que se está abriendo—, pero `NavegacionService` construye
   * las hijas con su propia consulta y no los necesita para decidir permisos.
   * Nada de la cascada de §25 los mira; están para que quien abre una
   * carpeta sepa si es un EQUIPO y pueda ofrecer las tareas de §13.
   */
  tipo?: TipoCarpetaFotos;
  equipo?: { id: number; codigoInterno: string | null } | null;
}

/** Una carpeta ya resuelta: con el permiso efectivo de quien preguntó. */
export interface CarpetaConPermiso extends CarpetaMinima {
  permiso: PermisoCarpeta;
  ramaCerrada: boolean;
}

@Injectable()
export class AccesoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Comparar permisos ──────────────────────────────────────────

  /** ¿`permiso` llega a `minimo`? */
  alcanza(permiso: PermisoCarpeta, minimo: PermisoCarpeta): boolean {
    return ESCALA.indexOf(permiso) >= ESCALA.indexOf(minimo);
  }

  /** El mayor de varios permisos. Sin argumentos, `SIN_ACCESO`. */
  private maximo(...permisos: PermisoCarpeta[]): PermisoCarpeta {
    return permisos.reduce<PermisoCarpeta>(
      (mayor, p) => (this.alcanza(p, mayor) ? p : mayor),
      'SIN_ACCESO',
    );
  }

  // ── Quién es quién ─────────────────────────────────────────────

  /** El nivel global dentro de FOTOS, o null si no tiene ninguno (§4). */
  nivelDe(usuario: UsuarioAutenticado): NivelFotos | null {
    return (
      usuario.permisos.find((p) => p.modulo === 'FOTOS')?.nivelFotos ?? null
    );
  }

  /** Un ADMIN_GLOBAL llega a todo por su nivel; el SuperAdmin, por su rol. */
  esAdminFotos(usuario: UsuarioAutenticado): boolean {
    return (
      usuario.rol === 'SUPERADMIN' || this.nivelDe(usuario) === 'ADMIN_GLOBAL'
    );
  }

  /** Cuenta externa del portal: existe solo para lo que le compartieron. */
  esCliente(usuario: UsuarioAutenticado): boolean {
    return usuario.rol === 'CLIENTE';
  }

  /**
   * ¿Puede crear una carpeta de PRIMER NIVEL?
   *
   * Es la única decisión del módulo que no es «por carpeta», y por eso está
   * aquí y no en `exigirPermiso`: la raíz no es una carpeta —no cuelga de
   * nada, nadie la posee y nadie la puede compartir—, así que no hay fila
   * cuyo permiso consultar.
   *
   * La decide el nivel global, y §3.3 se lo concede al Editor Global
   * («crear carpetas/subcarpetas») igual que al administrador. Quien no
   * tiene nivel global no crea raíces: crea dentro de lo que le
   * compartieron, que es exactamente lo que describe §4.
   */
  puedeCrearRaiz(usuario: UsuarioAutenticado): boolean {
    return this.tieneNivelMinimo(usuario, 'EDITOR_GLOBAL');
  }

  /**
   * ¿Su nivel GLOBAL llega a `minimo`? El SuperAdmin siempre.
   *
   * Para las decisiones que no cuelgan de una carpeta y por tanto no pasan
   * por `permisoSobre`: crear en la raíz y el atajo de §12. Compara por
   * posición en la escala, no por igualdad — un ADMIN_GLOBAL cumple todo lo
   * que cumple un EDITOR_GLOBAL, y escribirlo con `===` era la trampa que
   * ya está anotada en el guard.
   */
  tieneNivelMinimo(usuario: UsuarioAutenticado, minimo: NivelFotos): boolean {
    if (usuario.rol === 'SUPERADMIN') return true;
    const nivel = this.nivelDe(usuario);
    if (!nivel) return false;
    return ESCALA_NIVEL.indexOf(nivel) >= ESCALA_NIVEL.indexOf(minimo);
  }

  // ── La cascada de §25 ──────────────────────────────────────────

  async alcanceDe(usuario: UsuarioAutenticado): Promise<Alcance> {
    const [concesiones, propias] = await Promise.all([
      this.prisma.accesoCompartido.findMany({
        where: { usuarioId: usuario.id },
        select: { permiso: true, carpeta: { select: { ruta: true } } },
      }),
      this.prisma.carpetaFotos.findMany({
        where: { propietarioId: usuario.id },
        select: { ruta: true },
      }),
    ]);

    return {
      nivel: this.nivelDe(usuario),
      esSuperAdmin: usuario.rol === 'SUPERADMIN',
      concesiones: concesiones.map((c) => ({
        ruta: c.carpeta.ruta,
        permiso: c.permiso,
      })),
      rutasPropias: propias.map((p) => p.ruta),
    };
  }

  /**
   * El permiso efectivo sobre una ruta. LA función del módulo.
   *
   * Es PURA —solo alcance y ruta— y eso no es un detalle: la matriz
   * completa de nivel × permiso × profundidad se prueba sin levantar un
   * servidor ni tocar la BD, igual que las reglas del guard de Auth.
   *
   * §25 pide seis escalones «en este orden». Los seis están, pero no como
   * seis `if` con return: el primero corta, y los demás se combinan
   * quedándose con el MÁXIMO. La diferencia importa —
   *
   *   · Con «el primero que responda gana», un usuario con LECTURA_GLOBAL
   *     que además es PROPIETARIO de una carpeta se quedaría en LECTURA
   *     sobre lo suyo, porque el nivel global (escalón 2) responde antes
   *     que el propietario (escalón 3). Absurdo. El nivel global es un
   *     SUELO —«puede ver todas las carpetas», §3.2—, no un techo.
   *
   *   · Y con el máximo, la restricción explícita de §7 sigue funcionando
   *     exactamente donde tiene que funcionar: sobre un cliente, que no
   *     tiene nivel global ni es propietario de nada, así que su suelo es
   *     `SIN_ACCESO` y manda la concesión más profunda. Sobre alguien con
   *     nivel global NO muerde, y eso es lo que dicen §3.2 y §27.26: el
   *     usuario de oficina ve Proyecto A sin que nadie se lo comparta.
   */
  permisoSobre(alcance: Alcance, ruta: string): PermisoCarpeta {
    // §25.1 — El administrador global corta la cascada. Es el único
    // escalón que es un techo y un suelo a la vez.
    if (alcance.esSuperAdmin || alcance.nivel === 'ADMIN_GLOBAL')
      return 'TOTAL';

    // §25.2 — Nivel global: el suelo, igual en todo el árbol.
    const porNivel: PermisoCarpeta = alcance.nivel
      ? PERMISO_DE_NIVEL[alcance.nivel]
      : 'SIN_ACCESO';

    // §25.3 — Propietario. Cuenta también si lo es de un ANCESTRO: quien
    // creó "Proyecto A" manda sobre "Proyecto A/Frente 1" aunque esa
    // subcarpeta la haya creado otro, que es lo que pasa en cuanto se
    // comparte con permiso de edición.
    const porPropiedad: PermisoCarpeta = alcance.rutasPropias.some((propia) =>
      estaEnRama(ruta, propia),
    )
      ? 'TOTAL'
      : 'SIN_ACCESO';

    // §25.4, §25.5 y §25.6 son UNA sola resolución, no tres: entre las
    // concesiones que caen en el camino de esta carpeta gana la de la
    // carpeta MÁS PROFUNDA. Eso es el permiso específico cuando la
    // concesión es de la propia carpeta, la herencia de §7 cuando es de un
    // ancestro, y la restricción de §7 cuando la más profunda vale
    // `SIN_ACCESO`. Partirlo en tres pasos habría sido escribir tres veces
    // el mismo recorrido con tres nombres.
    const porConcesion = this.concesionMasProfunda(alcance, ruta);

    return this.maximo(porNivel, porPropiedad, porConcesion);
  }

  /**
   * Entre las concesiones que cubren esta ruta, la de la carpeta más
   * profunda.
   *
   * La profundidad se mide en segmentos de la ruta. No hay empates
   * posibles: `@@unique([usuarioId, carpetaId])` da una fila por carpeta, y
   * todas las candidatas son prefijos del MISMO camino, así que dos no
   * pueden estar al mismo nivel.
   */
  private concesionMasProfunda(alcance: Alcance, ruta: string): PermisoCarpeta {
    let mejor: PermisoCarpeta = 'SIN_ACCESO';
    let profundidadMejor = -1;

    for (const c of alcance.concesiones) {
      if (!estaEnRama(ruta, c.ruta)) continue;
      const profundidad = idsDeRuta(c.ruta).length;
      if (profundidad > profundidadMejor) {
        profundidadMejor = profundidad;
        mejor = c.permiso;
      }
    }

    return mejor;
  }

  // ── Exigir permisos ───────────────────────────────────────────

  /** La carpeta por id. Si no existe, la misma negativa que si no se ve. */
  async carpetaPorId(carpetaId: number): Promise<CarpetaMinima> {
    const carpeta = await this.prisma.carpetaFotos.findUnique({
      where: { id: carpetaId },
      select: {
        id: true,
        nombre: true,
        ruta: true,
        parentId: true,
        cerrada: true,
        actualizadoEn: true,
        // `tipo` y el equipo enlazado viajan con la carpeta desde la Fase 5:
        // quien la abre necesita saber si es un EQUIPO para ofrecer las
        // tareas de §13. Es una columna y un join por FK indexada, y esto se
        // llama una vez por petición —las hijas las carga `conContadores`—.
        tipo: true,
        equipo: { select: { id: true, codigoInterno: true } },
      },
    });
    if (!carpeta) throw new NotFoundException(NO_EXISTE_O_SIN_ACCESO);
    return carpeta;
  }

  /** El permiso efectivo sobre una carpeta concreta, por id. */
  async permisoEfectivo(
    usuario: UsuarioAutenticado,
    carpetaId: number,
  ): Promise<PermisoCarpeta> {
    const carpeta = await this.carpetaPorId(carpetaId);
    return this.permisoSobre(await this.alcanceDe(usuario), carpeta.ruta);
  }

  /**
   * Exige un permiso mínimo sobre una carpeta, o corta.
   *
   * TODA operación del módulo pasa por aquí, y el mínimo se pasa como
   * argumento en vez de haber un método por verbo: la tabla de §5 vive
   * entonces en los call sites, donde se lee al lado de lo que hace la
   * operación, y no duplicada en este archivo.
   *
   * Dos negativas distintas, a propósito:
   *
   *   · No llega ni a VERLA → 404 con el texto de `NO_EXISTE_O_SIN_ACCESO`,
   *     el mismo que si no existiera. No se le confirma que exista.
   *   · La ve pero le falta grado → 403 diciendo qué le falta. Ahí no hay
   *     nada que ocultar y sí algo que explicar.
   *
   * Una operación de ESCRITURA comprueba además que la rama no esté
   * archivada — ni un ADMIN_GLOBAL escribe en una rama cerrada—. Se decide
   * por el mínimo pedido y no por un flag aparte: si exiges EDICION o más,
   * vas a escribir.
   */
  async exigirPermiso(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    minimo: PermisoMinimo,
  ): Promise<CarpetaConPermiso> {
    const carpeta = await this.carpetaPorId(carpetaId);
    return this.exigirSobreCarpeta(
      await this.alcanceDe(usuario),
      carpeta,
      minimo,
    );
  }

  /**
   * Igual que `exigirPermiso`, pero con la carpeta y el alcance YA cargados.
   *
   * Existe para quien va a evaluar además a sus hijas —`NavegacionService`—
   * y ya tiene el `Alcance` en la mano: llamar a `exigirPermiso` lo
   * recargaría, y sobre todo obligaría a repetir los mensajes de negativa en
   * dos sitios, que es como acaban divergiendo.
   */
  async exigirSobreCarpeta(
    alcance: Alcance,
    carpeta: CarpetaMinima,
    minimo: PermisoMinimo,
  ): Promise<CarpetaConPermiso> {
    const permiso = this.permisoSobre(alcance, carpeta.ruta);

    // Ni la ve: se responde como si no existiera.
    if (permiso === 'SIN_ACCESO')
      throw new NotFoundException(NO_EXISTE_O_SIN_ACCESO);

    if (!this.alcanza(permiso, minimo))
      throw new ForbiddenException(this.faltaGrado(carpeta, minimo));

    const ramaCerrada = await this.ramaCerrada(carpeta.ruta);
    if (this.alcanza(minimo, 'EDICION') && ramaCerrada)
      throw new ForbiddenException(
        `"${carpeta.nombre}" está archivada: es de solo lectura. Un administrador de Fotos puede reabrirla.`,
      );

    return { ...carpeta, permiso, ramaCerrada };
  }

  /**
   * Qué grado le falta, para quien SÍ ve la carpeta.
   *
   * Nombra la carpeta y la acción porque a estas alturas el usuario ya sabe
   * que existe: el problema no es que no llegue, es que le suban el grado.
   * Un «no tienes permiso» a secas manda a preguntar.
   */
  private faltaGrado(carpeta: CarpetaMinima, minimo: PermisoMinimo): string {
    const accion =
      minimo === 'TOTAL'
        ? 'administrarla (compartirla, cambiar permisos o eliminarla)'
        : 'modificar su contenido';
    return `Tu acceso a "${carpeta.nombre}" no alcanza para ${accion}.`;
  }

  /**
   * Exige poder OTORGAR un permiso sobre una carpeta (§10, §26.8).
   *
   * Dos reglas, y las dos son de la especificación:
   *
   *   · §5 — administrar colaboradores y cambiar permisos es potestad de
   *     Acceso Total. Un Editor trabaja dentro de la carpeta pero no
   *     reparte llaves. Esto ENDURECE lo que hacía v2, donde cualquier
   *     interno con acceso podía compartir lo que alcanzaba.
   *
   *   · §26.8 — nadie otorga un permiso superior al suyo.
   *
   * Con la primera puesta, la segunda no puede fallar hoy: si exiges TOTAL
   * para llegar aquí, TOTAL es ya el máximo de la escala. Se comprueba
   * igual y a propósito — es la regla que §26.8 enuncia, quien la busque
   * tiene que encontrar código y no un comentario, y es el único candado
   * que queda en pie el día que HVC deje compartir a un Editor.
   */
  async exigirPuedeOtorgar(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    permisoAOtorgar: PermisoCarpeta,
  ): Promise<CarpetaConPermiso> {
    const carpeta = await this.exigirPermiso(usuario, carpetaId, 'TOTAL');

    if (!this.alcanza(carpeta.permiso, permisoAOtorgar))
      throw new ForbiddenException(
        `No puedes otorgar un permiso superior al tuyo sobre "${carpeta.nombre}".`,
      );

    return carpeta;
  }

  // ── Archivado ─────────────────────────────────────────────────

  /**
   * ¿Está archivada esta carpeta o alguna por encima?
   *
   * Se hereda hacia abajo: archivar "Pabellón 1" tiene que impedir subir
   * dentro de "Piso 2", o el archivado no serviría de nada. Una sola
   * consulta sobre los ids que ya vienen en la ruta.
   */
  async ramaCerrada(ruta: string): Promise<boolean> {
    const cerrada = await this.prisma.carpetaFotos.findFirst({
      where: { id: { in: idsDeRuta(ruta) }, cerrada: true },
      select: { id: true },
    });
    return cerrada !== null;
  }

  // ── Filtros para listar ───────────────────────────────────────

  /**
   * Las carpetas que este alcance ve, como condición de Prisma.
   *
   * Se devuelve como `where` para que filtre Postgres. Materializar los
   * ids obligaría a leer el subárbol completo antes de poder consultarlo,
   * y §24 pide justo lo contrario: «las consultas deben filtrar según
   * permisos — no traer todo al frontend para luego ocultarlo».
   *
   * ⚠️ Es un PREFILTRO, no la decisión. Deja pasar las ramas donde el
   * usuario tiene alguna concesión, incluidas las que una restricción más
   * profunda le niega: eso no se puede expresar en un `where` sin
   * reimplementar la cascada en SQL. Quien liste tiene que pasar cada fila
   * por `permisoSobre` después — para eso `Alcance` se carga de una vez.
   */
  prefiltroDeCarpetas(alcance: Alcance) {
    if (alcance.esSuperAdmin || alcance.nivel !== null) return {};

    const rutas = [
      ...alcance.concesiones.map((c) => c.ruta),
      ...alcance.rutasPropias,
    ];
    if (rutas.length === 0) return { id: { in: [] as number[] } };

    return {
      OR: rutas.map((ruta) => ({
        OR: [{ ruta }, { ruta: { startsWith: `${ruta}/` } }],
      })),
    };
  }

  /**
   * Las raíces de "Compartido conmigo" (§8): lo más alto que este usuario
   * alcanza, sin repetir lo que ya cuelga de otra raíz suya.
   *
   * Se calcula sobre el permiso EFECTIVO y no sobre las filas: una carpeta
   * con `SIN_ACCESO` no es raíz de nada, y una subcarpeta rescatada por una
   * concesión más profunda sí lo es aunque su madre esté negada.
   */
  raicesVisibles(alcance: Alcance): string[] {
    const candidatas = [
      ...new Set([
        ...alcance.concesiones.map((c) => c.ruta),
        ...alcance.rutasPropias,
      ]),
    ].filter((ruta) => this.permisoSobre(alcance, ruta) !== 'SIN_ACCESO');

    // Fuera las que ya cuelgan de otra visible: si alcanzas "Lima" y
    // "Lima/Almacén", en la raíz va solo "Lima".
    return candidatas.filter(
      (ruta) =>
        !candidatas.some((otra) => otra !== ruta && estaEnRama(ruta, otra)),
    );
  }

  // ── Fotos ─────────────────────────────────────────────────────

  /**
   * El permiso sobre una FOTO, en sus tres casos (Fase 6).
   *
   * Una foto no tiene `carpetaId` —sería una tercera fuente de verdad que
   * empezaría a mentir al mover un álbum—, así que su carpeta se DEDUCE, y
   * hay tres caminos:
   *
   *   1. cuelga de un álbum → la carpeta del álbum;
   *   2. cuelga de una tarea → la carpeta de la tarea;
   *   3. **ninguno de los dos** → está en la bandeja de §18.
   *
   * El tercero es el que la Fase 5 dejó sin resolver, y la respuesta está en
   * §18: la bandeja es del supervisor que subió las fotos —«toma 50
   * fotografías, las sube masivamente, DESPUÉS puede clasificar»—. Una foto
   * sin clasificar no está en el árbol de carpetas, así que **no hay ningún
   * permiso de carpeta que pueda aplicársele**: su dueño es `subidaPorId` y
   * punto.
   *
   * ⚠️ Y eso incluye al `ADMIN_GLOBAL`, que NO ve la bandeja ajena. No es
   * una excepción a §3.4: ese nivel concede alcance sobre **las carpetas**
   * (§3.2 lo dice con esas palabras), y una foto sin clasificar todavía no
   * está en ninguna. Es material en borrador —lo que alguien fotografió y
   * aún no ha decidido dónde va—, y sale de la bandeja en cuanto se
   * clasifica, momento en el que pasa a regirse por la carpeta como todo lo
   * demás. La alternativa —dejar que el admin husmee 50 fotos sin
   * clasificar— no la pide la especificación y convierte un cajón de trabajo
   * en un expediente.
   *
   * Devuelve la carpeta cuando la hay, y `null` para las de la bandeja: eso
   * es lo que necesita quien tenga que marcar actividad.
   */
  async exigirSobreFoto(
    usuario: UsuarioAutenticado,
    fotoId: number,
    minimo: PermisoMinimo,
  ): Promise<{ carpeta: CarpetaConPermiso | null; enBandeja: boolean }> {
    const foto = await this.prisma.foto.findUnique({
      where: { id: fotoId },
      select: {
        subidaPorId: true,
        album: { select: { carpetaId: true } },
        tarea: { select: { carpetaId: true } },
      },
    });
    if (!foto) throw new NotFoundException(noExisteOSinAcceso('Esa foto'));

    const carpetaId = foto.album?.carpetaId ?? foto.tarea?.carpetaId ?? null;

    if (carpetaId === null) {
      // Bandeja: solo quien la subió, y con el MISMO 404 que si no
      // existiera. Un 403 aquí confirmaría que la foto existe, que es justo
      // lo que el resto del módulo evita.
      if (foto.subidaPorId !== usuario.id)
        throw new NotFoundException(noExisteOSinAcceso('Esa foto'));
      return { carpeta: null, enBandeja: true };
    }

    return {
      carpeta: await this.exigirPermiso(usuario, carpetaId, minimo),
      enBandeja: false,
    };
  }

  // ── Actividad ─────────────────────────────────────────────────

  /**
   * Marca de actividad hacia arriba.
   *
   * `actualizadoEn` es `@updatedAt`, así que solo se movía al editar la
   * propia fila: subir una foto tres niveles más abajo no la tocaba. Se
   * propaga a la carpeta y a TODA su línea de ancestros, cuyos ids ya
   * vienen en la ruta. Son 4-5 filas en una escritura que es rara, frente
   * a un agregado por tarjeta en cada lectura, que es constante.
   */
  async marcarActividad(ruta: string) {
    await this.prisma.carpetaFotos.updateMany({
      where: { id: { in: idsDeRuta(ruta) } },
      data: { actualizadoEn: new Date() },
    });
  }
}
