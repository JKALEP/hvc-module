import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { ImagenService } from './imagen.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { TipoCampoFotos } from '../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar, describir } from '../common/texto';
import { aFechaUTC, claveDia } from '../common/fechas';

/** Un campo activo, con lo que hace falta para validar un valor suyo. */
export interface CampoParaValidar {
  id: number;
  nombre: string;
  clave: string;
  tipo: TipoCampoFotos;
  opciones: { id: number; etiqueta: string; activo: boolean }[];
}

/** Ya validado y listo para escribir. FOTO no pasa por aquí: ver abajo. */
interface ValorNormalizado {
  definicionId: number;
  valorTexto: string | null;
  valorNumero: string | null;
  valorFecha: Date | null;
  valorBooleano: boolean | null;
  opcionId: number | null;
}

/**
 * Lo que una carpeta de tipo EQUIPO tiene rellenado (Fase 1b).
 *
 * Es la mitad «rellenar» del EAV; la mitad «configurar» está en
 * `CampoFotosService`, con otro permiso: definir los campos es de
 * ADMIN_GLOBAL, rellenarlos es de quien tiene EDICION en la carpeta.
 *
 * ⚠️ **Esto NO reemplaza en bloque, al revés que `ValorCampoService` de
 * Gestión de Equipos**, y la diferencia es deliberada. Allí `reemplazar`
 * borra todas las filas del equipo y reescribe, porque el formulario manda
 * SIEMPRE todos los campos y «lo que llega es lo que hay». Aquí no puede
 * ser: **un campo de tipo FOTO no cabe en un JSON**, así que un borrado en
 * bloque se llevaría por delante la imagen —y sus dos objetos en R2— cada
 * vez que alguien corrigiera una errata en otro campo.
 *
 * Así que la semántica es de ACTUALIZACIÓN PARCIAL:
 *
 *   · una clave que no viene en el cuerpo → se deja como está;
 *   · una clave con valor → se escribe (`upsert`);
 *   · una clave con `null` o `""` → se borra esa fila, que es «vaciar el
 *     campo»;
 *   · una clave de un campo FOTO → se RECHAZA, y el mensaje dice por dónde
 *     va (`POST .../imagen`). Se prefiere rechazar a ignorar en silencio:
 *     que un valor mandado no se guarde sin decir nada es peor que un 400.
 */
@Injectable()
export class ValorCampoFotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly imagen: ImagenService,
    private readonly auditoria: AuditoriaFotosService,
  ) {}

  // ── Leer ──────────────────────────────────────────────────────

  /** Los campos activos, con sus opciones, para validar y para el formulario. */
  async camposActivos(): Promise<CampoParaValidar[]> {
    return this.prisma.definicionCampoFotos.findMany({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nombre: true,
        clave: true,
        tipo: true,
        opciones: {
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          select: { id: true, etiqueta: true, activo: true },
        },
      },
    });
  }

  /**
   * La ficha del equipo: cada campo con lo que tenga rellenado.
   *
   * Devuelve TAMBIÉN los campos desactivados que tengan valor —por eso no
   * filtra por `activo`—: `activo` decide si se PIDE en el formulario, no
   * si se enseña lo que alguien ya capturó. Un campo desactivado y vacío no
   * sale, que sería ruido.
   */
  async deCarpeta(usuario: UsuarioAutenticado, carpetaId: number) {
    await this.acceso.exigirPermiso(usuario, carpetaId, 'LECTURA');

    const [definiciones, valores] = await Promise.all([
      this.prisma.definicionCampoFotos.findMany({
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nombre: true,
          clave: true,
          tipo: true,
          activo: true,
          opciones: {
            orderBy: [{ orden: 'asc' }, { id: 'asc' }],
            select: { id: true, etiqueta: true, activo: true },
          },
        },
      }),
      this.prisma.valorCampoFotos.findMany({
        where: { carpetaId },
        select: {
          definicionId: true,
          valorTexto: true,
          valorNumero: true,
          valorFecha: true,
          valorBooleano: true,
          opcionId: true,
          claveImagen: true,
          claveMiniatura: true,
        },
      }),
    ]);

    const porCampo = new Map(valores.map((v) => [v.definicionId, v]));

    return Promise.all(
      definiciones
        .filter((d) => d.activo || porCampo.has(d.id))
        .map(async (d) => {
          const v = porCampo.get(d.id);
          return {
            id: d.id,
            nombre: d.nombre,
            clave: d.clave,
            tipo: d.tipo,
            activo: d.activo,
            opciones: d.opciones,
            // Un solo campo `valor`, con la forma que le toca a su tipo.
            // El frontend no tiene que saber en qué columna vive cada uno.
            valor: v ? this.aValorPlano(d.tipo, v) : null,
            // Las URLs se firman al leer y caducan: NUNCA se guardan.
            imagen:
              d.tipo === TipoCampoFotos.FOTO && v?.claveImagen
                ? {
                    url: await this.almacenamiento.urlFirmada(v.claveImagen),
                    urlMiniatura: v.claveMiniatura
                      ? await this.almacenamiento.urlFirmada(v.claveMiniatura)
                      : null,
                  }
                : null,
          };
        }),
    );
  }

  /** De la fila del EAV al valor que se enseña, según el tipo. */
  private aValorPlano(
    tipo: TipoCampoFotos,
    v: {
      valorTexto: string | null;
      valorNumero: unknown;
      valorFecha: Date | null;
      valorBooleano: boolean | null;
      opcionId: number | null;
      claveImagen: string | null;
    },
  ): string | number | boolean | null {
    switch (tipo) {
      case TipoCampoFotos.TEXTO:
      case TipoCampoFotos.TEXTO_LARGO:
        return v.valorTexto;
      case TipoCampoFotos.NUMERO:
        return v.valorNumero === null ? null : Number(v.valorNumero);
      // `@db.Date` en UTC, regla del proyecto: un día de calendario no
      // tiene hora, y pasarlo por una zona horaria solo puede correrlo.
      case TipoCampoFotos.FECHA:
        return v.valorFecha ? claveDia(v.valorFecha) : null;
      case TipoCampoFotos.BOOLEANO:
        return v.valorBooleano;
      case TipoCampoFotos.LISTA:
        return v.opcionId;
      case TipoCampoFotos.FOTO:
        // El valor de un campo FOTO es «tiene imagen o no»; el enlace va
        // aparte, firmado, en `imagen`.
        return v.claveImagen !== null;
    }
  }

  // ── Escribir ──────────────────────────────────────────────────

  /**
   * Valida un mapa `clave → valor` contra los campos activos.
   *
   * No toca la base: solo decide qué columna se llena y con qué, para que
   * las reglas por tipo se lean —y se prueben— en un sitio y no repartidas
   * por quien graba. Mismo criterio que `ValorCampoService` en Equipos.
   *
   * Devuelve por separado lo que hay que escribir y lo que hay que borrar,
   * porque son dos operaciones distintas sobre la misma tabla.
   */
  private async normalizar(entrada: Record<string, unknown>): Promise<{
    escribir: ValorNormalizado[];
    borrar: number[];
  }> {
    const campos = await this.camposActivos();
    const porClave = new Map(campos.map((c) => [c.clave, c]));

    const escribir: ValorNormalizado[] = [];
    const borrar: number[] = [];

    for (const [clave, bruto] of Object.entries(entrada)) {
      const campo = porClave.get(clave);
      if (!campo)
        throw new BadRequestException(
          `No hay ningún campo activo con la clave "${clave}".`,
        );

      if (campo.tipo === TipoCampoFotos.FOTO)
        throw new BadRequestException(
          `El campo "${campo.nombre}" es una imagen y no se manda con los demás: ` +
            'súbela en POST /fotos/carpeta/:id/campo/:campoId/imagen, o quítala con DELETE.',
        );

      // Vaciar un campo es borrarlo, no guardar una fila en blanco: así
      // «no rellenado» tiene UNA representación y no dos.
      if (this.estaVacio(bruto)) {
        borrar.push(campo.id);
        continue;
      }

      escribir.push(this.normalizarUno(campo, bruto));
    }

    return { escribir, borrar };
  }

  /** ¿Viene vacío? Un `false` y un `0` NO lo están. */
  private estaVacio(valor: unknown): boolean {
    if (valor === null || valor === undefined) return true;
    if (typeof valor === 'string') return valor.trim() === '';
    return false;
  }

  private normalizarUno(
    campo: CampoParaValidar,
    bruto: unknown,
  ): ValorNormalizado {
    const base: ValorNormalizado = {
      definicionId: campo.id,
      valorTexto: null,
      valorNumero: null,
      valorFecha: null,
      valorBooleano: null,
      opcionId: null,
    };

    // `switch` exhaustivo sobre el enum: añadir un tipo a `TipoCampoFotos`
    // no compila hasta decidir aquí cómo se valida, que es justo la
    // decisión que no puede quedar implícita.
    switch (campo.tipo) {
      case TipoCampoFotos.TEXTO:
      case TipoCampoFotos.TEXTO_LARGO: {
        const s = limpiar(bruto);
        if (!s)
          throw new BadRequestException(
            `El campo "${campo.nombre}" espera texto. Recibido: "${describir(bruto)}".`,
          );
        return { ...base, valorTexto: s };
      }

      case TipoCampoFotos.NUMERO: {
        const n = Number(bruto);
        if (typeof bruto === 'boolean' || !Number.isFinite(n))
          throw new BadRequestException(
            `El campo "${campo.nombre}" espera un número. Recibido: "${describir(bruto)}".`,
          );
        // Se guarda como texto: `Decimal` no pierde precisión por el camino
        // si nunca pasa por un `double`.
        return { ...base, valorNumero: String(n) };
      }

      case TipoCampoFotos.FECHA: {
        const s = limpiar(bruto);
        if (!s)
          throw new BadRequestException(
            `El campo "${campo.nombre}" espera una fecha (AAAA-MM-DD).`,
          );
        return { ...base, valorFecha: aFechaUTC(s, campo.nombre) };
      }

      case TipoCampoFotos.BOOLEANO: {
        if (typeof bruto === 'boolean')
          return { ...base, valorBooleano: bruto };
        const s = limpiar(bruto)?.toLowerCase();
        if (s === 'true' || s === 'false')
          return { ...base, valorBooleano: s === 'true' };
        throw new BadRequestException(
          `El campo "${campo.nombre}" espera sí o no. Recibido: "${describir(bruto)}".`,
        );
      }

      case TipoCampoFotos.LISTA: {
        const n = Number(bruto);
        const opcion = Number.isInteger(n)
          ? campo.opciones.find((o) => o.id === n)
          : undefined;
        if (!opcion)
          throw new BadRequestException(
            `"${describir(bruto)}" no es una opción de "${campo.nombre}". ` +
              `Opciones: ${campo.opciones
                .filter((o) => o.activo)
                .map((o) => `${o.id}=${o.etiqueta}`)
                .join(', ')}.`,
          );
        // Una opción DESACTIVADA no se puede elegir de nuevo, pero la que
        // ya estaba elegida se conserva: `activo` retira del formulario, no
        // reescribe lo capturado.
        if (!opcion.activo)
          throw new BadRequestException(
            `La opción "${opcion.etiqueta}" de "${campo.nombre}" está desactivada y ya no se puede elegir.`,
          );
        return { ...base, opcionId: opcion.id };
      }

      case TipoCampoFotos.FOTO:
        // Inalcanzable: `normalizar` lo rechaza antes con un mensaje que
        // dice por dónde va. Se deja para que el `switch` sea exhaustivo.
        throw new BadRequestException(
          `El campo "${campo.nombre}" es una imagen y se sube por su propia ruta.`,
        );
    }
  }

  /**
   * Guarda los campos que vengan. Ver la nota de la clase: es PARCIAL.
   *
   * Comprueba EDICION sobre la carpeta y que sea de tipo EQUIPO. Para el
   * camino de CREACIÓN está `escribirEn`, que es otro caso — ver allí.
   */
  async guardar(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    entrada: Record<string, unknown>,
  ) {
    const carpeta = await this.exigirCarpetaDeEquipo(usuario, carpetaId);
    const { escribir, borrar } = await this.normalizar(entrada);

    await this.escribir(this.prisma, carpetaId, escribir, borrar);

    if (escribir.length > 0 || borrar.length > 0)
      await this.auditoria.registrar(usuario, {
        carpetaId,
        entidad: 'CARPETA',
        entidadId: carpetaId,
        accion: 'EDICION',
        descripcion:
          `Actualizó los datos del equipo "${carpeta.nombre}": ` +
          `${escribir.length} campo(s) guardado(s), ${borrar.length} vaciado(s).`,
      });

    return this.deCarpeta(usuario, carpetaId);
  }

  /**
   * Escribe los valores de una carpeta que se está CREANDO, dentro de su
   * misma transacción.
   *
   * ⚠️ **No comprueba el permiso, y es correcto que no lo haga.** Quien
   * llama es `CarpetaService.crear`, que acaba de decidir si esta persona
   * puede crear aquí —`puedeCrearRaiz` en la raíz, EDICION sobre la madre
   * dentro—; volver a preguntarlo sería, además de redundante, imposible:
   * la carpeta todavía no está confirmada, así que `exigirPermiso` leería
   * por otra conexión y contestaría el 404 uniforme sobre algo que sí
   * existe. Por eso es un método aparte y no un `tx` opcional en `guardar`:
   * un parámetro que apaga una comprobación de permisos es exactamente la
   * clase de atajo que un día se usa desde donde no debe.
   *
   * Sí valida el CONTENIDO —tipos, opciones, claves inexistentes—, que es
   * lo que esta clase sabe hacer y no depende de quién pida.
   */
  async escribirEn(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    carpetaId: number,
    entrada: Record<string, unknown>,
  ) {
    const { escribir, borrar } = await this.normalizar(entrada);
    await this.escribir(tx, carpetaId, escribir, borrar);
    return escribir.length;
  }

  /** El upsert/borrado en sí, común a las dos vías. */
  private async escribir(
    db:
      | PrismaService
      | Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    carpetaId: number,
    escribir: ValorNormalizado[],
    borrar: number[],
  ) {
    for (const v of escribir) {
      const { definicionId, ...columnas } = v;
      await db.valorCampoFotos.upsert({
        where: { carpetaId_definicionId: { carpetaId, definicionId } },
        create: { carpetaId, definicionId, ...columnas },
        update: columnas,
      });
    }

    if (borrar.length > 0)
      await db.valorCampoFotos.deleteMany({
        where: { carpetaId, definicionId: { in: borrar } },
      });
  }

  // ── El campo de tipo FOTO ─────────────────────────────────────

  /**
   * Sube (o reemplaza) la imagen de un campo FOTO.
   *
   * Pasa por el MISMO `ImagenService` que las fotos de obra —WebP, 1600 px,
   * miniatura, y el EXIF descartado con su GPS dentro—, porque el riesgo es
   * el mismo: es una foto tomada con un móvil.
   *
   * ⚠️ Lo que NO hace es crear una fila de `Foto`. Es la decisión del
   * modelo: una `Foto` es evidencia de trabajo —vive en la galería, se
   * comenta, cuenta en los contadores de la carpeta— y la placa de un
   * equipo no es eso. Guardarla como `Foto` la habría metido en todo lo
   * anterior sin que nadie lo pidiera.
   */
  async subirImagen(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    definicionId: number,
    archivo: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname: string;
    },
  ) {
    const carpeta = await this.exigirCarpetaDeEquipo(usuario, carpetaId);
    const campo = await this.exigirCampoFoto(definicionId);

    const procesada = await this.imagen.procesar(archivo);

    // Agrupada por carpeta y con nombre aleatorio, igual que las fotos: el
    // original puede repetirse entre móviles y traer caracteres raros.
    const base = `${Date.now()}-${randomUUID()}.webp`;
    const grupo = `campo-c${carpetaId}`;
    const claveImagen = this.almacenamiento.construirClave(grupo, base, 'img');
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

    // Lo que hubiera antes se retira de R2 DESPUÉS de escribir la fila
    // nueva: si el borrado falla queda un huérfano, pero la fila apunta a
    // algo que existe. Al revés, un fallo dejaría la ficha sin imagen.
    const previo = await this.prisma.valorCampoFotos.findUnique({
      where: { carpetaId_definicionId: { carpetaId, definicionId } },
      select: { claveImagen: true, claveMiniatura: true },
    });

    await this.prisma.valorCampoFotos.upsert({
      where: { carpetaId_definicionId: { carpetaId, definicionId } },
      create: { carpetaId, definicionId, claveImagen, claveMiniatura },
      update: { claveImagen, claveMiniatura },
    });

    await this.borrarObjetos([previo]);

    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'CARPETA',
      entidadId: carpetaId,
      accion: 'EDICION',
      descripcion: `Subió la imagen del campo "${campo.nombre}" en "${carpeta.nombre}".`,
    });

    return {
      ok: true,
      url: await this.almacenamiento.urlFirmada(claveImagen),
      urlMiniatura: await this.almacenamiento.urlFirmada(claveMiniatura),
    };
  }

  /** Quita la imagen de un campo FOTO, y con ella sus objetos en R2. */
  async quitarImagen(
    usuario: UsuarioAutenticado,
    carpetaId: number,
    definicionId: number,
  ) {
    const carpeta = await this.exigirCarpetaDeEquipo(usuario, carpetaId);
    const campo = await this.exigirCampoFoto(definicionId);

    const fila = await this.prisma.valorCampoFotos.findUnique({
      where: { carpetaId_definicionId: { carpetaId, definicionId } },
      select: { id: true, claveImagen: true, claveMiniatura: true },
    });
    if (!fila?.claveImagen)
      throw new NotFoundException(
        `El campo "${campo.nombre}" no tiene ninguna imagen.`,
      );

    await this.prisma.valorCampoFotos.delete({ where: { id: fila.id } });
    await this.borrarObjetos([fila]);

    await this.auditoria.registrar(usuario, {
      carpetaId,
      entidad: 'CARPETA',
      entidadId: carpetaId,
      accion: 'EDICION',
      descripcion: `Quitó la imagen del campo "${campo.nombre}" en "${carpeta.nombre}".`,
    });
    return { ok: true };
  }

  /**
   * Retira de R2 los objetos de los valores que se indiquen.
   *
   * Lo usa también `CarpetaService.eliminar`: `ValorCampoFotos` va con
   * `Cascade`, así que la base se lleva las filas sola, pero **no sabe nada
   * del bucket**. Sin esta llamada, cada equipo eliminado dejaría dos
   * objetos huérfanos para siempre.
   */
  async borrarObjetos(
    filas: ({
      claveImagen: string | null;
      claveMiniatura: string | null;
    } | null)[],
  ) {
    const claves = filas
      .flatMap((f) => [f?.claveImagen, f?.claveMiniatura])
      .filter((c): c is string => typeof c === 'string');
    if (claves.length > 0) await this.almacenamiento.borrar(claves);
  }

  /** Las imágenes que cuelgan de una carpeta, para poder retirarlas. */
  imagenesDe(carpetaId: number) {
    return this.prisma.valorCampoFotos.findMany({
      where: { carpetaId, claveImagen: { not: null } },
      select: { claveImagen: true, claveMiniatura: true },
    });
  }

  // ── Auxiliares ────────────────────────────────────────────────

  /**
   * EDICION sobre la carpeta, y que la carpeta sea un EQUIPO.
   *
   * Lo segundo importa: estos campos describen un equipo, y admitirlos en
   * una carpeta corriente dejaría filas que ninguna pantalla enseña. Es la
   * misma lectura estricta que hace `TareaService.crear` con §13.
   *
   * El permiso lo resuelve `exigirPermiso`, así que una rama archivada
   * queda de solo lectura aquí también sin ninguna regla nueva.
   */
  private async exigirCarpetaDeEquipo(
    usuario: UsuarioAutenticado,
    carpetaId: number,
  ) {
    const carpeta = await this.acceso.exigirPermiso(
      usuario,
      carpetaId,
      'EDICION',
    );
    if (carpeta.tipo !== 'EQUIPO')
      throw new BadRequestException(
        'Los campos configurables son de las carpetas de tipo Equipo. Esta no lo es.',
      );
    return carpeta;
  }

  private async exigirCampoFoto(definicionId: number) {
    const campo = await this.prisma.definicionCampoFotos.findUnique({
      where: { id: definicionId },
      select: { id: true, nombre: true, tipo: true, activo: true },
    });
    if (!campo) throw new NotFoundException('Ese campo ya no existe.');
    if (campo.tipo !== TipoCampoFotos.FOTO)
      throw new BadRequestException(
        `El campo "${campo.nombre}" es de tipo ${campo.tipo}, no una imagen.`,
      );
    if (!campo.activo)
      throw new BadRequestException(
        `El campo "${campo.nombre}" está desactivado.`,
      );
    return campo;
  }
}
