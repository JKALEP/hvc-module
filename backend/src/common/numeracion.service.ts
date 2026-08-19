import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Serie del número de pedido. Es el `001` de `001-000106`.
 *
 * Constante y no columna porque HVC hoy tiene UNA sola serie. El día que
 * haga falta más de una —por sede, por tipo— este es el único sitio que
 * cambia, y la secuencia de abajo pasaría a ser una por serie.
 */
const SERIE = '001';

/** Dígitos del contador. `000106` son seis. */
const DIGITOS = 6;

/** Cualquier cliente de Prisma: el normal o el de dentro de una transacción. */
type ClientePrisma =
  PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * El número de pedido del requerimiento: `001-000106`.
 *
 * ── Por qué una SEQUENCE y no leer el último y sumar 1 ───────────────
 * Leer-y-sumar tiene una carrera: dos usuarios que emiten a la vez leen
 * el mismo último número y piden el mismo siguiente. Con un `@unique`
 * detrás no se duplica, pero la segunda emisión FALLA — y fallar no es
 * resolver el problema, es trasladárselo al usuario. `nextval()` es
 * atómico: dos llamadas simultáneas devuelven dos números distintos sin
 * bloquear ni reintentar.
 *
 * ── Huecos sí, duplicados no ────────────────────────────────────────
 * `nextval()` NO se deshace con un ROLLBACK: si la transacción que crea
 * el requerimiento falla, ese número queda consumido y se pierde. Es el
 * comportamiento correcto para lo que pide la especificación —"único que
 * nunca se repite y nunca se reinicia"—: un hueco en la serie no rompe
 * nada, un número repetido sí. Por eso tampoco se "recicla" el número de
 * un requerimiento cancelado.
 *
 * ── Perpetua ────────────────────────────────────────────────────────
 * No se reinicia por año ni por ningún otro criterio. La secuencia es
 * `NO CYCLE` y `BIGINT`: se agota mucho después de que el formato de
 * seis dígitos se quede corto, y si el contador pasa de 999999 el número
 * simplemente crece a siete dígitos en vez de dar la vuelta y repetirse.
 */
@Injectable()
export class NumeracionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserva el siguiente número de pedido.
   *
   * Se le pasa el cliente de la transacción que está creando el
   * requerimiento para que la reserva y el alta viajen juntas. Con el
   * cliente normal también funciona, solo que el número se consume
   * aunque después no se llegue a guardar nada.
   */
  async siguienteNumeroRequerimiento(cliente?: ClientePrisma): Promise<string> {
    const db = cliente ?? this.prisma;

    // `::text` a propósito: `nextval` devuelve BIGINT, y dejar que
    // atraviese la capa cruda como número obliga a lidiar con BigInt y su
    // serialización. Como lo único que se hace con el valor es rellenarlo
    // con ceros a la izquierda, el texto es el tipo natural.
    //
    // Plantilla etiquetada y no `$queryRawUnsafe`: el nombre de la
    // secuencia es constante y no hay nada del usuario en esta consulta.
    const filas = await db.$queryRaw<
      { n: string }[]
    >`SELECT nextval('requerimiento_numero_seq')::text AS n`;

    const n = filas[0]?.n;
    if (!n) {
      // No debería ocurrir: si la secuencia no existe, Postgres lanza
      // antes de llegar aquí. Cubre el caso de una fila vacía para no
      // devolver "001-undefined" en silencio.
      throw new Error(
        'La secuencia requerimiento_numero_seq no devolvió un número. ' +
          '¿Se aplicó la migración?',
      );
    }

    return `${SERIE}-${n.padStart(DIGITOS, '0')}`;
  }
}
