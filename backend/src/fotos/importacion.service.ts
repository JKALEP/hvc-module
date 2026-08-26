import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AccesoService } from './acceso.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { CicloService } from './ciclo.service';
import type { UsuarioAutenticado } from '../auth/tipos';
import { limpiar } from '../common/texto';
import { rutaDe } from '../common/arbol-ruta';

/**
 * Importación de estructura por Excel (§19).
 *
 * El Excel **no trae fotos**: define qué carpetas, equipos, actividades y álbumes
 * hay que crear. Columnas de §19:
 *
 *     Carpeta | Subcarpeta | Equipo | Tipo | Nombre | Descripción
 *
 * Las tres primeras son un CAMINO —«Proyecto A / Frente 1 / Equipo 01»— y
 * las tres últimas, la hoja que cuelga de él.
 *
 * Es la otra puerta a lo mismo que las plantillas de §20, y conviene tenerlo
 * presente: el Excel arranca una obra entera de una vez, desde la hoja que ya
 * tiene el planificador; la plantilla estampa un molde pequeño muchas veces,
 * en campo. Las dos acaban creando carpetas, actividades y álbumes.
 *
 * El flujo es el mismo de `personal/gestion-personal`: **leer → validar →
 * vista previa → decidir conflictos → confirmar en transacción**. Y por lo
 * mismo, `abrir()` está separado de `analizar()`: el archivo se lee DOS
 * veces —una para la vista previa y otra al confirmar— para no guardar
 * estado de sesión en el servidor. El navegador vuelve a mandar el mismo
 * archivo; el servidor no recuerda nada entre las dos llamadas.
 */

/** Las seis columnas de §19, en orden. */
const COLUMNAS = [
  'Carpeta',
  'Subcarpeta',
  'Equipo',
  'Tipo',
  'Nombre',
  'Descripción',
] as const;

/**
 * Qué puede pedir una fila del Excel.
 *
 * ⚠️ `ALBUM` se retiró en la Fase 4 del rediseño. Una hoja que lo traiga se
 * rechaza en la vista previa con el motivo, en vez de crear algo distinto en
 * silencio: la plantilla que HVC tenga guardada hay que actualizarla, igual
 * que cuando la columna «Tipo» pasó de decir `Tarea` a `Actividad`.
 */
const TIPOS_HOJA = ['ACTIVIDAD'] as const;
type TipoHoja = (typeof TIPOS_HOJA)[number];

/** Tope de filas. Un Excel de obra no pasa de unos cientos. */
const MAX_FILAS = 2000;

/** Qué hacer con una hoja que ya existe (§19). */
export type Decision = 'CREAR' | 'OMITIR' | 'ACTUALIZAR';

interface FilaLeida {
  fila: number;
  camino: string[];
  /**
   * Si la fila traía columna «Equipo», y por tanto el ÚLTIMO tramo del camino
   * es un equipo y no una carpeta corriente.
   *
   * ⚠️ Hace falta guardarlo aparte porque `camino` es el resultado de filtrar
   * los huecos, y filtrando se pierde de qué columna venía cada tramo.
   */
  ultimoEsEquipo: boolean;
  tipo: TipoHoja;
  nombre: string;
  descripcion: string | null;
}

@Injectable()
export class ImportacionFotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoService,
    private readonly auditoria: AuditoriaFotosService,
    private readonly ciclos: CicloService,
  ) {}

  /**
   * Abre el libro. Separado de `analizar` por el motivo de la cabecera.
   */
  private async abrir(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo. Debe ser un Excel .xlsx válido.',
      );
    }

    const hoja = wb.worksheets[0];
    if (!hoja)
      throw new BadRequestException('El archivo no tiene ninguna hoja.');
    return hoja;
  }

  private aTexto(celda: ExcelJS.Cell | undefined): string | null {
    const v = celda?.value;
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' && 'richText' in v)
      return limpiar(
        (v.richText as { text: string }[]).map((t) => t.text).join(''),
      );
    if (typeof v === 'object' && 'text' in v)
      return limpiar(String((v as { text: unknown }).text));
    // Una celda puede traer objetos que no se convierten a texto útil
    // —fórmulas, hipervínculos, errores—: se aceptan solo los primitivos y
    // el resto se trata como vacío, en vez de escribir «[object Object]»
    // como si fuera el nombre de una carpeta.
    if (typeof v === 'object') {
      // Una fórmula trae su valor ya calculado en `result`; solo sirve si es
      // primitivo. Un objeto anidado se descarta.
      const calculado: unknown = (v as { result?: unknown }).result;
      return typeof calculado === 'string' ||
        typeof calculado === 'number' ||
        typeof calculado === 'boolean'
        ? limpiar(String(calculado))
        : null;
    }
    return limpiar(String(v));
  }

  /**
   * Valida la cabecera (§19 paso 3).
   *
   * Se compara sin acentos ni mayúsculas porque «Descripción» y
   * «DESCRIPCION» son la misma columna y hacer fallar un archivo por eso
   * sería inútilmente estricto. Lo que sí se exige es el ORDEN: las seis
   * columnas donde §19 dice.
   */
  private validarCabecera(hoja: ExcelJS.Worksheet) {
    const normal = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

    const cabecera = hoja.getRow(1);
    const faltan: string[] = [];

    COLUMNAS.forEach((esperada, i) => {
      const leida = this.aTexto(cabecera.getCell(i + 1));
      if (leida === null || normal(leida) !== normal(esperada))
        faltan.push(
          `columna ${i + 1} debería ser "${esperada}"${leida ? ` y dice "${leida}"` : ' y está vacía'}`,
        );
    });

    if (faltan.length > 0)
      throw new BadRequestException(
        `La cabecera no tiene el formato esperado. ${faltan.join('; ')}.`,
      );
  }

  /** Lee las filas y acumula los problemas en vez de cortar en el primero. */
  private leerFilas(hoja: ExcelJS.Worksheet) {
    const filas: FilaLeida[] = [];
    const problemas: { fila: number; motivo: string }[] = [];

    hoja.eachRow((row, numero) => {
      if (numero === 1) return;
      if (filas.length + problemas.length >= MAX_FILAS) return;

      const carpeta = this.aTexto(row.getCell(1));
      const subcarpeta = this.aTexto(row.getCell(2));
      const equipo = this.aTexto(row.getCell(3));
      const tipoCrudo = this.aTexto(row.getCell(4));
      const nombre = this.aTexto(row.getCell(5));
      const descripcion = this.aTexto(row.getCell(6));

      // Fila entera vacía: es el relleno del final de la hoja, no un error.
      if (!carpeta && !subcarpeta && !equipo && !tipoCrudo && !nombre) return;

      if (!carpeta) {
        problemas.push({ fila: numero, motivo: 'Falta la carpeta.' });
        return;
      }
      if (!nombre) {
        problemas.push({ fila: numero, motivo: 'Falta el nombre.' });
        return;
      }

      const tipo = (tipoCrudo ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
        .toUpperCase();
      if (!TIPOS_HOJA.includes(tipo as TipoHoja)) {
        problemas.push({
          fila: numero,
          motivo: `Tipo "${tipoCrudo ?? ''}" no válido. Debe ser Actividad o Álbum.`,
        });
        return;
      }

      // ⚠️ Un hueco en medio invalida el camino: «Proyecto A / (vacío) /
      // Equipo 01» no dice dónde va el equipo. Se rechaza en vez de
      // adivinar que cuelga del proyecto.
      if (!subcarpeta && equipo) {
        problemas.push({
          fila: numero,
          motivo: 'Hay Equipo pero no Subcarpeta: el camino tiene un hueco.',
        });
        return;
      }

      filas.push({
        fila: numero,
        camino: [carpeta, subcarpeta, equipo].filter(
          (s): s is string => s !== null,
        ),
        ultimoEsEquipo: equipo !== null,
        tipo: tipo as TipoHoja,
        nombre,
        descripcion,
      });
    });

    return { filas, problemas };
  }

  /**
   * Vista previa (§19 pasos 4-6): qué se creará, qué ya existe y qué falla.
   *
   * No escribe NADA. Devuelve el árbol resultante con cada nodo marcado, y
   * los conflictos que hay que decidir antes de confirmar.
   */
  async analizar(
    usuario: UsuarioAutenticado,
    buffer: Buffer,
    destinoId: number,
  ) {
    const destino = await this.acceso.exigirPermiso(
      usuario,
      destinoId,
      'EDICION',
    );

    const hoja = await this.abrir(buffer);
    this.validarCabecera(hoja);
    const { filas, problemas } = this.leerFilas(hoja);

    if (filas.length === 0 && problemas.length === 0)
      throw new BadRequestException(
        'El archivo no tiene ninguna fila con datos.',
      );

    // Se resuelve el árbol UNA vez y se consulta la BD por camino, no por
    // fila: un Excel con 40 equipos repite «Proyecto A» 40 veces.
    const caminos = new Map<
      string,
      { camino: string[]; existeId: number | null; esEquipo: boolean }
    >();
    for (const f of filas) {
      for (let i = 1; i <= f.camino.length; i++) {
        const parcial = f.camino.slice(0, i);
        const clave = parcial.join(' / ');
        // Un mismo tramo puede aparecer como equipo en una fila y como paso
        // intermedio en otra; basta que alguna lo declare equipo.
        const esEquipo = f.ultimoEsEquipo && i === f.camino.length;
        const previo = caminos.get(clave);
        caminos.set(clave, {
          camino: parcial,
          existeId: previo?.existeId ?? null,
          esEquipo: previo?.esEquipo === true || esEquipo,
        });
      }
    }

    // Recorrido nivel a nivel desde el destino: una carpeta se identifica
    // por (padre, nombre), que es justo el índice único que ya existe.
    const idPorCamino = new Map<string, number>();
    for (const [clave, valor] of [...caminos.entries()].sort(
      (a, b) => a[1].camino.length - b[1].camino.length,
    )) {
      const padreClave = valor.camino.slice(0, -1).join(' / ');
      const padreId =
        valor.camino.length === 1 ? destinoId : idPorCamino.get(padreClave);
      if (padreId === undefined) continue;

      const existente = await this.prisma.carpetaFotos.findFirst({
        where: {
          parentId: padreId,
          nombre: valor.camino[valor.camino.length - 1],
        },
        select: { id: true },
      });
      valor.existeId = existente?.id ?? null;
      if (existente) idPorCamino.set(clave, existente.id);
    }

    // Conflictos: una hoja (actividad o álbum) que ya existe en su carpeta.
    const conflictos: {
      fila: number;
      camino: string;
      tipo: TipoHoja;
      nombre: string;
      motivo: string;
    }[] = [];

    for (const f of filas) {
      const clave = f.camino.join(' / ');
      const carpetaId = idPorCamino.get(clave);
      // Si su carpeta no existe todavía, la hoja tampoco puede existir.
      if (carpetaId === undefined) continue;

      const yaEsta =
        f.tipo === 'ACTIVIDAD'
          ? await this.prisma.actividadFotos.findFirst({
              // La actividad cuelga del CICLO, no de la carpeta: el duplicado
              // se busca en cualquier ciclo de ese equipo, porque «Revisar
              // pernos» ya existe aunque sea de la visita anterior.
              where: { ciclo: { carpetaId }, titulo: f.nombre },
              select: { id: true },
            })
          : null;

      if (yaEsta)
        conflictos.push({
          fila: f.fila,
          camino: clave,
          tipo: f.tipo,
          nombre: f.nombre,
          motivo: `"${f.nombre}" ya existe en ${clave}.`,
        });
    }

    const carpetasNuevas = [...caminos.values()].filter((c) => !c.existeId);
    const carpetasExistentes = [...caminos.values()].filter((c) => c.existeId);

    return {
      destino: { id: destino.id, nombre: destino.nombre },
      resumen: {
        filas: filas.length,
        carpetasNuevas: carpetasNuevas.length,
        carpetasExistentes: carpetasExistentes.length,
        // Las hojas en conflicto NO se cuentan como nuevas: qué pasa con
        // ellas lo decide quien importa, en el paso siguiente.
        hojasNuevas: filas.length - conflictos.length,
        conflictos: conflictos.length,
        problemas: problemas.length,
      },
      // El árbol tal como quedará, con cada carpeta marcada.
      carpetas: [...caminos.entries()]
        .map(([clave, v]) => ({
          camino: clave,
          nivel: v.camino.length,
          estado: v.existeId ? ('existente' as const) : ('nueva' as const),
        }))
        .sort((a, b) => a.camino.localeCompare(b.camino)),
      hojas: filas.map((f) => ({
        fila: f.fila,
        camino: f.camino.join(' / '),
        tipo: f.tipo,
        nombre: f.nombre,
        descripcion: f.descripcion,
      })),
      conflictos,
      problemas,
    };
  }

  /**
   * Confirma la importación (§19 paso 7-8), TODO en una transacción.
   *
   * §19 lo pide con esas palabras —«mediante una transacción segura, para
   * evitar estructuras incompletas»— y es la diferencia entre un fallo a
   * mitad que no deja nada y uno que deja media obra creada y a alguien
   * adivinando por dónde iba.
   *
   * `decisiones` mapea `fila → CREAR | OMITIR | ACTUALIZAR` para las hojas
   * en conflicto. Lo que no venga se OMITE: ante la duda, no duplicar.
   */
  async confirmar(
    usuario: UsuarioAutenticado,
    buffer: Buffer,
    destinoId: number,
    decisiones: Record<number, Decision> = {},
  ) {
    const destino = await this.acceso.exigirPermiso(
      usuario,
      destinoId,
      'EDICION',
    );

    const hoja = await this.abrir(buffer);
    this.validarCabecera(hoja);
    const { filas, problemas } = this.leerFilas(hoja);

    // Una fila con problema NO se importa, pero no impide el resto: §19
    // quiere que se vean los errores, no que un typo bloquee 200 filas.
    if (filas.length === 0)
      throw new BadRequestException(
        'Ninguna fila del archivo se puede importar. Revisa los problemas de la vista previa.',
      );

    const creado = { carpetas: 0, actividades: 0 };
    const omitido = { actividades: 0 };
    const actualizado = { actividades: 0 };

    await this.prisma.$transaction(async (tx) => {
      const idPorCamino = new Map<string, number>();

      /**
       * Devuelve el id de la carpeta del camino, creándola si hace falta.
       *
       * ⚠️ El último tramo se crea como carpeta de tipo EQUIPO cuando la fila
       * traía columna «Equipo», y entonces se le abre su Ciclo 1 en la MISMA
       * transacción. Antes se creaba corriente, y eso escribía actividades en
       * una carpeta que no era un equipo —el import saltaba §13 por escribir
       * con `tx` en vez de pasar por el service—. Con el modelo de ciclos ese
       * atajo dejó de existir: sin equipo no hay ciclo, y sin ciclo no hay
       * dónde poner una actividad.
       *
       * Una carpeta que YA existe no cambia de tipo: el Excel no manda sobre
       * lo que alguien creó a mano. Si no es un equipo, sus actividades se
       * omiten y se avisa, como cualquier otra fila que no cabe.
       */
      const asegurarCarpeta = async (
        camino: string[],
        ultimoEsEquipo: boolean,
      ): Promise<number> => {
        let padreId = destinoId;
        for (let i = 1; i <= camino.length; i++) {
          const clave = camino.slice(0, i).join(' / ');
          const yaResuelta = idPorCamino.get(clave);
          if (yaResuelta !== undefined) {
            padreId = yaResuelta;
            continue;
          }

          const nombre = camino[i - 1];
          const existente = await tx.carpetaFotos.findFirst({
            where: { parentId: padreId, nombre },
            select: { id: true },
          });

          if (existente) {
            idPorCamino.set(clave, existente.id);
            padreId = existente.id;
            continue;
          }

          const padre = await tx.carpetaFotos.findUniqueOrThrow({
            where: { id: padreId },
            select: { ruta: true },
          });
          const esEquipo = ultimoEsEquipo && i === camino.length;
          const nueva = await tx.carpetaFotos.create({
            data: {
              nombre,
              parentId: padreId,
              propietarioId: usuario.id,
              ruta: '',
              ...(esEquipo ? { tipo: 'EQUIPO' as const } : {}),
            },
            select: { id: true },
          });
          await tx.carpetaFotos.update({
            where: { id: nueva.id },
            data: { ruta: rutaDe(nueva.id, padre.ruta) },
          });
          if (esEquipo)
            await this.ciclos.abrirPrimeroEn(tx, nueva.id, usuario.id);

          creado.carpetas++;
          idPorCamino.set(clave, nueva.id);
          padreId = nueva.id;
        }
        return padreId;
      };

      for (const f of filas) {
        const carpetaId = await asegurarCarpeta(f.camino, f.ultimoEsEquipo);

        const existente =
          f.tipo === 'ACTIVIDAD'
            ? await tx.actividadFotos.findFirst({
                where: { ciclo: { carpetaId }, titulo: f.nombre },
                select: { id: true },
              })
            : null;

        // Sin conflicto se crea; con conflicto manda la decisión, y lo que
        // no se decidió se omite.
        const decision: Decision = existente
          ? (decisiones[f.fila] ?? 'OMITIR')
          : 'CREAR';

        if (existente && decision === 'OMITIR') {
          omitido.actividades++;
          continue;
        }

        if (existente && decision === 'ACTUALIZAR') {
          await tx.actividadFotos.update({
            where: { id: existente.id },
            data: { descripcion: f.descripcion },
          });
          actualizado.actividades++;
          continue;
        }

        if (f.tipo === 'ACTIVIDAD') {
          // ⚠️ Una actividad necesita un CICLO donde caer, y solo cabe en el
          // que esté en curso: meterla en uno cerrado reescribiría una visita
          // ya terminada, que es justo lo que el historial impide. Si el
          // equipo no tiene ninguno abierto, la fila se OMITE y se avisa —el
          // mismo criterio que con las actividades fuera de un EQUIPO—.
          const cicloAbierto = await tx.cicloFotos.findFirst({
            where: { carpetaId, cerradoEn: null },
            select: { id: true },
          });
          if (!cicloAbierto) {
            omitido.actividades++;
            continue;
          }
          await tx.actividadFotos.create({
            data: {
              cicloId: cicloAbierto.id,
              titulo: f.nombre,
              descripcion: f.descripcion,
              creadoPorId: usuario.id,
            },
          });
          creado.actividades++;
        }
      }
    });

    await this.acceso.marcarActividad(destino.ruta);

    // §23, acción 13 de 13.
    await this.auditoria.registrar(usuario, {
      carpetaId: destinoId,
      entidad: 'IMPORTACION',
      entidadId: destinoId,
      accion: 'IMPORTACION_EXCEL',
      descripcion:
        `Importó desde Excel en "${destino.nombre}": ${creado.carpetas} carpeta(s), ` +
        `${creado.actividades} actividad(s).`,
    });

    return { ok: true, creado, omitido, actualizado, problemas };
  }
}
