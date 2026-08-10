import { api } from './api';
import type {
  Supervisor,
  Trabajador,
  EmpresaContratista,
} from '@/types/models';

// Catálogos de personal: supervisores, empresas y trabajadores.
// La nómina (empresas y trabajadores) se carga por SQL directo: aquí
// solo se consulta. Lo de proyectos vive en proyectoService.ts.

/** Lista supervisores activos. */
export async function listarSupervisores(): Promise<Supervisor[]> {
  const { data } = await api.get<Supervisor[]>('/supervisor');
  return data;
}

/** Crea un supervisor. */
export async function crearSupervisor(payload: {
  nombre: string;
}): Promise<Supervisor> {
  const { data } = await api.post<Supervisor>('/supervisor', payload);
  return data;
}

/** Catálogo de empresas contratistas (para los filtros). */
export async function listarEmpresas(): Promise<EmpresaContratista[]> {
  const { data } = await api.get<EmpresaContratista[]>('/trabajador/empresas');
  return data;
}

/**
 * Autocompletado de trabajadores. Devuelve máximo 50 y solo ACTIVO.
 * `q` ya debe venir con debounce aplicado.
 */
export async function buscarTrabajadores(
  q: string,
  empresaId: number | null,
): Promise<Trabajador[]> {
  const { data } = await api.get<Trabajador[]>('/trabajador', {
    params: {
      ...(q ? { q } : {}),
      ...(empresaId !== null ? { empresaId } : {}),
    },
  });
  return data;
}
