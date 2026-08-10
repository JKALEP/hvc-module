import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaestroService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SECCIÓN 3 — Tabla maestra (solo consulta).
   * Busca coincidencia parcial (insensible a mayúsculas) en descripción,
   * proveedor o ruc. Si no hay término, devuelve todos los productos.
   */
  async buscar(q?: string) {
    const termino = (q ?? '').trim();

    const where =
      termino === ''
        ? {}
        : {
            OR: [
              {
                descripcion: {
                  contains: termino,
                  mode: 'insensitive' as const,
                },
              },
              {
                proveedor: { contains: termino, mode: 'insensitive' as const },
              },
              { ruc: { contains: termino, mode: 'insensitive' as const } },
            ],
          };

    return this.prisma.producto.findMany({
      where,
      orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        unidadMedida: true,
        cantidad: true,
        detalles: true,
        referencias: true,
        precioUnitario: true,
        proveedor: true,
        ruc: true,
        estado: true,
        importacionId: true,
      },
    });
  }
}
