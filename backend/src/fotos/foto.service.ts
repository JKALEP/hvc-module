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
import { IntervencionService } from './intervencion.service';
import { claveDia } from '../common/fechas';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import type {
  TipoEvidenciaFotos,
  MomentoEvidenciaFotos,
} from '../../generated/prisma/enums';

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
 * A dónde van las fotos de una subida.
 *
 * Los TRES sitios donde puede estar una foto desde la Fase 4: suelta en la
 * intervención, como evidencia de una actividad, o sin clasificar en la bandeja de
 * §18. Los destinos `carpeta` y `album` se retiraron con los álbumes.
 *
 * **Es una unión y no parámetros opcionales** a propósito: con `intervencionId?` y
 * `actividadId?` sueltos existirían combinaciones imposibles —dos destinos a
 * la vez, ninguno— que habría que rechazar a mano en cada rama. Aquí el tipo
 * ya no las admite, y el CHECK de la base dice lo mismo.
 */
export type DestinoSubida =
  | { tipo: 'intervencion'; intervencionId: number }
  | { tipo: 'actividad'; actividadId: number }
  | { tipo: 'bandeja' };

/** Cuántas fotos trae una página de galería. */
const FOTOS_POR_PAGINA = 24;

/** Tope de la clasificación por lotes de §18, y de la bandeja. */
const LIMITE_LOTE = 200;

@Injectable()
export class FotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly imagen: ImagenService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
    private readonly intervenciones: IntervencionService,
  ) {}

  /**
   * Galería de una carpeta, paginada POR ÁLBUM.
   *
   * Paginar álbumes y no fotos acota el resultado solo: un álbum son 10
   * fotos como máximo por definición, así que una página de 12 álbumes
   * nunca pasa de 120 fotos ni de 240 URLs firmadas.
   */
  /**
   * Las fotos SUELTAS de una intervención, paginadas (Fase 4).
   *
   * ⚠️ Antes esto paginaba ÁLBUMES y devolvía sus fotos anidadas. Con los
   * álbumes retirados el agrupador es la intervención, así que la galería es una
   * lista plana de fotos con cursor por id. Se gana lo que costaba el nivel
   * de más: una foto se busca por su fecha o por quién la subió, no por en
   * qué tanda entró.
   *
   * Solo las de la INTERVENCIÓN: la evidencia de una actividad se ve en su actividad
   * (§15), donde el antes y el después significan algo. Mezclarlas aquí
   * volvería a juntar dos cosas que la Fase 3 acaba de separar.
   */
  async galeria(
    usuario: UsuarioAutenticado,
    intervencionId: number,
    opciones: {
      cursor?: number;
      subidaPorId?: number;
      desde?: string;
      hasta?: string;
      anonimo?: boolean;
    } = {},
  ) {
    // `exigirIntervencion` resuelve la carpeta y exige LECTURA sobre ella: la
    // negativa es el 404 uniforme del módulo, escrito en un solo sitio.
    await this.intervenciones.exigirIntervencion(
      usuario,
      intervencionId,
      'LECTURA',
    );

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
      intervencionId,
      ...rango,
      ...(opciones.subidaPorId !== undefined
        ? { subidaPorId: opciones.subidaPorId }
        : {}),
    };

    const filas = await this.prisma.foto.findMany({
      where,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      // Una de más para saber si queda página siguiente sin contar todo.
      take: FOTOS_POR_PAGINA + 1,
      ...(opciones.cursor ? { cursor: { id: opciones.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        claveImagen: true,
        claveMiniatura: true,
        anchoPx: true,
        altoPx: true,
        bytes: true,
        tomadaEn: true,
        creadoEn: true,
        descripcion: true,
        subidaPor: { select: { id: true, nombre: true } },
        _count: { select: { comentarios: true } },
      },
    });

    const hayMas = filas.length > FOTOS_POR_PAGINA;
    const pagina = hayMas ? filas.slice(0, FOTOS_POR_PAGINA) : filas;

    const fotos = await Promise.all(
      pagina.map(async (f) => ({
        id: f.id,
        anchoPx: f.anchoPx,
        altoPx: f.altoPx,
        bytes: f.bytes,
        tomadaEn: f.tomadaEn ? claveDia(f.tomadaEn) : null,
        creadoEn: f.creadoEn,
        descripcion: f.descripcion,
        comentarios: f._count.comentarios,
        // A un cliente no se le enseña qué persona de HVC subió qué.
        subidaPor: opciones.anonimo ? null : f.subidaPor,
        url: await this.almacenamiento.urlFirmada(f.claveImagen),
        urlMiniatura: await this.almacenamiento.urlFirmada(f.claveMiniatura),
      })),
    );

    return {
      fotos,
      // Cursor para la siguiente página; null cuando ya no queda nada.
      siguiente: hayMas ? pagina[pagina.length - 1].id : null,
      totalFotos: await this.prisma.foto.count({ where }),
    };
  }

  /** Quiénes han subido fotos a esta intervención, para el filtro. */
  async autores(usuario: UsuarioAutenticado, intervencionId: number) {
    await this.intervenciones.exigirIntervencion(
      usuario,
      intervencionId,
      'LECTURA',
    );

    const filas = await this.prisma.foto.groupBy({
      by: ['subidaPorId'],
      where: { intervencionId },
      _count: { _all: true },
    });
    if (filas.length === 0) return [];

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: filas.map((f) => f.subidaPorId) } },
      select: { id: true, nombre: true },
    });
    const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));

    return filas
      .map((f) => ({
        usuarioId: f.subidaPorId,
        nombre: nombres.get(f.subidaPorId) ?? '—',
        fotos: f._count._all,
      }))
      .sort((a, b) => b.fotos - a.fotos);
  }

  /**
   * Valida el hueco del antes/después contra lo que espera la actividad.
   *
   * ⚠️ Tres reglas, y cada una responde a una manera distinta de
   * equivocarse:
   *
   *  - **Un momento fuera de una actividad se rechaza.** Una foto de álbum o
   *    de la bandeja no tiene antes ni después, y el CHECK de la base lo
   *    impide igual; esto es solo para decirlo en español.
   *  - **Una actividad de tipo ANTES_DESPUES EXIGE el momento.** Sin él, la
   *    foto entra sin hueco y la actividad sigue diciendo que le falta el
   *    antes — un silencio que parece un fallo de la app.
   *  - **Las de tipo UNA y NINGUNA lo rechazan**: no hay dos huecos que
   *    distinguir, así que un momento ahí solo puede ser un cliente
   *    desactualizado.
   */
  private momentoValido(
    valor: unknown,
    resuelto: { actividadId?: number; evidencia?: TipoEvidenciaFotos },
  ): MomentoEvidenciaFotos | null {
    const texto = limpiar(valor)?.toUpperCase() ?? null;

    if (resuelto.actividadId === undefined) {
      if (texto !== null)
        throw new BadRequestException(
          'El antes/después solo tiene sentido en la foto de una actividad.',
        );
      return null;
    }

    if (resuelto.evidencia === 'ANTES_DESPUES') {
      if (texto === null)
        throw new BadRequestException(
          'Esta actividad pide un antes y un después: indica cuál de los dos es.',
        );
      if (texto !== 'ANTES' && texto !== 'DESPUES')
        throw new BadRequestException(
          `Momento inválido: "${describir(valor)}". Valores permitidos: ANTES, DESPUES.`,
        );
      return texto;
    }

    if (texto !== null)
      throw new BadRequestException(
        'Esta actividad no pide un antes y un después, así que la foto no lleva momento.',
      );
    return null;
  }

  /**
   * Traduce un destino a «dónde cuelga la foto» y exige el permiso.
   *
   * Los tres casos acaban en lo mismo: un `intervencionId` o un `actividadId` con el
   * que crear la fila, y la `ruta` de la carpeta para marcar actividad. La
   * bandeja de §18 es el único que no tiene carpeta, y por eso `ruta` es
   * nullable.
   *
   * ⚠️ Los dos destinos de álbum —`carpeta`, que creaba uno, y `album`, que
   * añadía a uno existente— se retiraron en la Fase 4. Con ellos se fue el
   * `crearAlbum` que devolvía esta función y que obligaba a `subir` a
   * inventar una fila antes de procesar el primer byte.
   */
  private async resolverDestino(
    usuario: UsuarioAutenticado,
    destino: DestinoSubida,
  ): Promise<{
    intervencionId?: number;
    actividadId?: number;
    /** La carpeta a la que pertenece el destino. Solo para la bitácora. */
    carpetaId?: number;
    /** Qué evidencia espera la actividad de destino (Fase 3), si es una. */
    evidencia?: TipoEvidenciaFotos;
    ruta: string | null;
  }> {
    if (destino.tipo === 'bandeja') {
      // Sin carpeta no hay permiso de carpeta que pedir: la bandeja es de
      // quien sube, y cualquiera con el módulo puede tener la suya (§17).
      return { ruta: null };
    }

    if (destino.tipo === 'intervencion') {
      // `exigirIntervencion` pide EDICION sobre la carpeta y contesta el 404
      // uniforme si no se ve; `exigirAbierto` es el otro candado, el del
      // historial: en una intervención cerrada no entra una foto nueva.
      const intervencion = await this.intervenciones.exigirIntervencion(
        usuario,
        destino.intervencionId,
        'EDICION',
      );
      this.exigirIntervencionAbiertaParaFotos(intervencion);
      return {
        intervencionId: intervencion.id,
        carpetaId: intervencion.carpetaId,
        ruta: intervencion.carpeta.ruta,
      };
    }

    const actividad = await this.prisma.actividadFotos.findUnique({
      where: { id: destino.actividadId },
      select: {
        id: true,
        evidencia: true,
        // ⚠️ Y la intervención, para no dejar subir fotos a una intervención ya cerrada:
        // el permiso dice quién eres, esto dice si esa intervención sigue viva.
        intervencion: {
          select: { numero: true, cerradoEn: true, carpetaId: true },
        },
      },
    });
    if (!actividad)
      throw new NotFoundException(noExisteOSinAcceso('Esa actividad'));
    this.exigirIntervencionAbiertaParaFotos(actividad.intervencion);
    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      actividad.intervencion.carpetaId,
      'EDICION',
    );
    return {
      actividadId: actividad.id,
      evidencia: actividad.evidencia,
      carpetaId: actividad.intervencion.carpetaId,
      ruta: carpeta.ruta,
    };
  }

  /**
   * En una intervención cerrada no entran fotos nuevas.
   *
   * Mensaje propio y no el de `IntervencionService.exigirAbierto` porque aquí lo que
   * se está intentando es SUBIR, y decirlo con esas palabras evita que quien
   * lo lee busque qué «cambio» hizo.
   */
  private exigirIntervencionAbiertaParaFotos(intervencion: {
    numero: number;
    cerradoEn: Date | null;
  }) {
    if (intervencion.cerradoEn)
      throw new BadRequestException(
        `La intervención ${intervencion.numero} está cerrada y no admite fotos nuevas. ` +
          'Si hay que corregir algo, reábrelo primero: queda registrado.',
      );
  }

  async bandeja(usuario: UsuarioAutenticado) {
    const fotos = await this.prisma.foto.findMany({
      where: {
        subidaPorId: usuario.id,
        intervencionId: null,
        actividadId: null,
      },
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
        where: {
          subidaPorId: usuario.id,
          intervencionId: null,
          actividadId: null,
        },
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
   * Clasificar por lotes (§18): «20 fotos → Equipo ABC → Actividad Inspección».
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

    // ⚠️ Ya no se crea nada al clasificar. Cuando el destino era una CARPETA
    // había que inventar un álbum aquí —con su nombre, su descripción, y el
    // borrado de cortesía si el lote acababa vacío—; con los álbumes
    // retirados el destino ya existe siempre: una intervención o una actividad.
    //
    // Sigue siendo un `updateMany` con `subidaPorId` en el `where` y no un
    // bucle que valide foto a foto: una foto ajena o ya clasificada
    // sencillamente no entra en el update.
    const movidas = await this.prisma.foto.updateMany({
      where: {
        id: { in: fotoIds },
        subidaPorId: usuario.id,
        intervencionId: null,
        actividadId: null,
      },
      data: {
        intervencionId: resuelto.intervencionId ?? null,
        actividadId: resuelto.actividadId ?? null,
      },
    });

    if (movidas.count === 0)
      throw new BadRequestException(
        'Ninguna de esas fotos está en tu bandeja. ¿Ya se clasificaron?',
      );

    if (resuelto.ruta) await this.acceso.marcarActividad(resuelto.ruta);
    return {
      clasificadas: movidas.count,
      intervencionId: resuelto.intervencionId ?? null,
      actividadId: resuelto.actividadId ?? null,
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
    momentoCrudo?: string | null,
  ) {
    // Dónde aterrizan las fotos y qué permiso hace falta se resuelve ANTES
    // de tocar un solo byte: procesar diez imágenes para descubrir al final
    // que no se podía escribir sería gastar CPU y R2 para nada.
    const resuelto = await this.resolverDestino(usuario, destino);

    // El hueco del antes/después (Fase 3), validado contra lo que esa
    // actividad espera. Se comprueba ANTES de procesar, como el permiso.
    const momento = this.momentoValido(momentoCrudo, resuelto);

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

    // ⚠️ Aquí se creaba el álbum que recogía el lote, antes de procesar y
    // con borrado de cortesía si todo fallaba. Con los álbumes retirados
    // (Fase 4) el destino ya existe siempre —una intervención o una actividad—, así
    // que no hay nada que crear ni nada que deshacer.
    const intervencionId = resuelto.intervencionId ?? null;
    const actividadId = resuelto.actividadId ?? null;

    // La clave en R2 se agrupa por INTERVENCIÓN. Sin intervención —actividad o bandeja— se
    // agrupa por quien subió: el bucket sigue siendo navegable y una foto
    // NO cambia de clave al clasificarse después (§18), que es lo que
    // importa —mover el objeto obligaría a copiar y borrar en R2 por cada
    // foto de un lote de 50—.
    //
    // El prefijo `lotes/` que pone `construirClave` se conserva aunque los
    // lotes ya no existan: cambiarlo partiría el bucket en dos para siempre.
    const grupo = intervencionId !== null ? intervencionId : `u${usuario.id}`;

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
            intervencionId,
            actividadId,
            momento,
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
      // La carpeta se deduce del destino: `resolverDestino` ya la resolvió
      // para exigir el permiso, y de ella sale el hilo de §23.
      carpetaId: resuelto.carpetaId ?? null,
      entidad: 'FOTO',
      // Sin intervención ni actividad —la bandeja— no hay id de contenedor: se usa
      // el de la primera foto, que es lo único que identifica la subida.
      entidadId: intervencionId ?? actividadId ?? guardadas[0].id,
      accion: 'SUBIDA_FOTO',
      descripcion: `Subió ${guardadas.length} foto(s)${
        destino.tipo === 'bandeja' ? ' sin asignar' : ''
      }.`,
    });

    return {
      intervencionId,
      actividadId,
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
   * Los tres casos —álbum, actividad y bandeja— los resuelve
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
        intervencionId: true,
        actividadId: true,
        // Para poder anotar el valor ANTERIOR al editar la descripción: una
        // auditoría que solo dice «cambió» no responde a qué cambió.
        descripcion: true,
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
  /**
   * Mueve UNA foto de sitio (§1.2 del documento de gestión de contenido).
   *
   * Reutiliza `DestinoSubida`, así que los cuatro sitios donde puede vivir
   * una foto son los mismos que al subirla —álbum, actividad, carpeta (crea
   * álbum) y bandeja—: mover no inventa destinos nuevos, y `resolverDestino`
   * ya sabe validarlos y exigir EDICION en cada uno.
   *
   * ⚠️ **Permiso en ORIGEN y en DESTINO, y las dos comprobaciones importan.**
   * Con solo la del destino se podría sacar una foto de una carpeta que no se
   * alcanza; con solo la del origen, meterla en una donde no se puede
   * escribir. Es el mismo criterio que ya aplica `CarpetaService.editar` al
   * mover una rama del árbol. Las dos pasan por `exigirPermiso`, así que una
   * rama archivada bloquea el movimiento por los dos lados sin regla nueva.
   *
   * ⚠️ **Los objetos de R2 NO se mueven.** La clave se guarda por foto, así
   * que copiar y borrar en el bucket para que el prefijo quede bonito sería
   * gastar red y arriesgar huérfanos a cambio de nada. Es la misma decisión
   * que tomó `clasificar` en la Fase 6: una foto no cambia de clave nunca.
   *
   * ⚠️ **El álbum de origen que se queda vacío SE QUEDA.** Desde la Fase 2b
   * vaciar no es borrar, y mover la última foto de un álbum es vaciarlo.
   */
  async mover(
    usuario: UsuarioAutenticado,
    fotoId: number,
    destino: DestinoSubida,
  ) {
    const foto = await this.buscarConAcceso(usuario, fotoId, 'EDICION');

    // ⚠️ Devolver una foto a la bandeja solo se admite si es TUYA, y no es
    // una cortesía: la bandeja de §18 es estrictamente de quien subió la
    // foto —`subidaPorId`—, y ni un ADMIN_GLOBAL ve la ajena. Sin esta
    // comprobación, mover la foto de otro «a sin álbum» la sacaría del árbol
    // de carpetas y la dejaría donde quien la movió ya no puede alcanzarla:
    // no un borrado, pero indistinguible de uno para todos menos su autor.
    if (destino.tipo === 'bandeja' && foto.subidaPorId !== usuario.id)
      throw new BadRequestException(
        'Solo puedes devolver a «sin clasificar» una foto que subiste tú: ' +
          'la bandeja es privada de quien sube, y ahí dejarías de verla.',
      );

    const resuelto = await this.resolverDestino(usuario, destino);

    const intervencionDestino = resuelto.intervencionId ?? null;
    const actividadDestino = resuelto.actividadId ?? null;

    // Mover algo a donde ya está no es un error, pero tampoco es un
    // movimiento: se contesta sin escribir ni ensuciar la bitácora. Ya no hay
    // nada que deshacer al salir por aquí — antes había que retirar el álbum
    // que se acababa de crear para recibirla.
    if (
      foto.intervencionId === intervencionDestino &&
      foto.actividadId === actividadDestino
    ) {
      return { ok: true, id: fotoId, sinCambios: true };
    }

    const origen = await this.nombreDeSitio(
      foto.intervencionId,
      foto.actividadId,
    );

    await this.prisma.foto.update({
      where: { id: fotoId },
      data: {
        intervencionId: intervencionDestino,
        actividadId: actividadDestino,
      },
    });

    // Las DOS líneas de ancestros marcan actividad: la carpeta de la que
    // sale también cambió, aunque sea para tener una foto menos.
    if (foto.carpeta) await this.acceso.marcarActividad(foto.carpeta.ruta);
    if (resuelto.ruta) await this.acceso.marcarActividad(resuelto.ruta);

    const hacia = await this.nombreDeSitio(
      intervencionDestino,
      actividadDestino,
    );

    // §23. `MOVIMIENTO` ya existía en el enum desde la Fase 1 y hasta ahora
    // solo lo escribían las carpetas.
    await this.auditoria.registrar(usuario, {
      // Cuelga de la carpeta DESTINO cuando la hay; si la foto va a la
      // bandeja no hay ninguna, y entonces se ancla en la de origen para
      // que el hilo de §23 de esa carpeta registre que algo salió de ella.
      carpetaId: resuelto.carpetaId ?? foto.carpeta?.id ?? null,
      entidad: 'FOTO',
      entidadId: fotoId,
      accion: 'MOVIMIENTO',
      descripcion: `Movió una foto: ${origen} → ${hacia}.`,
    });

    return {
      ok: true,
      id: fotoId,
      intervencionId: intervencionDestino,
      actividadId: actividadDestino,
      sinCambios: false,
    };
  }

  /** Cómo se lee el sitio de una foto en la bitácora. */
  private async nombreDeSitio(
    intervencionId: number | null,
    actividadId: number | null,
  ): Promise<string> {
    if (intervencionId !== null) {
      const c = await this.prisma.intervencionFotos.findUnique({
        where: { id: intervencionId },
        select: { numero: true, carpeta: { select: { nombre: true } } },
      });
      return c
        ? `${c.carpeta.nombre} / intervención ${c.numero}`
        : `intervención #${intervencionId}`;
    }
    if (actividadId !== null) {
      const t = await this.prisma.actividadFotos.findUnique({
        where: { id: actividadId },
        select: {
          titulo: true,
          intervencion: {
            select: { numero: true, carpeta: { select: { nombre: true } } },
          },
        },
      });
      const actividad = t?.titulo ?? `actividad #${actividadId}`;
      // Se nombra la intervención además de la carpeta: en un equipo con historial,
      // «UPC / Inspección» no distingue la intervención de marzo de la de agosto.
      return t
        ? `${t.intervencion.carpeta.nombre} / intervención ${t.intervencion.numero} / ${actividad}`
        : actividad;
    }
    return 'sin clasificar';
  }

  /**
   * Corrige la descripción de una foto ya subida (§2.2 del documento de
   * gestión de contenido).
   *
   * Es un error humano de los corrientes —una errata, o algo escrito
   * apurado desde el móvil en obra— y corregirlo no compromete nada,
   * igual que ya se admite corregir el lugar y la fecha de un
   * requerimiento en Costos. Queda auditado con el valor anterior.
   *
   * ⚠️ **Pide EDICION y NO exige ser quien la subió**, al revés que borrar
   * —propia con EDICION, ajena con TOTAL— y al revés que un comentario, que
   * solo edita su autor. La diferencia no es un descuido:
   *
   *   · un COMENTARIO es una declaración firmada; que un tercero la
   *     reescriba destruye el registro de quién dijo qué, que es justo lo
   *     que §14 quiere guardar;
   *   · una DESCRIPCIÓN es la etiqueta de una evidencia compartida —de
   *     hecho nace siendo del LOTE, no de la foto—, así que corregirla es
   *     mantenimiento del expediente, no hablar en nombre de otro.
   *
   * Lo que sigue sin poder tocarse es la IMAGEN: reemplazar el archivo
   * detrás de un registro existente permitiría cambiar la prueba
   * fotográfica de una inspección sin que se note. Para eso se elimina y se
   * sube de nuevo, y las dos acciones quedan por separado en la bitácora.
   */
  async editarDescripcion(
    usuario: UsuarioAutenticado,
    fotoId: number,
    descripcionCruda: unknown,
  ) {
    const foto = await this.buscarConAcceso(usuario, fotoId, 'EDICION');
    const nueva = limpiar(descripcionCruda);
    const anterior = foto.descripcion;

    if (nueva === anterior)
      return { ok: true, id: fotoId, descripcion: anterior };

    await this.prisma.foto.update({
      where: { id: fotoId },
      data: { descripcion: nueva },
    });

    if (foto.carpeta) await this.acceso.marcarActividad(foto.carpeta.ruta);

    // §23. Con el valor anterior Y el nuevo: es lo que hace de esto una
    // corrección auditable y no una edición silenciosa.
    await this.auditoria.registrar(usuario, {
      carpetaId: foto.carpeta?.id ?? null,
      entidad: 'FOTO',
      entidadId: fotoId,
      accion: 'EDICION',
      descripcion:
        `Cambió la descripción de una foto: ` +
        `"${anterior ?? '(vacía)'}" → "${nueva ?? '(vacía)'}".`,
    });

    return { ok: true, id: fotoId, descripcion: nueva };
  }

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
    // ⚠️ Aquí se devolvía `albumVacio`, que decía «el álbum se quedó SIN
    // FOTOS». Se fue con los álbumes en la Fase 4: una intervención sin fotos sigue
    // siendo una intervención, así que no hay nada que avisar — y nadie lo
    // consumía ya.
    return { ok: true, id: fotoId };
  }
}
