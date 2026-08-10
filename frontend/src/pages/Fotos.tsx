import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  FolderPlusIcon,
  ImagePlusIcon,
  ImagesIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  Share2Icon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { TarjetaAlbum } from '@/components/shared/TarjetaAlbum';
import { TarjetaCarpeta } from '@/components/shared/TarjetaCarpeta';
import { RutaSedes } from '@/components/shared/RutaSedes';
import { DialogoNombre } from '@/components/shared/DialogoNombre';
import { DialogoCompartir } from '@/components/shared/DialogoCompartir';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNavegacion,
  useCrearSede,
  useEditarSede,
  useEliminarSede,
  useCrearAlbum,
  useEditarAlbum,
} from '@/hooks/useFotos';
import { useAuth } from '@/hooks/useAuth';
import { esAdminFotos } from '@/lib/modulos';
import type {
  AlbumResumen,
  CarpetaSede,
  TipoCompartible,
} from '@/types/models';

/** Qué diálogo está abierto. */
type Dialogo =
  | { tipo: 'nueva-sede' }
  | { tipo: 'renombrar-sede'; sede: CarpetaSede }
  | { tipo: 'nuevo-album' }
  | { tipo: 'renombrar-album'; album: AlbumResumen }
  | { tipo: 'compartir'; compartible: TipoCompartible; id: number; nombre: string };

/**
 * Explorador de Fotos.
 *
 * Sustituye a la rejilla plana y absorbe lo que era /fotos/admin: crear,
 * renombrar y compartir se hacen en la carpeta donde estás, no en otra
 * pantalla. Tener dos sitios para crear lo mismo se pudre.
 *
 * Un COLABORADOR no explora carpetas —sus álbumes cuelgan de sedes que no
 * puede recorrer— y recibe una raíz plana con lo que le compartieron.
 */
export function Fotos() {
  const { id } = useParams();
  const sedeId = id ? Number(id) : null;
  const { usuario } = useAuth();
  const admin = esAdminFotos(usuario);

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  const { data, isError } = useNavegacion(sedeId);
  const crearSede = useCrearSede();
  const editarSede = useEditarSede();
  const eliminarSede = useEliminarSede();
  const crearAlbum = useCrearAlbum();
  const editarAlbum = useEditarAlbum();

  // Sin datos y sin error todavía no se sabe nada: no es una carpeta vacía.
  const cargando = !data && !isError;
  const cerrar = () => setDialogo(null);

  const accionesAlbum = (album: AlbumResumen) => (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Renombrar ${album.nombre}`}
        onClick={() => setDialogo({ tipo: 'renombrar-album', album })}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Compartir ${album.nombre}`}
        onClick={() =>
          setDialogo({
            tipo: 'compartir',
            compartible: 'album',
            id: album.id,
            nombre: album.nombre,
          })
        }
      >
        <Share2Icon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          album.estado === 'CERRADO'
            ? `Reabrir ${album.nombre}`
            : `Cerrar ${album.nombre}`
        }
        onClick={() =>
          editarAlbum.mutate({
            id: album.id,
            payload: {
              estado: album.estado === 'CERRADO' ? 'ABIERTO' : 'CERRADO',
            },
          })
        }
      >
        {album.estado === 'CERRADO' ? <LockOpenIcon /> : <LockIcon />}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {!data?.raizPlana && (
          <RutaSedes
            ancestros={data?.ancestros ?? []}
            actual={data?.sedeActual?.nombre ?? null}
          />
        )}

        <PageHeader
          title={data?.sedeActual?.nombre ?? 'Fotos'}
          description={
            data?.raizPlana
              ? 'Los álbumes a los que te dieron acceso. En cada uno puedes ver y publicar fotos.'
              : sedeId === null
                ? 'Explora las carpetas para llegar a sus álbumes.'
                : undefined
          }
          actions={
            admin && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialogo({ tipo: 'nueva-sede' })}
                >
                  <FolderPlusIcon />
                  Nueva carpeta
                </Button>
                {sedeId !== null && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDialogo({
                          tipo: 'compartir',
                          compartible: 'carpeta',
                          id: sedeId,
                          nombre: data?.sedeActual?.nombre ?? 'esta carpeta',
                        })
                      }
                    >
                      <Share2Icon />
                      Compartir
                    </Button>
                    <Button onClick={() => setDialogo({ tipo: 'nuevo-album' })}>
                      <ImagePlusIcon />
                      Nuevo álbum
                    </Button>
                  </>
                )}
              </>
            )
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
          description="O no existe, o no tienes acceso a ella. Vuelve a Fotos y navega desde ahí."
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
                admin={admin}
                onRenombrar={(sede) =>
                  setDialogo({ tipo: 'renombrar-sede', sede })
                }
                onCompartir={(sede) =>
                  setDialogo({
                    tipo: 'compartir',
                    compartible: 'carpeta',
                    id: sede.id,
                    nombre: sede.nombre,
                  })
                }
                onCambiarEstado={(sede) =>
                  editarSede.mutate({
                    id: sede.id,
                    payload: {
                      estado:
                        sede.estado === 'INACTIVA' ? 'ACTIVA' : 'INACTIVA',
                    },
                  })
                }
                onEliminar={(sede) => eliminarSede.mutate(sede.id)}
              />
            ))}
          </div>
        </section>
      )}

      {data && data.albumes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {data.raizPlana ? 'Compartidos conmigo' : 'Álbumes'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.albumes.map((a) => (
              <TarjetaAlbum
                key={a.id}
                album={a}
                // Dentro de una carpeta la sede ya la dice el breadcrumb.
                mostrarSede={data.raizPlana}
                acciones={admin ? accionesAlbum(a) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {data && data.subsedes.length === 0 && data.albumes.length === 0 && (
        <EmptyState
          icon={ImagesIcon}
          title={
            data.raizPlana
              ? 'No hay álbumes para ti todavía'
              : sedeId === null
                ? 'No hay carpetas todavía'
                : 'Esta carpeta está vacía'
          }
          description={
            data.raizPlana
              ? 'Cuando un administrador de Fotos te dé acceso a un álbum, aparecerá aquí.'
              : admin
                ? 'Crea una carpeta o un álbum con los botones de arriba.'
                : 'Todavía no hay nada aquí.'
          }
        />
      )}

      {/* ── Diálogos ── */}

      {dialogo?.tipo === 'nueva-sede' && (
        <DialogoNombre
          titulo="Nueva carpeta"
          descripcion={
            sedeId === null
              ? 'Se creará en el primer nivel.'
              : `Se creará dentro de ${data?.sedeActual?.nombre ?? 'esta carpeta'}.`
          }
          etiqueta="Nombre"
          textoBoton="Crear"
          ocupado={crearSede.isPending}
          onConfirmar={(nombre) =>
            crearSede.mutate(
              { nombre, parentId: sedeId },
              { onSuccess: cerrar },
            )
          }
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'renombrar-sede' && (
        <DialogoNombre
          titulo="Renombrar carpeta"
          etiqueta="Nombre"
          valorInicial={dialogo.sede.nombre}
          textoBoton="Guardar"
          ocupado={editarSede.isPending}
          onConfirmar={(nombre) =>
            editarSede.mutate(
              { id: dialogo.sede.id, payload: { nombre } },
              { onSuccess: cerrar },
            )
          }
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'nuevo-album' && sedeId !== null && (
        <DialogoNombre
          titulo="Nuevo álbum"
          descripcion={`Se creará en ${data?.sedeActual?.nombre ?? 'esta carpeta'}.`}
          etiqueta="Nombre"
          conDescripcion
          textoBoton="Crear álbum"
          ocupado={crearAlbum.isPending}
          onConfirmar={(nombre, descripcion) =>
            crearAlbum.mutate(
              { sedeId, nombre, descripcion: descripcion || null },
              { onSuccess: cerrar },
            )
          }
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'renombrar-album' && (
        <DialogoNombre
          titulo="Renombrar álbum"
          etiqueta="Nombre"
          valorInicial={dialogo.album.nombre}
          conDescripcion
          descripcionInicial={dialogo.album.descripcion ?? ''}
          textoBoton="Guardar"
          ocupado={editarAlbum.isPending}
          onConfirmar={(nombre, descripcion) =>
            editarAlbum.mutate(
              {
                id: dialogo.album.id,
                payload: { nombre, descripcion: descripcion || null },
              },
              { onSuccess: cerrar },
            )
          }
          onCerrar={cerrar}
        />
      )}

      {dialogo?.tipo === 'compartir' && (
        <DialogoCompartir
          tipo={dialogo.compartible}
          id={dialogo.id}
          nombre={dialogo.nombre}
          onCerrar={cerrar}
        />
      )}
    </div>
  );
}
