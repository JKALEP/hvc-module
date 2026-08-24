import { useRef, useState } from 'react';
import { CameraIcon, ImagePlusIcon, UploadIcon, XIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { useSubirA } from '@/modules/fotos/hooks/useBandeja';
import { CamaraFotos } from '@/modules/fotos/components/CamaraFotos';

/** Máximo de fotos por lote (el backend también lo valida). */
const MAX_FOTOS = 15;

/**
 * Añadir fotos a un álbum existente.
 *
 * Permite:
 * - Tomar fotografías con la cámara en vivo, una tras otra.
 * - Elegir fotografías existentes.
 * - Previsualizar y administrar el lote antes de subirlo (máx. 15).
 *
 * No requiere cambios en backend.
 */
export function SubirAAlbum({ albumId }: { albumId: number }) {
  const subir = useSubirA();

  const inputArchivosRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const cuposDisponibles = MAX_FOTOS - archivos.length;
  const loteCompleto = cuposDisponibles <= 0;

  const crearPreviews = (files: File[]) => {
    const urls = files.map((file) => URL.createObjectURL(file));

    setPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return urls;
    });
  };

  /** Agrega archivos al lote respetando el máximo de MAX_FOTOS. */
  const agregarArchivos = (nuevos: File[]) => {
    if (nuevos.length === 0) return;

    setArchivos((prev) => {
      const espacio = MAX_FOTOS - prev.length;
      if (espacio <= 0) return prev;

      const siguiente = [...prev, ...nuevos.slice(0, espacio)];
      crearPreviews(siguiente);
      return siguiente;
    });
  };

  const limpiar = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));

    setArchivos([]);
    setPreviews([]);

    if (inputArchivosRef.current) {
      inputArchivosRef.current.value = '';
    }
  };

  const cerrar = () => {
    limpiar();
    setCamaraAbierta(false);
    setAbierto(false);
  };

  const quitarUno = (index: number) => {
    setArchivos((prev) => {
      const siguiente = prev.filter((_, i) => i !== index);
      crearPreviews(siguiente);
      return siguiente;
    });

    if (inputArchivosRef.current) {
      inputArchivosRef.current.value = '';
    }
  };

  const seleccionarArchivos = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nuevos = Array.from(event.target.files ?? []);

    agregarArchivos(nuevos);

    event.target.value = '';
  };

  /** Cada captura de CamaraFotos entra al mismo lote que "Elegir fotos". */
  const capturarFoto = (foto: File) => {
    agregarArchivos([foto]);
  };

  const enviar = () => {
    if (archivos.length === 0) return;

    subir.mutate(
      {
        destino: {
          tipo: 'album',
          albumId,
        },
        archivos,
        descripcion: '',
      },
      {
        onSuccess: cerrar,
      },
    );
  };

  /*
   * Estado cerrado:
   * solamente mostramos el botón "Añadir fotos".
   */
  if (!abierto) {
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
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      {/* Cámara en vivo */}
      <CamaraFotos
        abierto={camaraAbierta}
        onCerrar={() => setCamaraAbierta(false)}
        onCapturar={capturarFoto}
        cuposDisponibles={cuposDisponibles}
      />

      {/* Input oculto del selector de archivos */}
      <input
        ref={inputArchivosRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        onChange={seleccionarArchivos}
        className="hidden"
      />

      {/* Acciones */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setCamaraAbierta(true)}
          disabled={subir.isPending || loteCompleto}
        >
          <CameraIcon />
          Tomar foto
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputArchivosRef.current?.click()}
          disabled={subir.isPending || loteCompleto}
        >
          <ImagePlusIcon />
          Elegir fotos
        </Button>
      </div>

      {/* Previsualización */}
      {archivos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {archivos.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              <img
                src={previews[index]}
                alt={file.name}
                className="size-full object-cover"
              />

              <button
                type="button"
                aria-label={`Quitar ${file.name}`}
                title={`Quitar ${file.name}`}
                onClick={() => quitarUno(index)}
                disabled={subir.isPending}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition-colors hover:bg-destructive sm:opacity-0 sm:group-hover:opacity-100"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pie */}
      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {archivos.length === 0
            ? 'Ninguna foto seleccionada.'
            : `${archivos.length} / ${MAX_FOTOS} foto(s) seleccionada(s).`}
        </span>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={cerrar}
            disabled={subir.isPending}
          >
            <XIcon />
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={enviar}
            disabled={archivos.length === 0 || subir.isPending}
          >
            {subir.isPending ? <Spinner /> : <UploadIcon />}

            {subir.isPending
              ? 'Subiendo…'
              : `Subir${archivos.length > 0 ? ` (${archivos.length})` : ''}`}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {loteCompleto ? (
          <span className="font-medium text-amber-600">
            Alcanzaste el máximo de {MAX_FOTOS} fotos por vez. Elimina
            alguna para agregar otra.
          </span>
        ) : (
          `Hasta ${MAX_FOTOS} fotos por vez, máximo 15 MB cada una.`
        )}
      </p>
    </div>
  );
}