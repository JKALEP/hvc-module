import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { EditarProductoDto, CAMPOS_EDITABLES } from './dto';

interface FilaExcel {
  descripcion: string;
  unidadMedida: string | null;
  detalles: string | null;
  referencias: string | null;
}

@Injectable()
export class ImportacionService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizar(texto: unknown): string {
    return String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private limpiar(valor: unknown): string | null {
    if (valor === null || valor === undefined) return null;
    const s = String(valor).trim();
    return s === '' ? null : s;
  }

  private esCompleto(p: {
    codigo: string | null;
    precioUnitario: unknown;
    proveedor: string | null;
    ruc: string | null;
  }): boolean {
    return (
      !!this.limpiar(p.codigo) &&
      p.precioUnitario !== null &&
      p.precioUnitario !== undefined &&
      !!this.limpiar(p.proveedor) &&
      !!this.limpiar(p.ruc)
    );
  }

  private mapearColumnas(cabecera: unknown[]): Record<string, number> {
    const alias: Record<string, string[]> = {
      descripcion: [
        'DESCRIPCION',
        'DESCRIPCI N',
        'DESC',
        'PRODUCTO',
        'DESCRIPCION PRODUCTO',
        'NOMBRE',
        'ITEM DESCRIPCION',
      ],
      unidadMedida: [
        'UNIDAD DE MEDIDA',
        'UNIDAD',
        'UND MEDIDA',
        'U M',
        'UM',
        'UNID',
        'UNIDAD MED',
      ],
      detalles: [
        'DETALLES OBSERVACION',
        'DETALLES OBSERVAION',
        'DETALLES Y OBSERVACIONES',
        'DET OBSERVACION',
        'DETALLES',
        'OBSERVACION',
        'OBSERVACIONES',
        'DETALLE',
        'DETALLE OBSERVACION',
      ],
      referencias: [
        'REFERENCIAS',
        'REFERENCIA',
        'REF',
        'MARCA MODELO',
        'MARCA',
      ],
    };

    const mapa: Record<string, number> = {};
    cabecera.forEach((celda, idx) => {
      const norm = this.normalizar(celda);
      if (!norm) return;
      for (const [campo, nombres] of Object.entries(alias)) {
        if (mapa[campo] !== undefined) continue;
        if (nombres.some((n) => norm === n || norm.startsWith(n))) {
          mapa[campo] = idx;
          break;
        }
      }
    });
    return mapa;
  }

  private leerExcel(buffer: Buffer): FilaExcel[] {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('El archivo no es un Excel válido.');
    }

    const hoja = wb.Sheets[wb.SheetNames[0]];
    if (!hoja) throw new BadRequestException('El Excel no tiene hojas.');

    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      defval: null,
      blankrows: false,
    });
    if (filas.length === 0)
      throw new BadRequestException('El Excel está vacío.');

    // Busca la fila que contenga DESCRIPCIÓN — puede estar en cualquier posición
    // porque el formato HVC tiene encabezado institucional arriba.
    const idxCabecera = filas.findIndex((f) =>
      f.some((c) => {
        const norm = this.normalizar(c);
        return (
          norm === 'DESCRIPCION' ||
          norm.includes('DESCRIPCION') ||
          norm === 'DESCRIPCI N' ||
          norm === 'PRODUCTO'
        );
      }),
    );

    if (idxCabecera === -1)
      throw new BadRequestException(
        'No se encontró la columna DESCRIPCIÓN en el Excel. ' +
          'Verifica que el archivo tenga esa columna.',
      );

    const mapa = this.mapearColumnas(filas[idxCabecera]);

    const resultado: FilaExcel[] = [];
    for (let i = idxCabecera + 1; i < filas.length; i++) {
      const fila = filas[i];
      const descripcion = this.limpiar(fila[mapa.descripcion]);
      if (!descripcion) continue;

      resultado.push({
        descripcion,
        unidadMedida:
          mapa.unidadMedida !== undefined
            ? this.limpiar(fila[mapa.unidadMedida])
            : null,
        detalles:
          mapa.detalles !== undefined
            ? this.limpiar(fila[mapa.detalles])
            : null,
        referencias:
          mapa.referencias !== undefined
            ? this.limpiar(fila[mapa.referencias])
            : null,
      });
    }

    return resultado;
  }

  private async recalcularImportacion(importacionId: number) {
    const productos = await this.prisma.producto.findMany({
      where: { importacionId },
      select: {
        codigo: true,
        precioUnitario: true,
        proveedor: true,
        ruc: true,
      },
    });
    const total = productos.length;
    const completas = productos.filter((p) => this.esCompleto(p)).length;
    const estado = total > 0 && completas === total ? 'COMPLETO' : 'INCOMPLETO';

    await this.prisma.importacion.update({
      where: { id: importacionId },
      data: { totalFilas: total, filasCompletas: completas, estado },
    });
  }

  async importarDesdeExcel(archivo: { originalname: string; buffer: Buffer }) {
    if (!archivo?.buffer)
      throw new BadRequestException('No se recibió ningún archivo.');

    const filas = this.leerExcel(archivo.buffer);
    if (filas.length === 0)
      throw new BadRequestException(
        'No se encontraron filas con descripción en el Excel.',
      );

    const importacion = await this.prisma.importacion.create({
      data: {
        nombreArchivo: archivo.originalname,
        totalFilas: filas.length,
        filasCompletas: 0,
        estado: 'INCOMPLETO',
        productos: {
          create: filas.map((f) => ({
            descripcion: f.descripcion,
            unidadMedida: f.unidadMedida,
            detalles: f.detalles,
            referencias: f.referencias,
            estado: 'INCOMPLETO',
          })),
        },
      },
      include: { productos: { orderBy: { id: 'asc' } } },
    });

    return importacion;
  }

  async listar() {
    return this.prisma.importacion.findMany({
      orderBy: { fechaImportacion: 'desc' },
      select: {
        id: true,
        nombreArchivo: true,
        fechaImportacion: true,
        totalFilas: true,
        filasCompletas: true,
        estado: true,
      },
    });
  }

  async detalle(id: number) {
    const importacion = await this.prisma.importacion.findUnique({
      where: { id },
      include: { productos: { orderBy: { id: 'asc' } } },
    });
    if (!importacion)
      throw new NotFoundException(`Importación ${id} no encontrada.`);
    return importacion;
  }

  async editarProducto(
    importacionId: number,
    productoId: number,
    dto: EditarProductoDto,
  ) {
    const actual = await this.prisma.producto.findFirst({
      where: { id: productoId, importacionId },
    });
    if (!actual)
      throw new NotFoundException(
        `Producto ${productoId} no encontrado en la importación ${importacionId}.`,
      );

    const data: Record<string, unknown> = {};
    for (const campo of CAMPOS_EDITABLES) {
      if (campo in dto) {
        const valor = dto[campo];
        if (campo === 'precioUnitario' || campo === 'cantidad') {
          data[campo] =
            valor === null || valor === '' || valor === undefined
              ? null
              : String(valor);
        } else {
          data[campo] = this.limpiar(valor);
        }
      }
    }

    const precioAnterior = actual.precioUnitario;
    const hayNuevoPrecio = 'precioUnitario' in data;
    const precioNuevo = hayNuevoPrecio
      ? (data.precioUnitario as string | null)
      : (precioAnterior?.toString() ?? null);
    const cambioPrecio =
      hayNuevoPrecio &&
      precioNuevo !== null &&
      precioNuevo !== (precioAnterior?.toString() ?? null);

    const fusion = {
      codigo: ('codigo' in data ? data.codigo : actual.codigo) as string | null,
      precioUnitario: hayNuevoPrecio ? data.precioUnitario : precioAnterior,
      proveedor: ('proveedor' in data ? data.proveedor : actual.proveedor) as
        string | null,
      ruc: ('ruc' in data ? data.ruc : actual.ruc) as string | null,
    };
    data.estado = this.esCompleto(fusion) ? 'COMPLETO' : 'INCOMPLETO';

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const prod = await tx.producto.update({
        where: { id: productoId },
        data: data as any,
      });
      if (cambioPrecio) {
        await tx.historialPrecio.create({
          data: {
            productoId,
            precioAnterior: precioAnterior ?? null,
            precioNuevo: precioNuevo,
          },
        });
      }
      return prod;
    });

    await this.recalcularImportacion(importacionId);
    return actualizado;
  }

  async duplicarProducto(importacionId: number, productoId: number) {
    const original = await this.prisma.producto.findFirst({
      where: { id: productoId, importacionId },
    });
    if (!original)
      throw new NotFoundException(
        `Producto ${productoId} no encontrado en la importación ${importacionId}.`,
      );

    const copia = await this.prisma.producto.create({
      data: {
        importacionId,
        codigo: original.codigo,
        descripcion: original.descripcion,
        unidadMedida: original.unidadMedida,
        cantidad: original.cantidad,
        detalles: original.detalles,
        referencias: original.referencias,
        precioUnitario: null,
        proveedor: null,
        ruc: null,
        estado: 'INCOMPLETO',
      },
    });

    await this.recalcularImportacion(importacionId);
    return copia;
  }

  async eliminarProducto(importacionId: number, productoId: number) {
    const existe = await this.prisma.producto.findFirst({
      where: { id: productoId, importacionId },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException(
        `Producto ${productoId} no encontrado en la importación ${importacionId}.`,
      );

    await this.prisma.producto.delete({ where: { id: productoId } });
    await this.recalcularImportacion(importacionId);
    return { ok: true, id: productoId };
  }

  async eliminarImportacion(id: number) {
    const existe = await this.prisma.importacion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe)
      throw new NotFoundException(`Importación ${id} no encontrada.`);

    await this.prisma.importacion.delete({ where: { id } });
    return { ok: true, id };
  }
}
