import { FileSpreadsheetIcon, LayoutTemplateIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import {
  usePlantillas,
  useAplicarPlantilla,
} from '@/modules/fotos/hooks/useAdminFotos';

/**
 * Las dos formas de crear estructura de golpe: Excel (§19) y plantilla (§20).
 *
 * Viven en el CUERPO de la carpeta y no en la cabecera, donde estaban. Dos
 * razones, y la segunda importa más que la primera:
 *
 *   1. Con seis botones arriba, la fila se desbordaba.
 *   2. No son de la misma familia. «Nueva carpeta» y «Compartir» actúan
 *      SOBRE esta carpeta; importar y estampar una plantilla generan
 *      contenido DENTRO, como subir fotos o crear un álbum. Están donde se
 *      mira cuando uno piensa «esto está vacío, lléname esto».
 *
 * Son dos puertas al mismo sitio (ver `ImportacionFotosService`): el Excel
 * arranca una obra entera desde la hoja del planificador; la plantilla
 * estampa un molde pequeño muchas veces, en campo.
 */
export function CrearEstructura({
  carpetaId,
  onImportar,
}: {
  carpetaId: number;
  onImportar: () => void;
}) {
  // Solo las ACTIVAS: una plantilla desactivada sigue existiendo para el
  // administrador pero ya no se ofrece en obra.
  const { data: plantillas } = usePlantillas(true);
  const aplicar = useAplicarPlantilla();

  const hayPlantillas = (plantillas ?? []).length > 0;

  return (
    <section className="rounded-xl border border-dashed border-border p-4">
      <h2 className="mb-1 font-medium text-foreground">Crear estructura</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Genera carpetas, equipos y actividades de una vez, en vez de uno a
        uno.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onImportar}>
          <FileSpreadsheetIcon />
          Importar Excel
        </Button>

        {hayPlantillas && (
          <div className="flex items-center gap-2">
            <LayoutTemplateIcon className="size-4 shrink-0 text-muted-foreground" />
            <Select
              className="h-9 w-56"
              // Vuelve a "" tras aplicar: es un disparador, no un estado. Si
              // se quedara con la plantilla elegida parecería que esta
              // carpeta «tiene» esa plantilla puesta, y no es así — se
              // estampa una copia y la plantilla deja de mandar.
              value=""
              disabled={aplicar.isPending}
              aria-label="Crear desde plantilla"
              onChange={(e) => {
                if (!e.target.value) return;
                aplicar.mutate({
                  plantillaId: Number(e.target.value),
                  carpetaId,
                });
              }}
            >
              <option value="">Crear desde plantilla…</option>
              {(plantillas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </section>
  );
}
