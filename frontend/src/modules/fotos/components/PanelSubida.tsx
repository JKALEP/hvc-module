import { useEffect, useRef, useState } from 'react';
import { CameraIcon, ImagePlusIcon, UploadIcon, XIcon } from 'lucide-react';

import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { useSubirFotos } from '@/modules/fotos/hooks/useAlbumes';
import { CamaraFotos } from '@/modules/fotos/components/CamaraFotos';

/** Máximo de fotos por lote (el backend también lo valida). */
const MAX_FOTOS = 15;

/** Tamaño legible de un archivo. */
function formatPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Subir fotos a una carpeta.
 *
 * Permite:
 * - Tomar fotografías con la cámara en vivo (laptop, celular o tablet),
 *   una tras otra, sin cerrar la cámara entre cada captura.
 * - Elegir fotografías existentes desde galería/archivos.
 * - Previsualizar y administrar el lote antes de subirlo (máx. 15).
 * - Eliminar fotografías individualmente.
 *
 * Nada de esto llama al backend hasta que se presiona "Subir": la cámara y
 * el selector de archivos solo modifican `archivos[]`. La subida sigue
 * siendo una sola llamada con `File[]`, así que no requiere cambios en
 * backend, servicios ni hooks existentes.
 */
export function PanelSubida({ sedeId }: { sedeId: number }) {
  const subir = useSubirFotos();

  const [archivos, setArchivos] = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState('');

  // Selector normal de archivos (galería/explorador).
  const inputArchivosRef = useRef<HTMLInputElement>(null);

  // Cámara en vivo dentro de la app.
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  // Previews de las imágenes.
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = archivos.map((f) => URL.createObjectURL(f));

    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [archivos]);

  const cuposDisponibles = MAX_FOTOS - archivos.length;
  const loteCompleto = cuposDisponibles <= 0;

  const limpiar = () => {
    setArchivos([]);
    setDescripcion('');

    if (inputArchivosRef.current) {
      inputArchivosRef.current.value = '';
    }
  };

  const quitarUno = (index: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index));

    // Permite volver a seleccionar la misma imagen posteriormente.
    if (inputArchivosRef.current) {
      inputArchivosRef.current.value = '';
    }
  };

  /** Agrega archivos al lote respetando el máximo de MAX_FOTOS. */
  const agregarMas = (nuevos: File[]) => {
    if (nuevos.length === 0) return;

    setArchivos((prev) => {
      const espacio = MAX_FOTOS - prev.length;
      if (espacio <= 0) return prev;

      return [...prev, ...nuevos.slice(0, espacio)];
    });
  };

  /**
   * Se ejecuta cuando el usuario elige fotografías
   * desde la galería o explorador de archivos.
   */
  const seleccionarArchivos = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nuevos = Array.from(event.target.files ?? []);

    agregarMas(nuevos);

    // Permite volver a seleccionar el mismo archivo.
    event.target.value = '';
  };

  /** Cada captura de CamaraFotos entra al mismo lote que "Elegir fotos". */
  const capturarFoto = (foto: File) => {
    agregarMas([foto]);
  };

  const enviar = () => {
    if (archivos.length === 0) return;

    subir.mutate(
      {
        sedeId,
        archivos,
        descripcion,
      },
      {
        onSuccess: limpiar,
      },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-5">
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

        {/* Acciones principales */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Fotografías <span className="text-destructive">*</span>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="default"
              onClick={() => setCamaraAbierta(true)}
              disabled={subir.isPending || loteCompleto}
              className="w-full"
            >
              <CameraIcon />
              Tomar foto
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => inputArchivosRef.current?.click()}
              disabled={subir.isPending || loteCompleto}
              className="w-full"
            >
              <ImagePlusIcon />
              Elegir fotos
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {loteCompleto ? (
              <span className="font-medium text-amber-600">
                Alcanzaste el máximo de {MAX_FOTOS} fotografías. Elimina
                alguna para agregar otra.
              </span>
            ) : (
              <>
                Puedes tomar fotografías con la cámara o seleccionar
                imágenes existentes de tu dispositivo. Máximo {MAX_FOTOS}{' '}
                por lote.
              </>
            )}
          </p>
        </div>

        {/* Descripción */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Descripción del lote{' '}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </label>

          <Input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Instalación de griferías — avance 60%"
            className="h-9"
            disabled={subir.isPending}
          />

          <p className="text-xs text-muted-foreground">
            Se aplica a todas las fotos de esta subida.
          </p>
        </div>

        {/* Previsualización */}
        {archivos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Fotografías seleccionadas
              </p>

              <p className="text-xs text-muted-foreground tabular-nums">
                {archivos.length} / {MAX_FOTOS} foto(s)
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {archivos.map((f, i) => (
                <div
                  key={`${f.name}-${f.lastModified}-${i}`}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img
                    src={previews[i]}
                    alt={f.name}
                    className="size-full object-cover"
                  />

                  <button
                    type="button"
                    aria-label={`Quitar ${f.name}`}
                    title={`Quitar ${f.name}`}
                    onClick={() => quitarUno(i)}
                    disabled={subir.isPending}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 outline-none transition-colors hover:bg-destructive disabled:pointer-events-none sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <XIcon className="size-3.5" />
                  </button>

                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                    {formatPeso(f.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen y acciones */}
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">
            {archivos.length === 0
              ? 'Ninguna foto seleccionada.'
              : `${archivos.length} foto(s) · ${formatPeso(
                  archivos.reduce((total, f) => total + f.size, 0),
                )}`}
          </p>

          <div className="flex flex-wrap gap-2">
            {archivos.length > 0 && !subir.isPending && (
              <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                <XIcon />
                Quitar todo
              </Button>
            )}

            <Button
              type="button"
              onClick={enviar}
              disabled={archivos.length === 0 || subir.isPending}
            >
              {subir.isPending ? <Spinner /> : <UploadIcon />}

              {subir.isPending
                ? 'Subiendo…'
                : `Subir ${archivos.length || ''} foto(s)`.replace(
                    '  ',
                    ' ',
                  )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}