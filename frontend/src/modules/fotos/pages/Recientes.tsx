import { ClockIcon } from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/ui/skeleton';
import { TarjetaCarpeta } from '@/modules/fotos/components/TarjetaCarpeta';
import { useRecientes } from '@/modules/fotos/hooks/useCarpetas';

/**
 * Lo que cambió hace menos, de todo lo que este usuario alcanza (§21).
 *
 * Sale gratis porque `actualizadoEn` se propaga hacia arriba cuando algo
 * pasa dentro: subir una foto tres niveles más abajo mueve la fecha de toda
 * la línea de carpetas, así que esta lista responde «dónde hubo trabajo»
 * sin ningún agregado.
 *
 * Las tarjetas van SIN acciones a propósito. Esto es un atajo para llegar a
 * una carpeta, no un sitio donde administrarla: renombrar o archivar desde
 * aquí dejaría al usuario operando sobre algo cuyo contexto —dónde está,
 * qué tiene al lado— no está viendo.
 */
export function Recientes() {
  const { data, isError } = useRecientes();

  // Sin datos y sin error todavía no se sabe nada: no es una lista vacía.
  const cargando = !data && !isError;
  const carpetas = data?.carpetas ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recientes"
        description="Las carpetas con actividad más nueva, de todo lo que puedes ver."
      />

      {cargando && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={ClockIcon}
          title="No se pudo cargar la actividad reciente"
          description="Vuelve a intentarlo en un momento."
        />
      )}

      {data && carpetas.length === 0 && (
        <EmptyState
          icon={ClockIcon}
          title="Todavía no hay actividad"
          description="Cuando se creen carpetas o se suban fotos, aparecerán aquí."
        />
      )}

      {carpetas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {carpetas.map((c) => (
            <TarjetaCarpeta key={c.id} carpeta={c} />
          ))}
        </div>
      )}
    </div>
  );
}
