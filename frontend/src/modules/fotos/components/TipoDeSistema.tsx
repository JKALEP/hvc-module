import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/select';
import { useSistemas } from '@/modules/fotos/hooks/useCatalogoFotos';
import { useEditarCarpeta } from '@/modules/fotos/hooks/useCarpetas';
import type { TipoSistema } from '@/modules/fotos/types';

/**
 * Qué clase de sistema es el equipo (Fase 2).
 *
 * Va en la ficha del equipo y no en la cabecera de la intervención porque describe la
 * MÁQUINA, no la intervención: no cambia de una intervención al siguiente.
 *
 * ⚠️ Corregirlo NO reescribe las intervenciones, ni las cerradas ni la que está en
 * curso: lo que cambia es qué se propone la próxima vez. El aviso lo dice,
 * porque es justo lo que se espera al cambiarlo y no pasa — para traer las
 * nuevas a la intervención abierta está el botón «Del catálogo» de las actividades.
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

  // ⚠️ Una familia SIN tipos no se ofrece: un `<optgroup>` vacío pinta el
  // encabezado del grupo y nada debajo, así que el desplegable parecía roto
  // —tres títulos y ninguna opción— cuando en realidad el catálogo está a
  // medio cargar. Ver el mismo tratamiento en `FormularioEquipo`.
  const conTipos = (familias ?? [])
    .map((f) => ({ ...f, tipos: f.tipos ?? [] }))
    .filter((f) => f.tipos.length > 0);
  const hayTipos = conTipos.length > 0;

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

      {puedeEditar && hayTipos && (
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
          {conTipos.map((f) => (
            <optgroup key={f.id} label={f.nombre}>
              {f.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}

      {/* Sin catálogo no se pinta un desplegable que no deja elegir nada: se
          dice qué falta y dónde se arregla. */}
      {puedeEditar && !hayTipos && (
        <span className="ml-auto text-xs text-muted-foreground">
          Sin tipos en el catálogo — se crean en Administración de Fotos ›
          Tipos de sistema.
        </span>
      )}
    </div>
  );
}
