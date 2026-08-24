import { useEffect, useRef, useState } from 'react';
import { UploadIcon, XIcon } from 'lucide-react';

import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { useSubirFotos } from '@/modules/fotos/hooks/useAlbumes';

/** Tamaño legible de un archivo. */
function formatPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Subir fotos a una carpeta (crea un álbum nuevo automáticamente).
 *
 * Ahora con PREVIEW real: cada archivo elegido se ve como miniatura, no
 * solo como texto «foto1111.png». Cada miniatura tiene su propia X para
 * quitarla antes de subir, sin tener que vaciar la selección entera.
 */
export function PanelSubida({ sedeId }: { sedeId: number }) {
  const subir = useSubirFotos();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Una URL de objeto por archivo, para la miniatura. Se recrean solo
  // cuando cambia la lista, y se liberan al desmontar / reemplazar.
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = archivos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [archivos]);

  const limpiar = () => {
    setArchivos([]);
    setDescripcion('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const quitarUno = (index: number) => {
    setArchivos((prev) => prev.filter((_, i) => i !== index));
    // El input nativo no sabe que quitamos uno de su FileList: si se vuelve
    // a soltar los mismos archivos después, hay que limpiar su valor.
    if (inputRef.current) inputRef.current.value = '';
  };

  const agregarMas = (nuevos: File[]) => {
    setArchivos((prev) => [...prev, ...nuevos]);
  };

  const enviar = () => {
    if (archivos.length === 0) return;
    subir.mutate({ sedeId, archivos, descripcion }, { onSuccess: limpiar });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Fotos <span className="text-destructive">*</span>
            </label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              onChange={(e) => agregarMas(Array.from(e.target.files ?? []))}
              className="block w-full cursor-pointer rounded-lg border border-input bg-background text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Hasta 10 fotos por vez, máximo 15 MB cada una. JPEG, PNG, HEIC o
              WebP.
            </p>
          </div>

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
            />
            <p className="text-xs text-muted-foreground">
              Se aplica a todas las fotos de esta subida.
            </p>
          </div>
        </div>

        {/* Preview real, no solo el nombre del archivo. Cada miniatura
            tiene su propia X para quitarla antes de subir. */}
        {archivos.length > 0 && (
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
                  className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 outline-none transition-opacity hover:bg-destructive group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <XIcon className="size-3" />
                </button>
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                  {formatPeso(f.size)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            {archivos.length === 0
              ? 'Ninguna foto seleccionada.'
              : `${archivos.length} foto(s) · ${formatPeso(
                  archivos.reduce((a, f) => a + f.size, 0),
                )}`}
          </p>
          <div className="flex gap-2">
            {archivos.length > 0 && !subir.isPending && (
              <Button variant="ghost" size="sm" onClick={limpiar}>
                <XIcon />
                Quitar todo
              </Button>
            )}
            <Button
              onClick={enviar}
              disabled={archivos.length === 0 || subir.isPending}
            >
              {subir.isPending ? <Spinner /> : <UploadIcon />}
              {subir.isPending
                ? 'Subiendo…'
                : `Subir ${archivos.length || ''} foto(s)`.replace('  ', ' ')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}