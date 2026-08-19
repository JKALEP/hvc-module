import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoCampo } from '../../generated/prisma/enums';
import { limpiar } from '../common/texto';
import { aplanarValores } from './valor-texto';

/** Un filtro por un campo dinámico. */
export interface FiltroCampo {
  /** Clave del campo, no su id: el frontend manda algo legible. */
  clave: string;
  /** Texto, número, id de opción o "true"/"false", según el tipo. */
  valor: string;
}

export interface FiltrosEquipo {
  organizacionId: number;
  /** Solo los de esta ubicación. Sin subárbol: se navega nivel a nivel. */
  nodoId?: number | null;
  /** Busca en el código interno y en todos los valores de texto. */
  q?: string | null;
  campos?: FiltroCampo[];
  pagina?: number;
  porPagina?: number;
}

const POR_PAGINA = 50;

/**
 * Listado y filtrado de equipos.
 *
 * Vive aparte del CRUD desde el primer día porque el filtrado sobre EAV
 * no es un `where` más: cada campo por el que se filtra es una condición
 * sobre una FILA DISTINTA de `valores_campo`, así que dos filtros en Y
 * no se pueden expresar como dos condiciones del mismo `where` —eso
 * pediría que una sola fila tuviera los dos valores a la vez, y no
 * existe—.
 *
 * La forma que sí funciona con el query builder es anidar un `AND` de
 * `some`: «equipos que tengan ALGUNA fila que cumpla A **y** ALGUNA fila
 * que cumpla B». Prisma lo traduce a un EXISTS por condición, que con
 * los índices `(definicionCampoId, valor*)` es una búsqueda por índice y
 * no un escaneo.
 */
@Injectable()
export class EquipoBusquedaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Traduce un filtro a la condición que le toca según el TIPO del campo.
   *
   * Hace falta porque el valor vive en una columna distinta en cada
   * caso: filtrar «Marca = Carrier» mira `opcionId` si Marca es una
   * lista, y `valorTexto` si es texto libre.
   */
  private condicionDe(
    campo: { id: number; tipo: TipoCampo; nombre: string },
    valor: string,
  ) {
    const base = { definicionCampoId: campo.id };

    switch (campo.tipo) {
      case TipoCampo.LISTA: {
        const id = Number(valor);
        if (!Number.isInteger(id))
          throw new BadRequestException(
            `El filtro de "${campo.nombre}" espera el id de una opción.`,
          );
        return { ...base, opcionId: id };
      }

      case TipoCampo.SELECCION_MULTIPLE: {
        const id = Number(valor);
        if (!Number.isInteger(id))
          throw new BadRequestException(
            `El filtro de "${campo.nombre}" espera el id de una opción.`,
          );
        // La opción vive en la tabla puente, no en la fila de valor.
        return { ...base, opcionesElegidas: { some: { opcionId: id } } };
      }

      case TipoCampo.BOOLEANO:
        return { ...base, valorBooleano: valor === 'true' || valor === 'si' };

      case TipoCampo.NUMERO_ENTERO: {
        const n = Number(valor);
        if (!Number.isInteger(n))
          throw new BadRequestException(
            `El filtro de "${campo.nombre}" espera un número entero.`,
          );
        return { ...base, valorEntero: n };
      }

      case TipoCampo.NUMERO_DECIMAL:
      case TipoCampo.MONEDA: {
        const n = Number(valor);
        if (!Number.isFinite(n))
          throw new BadRequestException(
            `El filtro de "${campo.nombre}" espera un número.`,
          );
        return { ...base, valorNumero: n };
      }

      case TipoCampo.FECHA:
      case TipoCampo.FECHA_HORA:
        return { ...base, valorFecha: new Date(valor) };

      default:
        // Texto y sus variantes: coincidencia parcial, sin distinguir
        // mayúsculas. Es lo que espera quien escribe en un filtro.
        return {
          ...base,
          valorTexto: { contains: valor, mode: 'insensitive' as const },
        };
    }
  }

  /**
   * Los equipos que cumplen TODOS los filtros.
   *
   * Devuelve las filas ya aplanadas por `valor-texto.ts`: cada equipo
   * con sus valores como un objeto indexado por clave, que es lo que
   * consumen la tabla, la ficha y los reportes.
   */
  async listar(filtros: FiltrosEquipo) {
    const {
      organizacionId,
      nodoId,
      q,
      campos = [],
      pagina = 1,
      porPagina = POR_PAGINA,
    } = filtros;

    const definiciones = await this.prisma.definicionCampo.findMany({
      where: { organizacionId },
      select: { id: true, clave: true, nombre: true, tipo: true, orden: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
    const porClave = new Map(definiciones.map((d) => [d.clave, d]));

    // Un `some` por filtro, todos dentro de un AND: cada uno mira una
    // fila distinta de valores_campo.
    const condiciones = campos
      .filter((f) => limpiar(f.valor))
      .map((f) => {
        const campo = porClave.get(f.clave);
        if (!campo)
          throw new BadRequestException(
            `El campo "${f.clave}" no existe en esta organización.`,
          );
        return { valores: { some: this.condicionDe(campo, f.valor.trim()) } };
      });

    const busqueda = limpiar(q);
    const where = {
      organizacionId,
      ...(nodoId ? { nodoId } : {}),
      ...(condiciones.length > 0 ? { AND: condiciones } : {}),
      ...(busqueda
        ? {
            OR: [
              {
                codigoInterno: {
                  contains: busqueda,
                  mode: 'insensitive' as const,
                },
              },
              {
                valores: {
                  some: {
                    valorTexto: {
                      contains: busqueda,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, filas] = await Promise.all([
      this.prisma.equipo.count({ where }),
      this.prisma.equipo.findMany({
        where,
        orderBy: [{ codigoInterno: 'asc' }, { id: 'asc' }],
        skip: (Math.max(1, pagina) - 1) * porPagina,
        take: porPagina,
        include: {
          nodo: { select: { id: true, nombre: true } },
          valores: {
            include: {
              definicionCampo: { select: { clave: true } },
              opcion: { select: { etiqueta: true } },
              opcionesElegidas: {
                include: { opcion: { select: { etiqueta: true } } },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      pagina,
      porPagina,
      // Las columnas que la tabla debe pintar, en el orden configurado.
      columnas: definiciones.map((d) => ({
        clave: d.clave,
        nombre: d.nombre,
        tipo: d.tipo,
      })),
      equipos: filas.map((e) => ({
        id: e.id,
        codigoInterno: e.codigoInterno,
        nodo: e.nodo,
        actualizadoEn: e.actualizadoEn,
        valores: aplanarValores(e.valores),
      })),
    };
  }
}
