import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { ImagenService, LIMITES } from './imagen.service';
import { AccesoService, noExisteOSinAcceso } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { claveDia, aFechaUTC } from '../common/fechas';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar } from '../common/texto';

/**
 * Fotos y álbumes (§15, §16).
 *
 * Hereda al `LoteService` de v2 —donde cada subida creaba un "lote" que
 * nadie nombraba— y le devuelve el nombre y la descripción que pide §16.
 * El nombre sigue siendo OPCIONAL: la captura rápida de §17 sube desde el
 * celular sin pedir título, y la galería se agrupa por álbum igual.
 * Deducir esa agrupación comparando fecha y texto sería adivinar.
 */

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * A dónde van las fotos de una subida. Los cuatro sitios donde §15-§18
 * admiten que aparezca una foto, y **es una unión y no cuatro parámetros
 * opcionales** a propósito: con `albumId?`, `tareaId?` y `carpetaId?` sueltos
 * existirían combinaciones imposibles —dos destinos a la vez, ninguno— que
 * habría que rechazar a mano en cada rama. Aquí el tipo ya no las admite.
 */
export type DestinoSubida =
  | { tipo: 'carpeta'; carpetaId: number }
  | { tipo: 'album'; albumId: number }
  | { tipo: 'tarea'; tareaId: number }
  | { tipo: 'bandeja' };

/** Cuántos álbumes trae una página de galería. */
const ALBUMES_POR_PAGINA = 12;

/** Tope de la clasificación por lotes de §18, y de la bandeja. */
const LIMITE_LOTE = 200;

/** Lo que se devuelve de un álbum. Nunca la fila cruda. */
const SELECT_ALBUM = {
  id: true,
  carpetaId: true,
  nombre: true,
  descripcion: true,
  fecha: true,
  creadoEn: true,
  creadoPor: { select: { id: true, nombre: true } },
  _count: { select: { fotos: true, comentarios: true } },
} as const;

@Injectable()
export class AlbumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly imagen: ImagenService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  /**
   * Galería de una carpeta, paginada POR ÁLBUM.
   *
   * Paginar álbumes y no fotos acota el resultado solo: un álbum son 10
   * fotos como máximo por definición, así que una página de 12 álbumes
   * nunca pasa de 120 fotos ni de 240 URLs firmadas.
   */
  async galeria(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    opciones: {
      cursor?: number;
      subidaPorId?: number;
      desde?: string;
      hasta?: string;
      anonimo?: boolean;
    } = {},
  ) {
    await this.acceso.exigirPermiso(usuario, carpetaId, 'LECTURA');

    const rango =
      opciones.desde || opciones.hasta
        ? {
            creadoEn: {
              ...(opciones.desde
                ? { gte: new Date(`${opciones.desde}T00:00:00.000Z`) }
                : {}),
              // Hasta el final del día, no su medianoche.
              ...(opciones.hasta
                ? { lte: new Date(`${opciones.hasta}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {};

    const where = {
      carpetaId,
      ...rango,
      ...(opciones.subidaPorId !== undefined
        ? { creadoPorId: opciones.subidaPorId }
        : {}),
    };

    const albumes = await this.prisma.albumFotos.findMany({
      where,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      // Uno de más para saber si queda página siguiente sin contar todo.
      take: ALBUMES_POR_PAGINA + 1,
      ...(opciones.cursor ? { cursor: { id: opciones.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        // `nombre` y `fecha` desde §16: un álbum ya puede tener título, y la
        // galería tiene que enseñarlo. Siguen siendo nullable —la captura
        // rápida sube sin título— y ahí la cabecera cae a la fecha.
        nombre: true,
        fecha: true,
        descripcion: true,
        creadoEn: true,
        creadoPor: { select: { id: true, nombre: true } },
        _count: { select: { comentarios: true } },
        fotos: {
          orderBy: { creadoEn: 'asc' },
          select: {
            id: true,
            claveImagen: true,
            claveMiniatura: true,
            anchoPx: true,
            altoPx: true,
            bytes: true,
            tomadaEn: true,
            creadoEn: true,
            subidaPor: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    const hayMas = albumes.length > ALBUMES_POR_PAGINA;
    const pagina = hayMas ? albumes.slice(0, ALBUMES_POR_PAGINA) : albumes;

    const conUrls = await Promise.all(
      pagina.map(async (l) => ({
        id: l.id,
        nombre: l.nombre,
        fecha: l.fecha ? claveDia(l.fecha) : null,
        descripcion: l.descripcion,
        creadoEn: l.creadoEn,
        comentarios: l._count.comentarios,
        // A un cliente no se le enseña qué persona de HVC subió qué.
        subidoPor: opciones.anonimo ? null : l.creadoPor,
        fotos: await Promise.all(
          l.fotos.map(async (f) => ({
            id: f.id,
            anchoPx: f.anchoPx,
            altoPx: f.altoPx,
            bytes: f.bytes,
            tomadaEn: f.tomadaEn ? claveDia(f.tomadaEn) : null,
            creadoEn: f.creadoEn,
            subidaPor: opciones.anonimo ? null : f.subidaPor,
            url: await this.almacenamiento.urlFirmada(f.claveImagen),
            urlMiniatura: await this.almacenamiento.urlFirmada(
              f.claveMiniatura,
            ),
          })),
        ),
      })),
    );

    return {
      albumes: conUrls,
      // Cursor para la siguiente página; null cuando ya no queda nada.
      siguiente: hayMas ? pagina[pagina.length - 1].id : null,
      totalFotos: await this.prisma.foto.count({ where: { album: where } }),
    };
  }

  /** Quiénes han publicado en esta carpeta, para el filtro. */
  async autores(usuario: UsuarioAutenticado, carpetaId: number) {
    await this.acceso.exigirPermiso(usuario, carpetaId, 'LECTURA');

    const filas = await this.prisma.albumFotos.groupBy({
      by: ['creadoPorId'],
      where: { carpetaId },
      _count: { _all: true },
    });
    if (filas.length === 0) return [];

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: filas.map((f) => f.creadoPorId) } },
      select: { id: true, nombre: true },
    });
    const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));

    return filas
      .map((f) => ({
        usuarioId: f.creadoPorId,
        nombre: nombres.get(f.creadoPorId) ?? '—',
        albumes: f._count._all,
      }))
      .sort((a, b) => b.albumes - a.albumes);
  }

  /**
   * Traduce un destino a «dónde cuelga la foto» y exige el permiso.
   *
   * Los cuatro casos acaban en lo mismo: un `albumId` o un `tareaId` con los
   * que crear la fila, y la `ruta` de la carpeta para marcar actividad. La
   * bandeja de §18 es el único que no tiene carpeta, y por eso `ruta` es
   * nullable.
   */
  private async resolverDestino(
    usuario: UsuarioAutenticado,
    destino: DestinoSubida,
  ): Promise<{
    crearAlbum: boolean;
    carpetaId?: number;
    albumId?: number;
    tareaId?: number;
    ruta: string | null;
  }> {
    if (destino.tipo === 'bandeja') {
      // Sin carpeta no hay permiso de carpeta que pedir: la bandeja es de
      // quien sube, y cualquiera con el módulo puede tener la suya (§17).
      return { crearAlbum: false, ruta: null };
    }

    if (destino.tipo === 'carpeta') {
      const carpeta = await this.acceso.exigirPermiso(
        usuario,
        destino.carpetaId,
        'EDICION',
      );
      return {
        crearAlbum: true,
        carpetaId: destino.carpetaId,
        ruta: carpeta.ruta,
      };
    }

    if (destino.tipo === 'album') {
      const album = await this.prisma.albumFotos.findUnique({
        where: { id: destino.albumId },
        select: { id: true, carpetaId: true },
      });
      if (!album) throw new NotFoundException(noExisteOSinAcceso('Ese álbum'));
      const carpeta = await this.acceso.exigirPermiso(
        usuario,
        album.carpetaId,
        'EDICION',
      );
      return { crearAlbum: false, albumId: album.id, ruta: carpeta.ruta };
    }

    const tarea = await this.prisma.tareaFotos.findUnique({
      where: { id: destino.tareaId },
      select: { id: true, carpetaId: true },
    });
    if (!tarea) throw new NotFoundException(noExisteOSinAcceso('Esa tarea'));
    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      tarea.carpetaId,
      'EDICION',
    );
    return { crearAlbum: false, tareaId: tarea.id, ruta: carpeta.ruta };
  }

  /**
   * Crea un álbum vacío con nombre (§16).
   *
   * Existe además de la subida porque §16 pide el álbum como un tipo de
   * contenido —«Equipo ABC → Álbum "Estado inicial"»—, no como el efecto
   * secundario de arrastrar fotos. Se puede crear primero y llenarlo
   * después, que es como se trabaja cuando la estructura se planea antes de
   * ir a obra.
   *
   * El nombre sigue siendo OPCIONAL en el modelo por la captura rápida de
   * §17, pero por ESTA puerta se exige: quien abre «Nuevo álbum» y no
   * escribe nada está creando un álbum que no sabrá distinguir luego.
   */
  async crearAlbum(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    dto: {
      nombre?: string | null;
      descripcion?: string | null;
      fecha?: string | null;
    },
  ) {
    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      carpetaId,
      'EDICION',
    );

    const nombre = limpiar(dto.nombre);
    if (nombre === null)
      throw new BadRequestException('El álbum necesita un nombre.');

    const album = await this.prisma.albumFotos.create({
      data: {
        carpetaId,
        nombre,
        descripcion: limpiar(dto.descripcion),
        fecha: dto.fecha ? aFechaUTC(dto.fecha, 'La fecha del álbum') : null,
        creadoPorId: usuario.id,
      },
      select: SELECT_ALBUM,
    });

    await this.acceso.marcarActividad(carpeta.ruta);

    // §23, acción 7 de 13.
    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'ALBUM',
      entidadId: album.id,
      accion: 'CREACION',
      descripcion: `Creó el álbum "${album.nombre ?? 'sin título'}".`,
    });
    return album;
  }

  /** Renombrar o redescribir un álbum. Los campos que no llegan no se tocan. */
  async editarAlbum(
    usuario: UsuarioAutenticado,
    albumId: number,
    dto: {
      nombre?: string | null;
      descripcion?: string | null;
      fecha?: string | null;
    },
  ) {
    const album = await this.prisma.albumFotos.findUnique({
      where: { id: albumId },
      select: { carpetaId: true },
    });
    if (!album) throw new NotFoundException(noExisteOSinAcceso('Ese álbum'));

    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      album.carpetaId,
      'EDICION',
    );

    const datos: Record<string, unknown> = {};
    // Aquí el nombre SÍ puede vaciarse: un álbum nacido de la captura
    // rápida no tiene, y quitarle el que se le puso es volver a ese estado.
    if ('nombre' in dto) datos.nombre = limpiar(dto.nombre);
    if ('descripcion' in dto) datos.descripcion = limpiar(dto.descripcion);
    if ('fecha' in dto)
      datos.fecha = dto.fecha
        ? aFechaUTC(dto.fecha, 'La fecha del álbum')
        : null;

    const actualizado = await this.prisma.albumFotos.update({
      where: { id: albumId },
      data: datos,
      select: SELECT_ALBUM,
    });

    await this.acceso.marcarActividad(carpeta.ruta);
    return actualizado;
  }

  /**
   * La bandeja de §18: lo que subí y todavía no he clasificado.
   *
   * Es SIEMPRE la del usuario que pregunta —no recibe un id de nadie—,
   * porque una foto sin clasificar no está en el árbol y no hay permiso de
   * carpeta que pueda dar acceso a ella. Ver `AccesoService.exigirSobreFoto`
   * para el porqué completo, incluido por qué tampoco la ve un ADMIN_GLOBAL.
   */
  async bandeja(usuario: UsuarioAutenticado) {
    const fotos = await this.prisma.foto.findMany({
      where: { subidaPorId: usuario.id, albumId: null, tareaId: null },
      orderBy: { creadoEn: 'desc' },
      take: LIMITE_LOTE,
      select: {
        id: true,
        descripcion: true,
        anchoPx: true,
        altoPx: true,
        bytes: true,
        tomadaEn: true,
        creadoEn: true,
        claveImagen: true,
        claveMiniatura: true,
      },
    });

    return {
      total: await this.prisma.foto.count({
        where: { subidaPorId: usuario.id, albumId: null, tareaId: null },
      }),
      fotos: await Promise.all(
        fotos.map(async (f) => ({
          id: f.id,
          descripcion: f.descripcion,
          anchoPx: f.anchoPx,
          altoPx: f.altoPx,
          bytes: f.bytes,
          tomadaEn: f.tomadaEn ? claveDia(f.tomadaEn) : null,
          creadoEn: f.creadoEn,
          url: await this.almacenamiento.urlFirmada(f.claveImagen),
          urlMiniatura: await this.almacenamiento.urlFirmada(f.claveMiniatura),
        })),
      ),
    };
  }

  /**
   * Clasificar por lotes (§18): «20 fotos → Equipo ABC → Tarea Inspección».
   *
   * Solo mueve fotos que estén EN LA BANDEJA DE QUIEN LLAMA. Se comprueba
   * con un `where` que ya incluye `subidaPorId`, así que una foto ajena o ya
   * clasificada sencillamente no entra en el update — no hace falta un
   * bucle que las vaya rechazando de una en una.
   *
   * Los objetos de R2 NO se mueven: la clave se guarda por foto, y copiar y
   * borrar en el bucket 50 objetos para que el prefijo quede bonito sería
   * gastar red y arriesgar huérfanos a cambio de nada.
   */
  async clasificar(
    usuario: UsuarioAutenticado,
    fotoIds: number[],
    destino: DestinoSubida,
  ) {
    if (!Array.isArray(fotoIds) || fotoIds.length === 0)
      throw new BadRequestException('No se indicó ninguna foto.');
    if (fotoIds.length > LIMITE_LOTE)
      throw new BadRequestException(
        `Máximo ${LIMITE_LOTE} fotos por lote. Recibidas: ${fotoIds.length}.`,
      );
    if (destino.tipo === 'bandeja')
      throw new BadRequestException(
        'Clasificar es sacar las fotos de la bandeja, no devolverlas a ella.',
      );

    const resuelto = await this.resolverDestino(usuario, destino);

    // Un destino de tipo `carpeta` crea aquí el álbum que las recoge, igual
    // que lo haría una subida directa.
    const albumId =
      resuelto.albumId ??
      (resuelto.crearAlbum
        ? (
            await this.prisma.albumFotos.create({
              data: {
                carpetaId: resuelto.carpetaId!,
                creadoPorId: usuario.id,
              },
              select: { id: true },
            })
          ).id
        : null);

    const movidas = await this.prisma.foto.updateMany({
      where: {
        id: { in: fotoIds },
        subidaPorId: usuario.id,
        albumId: null,
        tareaId: null,
      },
      data: { albumId, tareaId: resuelto.tareaId ?? null },
    });

    // Si no se movió ninguna, el álbum recién creado se queda vacío y sin
    // sentido: se retira, igual que hace `subir` cuando todo falla.
    if (movidas.count === 0) {
      if (resuelto.crearAlbum && albumId !== null)
        await this.prisma.albumFotos.delete({ where: { id: albumId } });
      throw new BadRequestException(
        'Ninguna de esas fotos está en tu bandeja. ¿Ya se clasificaron?',
      );
    }

    if (resuelto.ruta) await this.acceso.marcarActividad(resuelto.ruta);
    return {
      clasificadas: movidas.count,
      albumId,
      tareaId: resuelto.tareaId ?? null,
    };
  }

  /**
   * Sube fotos a una carpeta. Crea el álbum solo.
   *
   * Cada archivo se procesa por separado: si uno falla, los anteriores se
   * conservan. Es lo correcto para una subida desde obra con mala señal.
   */
  async subir(
    usuario: UsuarioAutenticado,
    destino: DestinoSubida,
    archivos: ArchivoSubido[],
    descripcion?: string | null,
  ) {
    // Dónde aterrizan las fotos y qué permiso hace falta se resuelve ANTES
    // de tocar un solo byte: procesar diez imágenes para descubrir al final
    // que no se podía escribir sería gastar CPU y R2 para nada.
    const resuelto = await this.resolverDestino(usuario, destino);

    if (!archivos || archivos.length === 0)
      throw new BadRequestException('No se recibió ninguna imagen.');
    if (archivos.length > LIMITES.fotosPorSubida)
      throw new BadRequestException(
        `Máximo ${LIMITES.fotosPorSubida} fotos por subida. Recibidas: ${archivos.length}.`,
      );
    if (!this.almacenamiento.configurado)
      throw new BadRequestException(
        'El almacenamiento de fotos no está configurado en el servidor. Avisa al administrador.',
      );

    const texto = limpiar(descripcion);
    const guardadas: { id: number; bytes: number; bytesOriginal: number }[] =
      [];
    const fallidas: { archivo: string; motivo: string }[] = [];

    // El álbum se crea antes de procesar: si todo falla se borra al final.
    // Solo cuando el destino es una carpeta —los otros tres ya tienen dónde
    // colgar la foto, y crear un álbum vacío para ellos sería inventarse una
    // agrupación que nadie pidió.
    const album =
      resuelto.crearAlbum === true
        ? await this.prisma.albumFotos.create({
            data: {
              carpetaId: resuelto.carpetaId!,
              descripcion: texto,
              creadoPorId: usuario.id,
            },
            select: { id: true },
          })
        : null;

    const albumId = album?.id ?? resuelto.albumId ?? null;
    const tareaId = resuelto.tareaId ?? null;

    // La clave en R2 se agrupa por álbum. Sin álbum —tarea o bandeja— se
    // agrupa por quien subió: el bucket sigue siendo navegable y una foto
    // NO cambia de clave al clasificarse después (§18), que es lo que
    // importa —mover el objeto obligaría a copiar y borrar en R2 por cada
    // foto de un lote de 50—.
    const grupo = albumId !== null ? albumId : `u${usuario.id}`;

    for (const archivo of archivos) {
      try {
        const procesada = await this.imagen.procesar(archivo);

        // Nombre aleatorio: el original puede repetirse ("IMG_0001.jpg"
        // en diez móviles distintos) y traer caracteres raros.
        const base = `${Date.now()}-${randomUUID()}.webp`;
        const claveImagen = this.almacenamiento.construirClave(
          grupo,
          base,
          'img',
        );
        const claveMiniatura = this.almacenamiento.construirClave(
          grupo,
          base,
          'thumb',
        );

        await this.almacenamiento.subir(
          claveImagen,
          procesada.imagen,
          'image/webp',
        );
        await this.almacenamiento.subir(
          claveMiniatura,
          procesada.miniatura,
          'image/webp',
        );

        const foto = await this.prisma.foto.create({
          data: {
            albumId,
            tareaId,
            descripcion: texto,
            subidaPorId: usuario.id,
            claveImagen,
            claveMiniatura,
            anchoPx: procesada.anchoPx,
            altoPx: procesada.altoPx,
            bytes: procesada.bytes,
            bytesOriginal: procesada.bytesOriginal,
            formato: procesada.formato,
            tomadaEn: procesada.tomadaEn,
          },
          select: { id: true, bytes: true, bytesOriginal: true },
        });
        guardadas.push(foto);
      } catch (error) {
        fallidas.push({
          archivo: archivo.originalname,
          motivo: error instanceof Error ? error.message : 'Error desconocido.',
        });
      }
    }

    if (guardadas.length === 0) {
      // Un álbum sin fotos no significa nada: no se deja el rastro. Solo se
      // borra el que ESTA subida creó — a un álbum que ya existía no se le
      // toca porque una subida posterior fallara.
      if (album)
        await this.prisma.albumFotos.delete({ where: { id: album.id } });
      throw new BadRequestException(
        `No se pudo subir ninguna foto. ${fallidas.map((f) => `${f.archivo}: ${f.motivo}`).join(' · ')}`,
      );
    }

    // La carpeta y toda su línea de ancestros marcan actividad, para que
    // "Actualizado hoy" sea cierto también dos niveles más arriba. La
    // bandeja no tiene carpeta que marcar (§18).
    if (resuelto.ruta) await this.acceso.marcarActividad(resuelto.ruta);

    // §23, acción 5. UN evento por subida y no uno por foto: subir diez
    // fotos es un acto, y diez filas idénticas ahogarían la bitácora.
    await this.auditoria.registrar(usuario, {
      carpetaId: resuelto.carpetaId ?? null,
      entidad: 'FOTO',
      // Sin álbum ni tarea —la bandeja— no hay id de contenedor: se usa el
      // de la primera foto, que es lo único que identifica la subida.
      entidadId: albumId ?? tareaId ?? guardadas[0].id,
      accion: 'SUBIDA_FOTO',
      descripcion: `Subió ${guardadas.length} foto(s)${
        destino.tipo === 'bandeja' ? ' sin asignar' : ''
      }.`,
    });

    return {
      albumId,
      tareaId,
      enBandeja: destino.tipo === 'bandeja',
      subidas: guardadas.length,
      fallidas,
      bytesGuardados: guardadas.reduce((a, f) => a + f.bytes, 0),
      bytesOriginales: guardadas.reduce((a, f) => a + f.bytesOriginal, 0),
    };
  }

  /** URL de descarga: el navegador la guarda en vez de abrirla. */
  async urlDeDescarga(usuario: UsuarioAutenticado, fotoId: number) {
    const foto = await this.buscarConAcceso(usuario, fotoId);

    // Sin carpeta —una foto de la bandeja— el nombre lo abre «Sin
    // clasificar»: descargarla debe seguir funcionando, es SUYA.
    const donde = foto.carpeta?.nombre ?? 'Sin clasificar';
    const nombre = `${donde} - ${claveDia(foto.creadoEn)} - ${foto.id}.webp`;
    return {
      url: await this.almacenamiento.urlDeDescarga(foto.claveImagen, nombre),
      nombreArchivo: nombre,
    };
  }

  /**
   * La foto, con el permiso ya exigido y su carpeta si la tiene.
   *
   * Los tres casos —álbum, tarea y bandeja— los resuelve
   * `AccesoService.exigirSobreFoto`, que es el único sitio que sabe qué
   * significa cada uno. Aquí solo se recuperan los campos que hacen falta
   * para servirla o borrarla.
   */
  private async buscarConAcceso(
    usuario: UsuarioAutenticado,
    fotoId: number,
    minimo: 'LECTURA' | 'EDICION' | 'TOTAL' = 'LECTURA',
  ) {
    const { carpeta, enBandeja } = await this.acceso.exigirSobreFoto(
      usuario,
      fotoId,
      minimo,
    );

    const foto = await this.prisma.foto.findUnique({
      where: { id: fotoId },
      select: {
        id: true,
        subidaPorId: true,
        claveImagen: true,
        claveMiniatura: true,
        creadoEn: true,
        albumId: true,
        tareaId: true,
      },
    });
    if (!foto) throw new NotFoundException(noExisteOSinAcceso('Esa foto'));

    return { ...foto, carpeta, enBandeja };
  }

  /**
   * Borra una foto: quien la subió, o quien tiene TOTAL en la carpeta.
   *
   * El autor puede borrar la suya con EDICION —es su aportación—, pero
   * borrar la de otro es administrar la carpeta, y §5 eso se lo da a Acceso
   * Total. La distinción importa porque borrar no tiene confirmación ni
   * papelera y las fotos de obra son el registro histórico: un Editor no
   * debe poder vaciar lo que subió el equipo.
   *
   * Primero la fila y luego los objetos: si R2 falla queda un huérfano en
   * el log —que recoge `scripts/limpiar-r2-huerfanos.cjs`—, no una foto
   * fantasma en la galería.
   */
  async eliminar(usuario: UsuarioAutenticado, fotoId: number) {
    // El autor necesita EDICION; cualquier otro, TOTAL. Las dos ramas pasan
    // por `exigirSobreFoto`, así que las dos comprueban además que la rama
    // no esté archivada: en un proyecto cerrado no se borra nada.
    //
    // Para saber si es el autor hace falta la fila, y para leer la fila hace
    // falta permiso: se pide LECTURA primero —que en la bandeja ya exige ser
    // el dueño— y se vuelve a exigir con el mínimo real.
    const previa = await this.buscarConAcceso(usuario, fotoId);
    const esAutor = previa.subidaPorId === usuario.id;

    const foto = previa.enBandeja
      ? previa
      : await this.buscarConAcceso(
          usuario,
          fotoId,
          esAutor ? 'EDICION' : 'TOTAL',
        );

    await this.prisma.foto.delete({ where: { id: fotoId } });
    await this.almacenamiento.borrar([foto.claveImagen, foto.claveMiniatura]);

    // Si el álbum se queda vacío deja de tener sentido.
    //
    // `albumId` es nullable —una foto de la bandeja de §18 no cuelga de
    // ninguno, y una de tarea tampoco—, así que hay que preguntarlo.
    const albumId = foto.albumId;
    let albumVacio = false;
    if (albumId !== null) {
      const quedan = await this.prisma.foto.count({ where: { albumId } });
      if (quedan === 0) {
        await this.prisma.albumFotos.delete({ where: { id: albumId } });
        albumVacio = true;
      }
    }

    if (foto.carpeta) await this.acceso.marcarActividad(foto.carpeta.ruta);

    // §23, acción 6. Se registra también la de la bandeja, que no tiene
    // carpeta: `carpetaId` en null y el hecho igualmente anotado.
    await this.auditoria.registrar(usuario, {
      carpetaId: foto.carpeta?.id ?? null,
      entidad: 'FOTO',
      entidadId: fotoId,
      accion: 'ELIMINACION',
      descripcion: esAutor
        ? 'Eliminó una foto suya.'
        : 'Eliminó una foto de otro usuario.',
    });
    return { ok: true, id: fotoId, albumVacio };
  }
}
