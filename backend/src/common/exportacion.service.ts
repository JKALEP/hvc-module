import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { LineaCalculada } from './lineas.service';

/** Una columna de un bloque. */
export interface ColumnaExportable {
  titulo: string;
  /** Ancho de Excel, en caracteres. */
  ancho: number;
  /** Ancho del PDF en puntos. Por defecto se deriva del anterior. */
  anchoPdf?: number;
  /** Números y totales van a la derecha. */
  derecha?: boolean;
  /** Formato de Excel: '#,##0.00' para dinero. También fija los
   * decimales del PDF, para que los dos archivos digan lo mismo. */
  formato?: string;
}

export type Celda = string | number;

/** Una tabla dentro del archivo. Un documento trae una; una ficha, varias. */
export interface BloqueExportable {
  /** Vacío para no imprimir encabezado de sección. */
  titulo: string;
  columnas: ColumnaExportable[];
  filas: Celda[][];
  /** La fila de TOTAL, si el bloque suma algo. */
  filaFinal?: Celda[];
  /** Qué decir cuando no hay filas. */
  vacio?: string;
}

/** Cualquier cosa exportable: una cabecera de datos y N tablas. */
export interface Exportable {
  titulo: string;
  /** Sin extensión; se le añade .xlsx o .pdf. */
  nombreArchivo: string;
  /** El bloque de cabecera: pares etiqueta/valor. */
  datos: { etiqueta: string; valor: string }[];
  bloques: BloqueExportable[];
}

/** Lo que se necesita para armar un documento, venga de donde venga. */
export interface DocumentoExportable {
  titulo: string;
  codigo: string;
  organizacion: string;
  proveedor: string;
  estado: string;
  fecha: Date;
  /** Equipo, incidencia, cotización de origen… lo que aplique. */
  referencias: { etiqueta: string; valor: string }[];
  lineas: LineaCalculada[];
  total: number;
}

/** Los anchos del PDF van fijos: son los ya probados del documento. */
const COLUMNAS_DOCUMENTO: ColumnaExportable[] = [
  { titulo: '#', ancho: 6, anchoPdf: 26 },
  { titulo: 'Descripción', ancho: 46, anchoPdf: 250 },
  {
    titulo: 'Cantidad',
    ancho: 12,
    anchoPdf: 62,
    derecha: true,
    formato: '#,##0.00',
  },
  {
    titulo: 'P. unitario',
    ancho: 14,
    anchoPdf: 78,
    derecha: true,
    formato: '#,##0.00',
  },
  {
    titulo: 'Subtotal',
    ancho: 14,
    anchoPdf: 84,
    derecha: true,
    formato: '#,##0.00',
  },
];

/**
 * Genera el Excel o el PDF de cualquier cosa del sistema.
 *
 * Vivía dentro de `equipos/`, donde nació. Sale a `common/` porque
 * Costos tiene que exportar requerimientos, cotizaciones y costos, y
 * llamar al service de otro módulo de negocio habría atado dos dominios
 * que no se conocen — además de arrastrar el `@SoloSuperAdmin()` de su
 * controller a un módulo con otros roles.
 *
 * NADA se guarda: el archivo se arma en memoria a cada pulsación y se
 * devuelve como descarga. No hay copia en disco ni en R2 que pueda
 * quedar desfasada respecto a los datos — lo que vive en la base es la
 * verdad, y el archivo es una foto del momento en que se pidió.
 *
 * Un solo dibujante para documentos, fichas y reportes. Todos son lo
 * mismo visto de lejos —un título, unos datos de cabecera y una o más
 * tablas—, y tener dos implementaciones de «pintar una tabla en pdfkit»
 * era garantizar que se separaran. Lo que cambia por caso es el
 * `Exportable` que se le pasa, no cómo se pinta.
 */
@Injectable()
export class ExportacionService {
  private aTextoFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Sin caracteres que peleen con el nombre de archivo. */
  private limpiarNombre(nombre: string): string {
    return nombre.replace(/[^\w-]+/g, '_');
  }

  // ── Documentos ──

  /** Una cotización u orden de compra, con la forma genérica. */
  private deDocumento(doc: DocumentoExportable): Exportable {
    return {
      titulo: doc.titulo,
      nombreArchivo: `${doc.codigo}_${this.limpiarNombre(doc.proveedor)}`,
      datos: [
        { etiqueta: 'Código', valor: doc.codigo },
        { etiqueta: 'Organización', valor: doc.organizacion },
        { etiqueta: 'Proveedor', valor: doc.proveedor },
        { etiqueta: 'Estado', valor: doc.estado },
        { etiqueta: 'Fecha', valor: this.aTextoFecha(doc.fecha) },
        ...doc.referencias,
      ],
      bloques: [
        {
          titulo: '',
          columnas: COLUMNAS_DOCUMENTO,
          filas: doc.lineas.map((l) => [
            l.orden + 1,
            l.descripcion,
            l.cantidad,
            l.precioUnitario,
            l.subtotal,
          ]),
          filaFinal: ['', '', '', 'TOTAL', doc.total],
          vacio: 'Sin líneas.',
        },
      ],
    };
  }

  excelDocumento(doc: DocumentoExportable) {
    return this.excel(this.deDocumento(doc));
  }

  pdfDocumento(doc: DocumentoExportable) {
    return this.pdf(this.deDocumento(doc));
  }

  // ── Genérico ──

  async excel(t: Exportable) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'HVC Comercial S.A.C.';
    libro.created = new Date();
    const hoja = libro.addWorksheet(t.titulo.slice(0, 31));

    // El ancho lo fija el bloque más ancho: una sola hoja, una sola rejilla.
    const anchos = t.bloques.reduce<number[]>(
      (a, b) => b.columnas.map((c, i) => Math.max(c.ancho, a[i] ?? 0)),
      [],
    );
    anchos.forEach((w, i) => (hoja.getColumn(i + 1).width = w));

    hoja.addRow([t.titulo]).getCell(1).font = { bold: true, size: 14 };
    hoja.addRow([]);
    for (const d of t.datos) {
      const fila = hoja.addRow([d.etiqueta, d.valor]);
      fila.getCell(1).font = { bold: true };
    }

    for (const bloque of t.bloques) {
      hoja.addRow([]);
      if (bloque.titulo)
        hoja.addRow([bloque.titulo]).getCell(1).font = { bold: true, size: 12 };

      const encabezados = hoja.addRow(bloque.columnas.map((c) => c.titulo));
      encabezados.eachCell((c) => {
        c.font = { bold: true };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1D1D1' },
        };
      });

      if (bloque.filas.length === 0 && bloque.vacio) {
        hoja.addRow([bloque.vacio]);
        continue;
      }

      for (const celdas of bloque.filas) {
        const fila = hoja.addRow(celdas);
        bloque.columnas.forEach((c, i) => {
          if (c.formato) fila.getCell(i + 1).numFmt = c.formato;
        });
      }

      if (bloque.filaFinal) {
        const fila = hoja.addRow(bloque.filaFinal);
        bloque.columnas.forEach((c, i) => {
          fila.getCell(i + 1).font = { bold: true };
          if (c.formato) fila.getCell(i + 1).numFmt = c.formato;
        });
      }
    }

    return {
      buffer: Buffer.from(await libro.xlsx.writeBuffer()),
      nombreArchivo: `${t.nombreArchivo}.xlsx`,
    };
  }

  /**
   * PDF con las fuentes que trae pdfkit.
   *
   * Sin plantilla ni membrete: la identidad visual la define HVC más
   * adelante y montarla ahora sería trabajo a tirar. Lo que sí tiene es
   * la información completa y tablas legibles con salto de página.
   */
  pdf(t: Exportable): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    return new Promise((resolver, rechazar) => {
      const pdf = new PDFDocument({ size: 'A4', margin: 48 });
      const trozos: Buffer[] = [];
      pdf.on('data', (x: Buffer) => trozos.push(x));
      pdf.on('end', () =>
        resolver({
          buffer: Buffer.concat(trozos),
          nombreArchivo: `${t.nombreArchivo}.pdf`,
        }),
      );
      pdf.on('error', rechazar);

      pdf.fontSize(16).text(t.titulo, { align: 'left' });
      pdf.moveDown(0.6);

      pdf.font('Helvetica').fontSize(9);
      for (const d of t.datos) pdf.text(`${d.etiqueta}: ${d.valor}`);

      const izquierda = pdf.page.margins.left;
      const disponible =
        pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;

      for (const bloque of t.bloques) {
        pdf.moveDown(1);
        if (bloque.titulo) {
          // Con `izquierda` explícito: al dibujar las tablas se posiciona
          // cada celda por coordenadas, así que pdfkit se queda con la x
          // de la ÚLTIMA columna. Sin esto, el título del segundo bloque
          // aparecía alineado a la derecha y partido en dos líneas.
          pdf
            .font('Helvetica-Bold')
            .fontSize(11)
            .text(bloque.titulo, izquierda, pdf.y, { width: disponible });
          pdf.moveDown(0.4);
        }

        // Tabla a mano: pdfkit no trae una, y para esto una librería más
        // sería más peso que ayuda.
        const anchos = this.anchosPdf(bloque.columnas, disponible);
        const ancho = anchos.reduce((a, w) => a + w, 0);
        const x = anchos.map((_, i) =>
          anchos.slice(0, i).reduce((a, w) => a + w, izquierda),
        );

        /**
         * Dibuja una fila y devuelve lo que ocupó.
         *
         * El alto se MIDE, no se supone. Antes era fijo (16 pt) y eso
         * funcionaba solo mientras ninguna celda envolviera: en cuanto
         * un texto no cabía en su columna, pdfkit lo partía en dos
         * líneas y la fila siguiente se dibujaba encima de la segunda.
         * Con siete columnas —el comparativo de §37— pasa con cualquier
         * razón social, y el resultado era ilegible justo en el
         * documento que se le enseña a un jefe.
         *
         * `heightOfString` mide con la fuente y el ancho reales, así que
         * manda la celda que más líneas ocupe. El mínimo de 12 mantiene
         * el aire de las filas de una sola línea.
         */
        const fila = (celdas: Celda[], negrita = false): number => {
          const y = pdf.y;
          pdf.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

          const alto = Math.max(
            12,
            ...celdas.map((c, i) =>
              pdf.heightOfString(this.aTexto(c, bloque.columnas[i]), {
                width: anchos[i] - 6,
              }),
            ),
          );

          celdas.forEach((c, i) =>
            pdf.text(this.aTexto(c, bloque.columnas[i]), x[i], y, {
              width: anchos[i] - 6,
              align: bloque.columnas[i]?.derecha ? 'right' : 'left',
            }),
          );

          pdf.y = y + alto + 4;
          return alto + 4;
        };

        const linea = (y: number) =>
          pdf
            .moveTo(izquierda, y)
            .lineTo(izquierda + ancho, y)
            .strokeColor('#cccccc')
            .stroke();

        fila(
          bloque.columnas.map((c) => c.titulo),
          true,
        );
        linea(pdf.y - 4);

        if (bloque.filas.length === 0 && bloque.vacio) {
          pdf.font('Helvetica').fontSize(9).text(bloque.vacio, izquierda);
          continue;
        }

        for (const celdas of bloque.filas) {
          // Salto de página cuando ya no cabe ESTA fila, medida antes de
          // dibujarla: con altura variable, un margen fijo dejaba media
          // fila colgando fuera de la hoja.
          pdf.font('Helvetica').fontSize(9);
          const altoFila = Math.max(
            12,
            ...celdas.map((c, i) =>
              pdf.heightOfString(this.aTexto(c, bloque.columnas[i]), {
                width: anchos[i] - 6,
              }),
            ),
          );

          if (
            pdf.y + altoFila >
            pdf.page.height - pdf.page.margins.bottom - 20
          ) {
            pdf.addPage();
            fila(
              bloque.columnas.map((c) => c.titulo),
              true,
            );
            linea(pdf.y - 4);
          }
          fila(celdas);
        }

        if (bloque.filaFinal) {
          linea(pdf.y);
          pdf.y += 6;
          fila(bloque.filaFinal, true);
        }
      }

      pdf.end();
    });
  }

  /**
   * Los anchos del PDF, encogidos si no caben.
   *
   * Un reporte puede tener tantas columnas como campos configuró la
   * organización, así que el ancho no puede darse por bueno: sin esto,
   * la última columna se saldría de la hoja en silencio.
   */
  private anchosPdf(
    columnas: ColumnaExportable[],
    disponible: number,
  ): number[] {
    const anchos = columnas.map((c) => c.anchoPdf ?? c.ancho * 5.4);
    const total = anchos.reduce((a, w) => a + w, 0);
    return total <= disponible
      ? anchos
      : anchos.map((w) => (w * disponible) / total);
  }

  /** Los números del PDF salen con separador de miles; el texto, tal cual. */
  private aTexto(celda: Celda, columna?: ColumnaExportable): string {
    if (typeof celda !== 'number') return celda;
    // Si la columna tiene formato de dos decimales en Excel, el PDF dice
    // lo mismo: 2 y 2.00 no pueden ser el mismo dato en dos archivos.
    const decimales =
      columna?.formato === '#,##0.00' || !Number.isInteger(celda) ? 2 : 0;
    return celda.toLocaleString('es-PE', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
  }
}
