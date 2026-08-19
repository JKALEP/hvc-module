import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  crearCliente,
  crearOpcion,
  crearSupervisor,
  editarCliente,
  editarOpcion,
  editarSupervisor,
  eliminarCliente,
  eliminarOpcion,
  eliminarSupervisor,
  listarClientes,
  listarOpciones,
  listarSupervisores,
} from '@/modules/costos/services/adminService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import type {
  ClienteCostosCompleto,
  GuardarOpcionPayload,
  SupervisorCompleto,
  TipoCatalogo,
} from '@/modules/costos/types';

/**
 * Los tres maestros de administración: catálogos, clientes y
 * supervisores (§58, §13).
 *
 * Un archivo y no tres porque en el backend son UN controller
 * —`CatalogoController`— y en §59 son UNA pantalla. Mismo criterio que
 * `useCotizaciones`, que agrupa lo que allí son cuatro services detrás
 * de un controller. Los proveedores quedan fuera: tienen controller
 * propio, los toca también el Gestor y se buscan desde otra pantalla.
 *
 * Todas las escrituras invalidan además `opcionesRequerimiento`: los
 * selectores de §13 se alimentan de estas mismas tablas por otra ruta y
 * con otra forma, así que desactivar una unidad aquí tiene que dejar de
 * ofrecerse allí sin recargar la página.
 */

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      ['opciones-catalogo'],
      ['clientes-costos'],
      ['supervisores-costos'],
      QUERY_KEYS.opcionesRequerimiento,
    ])
      void qc.invalidateQueries({ queryKey: key });
  };
}

/**
 * Los mensajes de error salen TAL CUAL del backend.
 *
 * Es donde viven las reglas que los producen —`exigirSinUso` dice
 * cuántos lo usan y ofrece desactivar en su lugar, y el conflicto de
 * unicidad dice qué valor está repetido—. Reescribirlos aquí sería
 * tener dos versiones de la misma regla, y la de la pantalla se quedaría
 * atrás en cuanto cambiara la otra.
 */
const alFallar = (porDefecto: string) => (error: unknown) =>
  toast.error(getErrorMessage(error, porDefecto), { duration: 8000 });

// ── Catálogos ──

export function useOpcionesCatalogo(tipo: TipoCatalogo) {
  return useQuery({
    queryKey: QUERY_KEYS.opcionesCatalogo(tipo),
    queryFn: () => listarOpciones(tipo),
  });
}

export function useCrearOpcion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (payload: GuardarOpcionPayload) => crearOpcion(payload),
    onSuccess: (opcion) => {
      invalidar();
      toast.success(`Se añadió "${opcion.valor}"`);
    },
    onError: alFallar('No se pudo crear la opción'),
  });
}

export function useEditarOpcion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Omit<GuardarOpcionPayload, 'tipo'>;
    }) => editarOpcion(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Cambios guardados');
    },
    onError: alFallar('No se pudieron guardar los cambios'),
  });
}

export function useEliminarOpcion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => eliminarOpcion(id),
    onSuccess: () => {
      invalidar();
      toast.success('Opción eliminada');
    },
    onError: alFallar('No se pudo eliminar'),
  });
}

// ── Clientes ──

export function useClientesCostos(q: string) {
  return useQuery({
    queryKey: QUERY_KEYS.clientesCostos(q),
    queryFn: () => listarClientes(q),
    placeholderData: (anterior) => anterior,
  });
}

export function useCrearCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (payload: Partial<ClienteCostosCompleto>) =>
      crearCliente(payload),
    onSuccess: (cliente) => {
      invalidar();
      toast.success(`Se dio de alta a "${cliente.nombre}"`);
    },
    onError: alFallar('No se pudo crear el cliente'),
  });
}

export function useEditarCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<ClienteCostosCompleto>;
    }) => editarCliente(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Cambios guardados');
    },
    onError: alFallar('No se pudieron guardar los cambios'),
  });
}

export function useEliminarCliente() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => eliminarCliente(id),
    onSuccess: () => {
      invalidar();
      toast.success('Cliente eliminado');
    },
    onError: alFallar('No se pudo eliminar'),
  });
}

// ── Supervisores ──

export function useSupervisoresCostos(q: string) {
  return useQuery({
    queryKey: QUERY_KEYS.supervisoresCostos(q),
    queryFn: () => listarSupervisores(q),
    placeholderData: (anterior) => anterior,
  });
}

export function useCrearSupervisor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (payload: Partial<SupervisorCompleto>) =>
      crearSupervisor(payload),
    onSuccess: (supervisor) => {
      invalidar();
      toast.success(`Se dio de alta a "${supervisor.nombre}"`);
    },
    onError: alFallar('No se pudo crear el supervisor'),
  });
}

export function useEditarSupervisor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<SupervisorCompleto>;
    }) => editarSupervisor(id, payload),
    onSuccess: () => {
      invalidar();
      toast.success('Cambios guardados');
    },
    onError: alFallar('No se pudieron guardar los cambios'),
  });
}

export function useEliminarSupervisor() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => eliminarSupervisor(id),
    onSuccess: () => {
      invalidar();
      toast.success('Supervisor eliminado');
    },
    onError: alFallar('No se pudo eliminar'),
  });
}
