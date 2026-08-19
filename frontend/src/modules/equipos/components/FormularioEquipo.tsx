import { useState } from 'react';
import { SaveIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { CampoDinamico } from './CampoDinamico';
import { aValoresDeFormulario } from '@/modules/equipos/lib/campos';
import type {
  DefinicionCampo,
  NodoEstructura,
  EquipoDetalle,
  ValoresEquipo,
} from '@/modules/equipos/types';

/** El árbol aplanado, con sangría, para el selector de ubicación. */
function aplanar(
  nodos: NodoEstructura[],
  nivel = 0,
): { id: number; etiqueta: string }[] {
  return nodos.flatMap((n) => [
    { id: n.id, etiqueta: `${'　'.repeat(nivel)}${n.nombre}` },
    ...aplanar(n.hijos, nivel + 1),
  ]);
}

/**
 * Alta y edición de un equipo.
 *
 * El formulario NO conoce ningún campo: recorre las definiciones activas
 * de la organización y deja que `CampoDinamico` pinte cada una. Por eso
 * dar de alta un cliente nuevo con otros campos no toca este archivo.
 */
export function FormularioEquipo({
  campos,
  nodos,
  nodoPorDefecto,
  equipo,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  campos: DefinicionCampo[];
  nodos: NodoEstructura[];
  nodoPorDefecto: number | null;
  /** Si viene, se edita; si no, se crea. */
  equipo?: EquipoDetalle;
  ocupado: boolean;
  onGuardar: (datos: {
    nodoId: number;
    codigoInterno: string | null;
    valores: ValoresEquipo;
  }) => void;
  onCerrar: () => void;
}) {
  const activos = campos.filter((c) => c.activo);

  const [codigo, setCodigo] = useState(equipo?.codigoInterno ?? '');
  const [nodoId, setNodoId] = useState<number | null>(
    equipo?.nodo.id ?? nodoPorDefecto,
  );
  const [valores, setValores] = useState<ValoresEquipo>(() =>
    equipo ? aValoresDeFormulario(equipo.valores) : {},
  );

  const opciones = aplanar(nodos);

  // La validación fina la hace el backend, que es donde vive la regla.
  // Aquí solo se evita mandar algo que se sabe incompleto.
  const falta =
    nodoId === null ||
    activos.some(
      (c) =>
        c.obligatorio &&
        (valores[c.clave] === undefined ||
          valores[c.clave] === null ||
          valores[c.clave] === '' ||
          (Array.isArray(valores[c.clave]) &&
            (valores[c.clave] as unknown[]).length === 0)),
    );

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {equipo
              ? `Editar ${equipo.codigoInterno ?? 'equipo'}`
              : 'Nuevo equipo'}
          </DialogTitle>
          <DialogDescription>
            Los campos son los que configuró esta organización.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Código interno
            </label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="EQ-001"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Ubicación <span className="text-destructive">*</span>
            </label>
            <Select
              className="h-9"
              value={nodoId ?? ''}
              onChange={(e) =>
                setNodoId(e.target.value === '' ? null : Number(e.target.value))
              }
            >
              <option value="">Elegir…</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.etiqueta}
                </option>
              ))}
            </Select>
          </div>

          {activos.map((c) => (
            <CampoDinamico
              key={c.id}
              campo={c}
              valor={valores[c.clave]}
              onCambiar={(v) =>
                setValores((prev) => ({ ...prev, [c.clave]: v }))
              }
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={falta || ocupado}
            onClick={() =>
              onGuardar({
                nodoId: nodoId as number,
                codigoInterno: codigo.trim() || null,
                valores,
              })
            }
          >
            {ocupado ? <Spinner /> : <SaveIcon />}
            {equipo ? 'Guardar cambios' : 'Registrar equipo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
