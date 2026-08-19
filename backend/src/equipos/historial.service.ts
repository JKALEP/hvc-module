import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoEventoHistorial } from '../../generated/prisma/enums';

/** Un evento por escribir. El dueño es un equipo O una incidencia. */
export interface EventoNuevo {
  equipoId?: number;
  incidenciaId?: number;
  tipo: TipoEventoHistorial;
  usuarioId?: number | null;
  campoAfectado?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  descripcion?: string | null;
}

/** Lo que se compara para saber qué cambió. */
export interface Instantanea {
  /** clave del campo → texto legible de su valor */
  valores: Record<string, string>;
  nodo?: string;
  codigoInterno?: string | null;
}

/**
 * La bitácora de equipos e incidencias.
 *
 * Se escribe desde la capa de servicio en cada operación relevante, NO
 * desde un campo que la organización tenga que configurar: la
 * trazabilidad no es opcional ni depende de cómo cada cliente arme su
 * estructura.
 *
 * Cada evento pertenece a un equipo O a una incidencia, nunca a ambos —
 * la base lo exige con un CHECK, así que un error aquí no pasa
 * inadvertido.
 */
@Injectable()
export class HistorialService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compara dos instantáneas y devuelve un evento por cada diferencia.
   *
   * Se compara el TEXTO LEGIBLE y no la columna cruda: al historial le
   * interesa que «Marca» pasó de «Carrier» a «York», no que `opcionId`
   * pasó de 4 a 9. Un id no le dice nada a quien audita.
   */
  diferencias(
    antes: Instantanea,
    despues: Instantanea,
    base: {
      equipoId?: number;
      incidenciaId?: number;
      usuarioId?: number | null;
    },
  ): EventoNuevo[] {
    const eventos: EventoNuevo[] = [];
    const claves = new Set([
      ...Object.keys(antes.valores),
      ...Object.keys(despues.valores),
    ]);

    for (const clave of claves) {
      const a = antes.valores[clave] ?? '';
      const d = despues.valores[clave] ?? '';
      if (a === d) continue;
      eventos.push({
        ...base,
        tipo: TipoEventoHistorial.CAMBIO_CAMPO,
        campoAfectado: clave,
        valorAnterior: a || null,
        valorNuevo: d || null,
      });
    }

    if (antes.nodo !== undefined && antes.nodo !== despues.nodo)
      eventos.push({
        ...base,
        tipo: TipoEventoHistorial.CAMBIO_CAMPO,
        campoAfectado: 'ubicacion',
        valorAnterior: antes.nodo ?? null,
        valorNuevo: despues.nodo ?? null,
      });

    if (
      antes.codigoInterno !== undefined &&
      antes.codigoInterno !== despues.codigoInterno
    )
      eventos.push({
        ...base,
        tipo: TipoEventoHistorial.CAMBIO_CAMPO,
        campoAfectado: 'codigo_interno',
        valorAnterior: antes.codigoInterno ?? null,
        valorNuevo: despues.codigoInterno ?? null,
      });

    return eventos;
  }

  /** Escribe varios eventos de golpe. Sin eventos, no hace nada. */
  async registrar(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    eventos: EventoNuevo[],
  ) {
    if (eventos.length === 0) return;
    await tx.eventoHistorial.createMany({ data: eventos });
  }

  /** La bitácora de un equipo, de lo más reciente a lo más antiguo. */
  async deEquipo(equipoId: number) {
    return this.prisma.eventoHistorial.findMany({
      where: { equipoId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      include: { usuario: { select: { id: true, nombre: true } } },
      take: 200,
    });
  }

  /** La de una incidencia. Llega en la fase siguiente, ya sirve. */
  async deIncidencia(incidenciaId: number) {
    return this.prisma.eventoHistorial.findMany({
      where: { incidenciaId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      include: { usuario: { select: { id: true, nombre: true } } },
      take: 200,
    });
  }
}
