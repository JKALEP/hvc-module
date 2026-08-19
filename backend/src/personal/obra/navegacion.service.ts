import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CarpetaService } from './carpeta.service';
import { ProyectoService } from './proyecto.service';

/**
 * Qué se ve al abrir una carpeta del explorador.
 *
 * Mismo patrón que `NavegacionService` en Fotos: una carpeta contiene
 * subcarpetas Y proyectos a la vez, y la raíz es simplemente
 * `carpetaId = null`. Aquí no hay alcances ni permisos que resolver
 * —quien entra al módulo ve todo—, así que se queda en dos consultas.
 *
 * Los contadores de cada tarjeta de carpeta son de TODO su subárbol, no
 * solo del primer nivel: una carpeta "UPN" que solo contiene "UPN Villa"
 * diría "0 proyectos" si se contara plano, y sería mentira.
 */
@Injectable()
export class NavegacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carpetas: CarpetaService,
    private readonly proyectos: ProyectoService,
  ) {}

  async contenido(carpetaId: number | null) {
    const actual =
      carpetaId === null ? null : await this.carpetas.exigir(carpetaId);

    const [hijas, proyectos] = await Promise.all([
      this.prisma.carpeta.findMany({
        where: { parentId: carpetaId },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, ruta: true },
      }),
      this.proyectos.listarEn(carpetaId),
    ]);

    // Un solo viaje para los contadores de todas las hermanas: se piden
    // los descendientes de todas a la vez y se reparten por prefijo.
    const carpetasConteo = await this.contarSubarboles(hijas);

    return {
      carpeta: actual,
      camino: carpetaId === null ? [] : await this.carpetas.camino(carpetaId),
      carpetas: carpetasConteo,
      proyectos,
    };
  }

  /** Subcarpetas y proyectos de cada subárbol, en dos consultas totales. */
  private async contarSubarboles(
    hijas: { id: number; nombre: string; ruta: string }[],
  ) {
    if (hijas.length === 0) return [];

    const prefijos = hijas.map((h) => h.ruta);
    const [descendientes, proyectos] = await Promise.all([
      this.prisma.carpeta.findMany({
        where: { OR: prefijos.map((r) => ({ ruta: { startsWith: `${r}/` } })) },
        select: { id: true, ruta: true },
      }),
      this.prisma.proyecto.findMany({
        where: { carpetaId: { not: null } },
        select: { carpetaId: true, carpeta: { select: { ruta: true } } },
      }),
    ]);

    return hijas.map((h) => {
      const dentro = (ruta: string) =>
        ruta === h.ruta || ruta.startsWith(`${h.ruta}/`);
      return {
        id: h.id,
        nombre: h.nombre,
        ruta: h.ruta,
        subcarpetas: descendientes.filter((d) => dentro(d.ruta)).length,
        proyectos: proyectos.filter(
          (p) => p.carpeta !== null && dentro(p.carpeta.ruta),
        ).length,
      };
    });
  }
}
