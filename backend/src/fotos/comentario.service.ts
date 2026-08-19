import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService, noExisteOSinAcceso } from './acceso.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';

/**
 * Dónde se puede comentar.
 *
 * §14 nombra CUATRO —carpeta, equipo, tarea, álbum— y aquí hay tres, y no
 * es un recorte: en este módulo **un equipo ES una carpeta** de
 * `tipo = EQUIPO` (§12), así que comentar un equipo y comentar una carpeta
 * son la misma fila con la misma FK. Inventar una cuarta columna
 * `equipoId` habría dado dos caminos para el mismo comentario y una
 * pregunta sin respuesta: cuál de los dos lee la pantalla del equipo.
 *
 * `foto` entró en la Fase 6, que es lo que §14 marca como OPCIONAL. Su
 * permiso NO se resuelve aquí: lo hace `AccesoService.exigirSobreFoto`,
 * porque una foto tiene tres casos —álbum, tarea y la bandeja de §18, que
 * no cuelga de ninguna carpeta y es solo de quien la subió—. Ese era el
 * cabo que la Fase 5 dejó suelto.
 */
const ENTIDADES = ['carpeta', 'tarea', 'album', 'foto'] as const;
export type EntidadComentable = (typeof ENTIDADES)[number];

const SELECT_COMENTARIO = {
  id: true,
  texto: true,
  autorNombre: true,
  creadoEn: true,
  editadoEn: true,
  carpetaId: true,
  tareaId: true,
  albumId: true,
  fotoId: true,
  autor: { select: { id: true, nombre: true } },
} as const;

/** Máximo del texto. No es un límite de negocio, es un tope de sanidad. */
const MAX_TEXTO = 4000;

/**
 * Los comentarios de §14.
 *
 * UNA tabla con dueño polimórfico y no una por entidad: el comentario es el
 * mismo objeto en los tres sitios, y tres tablas serían tres CRUD idénticos.
 * Que tenga exactamente un dueño lo garantiza el CHECK
 * `comentarios_fotos_un_solo_dueno_chk`; aquí se valida igual para dar el
 * mensaje en español, porque un CHECK habla en inglés y sin contexto.
 *
 * El permiso SIEMPRE se resuelve por la carpeta que contiene a la entidad,
 * con `AccesoService`. Un comentario no tiene permisos propios.
 */
@Injectable()
export class ComentarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
  ) {}

  private validarEntidad(valor: string): EntidadComentable {
    const entidad = (limpiar(valor) ?? '').toLowerCase();
    if (!ENTIDADES.includes(entidad as EntidadComentable))
      throw new BadRequestException(
        `No se puede comentar "${describir(valor)}". Valores permitidos: ${ENTIDADES.join(', ')}.`,
      );
    return entidad as EntidadComentable;
  }

  /**
   * De qué carpeta cuelga la entidad comentada.
   *
   * Es el único punto donde el polimorfismo se resuelve, y por eso todo lo
   * demás —crear, listar, editar, borrar— puede hablar solo de carpetas.
   */
  private async carpetaDe(
    entidad: EntidadComentable,
    entidadId: number,
  ): Promise<number | null> {
    if (entidad === 'carpeta') {
      // No se comprueba que exista: `exigirPermiso` ya lo hace, y con el
      // 404 uniforme que toca. Comprobarlo aquí daría un mensaje distinto
      // para «no existe» y delataría cuáles sí.
      return entidadId;
    }

    if (entidad === 'tarea') {
      const tarea = await this.prisma.tareaFotos.findUnique({
        where: { id: entidadId },
        select: { carpetaId: true },
      });
      if (!tarea) throw new NotFoundException(noExisteOSinAcceso('Esa tarea'));
      return tarea.carpetaId;
    }

    if (entidad === 'album') {
      const album = await this.prisma.albumFotos.findUnique({
        where: { id: entidadId },
        select: { carpetaId: true },
      });
      if (!album) throw new NotFoundException(noExisteOSinAcceso('Ese álbum'));
      return album.carpetaId;
    }

    // `foto` es el único que NO devuelve carpeta: puede no tenerla. Se
    // señaliza con null y quien llama pide el permiso por el otro camino.
    return null;
  }

  /** La columna que toca rellenar, con las otras tres en null. */
  private dueño(entidad: EntidadComentable, entidadId: number) {
    return {
      carpetaId: entidad === 'carpeta' ? entidadId : null,
      tareaId: entidad === 'tarea' ? entidadId : null,
      albumId: entidad === 'album' ? entidadId : null,
      fotoId: entidad === 'foto' ? entidadId : null,
    };
  }

  /**
   * Exige el permiso sobre la entidad comentada, venga de donde venga.
   *
   * Tres de las cuatro se resuelven por su carpeta; `foto` se delega en
   * `AccesoService.exigirSobreFoto`, que sabe además tratar la bandeja de
   * §18 —donde no hay carpeta y manda `subidaPorId`—. Devuelve la ruta para
   * marcar actividad, o null cuando no hay carpeta que marcar.
   */
  private async exigirSobre(
    usuario: UsuarioAutenticado,
    entidad: EntidadComentable,
    entidadId: number,
    minimo: 'LECTURA' | 'EDICION' | 'TOTAL',
  ): Promise<string | null> {
    if (entidad === 'foto') {
      const { carpeta } = await this.acceso.exigirSobreFoto(
        usuario,
        entidadId,
        minimo,
      );
      return carpeta?.ruta ?? null;
    }

    const carpetaId = await this.carpetaDe(entidad, entidadId);
    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      carpetaId!,
      minimo,
    );
    return carpeta.ruta;
  }

  /**
   * Leer comentarios es LECTURA.
   *
   * §14 lo dice del cliente con esas palabras: «podrá visualizar esta
   * información si tiene permiso de lectura».
   */
  async listar(
    usuario: UsuarioAutenticado,
    entidadCruda: string,
    entidadId: number,
  ) {
    const entidad = this.validarEntidad(entidadCruda);
    await this.exigirSobre(usuario, entidad, entidadId, 'LECTURA');

    return this.prisma.comentarioFotos.findMany({
      where: this.dueño(entidad, entidadId),
      select: SELECT_COMENTARIO,
      // Conversación: lo primero arriba.
      orderBy: { creadoEn: 'asc' },
    });
  }

  /**
   * Escribir un comentario exige EDICION, no LECTURA.
   *
   * §14 le concede al cliente VISUALIZAR con permiso de lectura, y nada
   * más. Un comentario es contenido que queda en el expediente de la obra,
   * así que ponerlo es escribir — el mismo escalón que subir una foto.
   */
  async crear(
    usuario: UsuarioAutenticado,
    entidadCruda: string,
    entidadId: number,
    texto: string | null | undefined,
  ) {
    const entidad = this.validarEntidad(entidadCruda);
    const ruta = await this.exigirSobre(usuario, entidad, entidadId, 'EDICION');

    const comentario = await this.prisma.comentarioFotos.create({
      data: {
        ...this.dueño(entidad, entidadId),
        texto: this.validarTexto(texto),
        autorId: usuario.id,
        // Se guarda el nombre ADEMÁS de la FK, igual que en la bitácora:
        // dar de baja una cuenta pone `autorId` a null y un comentario sin
        // firma no dice nada. Es la forma de `EventoFotos`.
        autorNombre: usuario.nombre,
      },
      select: SELECT_COMENTARIO,
    });

    // Una foto de la bandeja no tiene carpeta que marcar.
    if (ruta) await this.acceso.marcarActividad(ruta);
    return comentario;
  }

  private validarTexto(valor: unknown): string {
    const texto = limpiar(valor);
    if (texto === null)
      throw new BadRequestException('El comentario no puede ir vacío.');
    if (texto.length > MAX_TEXTO)
      throw new BadRequestException(
        `El comentario es demasiado largo (${texto.length} caracteres, máximo ${MAX_TEXTO}).`,
      );
    return texto;
  }

  /**
   * El comentario y CÓMO exigir permiso sobre él, sea cual sea su dueño.
   *
   * Devuelve la entidad y su id en vez de una carpeta, porque desde la Fase
   * 6 no todos los dueños tienen una: un comentario sobre una foto de la
   * bandeja de §18 no cuelga de ninguna. Quien llama pasa eso por
   * `exigirSobre`, que es el único que sabe resolver los cuatro casos.
   */
  private async comentarioConDueño(comentarioId: number) {
    const comentario = await this.prisma.comentarioFotos.findUnique({
      where: { id: comentarioId },
      select: {
        id: true,
        autorId: true,
        carpetaId: true,
        tareaId: true,
        albumId: true,
        fotoId: true,
      },
    });
    if (!comentario)
      throw new NotFoundException(noExisteOSinAcceso('Ese comentario'));

    const dueño: { entidad: EntidadComentable; id: number } | null =
      comentario.carpetaId !== null
        ? { entidad: 'carpeta', id: comentario.carpetaId }
        : comentario.tareaId !== null
          ? { entidad: 'tarea', id: comentario.tareaId }
          : comentario.albumId !== null
            ? { entidad: 'album', id: comentario.albumId }
            : comentario.fotoId !== null
              ? { entidad: 'foto', id: comentario.fotoId }
              : null;

    // El CHECK `comentarios_fotos_un_solo_dueno_chk` garantiza que hay
    // exactamente uno, así que esto no puede pasar. Se comprueba porque el
    // tipo lo admite y callarlo sería dejar un `!` que el día que el CHECK
    // cambie miente en silencio.
    if (!dueño)
      throw new NotFoundException(noExisteOSinAcceso('Ese comentario'));

    return { comentario, dueño };
  }

  /**
   * Editar SOLO lo propio. Nadie reescribe lo que dijo otro.
   *
   * No es una cuestión de grado: ni un `ADMIN_GLOBAL` puede, y por eso la
   * comprobación es de autoría y no de permiso. Un comentario firmado que
   * un tercero puede reescribir deja de ser un registro de quién dijo qué,
   * que es justo para lo que §14 pide guardar autor y última modificación.
   * Lo que un administrador sí puede es BORRARLO.
   */
  async editar(
    usuario: UsuarioAutenticado,
    comentarioId: number,
    texto: string | null | undefined,
  ) {
    const { comentario, dueño } = await this.comentarioConDueño(comentarioId);
    const ruta = await this.exigirSobre(
      usuario,
      dueño.entidad,
      dueño.id,
      'EDICION',
    );

    if (comentario.autorId !== usuario.id)
      throw new ForbiddenException(
        'Solo puedes editar tus propios comentarios. Si hace falta retirarlo, elimínalo.',
      );

    const actualizado = await this.prisma.comentarioFotos.update({
      where: { id: comentarioId },
      data: { texto: this.validarTexto(texto), editadoEn: new Date() },
      select: SELECT_COMENTARIO,
    });

    if (ruta) await this.acceso.marcarActividad(ruta);
    return actualizado;
  }

  /**
   * Borrar: el propio con EDICION, el ajeno con TOTAL.
   *
   * Misma distinción que §5 hace con las fotos y que sigue `TareaService`:
   * retirar lo de uno es trabajar, retirar lo de otro es moderar.
   */
  async eliminar(usuario: UsuarioAutenticado, comentarioId: number) {
    const { comentario, dueño } = await this.comentarioConDueño(comentarioId);

    const esPropio = comentario.autorId === usuario.id;
    const ruta = await this.exigirSobre(
      usuario,
      dueño.entidad,
      dueño.id,
      esPropio ? 'EDICION' : 'TOTAL',
    );

    await this.prisma.comentarioFotos.delete({ where: { id: comentarioId } });
    if (ruta) await this.acceso.marcarActividad(ruta);
    return { ok: true, id: comentarioId };
  }
}
