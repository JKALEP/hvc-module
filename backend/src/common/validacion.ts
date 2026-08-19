import { BadRequestException } from '@nestjs/common';
import { describir } from './texto';

/**
 * Conversión de ids que llegan del cliente.
 *
 * Estaban duplicadas en `sede.service` y `reporte-diario.service` con
 * mensajes distintos para el mismo fallo. El mensaje se pasa por
 * parámetro para que cada módulo hable su propio idioma —"carpeta",
 * "proyecto"— sin reimplementar la comprobación.
 */
export function aId(valor: unknown, mensaje: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0)
    throw new BadRequestException(
      `${mensaje} Recibido: "${describir(valor)}".`,
    );
  return n;
}

/** Igual, pero admite ausencia: null, undefined y "" son null. */
export function aIdOpcional(valor: unknown, mensaje: string): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return aId(valor, mensaje);
}
