import { api } from './api';
import type {
  IndicadoresMensual,
  EmpresaDetalleMensual,
  RangoMeses,
  FilaSupervisor,
  ResumenSupervisor,
  Periodo,
} from '@/types/models';

// Modo "Meses" de /personal y seguimiento de supervisores.

interface FiltrosMensual extends RangoMeses {
  empresaId: number | null;
  proyectoId: number | null;
}

function params(f: FiltrosMensual) {
  return {
    ...(f.desdeMes ? { desdeMes: f.desdeMes } : {}),
    ...(f.hastaMes ? { hastaMes: f.hastaMes } : {}),
    ...(f.empresaId !== null ? { empresaId: f.empresaId } : {}),
    ...(f.proyectoId !== null ? { proyectoId: f.proyectoId } : {}),
  };
}

/** Indicadores de personal desglosados mes a mes. */
export async function obtenerIndicadoresMensual(
  filtros: FiltrosMensual,
): Promise<IndicadoresMensual> {
  const { data } = await api.get<IndicadoresMensual>(
    '/indicadores/personal-mensual',
    { params: params(filtros) },
  );
  return data;
}

/** Detalle de una contratista: sus trabajadores con días por mes. */
export async function obtenerEmpresaMensual(
  empresaId: number,
  filtros: FiltrosMensual,
): Promise<EmpresaDetalleMensual> {
  const { data } = await api.get<EmpresaDetalleMensual>(
    `/indicadores/empresa/${empresaId}/mensual`,
    {
      params: {
        ...(filtros.desdeMes ? { desdeMes: filtros.desdeMes } : {}),
        ...(filtros.hastaMes ? { hastaMes: filtros.hastaMes } : {}),
        ...(filtros.proyectoId !== null
          ? { proyectoId: filtros.proyectoId }
          : {}),
      },
    },
  );
  return data;
}

// ── Supervisores ──

/** Tabla comparativa de todos los supervisores. */
export async function obtenerComparacionSupervisores(
  periodo: Periodo,
): Promise<FilaSupervisor[]> {
  const { data } = await api.get<FilaSupervisor[]>('/supervisor/comparacion', {
    params: {
      ...(periodo.desde ? { desde: periodo.desde } : {}),
      ...(periodo.hasta ? { hasta: periodo.hasta } : {}),
    },
  });
  return data;
}

/** Obras que ha llevado un supervisor (histórico) + desempeño del período. */
export async function obtenerResumenSupervisor(
  id: number,
  periodo: Periodo,
): Promise<ResumenSupervisor> {
  const { data } = await api.get<ResumenSupervisor>(
    `/supervisor/${id}/resumen`,
    {
      params: {
        ...(periodo.desde ? { desde: periodo.desde } : {}),
        ...(periodo.hasta ? { hasta: periodo.hasta } : {}),
      },
    },
  );
  return data;
}
