import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { limpiar } from '../../common/texto';

/** Cuántas filas devuelve como mucho una página. */
const POR_PAGINA = 100;

/**
 * La Base de Costos (§52) — solo lectura.
 *
 * Sustituye a la «Tabla Maestra», que leía `Producto`: una tabla donde
 * cada fila era a la vez el ítem pedido, la cotización y el costo, sin
 * saber de qué requerimiento venía ni quién la había aprobado. Aquí cada
 * fila es un `CostoItem`, y por tanto trae consigo su requerimiento, su
 * proveedor, su cotización, quién lo registró y cuándo — que es
 * exactamente lo que §52 pide conservar.
 *
 * Service de solo lectura aparte del CRUD, igual que
 * `proyecto-analitica` o `indicadores-mensual`: responde otra pregunta.
 * El CRUD registra lo que costó un requerimiento; esto responde «¿cuánto
 * hemos pagado por esto históricamente?».
 *
 * Pagina, al revés que la Tabla Maestra, que hacía `findMany` sin `take`
 * sobre todo lo que hubiera. Un histórico de costos solo crece.
 */
@Injectable()
export class BaseCostosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca en el histórico por descripción, proveedor o RUC.
   *
   * El total de la línea NO se guarda: es cantidad × costoUnitario y se
   * calcula aquí, igual que en los documentos de Equipos.
   */
  async buscar(filtros: { q?: string; pagina?: number }) {
    const termino = limpiar(filtros.q);
    const pagina = Math.max(1, Math.trunc(Number(filtros.pagina) || 1));

    const where = termino
      ? {
          OR: [
            {
              descripcion: { contains: termino, mode: 'insensitive' as const },
            },
            {
              costo: {
                proveedorRazonSocial: {
                  contains: termino,
                  mode: 'insensitive' as const,
                },
              },
            },
            {
              costo: {
                proveedorRuc: {
                  contains: termino,
                  mode: 'insensitive' as const,
                },
              },
            },
          ],
        }
      : {};

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.costoItem.count({ where }),
      this.prisma.costoItem.findMany({
        where,
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: {
          id: true,
          descripcion: true,
          unidad: true,
          cantidad: true,
          detalleObservacion: true,
          referencias: true,
          costoUnitario: true,
          creadoEn: true,
          costo: {
            select: {
              id: true,
              proveedorRazonSocial: true,
              proveedorRuc: true,
              creadoEn: true,
              requerimiento: {
                select: { id: true, numero: true, clienteNombre: true },
              },
              registradoPor: { select: { id: true, nombre: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      pagina,
      porPagina: POR_PAGINA,
      filas: filas.map((f) => {
        const costoUnitario = Number(f.costoUnitario.toString());
        return {
          id: f.id,
          descripcion: f.descripcion,
          unidad: f.unidad,
          cantidad: f.cantidad,
          detalleObservacion: f.detalleObservacion,
          referencias: f.referencias,
          costoUnitario,
          // Dinero: se redondea a 2 decimales, no a los 4 del unitario.
          costoTotal: Math.round(costoUnitario * f.cantidad * 100) / 100,
          registradoEn: f.costo.creadoEn,
          proveedor: f.costo.proveedorRazonSocial,
          proveedorRuc: f.costo.proveedorRuc,
          requerimientoId: f.costo.requerimiento.id,
          requerimientoNumero: f.costo.requerimiento.numero,
          cliente: f.costo.requerimiento.clienteNombre,
          registradoPor: f.costo.registradoPor?.nombre ?? null,
        };
      }),
    };
  }
}
