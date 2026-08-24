import { useRef } from 'react';
import { ImageIcon, XIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { Spinner } from '@/shared/ui/spinner';
import type { CampoDeCarpeta, TipoCampoFotos } from '@/modules/fotos/types';

/**
 * El control de UN campo configurable, según su tipo.
 *
 * Vive aparte porque lo usan las DOS pantallas de la Fase 1b —el formulario
 * de «Añadir equipo» y la ficha de dentro de la carpeta— y son el mismo
 * control con el mismo `switch`. Duplicarlo habría dejado dos sitios donde
 * añadir el tipo nuevo el día que se amplíe `TipoCampoFotos`.
 *
 * ⚠️ El campo FOTO es el único que NO se controla por valor: una imagen no
 * viaja en el JSON de los demás, así que se sube por su propia ruta y aquí
 * se delega en `onImagen`. Cuando quien lo monta no puede subir todavía
 * —porque la carpeta aún no existe—, se enseña deshabilitado con el motivo,
 * que es más honesto que esconderlo y que el usuario no sepa que existe.
 */
export function ControlDeCampo({
  campo,
  valor,
  onCambiar,
  onImagen,
  onQuitarImagen,
  subiendo = false,
  motivoImagenDeshabilitada,
}: {
  campo: Pick<CampoDeCarpeta, 'id' | 'nombre' | 'clave' | 'tipo' | 'opciones'> & {
    imagen?: CampoDeCarpeta['imagen'];
  };
  valor: unknown;
  onCambiar: (valor: unknown) => void;
  onImagen?: (archivo: File) => void;
  onQuitarImagen?: () => void;
  subiendo?: boolean;
  motivoImagenDeshabilitada?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const control = (tipo: TipoCampoFotos) => {
    switch (tipo) {
      case 'TEXTO':
        return (
          <Input
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onCambiar(e.target.value)}
          />
        );

      case 'TEXTO_LARGO':
        return (
          <Textarea
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onCambiar(e.target.value)}
          />
        );

      case 'NUMERO':
        return (
          <Input
            type="number"
            step="any"
            value={
              typeof valor === 'number' || typeof valor === 'string' ? valor : ''
            }
            onChange={(e) => onCambiar(e.target.value)}
          />
        );

      // `type="date"` habla exactamente el "AAAA-MM-DD" que el backend
      // guarda y devuelve, así que no hay conversión que pueda correr el día.
      case 'FECHA':
        return (
          <Input
            type="date"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onCambiar(e.target.value)}
          />
        );

      case 'BOOLEANO':
        return (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={valor === true}
              onChange={(e) => onCambiar(e.target.checked)}
            />
            <span className="text-muted-foreground">
              {valor === true ? 'Sí' : 'No'}
            </span>
          </label>
        );

      case 'LISTA':
        return (
          <Select
            value={valor === null || valor === undefined ? '' : String(valor)}
            onChange={(e) =>
              onCambiar(e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">— Sin elegir —</option>
            {campo.opciones
              // Una opción desactivada no se ofrece, PERO si es la que está
              // elegida sí se muestra: si no, el desplegable aparecería vacío
              // y guardar la borraría sin que nadie lo pidiera.
              .filter((o) => o.activo || o.id === valor)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.etiqueta}
                  {!o.activo ? ' (retirada)' : ''}
                </option>
              ))}
          </Select>
        );

      case 'FOTO':
        return (
          <div className="space-y-2">
            {campo.imagen ? (
              <div className="flex items-center gap-3">
                <img
                  src={campo.imagen.urlMiniatura ?? campo.imagen.url}
                  alt={campo.nombre}
                  className="size-16 rounded-lg border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onQuitarImagen}
                  disabled={!onQuitarImagen || subiendo}
                >
                  <XIcon />
                  Quitar
                </Button>
              </div>
            ) : null}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImagen?.(f);
                if (inputRef.current) inputRef.current.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={!onImagen || subiendo}
            >
              {subiendo ? <Spinner /> : <ImageIcon />}
              {campo.imagen ? 'Cambiar imagen' : 'Subir imagen'}
            </Button>
            {motivoImagenDeshabilitada && (
              <p className="text-xs text-muted-foreground">
                {motivoImagenDeshabilitada}
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {campo.nombre}
      </label>
      {control(campo.tipo)}
    </div>
  );
}
