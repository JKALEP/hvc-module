import { useParams } from 'react-router-dom';
import { ImagesIcon } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TarjetaAlbum } from '@/components/shared/TarjetaAlbum';
import { TarjetaCarpeta } from '@/components/shared/TarjetaCarpeta';
import { RutaSedes } from '@/components/shared/RutaSedes';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortalNavegacion } from '@/hooks/useFotos';

/**
 * Explorador del cliente externo.
 *
 * Es el mismo gesto que el interno —carpetas, breadcrumb, álbumes— pero
 * su raíz son las carpetas que le compartieron, no la raíz real: el
 * backend recorta el breadcrumb ahí para no enseñarle la estructura de
 * HVC por encima de lo suyo.
 */
export function Portal() {
  const { id } = useParams();
  const sedeId = id ? Number(id) : null;

  const { data, isError } = usePortalNavegacion(sedeId);
  const cargando = !data && !isError;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <RutaSedes
          ancestros={data?.ancestros ?? []}
          actual={data?.sedeActual?.nombre ?? null}
          raiz="/portal"
          etiquetaRaiz="Compartido conmigo"
          rutaCarpeta="/portal/carpeta"
        />

        <PageHeader
          title={data?.sedeActual?.nombre ?? 'Compartido conmigo'}
          description={
            sedeId === null
              ? 'Las carpetas y álbumes que HVC compartió contigo.'
              : undefined
          }
        />
      </div>

      {cargando && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={ImagesIcon}
          title="No se pudo abrir esta carpeta"
          description="O no existe, o ya no está compartida contigo."
        />
      )}

      {data && data.subsedes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Carpetas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.subsedes.map((c) => (
              <TarjetaCarpeta
                key={c.id}
                carpeta={c}
                // Un cliente no administra nada: solo entra.
                admin={false}
                enlaceBase="/portal/carpeta"
                onRenombrar={() => undefined}
                onCompartir={() => undefined}
                onCambiarEstado={() => undefined}
                onEliminar={() => undefined}
              />
            ))}
          </div>
        </section>
      )}

      {data && data.albumes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Álbumes
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.albumes.map((a) => (
              <TarjetaAlbum
                key={a.id}
                album={a}
                mostrarSede={sedeId === null}
                enlaceBase="/portal/album"
                ocultarColaboradores
              />
            ))}
          </div>
        </section>
      )}

      {data && data.subsedes.length === 0 && data.albumes.length === 0 && (
        <EmptyState
          icon={ImagesIcon}
          title={
            sedeId === null
              ? 'Todavía no hay nada compartido contigo'
              : 'Esta carpeta está vacía'
          }
          description={
            sedeId === null
              ? 'Cuando HVC comparta una carpeta o un álbum contigo, aparecerá aquí.'
              : undefined
          }
        />
      )}
    </div>
  );
}
