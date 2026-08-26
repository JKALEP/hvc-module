import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/select';
import { useSistemas } from '@/modules/fotos/hooks/useCatalogoFotos';
import { useEditarCarpeta } from '@/modules/fotos/hooks/useCarpetas';
import type { TipoSistema } from '@/modules/fotos/types';

/**
 * Qué clase de sistema es el equipo (Fase 2).
 *
 * Va en la ficha del equipo y no en la cabecera del ciclo porque describe la
 * MÁQUINA, no la visita: no cambia de un ciclo al siguiente.
 *
 * ⚠️ Corregirlo NO reescribe las visitas, ni las cerradas ni la que está en
 * curso: lo que cambia es qué se propone la próxima vez. El aviso lo dice,
 * porque es justo lo que se espera al cambiarlo y no pasa — para traer las
 * nuevas al ciclo abierto está el botón «Del catálogo» de las actividades.
 */
export function TipoDeSistema({
  carpetaId,
  tipoSistema,
  puedeEditar,
}: {
  carpetaId: number;
  tipoSistema: TipoSistema | null;
  puedeEditar: boolean;
}) {
  // Solo los activos: aquí se está ELIGIENDO, y un tipo retirado ya no se
  // ofrece. El equipo que ya lo tenía lo conserva y se sigue viendo abajo.
  const { data: familias } = useSistemas(true);
  const editar = useEditarCarpeta();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
      <span className="text-sm text-muted-foreground">Tipo de sistema</span>

      {tipoSistema ? (
        <Badge variant="outline">
          {tipoSistema.familia?.nombre
            ? `${tipoSistema.familia.nombre} · ${tipoSistema.nombre}`
            : tipoSistema.nombre}
        </Badge>
      ) : (
        <Badge variant="secondary">Sin definir</Badge>
      )}

      {puedeEditar && (
        <Select
          className="ml-auto w-64"
          aria-label="Cambiar el tipo de sistema"
          value={tipoSistema?.id ?? ''}
          disabled={editar.isPending}
          onChange={(e) =>
            editar.mutate({
              id: carpetaId,
              payload: {
                tipoSistemaId: e.target.value ? Number(e.target.value) : null,
              },
            })
          }
        >
          <option value="">— Sin definir —</option>
          {(familias ?? []).map((f) => (
            <optgroup key={f.id} label={f.nombre}>
              {(f.tipos ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}
    </div>
  );
}
