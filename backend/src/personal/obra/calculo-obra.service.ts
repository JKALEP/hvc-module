import { Injectable } from '@nestjs/common';
import { redondear } from './validacion';
import type { EstadoProyecto } from './dto';
import { estadoDeAvance } from './validacion';

/** Lo mínimo de una jornada para poder calcular sobre ella. */
export interface JornadaCalculable {
  fecha: Date;
  equiposEjecutados: number;
  equiposProgramados: number;
  contratistasProgramados: number;
  asistencias: { id: number }[];
}

/** Una fila de la serie: la jornada con todo lo derivado. */
export interface PuntoSerie {
  fecha: string;
  equiposEjecutados: number;
  equiposProgramados: number;
  /** ejecutados ÷ programados × 100. null si no hubo programados. */
  produccion: number | null;
  /** Σ ejecutados hasta esa fecha ÷ total de equipos × 100. */
  avanceAcumulado: number;
  contratistasProgramados: number;
  contratistasTrabajando: number;
  /** trabajando ÷ programados × 100. null si no hubo programados. */
  calificacionProveedor: number | null;
}

/**
 * Las fórmulas del registro diario. NADA de esto se guarda.
 *
 * Vive aparte del CRUD porque son dos trabajos distintos: aquí no se
 * toca la base de datos, y así las fórmulas se pueden comprobar solas.
 *
 * OJO con la diferencia respecto al modelo anterior: el avance ya no es
 * `Σ ejecutados / Σ programados` sino `Σ ejecutados / totalEquipos del
 * proyecto`. El denominador es ahora una cifra fija de la obra, no la
 * suma de lo que se fue programando. Los dos números NO son comparables.
 */
@Injectable()
export class CalculoObraService {
  /** Porcentaje con dos decimales. null cuando no hay denominador. */
  pct(numerador: number, denominador: number): number | null {
    if (denominador <= 0) return null;
    return redondear((numerador / denominador) * 100);
  }

  /**
   * Producción del día.
   * Un día sin equipos programados no es "0 %", es "no aplica": por eso
   * devuelve null y no cero.
   */
  produccion(ejecutados: number, programados: number): number | null {
    return this.pct(ejecutados, programados);
  }

  /** Calificación del proveedor: quién vino sobre quién se esperaba. */
  calificacion(trabajando: number, programados: number): number | null {
    return this.pct(trabajando, programados);
  }

  /**
   * La serie completa del proyecto, en orden cronológico.
   *
   * El avance acumulado se topa en 100: pasarse de lo contemplado es
   * posible en el mundo real, pero un avance de 112 % rompe el gráfico,
   * la barra y el estado. El exceso sigue visible en los equipos.
   */
  serie(jornadas: JornadaCalculable[], totalEquipos: number): PuntoSerie[] {
    const ordenadas = [...jornadas].sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime(),
    );

    let acumulado = 0;
    return ordenadas.map((j) => {
      acumulado += j.equiposEjecutados;
      const trabajando = j.asistencias.length;
      return {
        fecha: j.fecha.toISOString().slice(0, 10),
        equiposEjecutados: j.equiposEjecutados,
        equiposProgramados: j.equiposProgramados,
        produccion: this.produccion(j.equiposEjecutados, j.equiposProgramados),
        avanceAcumulado: Math.min(100, this.pct(acumulado, totalEquipos) ?? 0),
        contratistasProgramados: j.contratistasProgramados,
        contratistasTrabajando: trabajando,
        calificacionProveedor: this.calificacion(
          trabajando,
          j.contratistasProgramados,
        ),
      };
    });
  }

  /** Avance total: lo ejecutado en toda la obra sobre lo contemplado. */
  avanceTotal(jornadas: JornadaCalculable[], totalEquipos: number): number {
    const ejecutados = jornadas.reduce((a, j) => a + j.equiposEjecutados, 0);
    return Math.min(100, this.pct(ejecutados, totalEquipos) ?? 0);
  }

  estado(avance: number | null): EstadoProyecto {
    return estadoDeAvance(avance);
  }

  /**
   * DÍAS DE ATRASO — PROPUESTA NO VALIDADA CON EL NEGOCIO.
   *
   * ⚠ La fórmula exacta no está confirmada. Da por buenos dos supuestos
   * que quizá no lo sean:
   *   1. que el avance esperado crece LINEALMENTE en el tiempo, y
   *   2. que pasada la fecha fin prevista lo esperado es el 100 %.
   *
   * Una obra con arranque lento y cierre intenso saldrá "atrasada"
   * durante meses aunque vaya a terminar a tiempo.
   *
   *   esperado = (hoy − inicio) / (fin − inicio) × 100      [0..100]
   *   atraso   = (esperado − real) / 100 × duraciónEnDías
   */
  atraso(
    inicio: Date,
    finPrevista: Date,
    avanceReal: number,
    hoy = new Date(),
  ): { avanceEsperado: number; diasAtraso: number } {
    const DIA = 86_400_000;
    const duracion = Math.max(1, Math.round((+finPrevista - +inicio) / DIA));
    const transcurrido = Math.round((+hoy - +inicio) / DIA);

    const avanceEsperado = Math.max(
      0,
      Math.min(100, redondear((transcurrido / duracion) * 100)),
    );
    const diasAtraso = Math.max(
      0,
      Math.round(((avanceEsperado - avanceReal) / 100) * duracion),
    );
    return { avanceEsperado, diasAtraso };
  }
}
