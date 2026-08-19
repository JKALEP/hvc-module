import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AccionCostos,
  EntidadCostos,
} from '../../../generated/prisma/enums';
import type { UsuarioAutenticado } from '../../auth/tipos';

/** Un evento por escribir. El autor se pasa aparte, una sola vez. */
export interface EventoNuevo {
  /// El hilo de §64. Null en las acciones de administración, que no
  /// cuelgan de ningún requerimiento.
  requerimientoId?: number | null;
  entidad: EntidadCostos;
  entidadId: number;
  accion: AccionCostos;
  campoAfectado?: string | null;
  valorAnterior?: string | null;
  valorNuevo?: string | null;
  motivo?: string | null;
  descripcion?: string | null;
}

/** Cualquier cliente de Prisma: el normal o el de dentro de una transacción. */
type ClientePrisma =
  PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/**
 * La bitácora del módulo Costos (§53, §64).
 *
 * Tabla y service propios, no una extensión de `HistorialService` de
 * Equipos: aquélla ata cada evento a un equipo o a una incidencia con un
 * CHECK en la base, y aquí hay trece clases de entidad. La FORMA sí se
 * copia de allí, porque funciona.
 *
 * Se escribe desde la capa de servicio en cada operación relevante, no
 * desde un ajuste que alguien pueda apagar: §53 dice que un valor
 * histórico no se pierde en silencio, y eso no es opcional.
 *
 * Todo lo que entra aquí guarda el NOMBRE del usuario además de su id.
 * La FK es SetNull —dar de baja una cuenta no puede vaciar la bitácora—
 * y una auditoría que ya no sabe quién hizo qué no es una auditoría.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escribe varios eventos de golpe. Sin eventos, no hace nada.
   *
   * Acepta el cliente de una transacción para que el hecho y su registro
   * viajen juntos: si el alta se deshace, su evento también.
   */
  async registrar(
    usuario: UsuarioAutenticado | null,
    eventos: EventoNuevo[],
    cliente?: ClientePrisma,
  ): Promise<void> {
    if (eventos.length === 0) return;
    const db = cliente ?? this.prisma;

    await db.eventoCostos.createMany({
      data: eventos.map((e) => ({
        requerimientoId: e.requerimientoId ?? null,
        entidad: e.entidad,
        entidadId: e.entidadId,
        accion: e.accion,
        usuarioId: usuario?.id ?? null,
        usuarioNombre: usuario?.nombre ?? null,
        campoAfectado: e.campoAfectado ?? null,
        valorAnterior: e.valorAnterior ?? null,
        valorNuevo: e.valorNuevo ?? null,
        motivo: e.motivo ?? null,
        descripcion: e.descripcion ?? null,
      })),
    });
  }

  /** Atajo para un solo evento, que es el caso corriente. */
  registrarUno(
    usuario: UsuarioAutenticado | null,
    evento: EventoNuevo,
    cliente?: ClientePrisma,
  ): Promise<void> {
    return this.registrar(usuario, [evento], cliente);
  }

  /**
   * Compara dos versiones de una fila y devuelve un evento por campo
   * cambiado.
   *
   * Se compara el TEXTO LEGIBLE, no la columna cruda: al que audita le
   * interesa que el cliente pasó de «Alicorp» a «Backus», no que
   * `clienteId` pasó de 4 a 9. Un id no le dice nada a nadie.
   *
   * Un campo que no aparece en `antes` no se compara: los DTO del módulo
   * son parciales y «no lo mandaron» no es «lo vaciaron».
   */
  diferencias(
    antes: Record<string, string | null>,
    despues: Record<string, string | null>,
    base: Omit<
      EventoNuevo,
      'accion' | 'campoAfectado' | 'valorAnterior' | 'valorNuevo'
    >,
  ): EventoNuevo[] {
    const eventos: EventoNuevo[] = [];

    for (const campo of Object.keys(despues)) {
      const a = antes[campo] ?? null;
      const d = despues[campo] ?? null;
      if (a === d) continue;
      eventos.push({
        ...base,
        accion: 'EDICION',
        campoAfectado: campo,
        valorAnterior: a,
        valorNuevo: d,
      });
    }

    return eventos;
  }

  /**
   * La cadena completa de un requerimiento (§64), del primer hecho al
   * último.
   *
   * En orden ASCENDENTE, al revés que las bitácoras de Equipos: aquello
   * es una lista de «lo último que pasó» y esto es un relato —Luis creó →
   * Rodolfo observó → … → Luis registró el costo— que solo se lee hacia
   * adelante.
   */
  async deRequerimiento(requerimientoId: number) {
    return this.prisma.eventoCostos.findMany({
      where: { requerimientoId },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    });
  }

  /** Lo que le ha pasado a una fila concreta, de lo más reciente hacia atrás. */
  async deEntidad(entidad: EntidadCostos, entidadId: number) {
    return this.prisma.eventoCostos.findMany({
      where: { entidad, entidadId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }
}
