import { useState } from 'react';
import { Trash2Icon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  useCrearAlbum,
  useEditarAlbum,
  useEliminarAlbum,
} from '@/modules/fotos/hooks/useAlbumes';
import type { AlbumDeGaleria } from '@/modules/fotos/types';

/**
 * Crear o renombrar un álbum (§16).
 *
 * §16 pide el álbum como un TIPO DE CONTENIDO —«Equipo ABC → Álbum Estado
 * inicial»—, no solo como el efecto secundario de arrastrar fotos. Se puede
 * crear vacío y llenarlo después, que es como se trabaja cuando la
 * estructura se planea antes de ir a obra.
 *
 * ⚠️ El nombre es OBLIGATORIO al crear y OPCIONAL al editar, y no es un
 * descuido: quien abre «Nuevo álbum» y no escribe nada crea algo que no
 * sabrá distinguir luego, mientras que vaciar el nombre de uno existente es
 * volverlo al estado en que nacen los de la captura rápida (§17). El backend
 * hace cumplir exactamente esa misma asimetría.
 */
export function DialogoAlbum({
  carpetaId,
  album,
  abierto,
  onCerrar,
}: {
  carpetaId: number;
  /** null = crear uno nuevo. */
  album: AlbumDeGaleria | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const crear = useCrearAlbum();
  const editar = useEditarAlbum();
  const eliminar = useEliminarAlbum();

  const editando = album !== null;

  // El estado arranca DEL ÁLBUM, sin efecto que lo sincronice después: quien
  // monta este diálogo le pone un `key` distinto por álbum, así que React lo
  // remonta con estos valores ya puestos. Copiar props a estado en un
  // `useEffect` es el camino que parece obvio y renderiza una vez en blanco
  // antes de corregirse —además de lo que caza `set-state-in-effect`—.
  const [nombre, setNombre] = useState(album?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(album?.descripcion ?? '');
  const [fecha, setFecha] = useState(album?.fecha ?? '');

  const guardar = () => {
    const limpio = nombre.trim();
    if (editando) {
      editar.mutate(
        {
          id: album.id,
          payload: {
            nombre: limpio || null,
            descripcion: descripcion.trim() || null,
            fecha: fecha || null,
          },
        },
        { onSuccess: onCerrar },
      );
    } else {
      if (!limpio) return;
      crear.mutate(
        {
          carpetaId,
          payload: {
            nombre: limpio,
            descripcion: descripcion.trim() || null,
            fecha: fecha || null,
          },
        },
        { onSuccess: onCerrar },
      );
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar álbum' : 'Nuevo álbum'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'Puedes dejar el nombre vacío: el álbum volverá a mostrarse por su fecha.'
              : 'Un álbum agrupa fotos de un momento. Por ejemplo «Estado inicial» antes de intervenir un equipo. Puedes crearlo ahora y subir las fotos después.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Nombre{' '}
              {editando ? (
                <span className="text-muted-foreground">(opcional)</span>
              ) : (
                <span className="text-destructive">*</span>
              )}
            </label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              placeholder="Estado inicial"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Descripción <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Antes de intervenir"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Fecha del trabajo{' '}
              <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            {/* §15 avisa de no depender del EXIF para la fecha de trabajo: se
                fotografía hoy lo que se hizo ayer. Ésta la escribe una
                persona y por eso manda sobre la de captura. */}
            <p className="text-xs text-muted-foreground">
              El día que documenta, que no tiene por qué ser el de la subida.
            </p>
          </div>
        </div>

        <DialogFooter>
          {/* Solo si está VACÍO, y no por prudencia: el backend rechaza con
              400 uno que tenga fotos, así que pintarlo siempre sería ofrecer
              un botón que contesta un error. Mismo criterio que separar
              `renombrar` de `compartir` en las tarjetas de carpeta.

              Un álbum vacío no se podía retirar por ninguna vía hasta ahora
              —se descubrió al limpiar una prueba: además bloqueaba el borrado
              de su carpeta, porque la FK es `Restrict`—. Con fotos dentro no
              hace falta este botón: se van borrando y el álbum se retira solo
              con la última. */}
          {editando && album.fotos.length === 0 && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              disabled={eliminar.isPending}
              onClick={() =>
                eliminar.mutate(album.id, { onSuccess: onCerrar })
              }
            >
              <Trash2Icon />
              Eliminar
            </Button>
          )}

          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={
              (!editando && !nombre.trim()) || crear.isPending || editar.isPending
            }
          >
            {editando ? 'Guardar' : 'Crear álbum'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
