import { Injectable, BadRequestException } from '@nestjs/common';
import { limpiar, describir } from './texto';

/** Una línea tal como llega del formulario. */
export interface LineaDto {
  descripcion?: string | null;
  cantidad?: number | string | null;
  precioUnitario?: number | string | null;
}

/** Ya validada y lista para escribir. */
export interface LineaNormalizada {
  orden: number;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

/** Una línea con su subtotal, para mostrar y exportar. */
export interface LineaCalculada {
  id: number;
  orden: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/**
 * La aritmética de un documento con líneas: normalizar lo que llega del
 * formulario, calcular subtotales y sumar el total.
 *
 * Vivía dentro de `equipos/documento.service.ts` junto al correlativo de
 * ese módulo. Sale a `common/` porque el módulo Costos necesita las
 * MISMAS reglas para las cotizaciones de proveedor y para los costos por
 * ítem, y dos copias de "cómo se redondea un subtotal" son dos criterios
 * que acaban discrepando en el tercer decimal.
 *
 * El correlativo NO vino con ella: `equipos` numera por año
 * (`COT-2026-001`) y Costos usa una secuencia perpetua de Postgres. Son
 * dos políticas distintas, no una compartida.
 *
 * NADA de esto se guarda. El subtotal es cantidad × precio y el total la
 * suma de los subtotales: guardarlos obligaría a reescribirlos en cada
 * alta, edición y borrado de línea.
 */
@Injectable()
export class LineasService {
  /** Decimal(14,4): se guarda como texto para no pasar por el flotante. */
  private aDecimal(valor: unknown, campo: string): string {
    const n =
      typeof valor === 'number'
        ? valor
        : Number(limpiar(valor)?.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0)
      throw new BadRequestException(
        `"${campo}" debe ser un número mayor o igual a 0. Recibido: "${describir(valor)}".`,
      );
    return n.toFixed(4);
  }

  /**
   * Valida las líneas que llegan del formulario.
   *
   * Un documento sin líneas se acepta: se crea vacío y se le van
   * agregando renglones, igual que una cotización de verdad se empieza
   * en blanco. El total sale 0 hasta que tenga alguna.
   */
  normalizarLineas(valor: unknown): LineaNormalizada[] {
    if (valor === undefined || valor === null) return [];
    if (!Array.isArray(valor))
      throw new BadRequestException('El campo "lineas" debe ser una lista.');

    return valor.map((cruda: LineaDto, i) => {
      const descripcion = limpiar(cruda?.descripcion);
      if (!descripcion)
        throw new BadRequestException(
          `La línea ${i + 1} necesita una descripción.`,
        );
      return {
        orden: i,
        descripcion,
        cantidad: this.aDecimal(cruda?.cantidad, `cantidad (línea ${i + 1})`),
        precioUnitario: this.aDecimal(
          cruda?.precioUnitario,
          `precio unitario (línea ${i + 1})`,
        ),
      };
    });
  }

  /** Redondeo a 2 decimales: es dinero, no una medida. */
  private redondear(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Las líneas guardadas, con su subtotal calculado. */
  calcularLineas(
    lineas: {
      id: number;
      orden: number;
      descripcion: string;
      cantidad: { toString(): string };
      precioUnitario: { toString(): string };
    }[],
  ): LineaCalculada[] {
    return lineas
      .slice()
      .sort((a, b) => a.orden - b.orden || a.id - b.id)
      .map((l) => {
        const cantidad = Number(l.cantidad.toString());
        const precioUnitario = Number(l.precioUnitario.toString());
        return {
          id: l.id,
          orden: l.orden,
          descripcion: l.descripcion,
          cantidad,
          precioUnitario,
          subtotal: this.redondear(cantidad * precioUnitario),
        };
      });
  }

  /** El total del documento: la suma de los subtotales, nunca a mano. */
  total(lineas: LineaCalculada[]): number {
    return this.redondear(lineas.reduce((a, l) => a + l.subtotal, 0));
  }
}
