import { useRef, useState } from 'react';
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
 * Subir fotos a una carpeta.
 *
 * No hay paso previo de crear ni nombrar nada: subir ES la acción, y el
 * lote se crea solo. La descripción es del lote entero — en obra se
 * documenta un momento, no cada imagen — y la etiqueta lo dice para que
 * nadie busque un campo por foto que no existe.
 */
export function PanelSubida({ sedeId }: { sedeId: number }) {
  const subir = useSubirFotos();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState('');
  // El <input type="file"> no se puede vaciar por estado: se limpia por ref.
  const inputRef = useRef<HTMLInputElement>(null);

  const limpiar = () => {
    setArchivos([]);
    setDescripcion('');
    if (inputRef.current) inputRef.current.value = '';
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
              onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
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
                Quitar
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
