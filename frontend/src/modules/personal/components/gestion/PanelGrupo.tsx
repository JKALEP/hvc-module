import { useState } from 'react';
import {
  ChevronRightIcon,
  PencilIcon,
  Trash2Icon,
  UserPlusIcon,
  FolderInputIcon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from '@/shared/ui/table';
import { cn } from '@/shared/lib/utils';
import { FilaFicha } from './FilaFicha';
import { COLUMNAS, ETIQUETA_GRUPO } from '@/modules/personal/lib/sctr';
import type {
  GrupoPersonal,
  Catalogo,
  DatosFicha,
  TipoPersonal,
} from '@/modules/personal/types';

/**
 * Un grupo con su gente: la fila de color del Excel, convertida en
 * cabecera plegable con su propia tabla debajo.
 */
export function PanelGrupo({
  grupo,
  tipo,
  color,
  catalogo,
  seleccionadas,
  onSeleccionar,
  onRenombrar,
  onEliminarGrupo,
  onAgregar,
  onCambiar,
  onDuplicar,
  onEliminarFicha,
  onMoverSeleccion,
}: {
  grupo: GrupoPersonal;
  tipo: TipoPersonal;
  color: string;
  catalogo?: Catalogo;
  seleccionadas: Set<number>;
  onSeleccionar: (id: number, marcada: boolean) => void;
  onRenombrar: (id: number, nombre: string) => void;
  onEliminarGrupo: (grupo: GrupoPersonal) => void;
  onAgregar: (grupoId: number) => void;
  onCambiar: (id: number, cambios: Partial<DatosFicha>) => void;
  onDuplicar: (id: number) => void;
  onEliminarFicha: (id: number) => void;
  onMoverSeleccion: (grupoId: number) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState(grupo.nombre);

  const guardarNombre = () => {
    const limpio = nombre.trim();
    if (limpio && limpio !== grupo.nombre) onRenombrar(grupo.id, limpio);
    else setNombre(grupo.nombre);
    setEditandoNombre(false);
  };

  const marcadasAqui = grupo.fichas.filter((f) =>
    seleccionadas.has(f.id),
  ).length;

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      {/* Cabecera: el mismo color con el que viaja en el Excel. */}
      <header
        className="flex flex-wrap items-center gap-2 px-3 py-2"
        style={{ backgroundColor: `#${color}25` }}
      >
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={abierto}
        >
          <ChevronRightIcon
            className={cn('size-4 transition-transform', abierto && 'rotate-90')}
          />
          <span
            className="size-3 shrink-0 rounded-sm border border-black/10"
            style={{ backgroundColor: `#${color}` }}
            aria-hidden
          />
        </button>

        {editandoNombre ? (
          <Input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setNombre(grupo.nombre);
                setEditandoNombre(false);
              }
            }}
            className="h-8 max-w-md"
          />
        ) : (
          <h3 className="font-semibold text-foreground">{grupo.nombre}</h3>
        )}

        <span className="text-sm text-muted-foreground tabular-nums">
          {grupo.fichas.length} persona(s)
        </span>

        <div className="ml-auto flex items-center gap-1">
          {marcadasAqui > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMoverSeleccion(grupo.id)}
            >
              <FolderInputIcon />
              Traer {marcadasAqui > 0 ? 'selección' : ''}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onAgregar(grupo.id)}>
            <UserPlusIcon />
            Agregar
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Renombrar ${ETIQUETA_GRUPO[tipo].toLowerCase()}`}
            title={`Renombrar ${ETIQUETA_GRUPO[tipo].toLowerCase()}`}
            onClick={() => setEditandoNombre(true)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Eliminar grupo"
            title="Eliminar grupo"
            onClick={() => onEliminarGrupo(grupo)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </header>

      {abierto && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-8" />
                {COLUMNAS.map((c) => (
                  <TableHead key={c.clave} className="text-xs whitespace-nowrap">
                    {c.etiqueta}
                  </TableHead>
                ))}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupo.fichas.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <td
                    colSpan={COLUMNAS.length + 2}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    Sin personal. Pulsa «Agregar» para añadir la primera fila.
                  </td>
                </TableRow>
              ) : (
                grupo.fichas.map((f) => (
                  <FilaFicha
                    key={f.id}
                    ficha={f}
                    catalogo={catalogo}
                    seleccionada={seleccionadas.has(f.id)}
                    onSeleccionar={onSeleccionar}
                    onCambiar={onCambiar}
                    onDuplicar={onDuplicar}
                    onEliminar={onEliminarFicha}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
