import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { claveFecha } from './validacion';

/**
 * Todo lo que se deduce de la asistencia de una obra.
 *
 * Nada de esto se guarda: son agregados sobre `asistencias_jornada`. Y
 * se agrupa por el SNAPSHOT (`grupoNombre`, `documento`), no por la FK:
 * si alguien cambió de contrata en mayo, sus días de marzo tienen que
 * seguir contando para la empresa con la que vino en marzo.
 *
 * Fuera de alcance a propósito (pertenece a un futuro módulo Personal):
 * el historial de una persona ENTRE proyectos. Aquí todo es de esta obra.
 */
@Injectable()
export class AnaliticaService {
  constructor(private readonly prisma: PrismaService) {}

  private async asistenciasDe(proyectoId: number) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, encargadoNombre: true },
    });
    if (!proyecto) throw new NotFoundException('Ese proyecto ya no existe.');

    const filas = await this.prisma.asistenciaJornada.findMany({
      where: { jornada: { proyectoId } },
      select: {
        fichaPersonalId: true,
        nombreCompleto: true,
        documento: true,
        grupoNombre: true,
        jornada: { select: { fecha: true } },
      },
    });
    return { proyecto, filas };
  }

  /**
   * Empresas que pusieron gente, con sus días-persona.
   *
   * `participaciones` es la suma de días-persona (alguien que vino 5
   * días cuenta 5); `personal` son personas distintas. Los dos números
   * hacen falta: 20 participaciones pueden ser 20 personas un día o 2
   * personas diez días.
   */
  async empresas(proyectoId: number) {
    const { proyecto, filas } = await this.asistenciasDe(proyectoId);

    const porEmpresa = new Map<
      string,
      {
        participaciones: number;
        personas: Map<string, { nombre: string; fechas: string[] }>;
      }
    >();

    for (const f of filas) {
      let e = porEmpresa.get(f.grupoNombre);
      if (!e) {
        e = { participaciones: 0, personas: new Map() };
        porEmpresa.set(f.grupoNombre, e);
      }
      e.participaciones += 1;
      let p = e.personas.get(f.documento);
      if (!p) {
        p = { nombre: f.nombreCompleto, fechas: [] };
        e.personas.set(f.documento, p);
      }
      p.fechas.push(claveFecha(f.jornada.fecha));
    }

    return [...porEmpresa.entries()]
      .map(([empresa, e]) => ({
        empresa,
        // Se resalta a quien no es de la encargada: es lo que permite ver
        // de un vistazo cuánto personal externo entró a la obra.
        esEncargada: empresa === proyecto.encargadoNombre,
        participaciones: e.participaciones,
        personal: e.personas.size,
        detalle: [...e.personas.entries()]
          .map(([documento, p]) => ({
            documento,
            nombre: p.nombre,
            dias: p.fechas.length,
            fechas: p.fechas.sort(),
          }))
          .sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre)),
      }))
      .sort((a, b) => b.participaciones - a.participaciones);
  }

  /**
   * Personas que participaron, con sus días.
   *
   * Sin porcentaje por persona a propósito: no hay un 100 % esperado
   * individual, así que un porcentaje sugeriría una meta que no existe.
   * La barra es proporcional a quien más días acumuló.
   */
  async participacion(proyectoId: number) {
    const { filas } = await this.asistenciasDe(proyectoId);

    const porPersona = new Map<
      string,
      {
        nombre: string;
        empresa: string;
        fichaId: number | null;
        fechas: string[];
      }
    >();
    for (const f of filas) {
      let p = porPersona.get(f.documento);
      if (!p) {
        p = {
          nombre: f.nombreCompleto,
          empresa: f.grupoNombre,
          fichaId: f.fichaPersonalId,
          fechas: [],
        };
        porPersona.set(f.documento, p);
      }
      p.fechas.push(claveFecha(f.jornada.fecha));
      // La empresa que se muestra es la del último día en que vino.
      p.empresa = f.grupoNombre;
    }

    const personas = [...porPersona.entries()]
      .map(([documento, p]) => ({
        documento,
        fichaPersonalId: p.fichaId,
        nombre: p.nombre,
        empresa: p.empresa,
        dias: p.fechas.length,
        fechas: p.fechas.sort(),
      }))
      .sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre));

    return {
      personas,
      // El filtro se arma con quien REALMENTE participó: nunca ofrece una
      // empresa sin nadie dentro.
      empresas: [...new Set(personas.map((p) => p.empresa))].sort(),
      maximoDias: personas[0]?.dias ?? 0,
    };
  }

  /**
   * Calendario de una persona en la obra: qué días vino y cuáles no,
   * sobre todas las fechas con jornada registrada.
   */
  async calendarioDe(proyectoId: number, documento: string) {
    const { filas } = await this.asistenciasDe(proyectoId);

    const jornadas = await this.prisma.jornada.findMany({
      where: { proyectoId },
      orderBy: { fecha: 'asc' },
      select: { fecha: true },
    });

    const suyas = filas.filter((f) => f.documento === documento);
    if (suyas.length === 0)
      throw new NotFoundException('Esa persona no participó en este proyecto.');

    const vino = new Set(suyas.map((f) => claveFecha(f.jornada.fecha)));
    const dias = jornadas.map((j) => {
      const fecha = claveFecha(j.fecha);
      return { fecha, participo: vino.has(fecha) };
    });

    return {
      documento,
      nombre: suyas[suyas.length - 1].nombreCompleto,
      empresa: suyas[suyas.length - 1].grupoNombre,
      diasParticipados: vino.size,
      diasDelProyecto: dias.length,
      dias,
    };
  }
}
