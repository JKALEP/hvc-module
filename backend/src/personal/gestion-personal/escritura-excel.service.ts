import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoPersonal } from '../../../generated/prisma/enums';
import { ENCABEZADOS, MESES, aAnio, aMes } from './validacion';

/** Nombre de hoja por tipo, el mismo del archivo original de HVC. */
const HOJA_POR_TIPO: Record<TipoPersonal, string> = {
  CONTRATISTA: 'OPERATIVO',
  SUPERVISOR: 'SUPERVISORES',
};

const GRIS_ENCABEZADO = 'FFD1D1D1'; // el del archivo original
const ANCHOS = [22, 18, 18, 20, 16, 11, 14, 8, 14, 10, 15, 15, 14];

@Injectable()
export class EscrituraExcelService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reconstruye el libro con el formato del original, para que el
   * documento exportado siga sirviendo para el trámite SCTR:
   * fila de grupo combinada A→M y con su color, encabezados, y las
   * personas debajo SIN filas en blanco entre bloques.
   */
  private escribirHoja(
    libro: ExcelJS.Workbook,
    nombre: string,
    colorGrupo: string,
    grupos: {
      nombre: string;
      fichas: {
        nombres: string;
        apellidoPaterno: string;
        apellidoMaterno: string;
        tipoTrabajador: string;
        paisNacimiento: string;
        tipoDocumento: string;
        numeroDocumento: string;
        sexo: string;
        fechaNacimiento: Date;
        moneda: string;
        remuneracion: { toString(): string };
        estadoCivil: string;
        sede: string;
      }[];
    }[],
  ) {
    const hoja = libro.addWorksheet(nombre);
    ANCHOS.forEach((w, i) => (hoja.getColumn(i + 1).width = w));

    for (const grupo of grupos) {
      // ── Fila de grupo: combinada A→M y con fondo ──
      const filaGrupo = hoja.addRow([grupo.nombre]);
      hoja.mergeCells(filaGrupo.number, 1, filaGrupo.number, 13);
      const celda = filaGrupo.getCell(1);
      celda.fill = {
        type: 'pattern',
        pattern: 'solid',
        // ARGB: Excel quiere el canal alfa delante, siempre opaco.
        fgColor: { argb: `FF${colorGrupo}` },
      };
      celda.font = { bold: true };
      celda.alignment = { vertical: 'middle' };

      // ── Encabezados ──
      const filaEnc = hoja.addRow([...ENCABEZADOS]);
      filaEnc.eachCell((c) => {
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: GRIS_ENCABEZADO },
        };
        c.font = { bold: true };
      });

      // ── Personas ──
      for (const f of grupo.fichas) {
        const fila = hoja.addRow([
          f.nombres,
          f.apellidoPaterno,
          f.apellidoMaterno,
          f.tipoTrabajador,
          f.paisNacimiento,
          f.tipoDocumento,
          // Texto explícito: si Excel lo interpreta como número,
          // "003017132" pierde los ceros y el documento deja de valer.
          f.numeroDocumento,
          f.sexo,
          this.aTextoFecha(f.fechaNacimiento),
          f.moneda,
          Number(f.remuneracion.toString()),
          f.estadoCivil,
          f.sede,
        ]);
        // Formato de texto en la columna del documento y en la fecha:
        // así se conservan tal cual al reabrir el archivo.
        fila.getCell(7).numFmt = '@';
        fila.getCell(9).numFmt = '@';
        fila.getCell(11).numFmt = '#,##0';
      }
      // Sin fila en blanco entre bloques: igual que el original.
    }

    return hoja;
  }

  /** dd/mm/aaaa, el formato del archivo original. */
  private aTextoFecha(fecha: Date): string {
    const d = String(fecha.getUTCDate()).padStart(2, '0');
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${fecha.getUTCFullYear()}`;
  }

  private cargar(anio: number, mes: number, tipo: TipoPersonal) {
    return this.prisma.periodoPersonal.findUnique({
      where: { anio_mes_tipo: { anio, mes, tipo } },
      include: {
        grupos: {
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          include: { fichas: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] } },
        },
      },
    });
  }

  /**
   * Genera el libro. Con un solo tipo sale una hoja; con los dos sale el
   * libro completo que traía OPERATIVO + SUPERVISORES, igual que el
   * archivo original.
   */
  async generar(
    anioCrudo: unknown,
    mesCrudo: unknown,
    tipos: TipoPersonal[],
  ): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    const anio = aAnio(anioCrudo);
    const mes = aMes(mesCrudo);

    const libro = new ExcelJS.Workbook();
    libro.creator = 'HVC Comercial S.A.C.';
    libro.created = new Date();

    let algoEscrito = false;
    for (const tipo of tipos) {
      const periodo = await this.cargar(anio, mes, tipo);
      if (!periodo) continue;
      const conGente = periodo.grupos.filter((g) => g.fichas.length > 0);
      if (conGente.length === 0) continue;
      this.escribirHoja(
        libro,
        HOJA_POR_TIPO[tipo],
        periodo.colorGrupo,
        conGente,
      );
      algoEscrito = true;
    }

    if (!algoEscrito)
      throw new NotFoundException(
        'No hay nada que exportar en ese periodo: no existe o no tiene personal cargado.',
      );

    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    return { buffer, nombreArchivo: this.nombreArchivo(mes, tipos) };
  }

  /** LISTA_ACTUALIZADA_SCTR_-_JULIO_-_OPERATIVO.xlsx */
  private nombreArchivo(mes: number, tipos: TipoPersonal[]): string {
    const etiqueta =
      tipos.length === 1 ? HOJA_POR_TIPO[tipos[0]] : 'OPERATIVO_Y_SUPERVISORES';
    return `LISTA_ACTUALIZADA_SCTR_-_${MESES[mes - 1]}_-_${etiqueta}.xlsx`;
  }
}
