import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Tope de resultados del autocompletado: el multi-select del formulario
// no necesita más y evita traer la nómina completa en cada tecla.
const LIMITE_AUTOCOMPLETADO = 50;

@Injectable()
export class TrabajadorService {
  constructor(private readonly prisma: PrismaService) {}

  private limpiar(valor: unknown): string | null {
    if (typeof valor === 'string') {
      const s = valor.trim();
      return s === '' ? null : s;
    }
    if (typeof valor === 'number' || typeof valor === 'boolean')
      return String(valor);
    // null, undefined, objetos y arrays: no son texto válido.
    return null;
  }

  /**
   * Autocompletado de trabajadores para el multi-select del reporte diario.
   * Busca coincidencia parcial (insensible a mayúsculas) en nombres,
   * apellidos o dni. Opcionalmente filtra por empresa contratista.
   * Por defecto solo devuelve ACTIVO: no se asigna personal dado de baja.
   */
  async buscar(q?: string, empresaId?: number, incluirInactivos = false) {
    const termino = (q ?? '').trim();

    return this.prisma.trabajador.findMany({
      where: {
        ...(incluirInactivos ? {} : { estado: 'ACTIVO' as const }),
        ...(empresaId !== undefined ? { empresaId } : {}),
        ...(termino
          ? {
              OR: [
                {
                  nombres: { contains: termino, mode: 'insensitive' as const },
                },
                {
                  apellidos: {
                    contains: termino,
                    mode: 'insensitive' as const,
                  },
                },
                { dni: { contains: termino, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }, { id: 'asc' }],
      take: LIMITE_AUTOCOMPLETADO,
      select: {
        id: true,
        dni: true,
        nombres: true,
        apellidos: true,
        empresaId: true,
        estado: true,
        empresa: { select: { id: true, nombre: true, ruc: true } },
      },
    });
  }

  async detalle(id: number) {
    const trabajador = await this.prisma.trabajador.findUnique({
      where: { id },
      include: {
        empresa: { select: { id: true, nombre: true, ruc: true } },
        _count: { select: { participaciones: true } },
      },
    });
    if (!trabajador)
      throw new NotFoundException(`Trabajador ${id} no encontrado.`);
    return trabajador;
  }

  /** Catálogo de empresas contratistas, para poblar el filtro del autocompletado. */
  async listarEmpresas(estado?: string) {
    const filtro = this.limpiar(estado)?.toUpperCase();

    return this.prisma.empresaContratista.findMany({
      where: filtro === 'TODOS' ? {} : { estado: 'ACTIVO' as const },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { trabajadores: true } } },
    });
  }
}
