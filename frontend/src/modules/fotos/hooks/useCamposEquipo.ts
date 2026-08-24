import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as fotos from '@/modules/fotos/services/fotosService';
import { getErrorMessage } from '@/shared/services/api';
import { QUERY_KEYS } from '@/shared/lib/constants';
import { useInvalidarFotos } from './useInvalidarFotos';

// Los campos configurables del equipo (Fase 1b): lecturas Y escrituras en un
// solo archivo, nombrado por el recurso. Dentro conviven los DOS grupos —las
// definiciones y los valores— porque son el mismo recurso visto desde sus
// dos lados, y partirlos en `useCampos` / `useCamposDeCarpeta` sería
// exactamente el par que se distingue por una letra que la convención del
// proyecto prohíbe.

/**
 * Las definiciones: qué campos existen.
 *
 * Son globales al módulo, así que la clave no lleva id. Leerlas no exige ser
 * administrador —hacen falta para pintar el formulario de un equipo—; lo que
 * sí lo exige es cambiarlas, y eso lo hace cumplir el backend.
 */
export function useCamposEquipo(soloActivos = false) {
  return useQuery({
    queryKey: [...QUERY_KEYS.camposEquipo, soloActivos] as const,
    queryFn: () => fotos.listarCamposEquipo(soloActivos),
  });
}

/**
 * Invalida solo las definiciones.
 *
 * `useInvalidarFotos` barre TODO lo del módulo y aquí sería desmedido:
 * renombrar un campo no cambia el árbol de carpetas ni la galería.
 */
function useInvalidarCampos() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.camposEquipo });
  };
}

export function useCrearCampoEquipo() {
  const invalidar = useInvalidarCampos();
  return useMutation({
    mutationFn: fotos.crearCampoEquipo,
    onSuccess: (c) => {
      invalidar();
      toast.success(`Campo creado: ${c.nombre}`);
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo crear el campo')),
  });
}

export function useEditarCampoEquipo() {
  const invalidar = useInvalidarCampos();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      payload: { nombre?: string; orden?: number; activo?: boolean };
    }) => fotos.editarCampoEquipo(vars.id, vars.payload),
    onSuccess: (c) => {
      invalidar();
      // El aviso nombra lo que de verdad pasó: desactivar no es «guardar».
      toast.success(
        c.activo ? `Campo actualizado: ${c.nombre}` : `Campo desactivado: ${c.nombre}`,
      );
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo actualizar el campo')),
  });
}

/**
 * Borrado real, y el backend lo rechaza si alguien lo tiene rellenado.
 *
 * ⚠️ El mensaje de error sale TAL CUAL del servidor: ya dice cuántos equipos
 * lo usan y ofrece desactivarlo en su lugar. Reescribirlo aquí sería tener
 * dos versiones de la misma regla — mismo criterio que la administración de
 * Costos.
 */
export function useEliminarCampoEquipo() {
  const invalidar = useInvalidarCampos();
  return useMutation({
    mutationFn: fotos.eliminarCampoEquipo,
    onSuccess: () => {
      invalidar();
      toast.success('Campo eliminado');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo eliminar el campo')),
  });
}

export function useAgregarOpcionCampo() {
  const invalidar = useInvalidarCampos();
  return useMutation({
    mutationFn: (vars: { id: number; etiqueta: string }) =>
      fotos.agregarOpcionCampo(vars.id, vars.etiqueta),
    onSuccess: () => invalidar(),
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo añadir la opción')),
  });
}

/** Elegida por alguien = se desactiva; si no, se borra. Lo decide el backend. */
export function useEliminarOpcionCampo() {
  const invalidar = useInvalidarCampos();
  return useMutation({
    mutationFn: fotos.eliminarOpcionCampo,
    onSuccess: () => invalidar(),
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo quitar la opción')),
  });
}

// ── Los valores de UNA carpeta ──

/**
 * La ficha del equipo.
 *
 * `habilitado` porque solo se pide en una carpeta de tipo EQUIPO: en una
 * corriente el backend contestaría 400, y pedirlo en cada carpeta que se
 * abre sería una consulta para nada. Mismo criterio que `useTareas`.
 */
export function useCamposDeCarpeta(
  carpetaId: number | null,
  habilitado = true,
) {
  return useQuery({
    queryKey: QUERY_KEYS.camposDeCarpeta(carpetaId ?? 0),
    queryFn: () => fotos.camposDeCarpeta(carpetaId!),
    enabled: habilitado && carpetaId !== null,
  });
}

export function useGuardarCamposDeCarpeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      carpetaId: number;
      valores: Record<string, unknown>;
    }) => fotos.guardarCamposDeCarpeta(vars.carpetaId, vars.valores),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.camposDeCarpeta(vars.carpetaId),
      });
      toast.success('Datos del equipo guardados');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudieron guardar los datos')),
  });
}

/**
 * La imagen de un campo FOTO.
 *
 * Invalida los campos de la carpeta y NO el resto del módulo: esta imagen
 * no es una `Foto`, así que no toca la galería ni los contadores. Esa
 * separación es justamente la decisión del modelo.
 */
export function useSubirImagenDeCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { carpetaId: number; campoId: number; archivo: File }) =>
      fotos.subirImagenDeCampo(vars.carpetaId, vars.campoId, vars.archivo),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.camposDeCarpeta(vars.carpetaId),
      });
      toast.success('Imagen guardada');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo subir la imagen')),
  });
}

export function useQuitarImagenDeCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { carpetaId: number; campoId: number }) =>
      fotos.quitarImagenDeCampo(vars.carpetaId, vars.campoId),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: QUERY_KEYS.camposDeCarpeta(vars.carpetaId),
      });
      toast.success('Imagen quitada');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo quitar la imagen')),
  });
}

// `useInvalidarFotos` se re-exporta para quien cree un equipo CON valores:
// eso sí cambia el árbol, y refrescar solo los campos dejaría la tarjeta
// nueva sin aparecer.
export { useInvalidarFotos };

// ── Color por tipo de carpeta (Fase 1c) ──
//
// Vive en este archivo y no en uno propio porque es lo mismo que los campos:
// configuración del módulo que un ADMIN_GLOBAL cambia y todos leen. Un
// `useColores.ts` de veinte líneas para dos hooks sería partir el recurso
// por el tipo técnico, que es justo lo que la convención evita.

/**
 * Qué color usa cada tipo de carpeta.
 *
 * `staleTime` largo a propósito: esto cambia una vez cada muchos meses y lo
 * pide CADA pantalla del explorador. Sin él, abrir una carpeta dispararía
 * una consulta más para leer dos filas que no han cambiado.
 */
export function useColoresDeCarpeta() {
  return useQuery({
    queryKey: QUERY_KEYS.coloresCarpeta,
    queryFn: fotos.coloresDeCarpeta,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCambiarColorDeCarpeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fotos.cambiarColorDeCarpeta,
    onSuccess: (colores) => {
      // Se escribe la respuesta en la caché en vez de invalidar: el servidor
      // ya devolvió el mapa completo, así que refetchear sería pedir lo que
      // acabamos de recibir.
      qc.setQueryData(QUERY_KEYS.coloresCarpeta, colores);
      toast.success('Color actualizado');
    },
    onError: (e) =>
      toast.error(getErrorMessage(e, 'No se pudo cambiar el color')),
  });
}
