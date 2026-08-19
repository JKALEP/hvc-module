import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import { ETIQUETA_TIPO } from '@/modules/equipos/lib/campos';
import type { DefinicionCampo, TipoCampo } from '@/modules/equipos/types';

/**
 * Un campo del formulario, pintado según su TIPO.
 *
 * Es la pieza que hace que dar de alta un cliente nuevo no toque código:
 * el formulario de registro no conoce ningún campo, solo recorre las
 * definiciones de la organización y pide a este componente que pinte
 * cada una.
 *
 * El `switch` está aquí y en un solo sitio a propósito. Repartirlo entre
 * el formulario de alta y el de edición sería tener dos criterios sobre
 * cómo se captura una fecha.
 */
export function CampoDinamico({
  campo,
  valor,
  onCambiar,
}: {
  campo: DefinicionCampo;
  valor: unknown;
  onCambiar: (valor: unknown) => void;
}) {
  const comun = 'h-9';

  const control = () => {
    switch (campo.tipo) {
      case 'TEXTO_LARGO':
        return (
          <textarea
            value={String(valor ?? '')}
            onChange={(e) => onCambiar(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
          />
        );

      case 'BOOLEANO':
        return (
          <Select
            className={comun}
            value={valor === true ? 'si' : valor === false ? 'no' : ''}
            onChange={(e) =>
              onCambiar(e.target.value === '' ? null : e.target.value === 'si')
            }
          >
            <option value="">Sin definir</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </Select>
        );

      case 'LISTA':
        return (
          <Select
            className={comun}
            value={String(valor ?? '')}
            onChange={(e) =>
              onCambiar(e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">Sin elegir</option>
            {campo.opciones
              .filter((o) => o.activo)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.etiqueta}
                </option>
              ))}
          </Select>
        );

      case 'SELECCION_MULTIPLE': {
        // Casillas y no un <select multiple>: con el nativo hay que
        // saber que se elige con Ctrl, y nadie lo sabe.
        const elegidas = Array.isArray(valor) ? (valor as number[]) : [];
        const alternar = (id: number) =>
          onCambiar(
            elegidas.includes(id)
              ? elegidas.filter((x) => x !== id)
              : [...elegidas, id],
          );
        return (
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-input p-2">
            {campo.opciones
              .filter((o) => o.activo)
              .map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={elegidas.includes(o.id)}
                    onChange={() => alternar(o.id)}
                    className="size-4 rounded border-input"
                  />
                  {o.etiqueta}
                </label>
              ))}
          </div>
        );
      }

      case 'FECHA':
      case 'FECHA_HORA':
        return (
          <Input
            type={campo.tipo === 'FECHA' ? 'date' : 'datetime-local'}
            className={comun}
            value={String(valor ?? '')}
            onChange={(e) => onCambiar(e.target.value || null)}
          />
        );

      case 'NUMERO_ENTERO':
      case 'NUMERO_DECIMAL':
      case 'MONEDA':
        return (
          <Input
            className={cn(comun, 'text-right tabular-nums')}
            inputMode={campo.tipo === 'NUMERO_ENTERO' ? 'numeric' : 'decimal'}
            value={String(valor ?? '')}
            onChange={(e) => onCambiar(e.target.value)}
            placeholder={campo.tipo === 'MONEDA' ? '0.00' : ''}
          />
        );

      default: {
        // TEXTO, CORREO, TELEFONO, URL, ARCHIVO e IMAGEN.
        // Los dos últimos son un texto por ahora: la subida a R2 llega
        // con las fotos de equipo, en su propia fase.
        const tipoHtml: Record<string, string> = {
          CORREO: 'email',
          TELEFONO: 'tel',
          URL: 'url',
        };
        return (
          <Input
            type={tipoHtml[campo.tipo] ?? 'text'}
            className={comun}
            value={String(valor ?? '')}
            onChange={(e) => onCambiar(e.target.value)}
            placeholder={
              campo.tipo === 'ARCHIVO' || campo.tipo === 'IMAGEN'
                ? 'Referencia del archivo (la subida llega en otra fase)'
                : ''
            }
          />
        );
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {campo.nombre}
        {campo.obligatorio && <span className="text-destructive"> *</span>}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          {ETIQUETA_TIPO[campo.tipo as TipoCampo]}
        </span>
      </label>
      {control()}
    </div>
  );
}
