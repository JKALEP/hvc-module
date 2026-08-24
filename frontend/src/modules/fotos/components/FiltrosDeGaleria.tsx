import { XIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import type { AutorDeCarpeta, FiltrosGaleria } from '@/modules/fotos/types';

// Sin exportar: un archivo que exporta un componente Y una constante rompe
// el fast-refresh de Vite (`react-refresh/only-export-components`), y el
// estado inicial es de quien monta el filtro, no del filtro.
const SIN_FILTROS: FiltrosGaleria = {
  subidaPorId: null,
  desde: '',
  hasta: '',
};

/**
 * Filtros de la galería: por autor y por rango de fechas.
 *
 * El de autor solo aparece si hay MÁS DE UNO: en una carpeta donde subió una
 * sola persona, un desplegable con una única opción es ruido —y en obra ese
 * es el caso más común—.
 *
 * En móvil los tres campos ocupan el ancho completo y se apilan; §21 pide
 * priorizar el flujo de subir, no el de filtrar.
 */
export function FiltrosDeGaleria({
  filtros,
  onCambiar,
  autores,
  totalFotos,
}: {
  filtros: FiltrosGaleria;
  onCambiar: (f: FiltrosGaleria) => void;
  autores: AutorDeCarpeta[];
  totalFotos: number;
}) {
  const hayFiltro =
    filtros.subidaPorId !== null || filtros.desde !== '' || filtros.hasta !== '';

  return (
    <div className="flex flex-wrap items-end gap-3">
      {autores.length > 1 && (
        <div className="w-full space-y-1.5 sm:w-56">
          <label className="block text-sm font-medium text-foreground">
            Subido por
          </label>
          <Select
            className="h-9"
            value={
              filtros.subidaPorId === null ? '' : String(filtros.subidaPorId)
            }
            onChange={(e) =>
              onCambiar({
                ...filtros,
                subidaPorId:
                  e.target.value === '' ? null : Number(e.target.value),
              })
            }
          >
            <option value="">Todos</option>
            {autores.map((a) => (
              <option key={a.usuarioId} value={a.usuarioId}>
                {a.nombre} ({a.albumes})
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex-1 space-y-1.5 sm:flex-none">
        <label className="block text-sm font-medium text-foreground">
          Desde
        </label>
        <Input
          type="date"
          className="h-9 w-full sm:w-40"
          value={filtros.desde}
          onChange={(e) => onCambiar({ ...filtros, desde: e.target.value })}
        />
      </div>

      <div className="flex-1 space-y-1.5 sm:flex-none">
        <label className="block text-sm font-medium text-foreground">
          Hasta
        </label>
        <Input
          type="date"
          className="h-9 w-full sm:w-40"
          value={filtros.hasta}
          onChange={(e) => onCambiar({ ...filtros, hasta: e.target.value })}
        />
      </div>

      {hayFiltro && (
        <Button variant="ghost" size="sm" onClick={() => onCambiar(SIN_FILTROS)}>
          <XIcon />
          Limpiar
        </Button>
      )}

      <p className="ml-auto text-sm text-muted-foreground tabular-nums">
        {totalFotos} foto(s)
      </p>
    </div>
  );
}
