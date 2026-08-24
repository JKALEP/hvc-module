import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import type { AccionFotos, EntidadFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';

/**
 * La bitácora del módulo Fotos (§23).
 *
 * Tabla y enums propios, no una extensión de `EventoCostos`: aquélla cuelga
 * cada evento de un `Requerimiento` y sus acciones son las del proceso de
 * compra. La FORMA sí se copia de `costos/auditoria`, porque funciona —
 * entidad + acción + valor anterior/nuevo + usuario, con el nombre en texto
 * además de la FK, para que dar de baja una cuenta no vacíe el registro—.
 *
 * Nació en la Fase 4 registrando solo el atajo de §12; la Fase 8 la completó
 * con las trece acciones de §23, sembradas desde los services de las fases
 * 3-7. Se creó entonces, y no un `prisma.eventoFotos.create` suelto en el
 * service del atajo, porque el primer sitio que escribe la bitácora es el
 * que fija su forma.
 *
 * ⚠️ **Registrar NUNCA tumba la operación que se está auditando.** Si el
 * `INSERT` de la bitácora falla, se traga el error y se sigue: un fallo
 * escribiendo el registro de «se subió una foto» no puede deshacer la foto,
 * que ya está en R2. Es la decisión contraria a la de Costos —allí el evento
 * va DENTRO de la misma transacción que el cambio, porque un requerimiento
 * sin su rastro es un problema de auditoría contable—. Aquí el rastro es
 * importante pero el contenido lo es más, y las dos escrituras no comparten
 * transacción de todos modos: la foto ya viajó a un bucket externo.
 */

/** Un evento por escribir. El autor se pasa aparte, una sola vez. */
export interface EventoFotosNuevo {
  /**
   * El hilo de §23: toda la historia de una carpeta en una consulta.
   * Null en lo que no cuelga de ninguna — publicar una plantilla, o crear
   * un equipo desde el atajo.
   */
  carpetaId?: number | null;
  entidad: EntidadFotos;
  entidadId: number;
  accion: AccionFotos;
  campoAfectado?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  descripcion?: string | null;
  /** §23 la pide «si corresponde»: solo en las acciones sensibles. */
  ip?: string | null;
}

@Injectable()
export class AuditoriaFotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  /**
   * Escribe un evento.
   *
   * Guarda el NOMBRE del usuario además de la FK: la FK es `SetNull`
   * —dar de baja una cuenta no puede vaciar la bitácora— y un registro que
   * ya no sabe quién hizo qué no es un registro.
   */
  async registrar(
    usuario: UsuarioAutenticado | null,
    eventos: EventoFotosNuevo | EventoFotosNuevo[],
  ): Promise<void> {
    const lista = Array.isArray(eventos) ? eventos : [eventos];
    if (lista.length === 0) return;

    try {
      await this.prisma.eventoFotos.createMany({
        data: lista.map((evento) => ({
          carpetaId: evento.carpetaId ?? null,
          entidad: evento.entidad,
          entidadId: evento.entidadId,
          accion: evento.accion,
          usuarioId: usuario?.id ?? null,
          usuarioNombre: usuario?.nombre ?? null,
          campoAfectado: evento.campoAfectado ?? null,
          valorAnterior: evento.valorAnterior ?? null,
          valorNuevo: evento.valorNuevo ?? null,
          descripcion: evento.descripcion ?? null,
          ip: evento.ip ?? null,
        })),
      });
    } catch (error) {
      // Ver la nota de la cabecera: la bitácora no tumba la operación.
      console.error('[auditoría Fotos] no se pudo registrar el evento', error);
    }
  }

  /**
   * Un evento por CAMPO que cambió, comparando antes y después.
   *
   * Mismo criterio que `costos/auditoria`: un campo que no aparece en
   * `despues` no se compara, porque los DTO del módulo son parciales y «no
   * lo mandaron» no es «lo vaciaron». Comparar los dos estados es más
   * fiable que deducir el cambio del payload, que no sabe qué había antes.
   */
  diferencias(
    antes: Record<string, string | null>,
    despues: Record<string, string | null>,
    base: Omit<
      EventoFotosNuevo,
      'accion' | 'campoAfectado' | 'valorAnterior' | 'valorNuevo'
    >,
  ): EventoFotosNuevo[] {
    const eventos: EventoFotosNuevo[] = [];

    for (const campo of Object.keys(despues)) {
      const a = antes[campo] ?? null;
      const d = despues[campo] ?? null;
      if (a === d) continue;
      eventos.push({
        ...base,
        accion: 'EDICION',
        campoAfectado: campo,
        valorAnterior: a,
        valorNuevo: d,
      });
    }

    return eventos;
  }

  /**
   * El hilo de una CARPETA (§23): todo lo que le ha pasado a ella y a lo que
   * cuelga de ella.
   *
   * En orden DESCENDENTE, al revés que `deRequerimiento` de Costos: aquello
   * es un relato con principio y fin —se emitió, se cotizó, se aprobó— y
   * esto es una carpeta viva, donde lo que se consulta es «qué ha pasado
   * últimamente».
   */
  async deCarpeta(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    limite = 200,
  ) {
    // ⚠️ Pide LECTURA sobre la carpeta, y no un nivel global, por dos
    // razones. La primera es que el hilo de §23 es para quien trabaja
    // dentro: «¿qué ha pasado aquí últimamente?» es la pregunta del
    // supervisor, no la del administrador.
    //
    // La segunda es la que importa: sin esta línea la bitácora era un
    // CANAL LATERAL que rodeaba la regla central del módulo. Un supervisor
    // recibía 404 «no existe o no tienes acceso» en `GET /fotos/carpeta/152`
    // y, pidiendo `GET /fotos/auditoria/carpeta/152`, leía su historia
    // entera —quién la creó, qué se subió, a quién se le compartió—. Se
    // reprodujo contra la API con una cuenta real antes de escribir esto.
    //
    // Delegando en `exigirPermiso` la negativa vuelve a ser el MISMO 404
    // del resto del módulo, sin escribir aquí un segundo texto que se
    // quedaría corto el día que cambie el otro.
    await this.acceso.exigirPermiso(usuario, carpetaId, 'LECTURA');

    return this.prisma.eventoFotos.findMany({
      where: { carpetaId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: limite,
    });
  }

  /** Lo que le ha pasado a una fila concreta, de lo más reciente hacia atrás. */
  async deEntidad(entidad: EntidadFotos, entidadId: number, limite = 200) {
    return this.prisma.eventoFotos.findMany({
      where: { entidad, entidadId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: limite,
    });
  }

  /**
   * La consulta general de §23, para el administrador.
   *
   * Filtra por usuario, acción y rango de fechas —«quién hizo qué y
   * cuándo», que es la pregunta que §23 dice que HVC necesita contestar—.
   * Pagina por cursor, como la galería: la bitácora solo crece.
   */
  async consultar(
    usuario: UsuarioAutenticado,
    filtros: {
      usuarioId?: number;
      accion?: AccionFotos;
      entidad?: EntidadFotos;
      desde?: string;
      hasta?: string;
      cursor?: number;
      limite?: number;
    },
  ) {
    // La consulta general NO cuelga de ninguna carpeta: barre el módulo
    // entero, así que no hay permiso de carpeta que pueda acotarla y el
    // mínimo tiene que ser un nivel global. ADMIN_GLOBAL y no LECTURA_GLOBAL
    // porque §23 la describe como la herramienta del administrador, es el
    // mismo mínimo que ya exige administrar plantillas en este mismo
    // controller, y es lo que el frontend viene afirmando desde siempre en
    // `esAdminFotos`. Antes no exigía NADA: bastaba tener el módulo.
    if (!this.acceso.tieneNivelMinimo(usuario, 'ADMIN_GLOBAL'))
      throw new ForbiddenException(
        'Solo un administrador de Fotos puede consultar la bitácora del módulo.',
      );

    const limite = Math.min(filtros.limite ?? 50, 200);

    const where = {
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
      ...(filtros.accion ? { accion: filtros.accion } : {}),
      ...(filtros.entidad ? { entidad: filtros.entidad } : {}),
      ...(filtros.desde || filtros.hasta
        ? {
            creadoEn: {
              ...(filtros.desde
                ? { gte: new Date(`${filtros.desde}T00:00:00.000Z`) }
                : {}),
              ...(filtros.hasta
                ? { lte: new Date(`${filtros.hasta}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    };

    const filas = await this.prisma.eventoFotos.findMany({
      where,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: limite + 1,
      ...(filtros.cursor ? { cursor: { id: filtros.cursor }, skip: 1 } : {}),
      include: { carpeta: { select: { id: true, nombre: true } } },
    });

    const hayMas = filas.length > limite;
    const pagina = hayMas ? filas.slice(0, limite) : filas;

    return {
      eventos: pagina,
      siguiente: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }
}
