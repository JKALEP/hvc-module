import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  crearFicha,
  editarFicha,
  duplicarFicha,
  moverFichas,
  eliminarFichas,
  previsualizarExcel,
  importarExcel,
  exportarExcel,
} from '@/modules/personal/services/gestionPersonalService';
import { getErrorMessage } from '@/shared/services/api';
import { useInvalidarPeriodo } from '@/modules/personal/hooks/useGestionPersonal';
import type {
  TipoPersonal,
  DatosFicha,
  HojaAImportar,
  ResolucionConflicto,
} from '@/modules/personal/types';

/**
 * Las personas de la lista y el ida y vuelta con Excel.
 *
 * Todas las escrituras invalidan el periodo abierto, que es lo único que
 * la pantalla muestra.
 */

export function useCrearFicha(anio: number, mes: number, tipo: TipoPersonal) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (vars: { grupoId: number } & DatosFicha) => crearFicha(vars),
    onSuccess: () => invalidar(),
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo agregar a la persona')),
  });
}

/**
 * Edición inline: se manda solo el campo que cambió.
 *
 * Sin toast en el camino feliz. Guardar una celda pasa docenas de veces
 * seguidas mientras se rellena la tabla, y un aviso por cada una taparía
 * la pantalla; el indicador de «guardado» de la cabecera ya lo dice.
 */
export function useEditarFicha(anio: number, mes: number, tipo: TipoPersonal) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (vars: {
      id: number;
      cambios: Partial<DatosFicha> & { grupoId?: number };
    }) => editarFicha(vars.id, vars.cambios),
    onSuccess: () => invalidar(),
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo guardar el cambio')),
  });
}

export function useDuplicarFicha(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (id: number) => duplicarFicha(id),
    onSuccess: () => {
      invalidar();
      // El documento NO se copia: es único en el periodo. Se avisa para
      // que nadie exporte la lista con un "COPIA-1" dentro.
      toast.success('Fila duplicada · escribe el NUM. IDENT de la copia');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo duplicar')),
  });
}

export function useMoverFichas(anio: number, mes: number, tipo: TipoPersonal) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (vars: { fichaIds: number[]; grupoDestinoId: number }) =>
      moverFichas(vars.fichaIds, vars.grupoDestinoId),
    onSuccess: (r) => {
      invalidar();
      toast.success(`${r.movidas} persona(s) movidas`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo mover')),
  });
}

export function useEliminarFichas(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (fichaIds: number[]) => eliminarFichas(fichaIds),
    onSuccess: (r) => {
      invalidar();
      toast.success(`${r.eliminadas} persona(s) eliminadas`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo eliminar')),
  });
}

// ── Excel ──

/** Paso 1: qué trae el archivo. No escribe nada. */
export function usePrevisualizarExcel() {
  return useMutation({
    mutationFn: (archivo: File) => previsualizarExcel(archivo),
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo leer el archivo')),
  });
}

/** Paso 2: aplicar el mapeo confirmado. */
export function useImportarExcel(
  anio: number,
  mes: number,
  tipo: TipoPersonal,
) {
  const invalidar = useInvalidarPeriodo(anio, mes, tipo);
  return useMutation({
    mutationFn: (vars: {
      archivo: File;
      hojas: HojaAImportar[];
      conflictos: ResolucionConflicto;
    }) => importarExcel(vars.archivo, vars.hojas, vars.conflictos),
    onSuccess: () => invalidar(),
    onError: (e) => toast.error(getErrorMessage(e, 'No se pudo importar')),
  });
}

export function useExportarExcel() {
  return useMutation({
    mutationFn: (vars: { anio: number; mes: number; tipo?: TipoPersonal }) =>
      exportarExcel(vars.anio, vars.mes, vars.tipo),
    onSuccess: (nombre) => toast.success(`Descargado: ${nombre}`),
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : 'No se pudo generar el Excel',
      ),
  });
}
