import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { TipoPersonal } from '../../../generated/prisma/enums';
import { limpiar } from '../../common/texto';
import { leerPaletaTema, colorDeRelleno, esFondoNeutro } from './color-excel';
import { normalizarFicha, type FichaNormalizada } from './validacion';
import type { DatosFichaDto, HojaDetectada, BloqueDetectado } from './dto';

/** Una persona leída del Excel, con la fila de la que salió. */
export interface FilaLeida {
  fila: number;
  datos: FichaNormalizada;
}

/** Un bloque: la fila de grupo y su gente hasta el siguiente grupo. */
export interface BloqueLeido {
  grupo: string;
  fila: number;
  personas: FilaLeida[];
}

export interface HojaLeida {
  hoja: string;
  colorGrupo: string | null;
  tipoSugerido: TipoPersonal | null;
  bloques: BloqueLeido[];
  problemas: { fila: number; motivo: string }[];
}

/** Columnas A→M. La 14 (N) va vacía en los archivos reales. */
const PRIMERA_COLUMNA = 1;
const ULTIMA_COLUMNA = 13;

/**
 * Palabras que delatan a qué tipo pertenece una hoja. Es solo una
 * SUGERENCIA: el usuario confirma el mapeo antes de importar, porque los
 * nombres de hoja de HVC no son estables («OPERATIVO», «SUPERVISORES»,
 * «NO PLANILLA»).
 */
const PISTAS: { patron: RegExp; tipo: TipoPersonal }[] = [
  { patron: /supervis/i, tipo: TipoPersonal.SUPERVISOR },
  { patron: /operativ|contrat/i, tipo: TipoPersonal.CONTRATISTA },
];

@Injectable()
export class LecturaExcelService {
  /**
   * Abre el libro. Se separa de `analizar` porque el flujo de
   * importación lo lee dos veces: una para la vista previa y otra al
   * confirmar, sin obligar al usuario a volver a subirlo.
   */
  async abrir(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'No se pudo leer el archivo. Debe ser un Excel .xlsx válido.',
      );
    }
    if (wb.worksheets.length === 0)
      throw new BadRequestException('El archivo no tiene ninguna hoja.');
    return wb;
  }

  /**
   * ¿Esta fila abre un grupo?
   *
   * Se reconoce por su FORMA, no por un color concreto: celda A con
   * texto, combinada hacia la derecha, con relleno que no es el blanco
   * de las filas de datos, y que no es la cabecera.
   *
   * Buscar «el color de la hoja» no sirve, y no por los tres colores
   * distintos entre hojas (FFC000 en OPERATIVO, 3B7D23 en SUPERVISORES,
   * 2E75B6 en las antiguas) sino por algo peor: la hoja SUPERVISORES de
   * julio tiene CUATRO grupos en DOS colores —«AREA MANTENIMIENTO» en
   * verde y «AYUDANTES HVA», «TECNICOS RXH» y «TECNICOS HVA» en
   * amarillo—. Cualquier regla de un solo color por hoja se come uno de
   * los dos bandos.
   */
  private esFilaDeGrupo(
    fila: ExcelJS.Row,
    paleta: (string | null)[],
  ): string | null {
    const celda = fila.getCell(PRIMERA_COLUMNA);
    if (!limpiar(this.aTexto(celda.value))) return null;
    if (!celda.isMerged) return null;
    if (this.esEncabezado(fila)) return null;
    const color = colorDeRelleno(celda.fill, paleta);
    if (!color || esFondoNeutro(color)) return null;
    return color;
  }

  /** Solo lo que se puede convertir a texto sin perder información. */
  private aPrimitivo(valor: unknown): string {
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    if (valor instanceof Date) return valor.toISOString();
    return '';
  }

  /** El valor de una celda como texto plano, sea cual sea su tipo. */
  private aTexto(valor: ExcelJS.CellValue): string {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'object') {
      const o = valor as unknown as Record<string, unknown>;
      // Celdas con fórmula o con texto enriquecido. Se estrecha a
      // primitivo antes de convertir: un `result` que sea a su vez un
      // objeto daría "[object Object]" dentro del propio dato.
      if ('result' in o) return this.aPrimitivo(o.result);
      if ('text' in o) return this.aPrimitivo(o.text);
      if ('richText' in o && Array.isArray(o.richText))
        return (o.richText as { text?: string }[])
          .map((t) => t.text ?? '')
          .join('');
      return '';
    }
    return this.aPrimitivo(valor);
  }

  /**
   * ¿Es la fila de encabezados?
   *
   * Se mira el contenido y no el color: las hojas antiguas de HVC ponen
   * «Nombres*» en vez de «NOMBRES» y usan otro relleno, pero la primera
   * columna siempre habla de nombres y la séptima del documento.
   */
  private esEncabezado(fila: ExcelJS.Row): boolean {
    const a = limpiar(this.aTexto(fila.getCell(1).value))?.toUpperCase() ?? '';
    const g = limpiar(this.aTexto(fila.getCell(7).value))?.toUpperCase() ?? '';
    return (
      a.startsWith('NOMBRE') &&
      (g.includes('IDENT') || g.includes('NUM') || g.includes('DOC'))
    );
  }

  /** Los 13 campos de una fila, por POSICIÓN A→M, nunca por etiqueta. */
  private aDatos(fila: ExcelJS.Row): DatosFichaDto {
    const v = (c: number) => fila.getCell(c).value;
    return {
      nombres: this.aTexto(v(1)),
      apellidoPaterno: this.aTexto(v(2)),
      apellidoMaterno: this.aTexto(v(3)),
      tipoTrabajador: this.aTexto(v(4)),
      paisNacimiento: this.aTexto(v(5)),
      tipoDocumento: this.aTexto(v(6)),
      // Sin pasar por texto: si Excel lo guardó como número hay que
      // conservarlo tal cual para no perder ceros a la izquierda.
      numeroDocumento: v(7) as string | number | null,
      sexo: this.aTexto(v(8)),
      // Puede venir como Date nativo o como "dd/mm/aaaa".
      fechaNacimiento:
        v(9) instanceof Date ? (v(9) as Date) : this.aTexto(v(9)),
      moneda: this.aTexto(v(10)),
      remuneracion: v(11) as number | string | null,
      estadoCivil: this.aTexto(v(12)),
      sede: this.aTexto(v(13)),
    } as DatosFichaDto;
  }

  /** ¿La fila está completamente vacía en las 13 columnas? */
  private estaVacia(fila: ExcelJS.Row): boolean {
    for (let c = PRIMERA_COLUMNA; c <= ULTIMA_COLUMNA; c++) {
      if (limpiar(this.aTexto(fila.getCell(c).value))) return false;
    }
    return true;
  }

  /**
   * Recorre una hoja y devuelve sus bloques.
   *
   * Los bloques se cortan por el color de la fila de grupo y no por
   * filas en blanco: en los archivos reales no hay separación entre el
   * último trabajador de un grupo y el grupo siguiente.
   *
   * Una fila que no valida NO aborta la hoja: se anota en `problemas` y
   * se sigue. Un solo DNI mal escrito no puede impedir importar 74
   * personas.
   */
  leerHoja(hoja: ExcelJS.Worksheet, paleta: (string | null)[]): HojaLeida {
    // Una hoja con otro diseño (otras columnas, otro orden) no se
    // interpreta a la fuerza: leerla por posición daría 40 errores de
    // validación en vez de un motivo claro.
    if (!this.tieneFormatoEsperado(hoja)) {
      return {
        hoja: hoja.name,
        colorGrupo: null,
        tipoSugerido: null,
        bloques: [],
        problemas: [
          {
            fila: 0,
            motivo:
              'Esta hoja no tiene el formato de la lista SCTR: se esperan 13 columnas de NOMBRES a SEDE. No se puede importar.',
          },
        ],
      };
    }

    const bloques: BloqueLeido[] = [];
    const problemas: { fila: number; motivo: string }[] = [];
    const colores: string[] = [];
    let actual: BloqueLeido | null = null;

    hoja.eachRow((fila, numero) => {
      if (this.estaVacia(fila)) return;

      // ── Fila de grupo ──
      const color = this.esFilaDeGrupo(fila, paleta);
      if (color) {
        colores.push(color);
        actual = {
          grupo:
            limpiar(this.aTexto(fila.getCell(PRIMERA_COLUMNA).value)) ?? '',
          fila: numero,
          personas: [],
        };
        bloques.push(actual);
        return;
      }

      // ── Fila de encabezados ──
      if (this.esEncabezado(fila)) return;

      // ── Fila de trabajador ──
      if (!actual) {
        // Gente antes del primer grupo: en las hojas donde no se detectó
        // color, TODO cae aquí. Se recoge en un grupo sin nombre para no
        // perderla; el usuario le pondrá nombre después.
        actual = { grupo: '', fila: numero, personas: [] };
        bloques.push(actual);
      }

      try {
        actual.personas.push({
          fila: numero,
          datos: normalizarFicha(this.aDatos(fila)),
        });
      } catch (error) {
        problemas.push({
          fila: numero,
          motivo:
            error instanceof BadRequestException
              ? ((error.getResponse() as { message?: string }).message ??
                error.message)
              : 'No se pudo leer la fila.',
        });
      }
    });

    return {
      hoja: hoja.name,
      // El del primer grupo. Es el que se guarda en el periodo y con el
      // que se vuelve a pintar al exportar; si la hoja mezcla colores,
      // el usuario puede cambiarlo antes de importar.
      colorGrupo: colores[0] ?? null,
      tipoSugerido: PISTAS.find((p) => p.patron.test(hoja.name))?.tipo ?? null,
      // Un bloque sin gente no aporta nada y ensucia la vista previa.
      bloques: bloques.filter((b) => b.personas.length > 0),
      problemas,
    };
  }

  /**
   * ¿La hoja tiene las 13 columnas de la lista SCTR?
   *
   * Se busca una fila de encabezados en las primeras filas. Hace falta
   * porque entre los archivos de HVC hay libros de otra plantilla —el de
   * enero trae PRODUCTO, SEDE, TIPO DOCUMENTO, NRO DOCUMENTO, PRIMER
   * NOMBRE, SEGUNDO NOMBRE…— que no es esta lista y no debe importarse.
   */
  private tieneFormatoEsperado(hoja: ExcelJS.Worksheet): boolean {
    const tope = Math.min(hoja.rowCount, 15);
    for (let n = 1; n <= tope; n++) {
      if (this.esEncabezado(hoja.getRow(n))) return true;
    }
    return false;
  }

  /** Todas las hojas del libro, para el paso de mapeo. */
  analizar(wb: ExcelJS.Workbook): HojaLeida[] {
    // `exceljs` declara `themes` como string[], pero en tiempo de
    // ejecución es { theme1: '<xml>' }. El tipo miente; el dato no.
    const themes = (
      wb.model as unknown as {
        themes?: Record<string, string>;
      }
    ).themes;
    const paleta = leerPaletaTema(themes?.theme1);
    return wb.worksheets.map((h) => this.leerHoja(h, paleta));
  }

  /** La vista previa que ve el usuario: cuenta, no contenido. */
  aResumen(hojas: HojaLeida[]): HojaDetectada[] {
    return hojas.map((h) => ({
      hoja: h.hoja,
      colorGrupo: h.colorGrupo,
      tipoSugerido: h.tipoSugerido,
      bloques: h.bloques.map((b): BloqueDetectado => ({
        grupo: b.grupo || '(sin grupo)',
        fila: b.fila,
        personas: b.personas.length,
      })),
      totalPersonas: h.bloques.reduce((a, b) => a + b.personas.length, 0),
      problemas: h.problemas,
    }));
  }
}
