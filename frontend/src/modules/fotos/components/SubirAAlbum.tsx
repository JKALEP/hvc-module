import { useRef, useState } from 'react';
import { ImagePlusIcon, UploadIcon, XIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { useSubirA } from '@/modules/fotos/hooks/useBandeja';

/**
 * Añadir fotos a un álbum que YA existe.
 *
 * ⚠️ Cierra un hueco de los de «código de servidor sin puerta», el patrón
 * que dominó las fases 9 y 10 de v3. `POST /fotos/album/:id/foto` existe
 * desde la Fase 6, `resolverDestino` sabe tratar el destino `album` y hasta
 * `rutaDeSubida` lo traducía — pero **ningún componente construía nunca ese
 * destino**. Los únicos que la UI producía eran `carpeta`, `tarea` y
 * `bandeja`, así que un álbum solo podía crecer en el momento de crearse.
 *
 * Se despliega en vez de estar siempre abierto, por lo mismo que el hilo de
 * comentarios: una galería con doce álbumes serían doce formularios de
 * subida compitiendo con las fotos.
 *
 * ⚠️ Sin `capture="environment"` a propósito. Ese atributo abre la cámara y
 * ESCONDE la galería del móvil: es lo que se quiere en la captura rápida de
 * §17 —se está fotografiando ahora— y no aquí, donde lo normal es añadir a
 * un álbum material ya tomado.
 */
export function SubirAAlbum({ albumId }: { albumId: number }) {
  const subir = useSubirA();
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);

  const limpiar = () => {
    setArchivos([]);
    // El <input type="file"> no se vacía por estado: se limpia por ref.
    if (inputRef.current) inputRef.current.value = '';
  };

  const cerrar = () => {
    limpiar();
    setAbierto(false);
  };

  const enviar = () => {
    if (archivos.length === 0) return;
    subir.mutate(
      // La descripción es la del álbum, que ya está puesta: pedirla otra vez
      // aquí invitaría a describir el lote y no el trabajo, que es justo lo
      // que §15 quiere evitar.
      { destino: { tipo: 'album', albumId }, archivos, descripcion: '' },
      { onSuccess: cerrar },
    );
  };

  if (!abierto)
    return (
      <Button
        size="sm"
        variant="ghost"
        className="-ml-2"
        onClick={() => setAbierto(true)}
      >
        <ImagePlusIcon />
        Añadir fotos
      </Button>
    );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
      <Input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        className="h-9 max-w-xs"
        onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
      />
      <Button
        size="sm"
        onClick={enviar}
        disabled={archivos.length === 0 || subir.isPending}
      >
        {subir.isPending ? <Spinner /> : <UploadIcon />}
        Subir {archivos.length > 0 && `(${archivos.length})`}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Cancelar"
        onClick={cerrar}
        disabled={subir.isPending}
      >
        <XIcon />
      </Button>
      <span className="text-xs text-muted-foreground">
        Hasta 10 por vez, 15 MB cada una.
      </span>
    </div>
  );
}
