import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FoldersIcon, XIcon } from 'lucide-react';


import { PanelFotos } from '@/modules/fotos/components/PanelFotos';
import { AvisoArchivada } from '@/modules/fotos/components/AvisoArchivada';
import { EtiquetaSeccion } from '@/modules/fotos/components/EtiquetaSeccion';
import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TarjetaCarpeta } from '@/modules/fotos/components/TarjetaCarpeta';
import { RutaSedes } from '@/modules/fotos/components/RutaSedes';
import { GaleriaFotosPlanas } from '@/modules/fotos/components/GaleriaAlbumes';
import { PanelTareas } from '@/modules/fotos/components/PanelTareas';
import { HiloComentarios } from '@/modules/fotos/components/HiloComentarios';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useCarpeta } from '@/modules/fotos/hooks/useCarpetas';
import { useGaleria } from '@/modules/fotos/hooks/useAlbumes';
import type { FiltrosGaleria } from '@/modules/fotos/types';

const SIN_FILTROS: FiltrosGaleria = {
  subidaPorId: null,
  desde: '',
  hasta: '',
};

/**
 * Portal del cliente externo: ver y descargar, nada más.
 *
 * Es el mismo gesto que el explorador interno —carpetas, camino,
 * galería— pero su punto de partida son las carpetas que le
 * compartieron. Los escalones por encima llegan como texto sin enlace: le
 * dicen dónde encaja lo suyo sin darle acceso a nada de arriba.
 */
export function Portal() {
  const { id } = useParams();
  const sedeId = id ? Number(id) : null;

  const [filtros, setFiltros] = useState<FiltrosGaleria>(SIN_FILTROS);

  const { data, isError } = useCarpeta(sedeId, { portal: true });
  const galeria = useGaleria(sedeId ?? 0, filtros, true);

  const cargando = !data && !isError;
  const albumes = galeria.data?.pages.flatMap((p) => p.albumes) ?? [];
  const totalFotos = galeria.data?.pages[0]?.totalFotos ?? 0;
  const hayFiltro = filtros.desde !== '' || filtros.hasta !== '';

  const totalCarpetas = (data?.secciones ?? []).reduce(
    (t, s) => t + s.carpetas.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <RutaSedes
          // ⚠️ Se descartan los ancestros NO navegables (§22).
          //
          // El backend los manda como contexto —«tu carpeta cuelga de UPN
          // Villa»— y para un interno eso está bien. Para un CLIENTE es
          // enseñarle el nombre de una carpeta que no tiene autorizada, que
          // es literalmente lo que §22 prohíbe: «No mostrar carpetas que no
          // tenga autorizadas». Y no le sirve de nada: abrirla da 404.
          ancestros={(data?.ancestros ?? []).filter((a) => a.navegable)}
          actual={data?.carpetaActual?.nombre ?? null}
          raiz="/portal"
          etiquetaRaiz="Compartido conmigo"
          rutaCarpeta="/portal/carpeta"
        />

        <PageHeader
          title={data?.carpetaActual?.nombre ?? 'Compartido conmigo'}
          description={
            sedeId === null
              ? 'Las carpetas que HVC compartió contigo.'
              : data
                ? `${totalCarpetas} carpeta(s) · ${totalFotos} foto(s)`
                : undefined
          }
        />
      </div>

      {data?.ramaCerrada && (
        <AvisoArchivada>
          Esta carpeta está archivada: ya no se le añaden fotos nuevas.
        </AvisoArchivada>
      )}

      {cargando && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={FoldersIcon}
          title="No se pudo abrir esta carpeta"
          description="O no existe, o ya no está compartida contigo."
        />
      )}

      {(data?.secciones ?? []).map((seccion) => (
        <section key={seccion.clave} className="space-y-3">
          <EtiquetaSeccion>{seccion.etiqueta}</EtiquetaSeccion>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seccion.carpetas.map((c) => (
              // Un cliente no administra nada: sin acciones.
              <TarjetaCarpeta
                key={c.id}
                carpeta={c}
                enlaceBase="/portal/carpeta"
              />
            ))}
          </div>
        </section>
      ))}

      {sedeId !== null && data && (
        <>
          {/* §22 describe el recorrido del cliente:
              «… → Equipo ABC → Tareas → Álbumes → Fotografías → Comentarios».
              Las tareas solo existen en un equipo (§13), así que la sección
              aparece cuando la carpeta lo es — igual que en el módulo interno.
          */}
          {data.carpetaActual?.tipo === 'EQUIPO' && (
            <PanelTareas
              carpetaId={sedeId}
              permiso={data.permiso}
              ramaCerrada={data.ramaCerrada}
              portal
            />
          )}

          <PanelFotos as="section" denso>
            <h2 className="mb-3 font-medium text-foreground">Comentarios</h2>

            <HiloComentarios
              entidad="carpeta"
              entidadId={sedeId}
              permiso={data.permiso}
              ramaCerrada={data.ramaCerrada}
              portal
            />
          </PanelFotos>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Desde
              </label>

              <Input
                type="date"
                className="h-9 w-40"
                value={filtros.desde}
                onChange={(e) =>
                  setFiltros((f) => ({
                    ...f,
                    desde: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Hasta
              </label>

              <Input
                type="date"
                className="h-9 w-40"
                value={filtros.hasta}
                onChange={(e) =>
                  setFiltros((f) => ({
                    ...f,
                    hasta: e.target.value,
                  }))
                }
              />
            </div>

            {hayFiltro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltros(SIN_FILTROS)}
              >
                <XIcon />
                Limpiar
              </Button>
            )}

            <p className="ml-auto text-sm text-muted-foreground tabular-nums">
              {totalFotos} foto(s)
            </p>
          </div>

          <GaleriaFotosPlanas
            albumes={albumes}
            cargando={galeria.isLoading}
            hayMas={Boolean(galeria.hasNextPage)}
            cargandoMas={galeria.isFetchingNextPage}
            onCargarMas={() => void galeria.fetchNextPage()}
            // Un cliente nunca borra.
            puedeBorrar={() => false}
            portal
            // Hacen falta para los hilos de §14 que la galería monta en la
            // cabecera del álbum y dentro del visor de la foto. Con `portal`
            // los dos quedan en solo lectura pase lo que pase con el grado.
            permiso={data.permiso}
            ramaCerrada={data.ramaCerrada}
            vacio={{
              titulo: hayFiltro
                ? 'Ninguna foto en esas fechas'
                : 'Sin fotos todavía',
              descripcion: hayFiltro
                ? 'Prueba a ampliar el rango de fechas.'
                : undefined,
            }}
          />
        </>
      )}

      {sedeId === null && data && data.secciones.length === 0 && (
        <EmptyState
          icon={FoldersIcon}
          title="Todavía no hay nada compartido contigo"
          description="Cuando HVC comparta una carpeta contigo, aparecerá aquí."
        />
      )}
    </div>
  );
}