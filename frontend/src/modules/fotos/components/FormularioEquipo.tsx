import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { ControlDeCampo } from './ControlDeCampo';
import { useCamposEquipo } from '@/modules/fotos/hooks/useCamposEquipo';

/**
 * «Añadir equipo»: nombre y los campos configurables, en un solo paso.
 *
 * ⚠️ Sustituye a `SelectorEquipo`, el flujo de TRES pasos contra el catálogo
 * de Gestión de Equipos —organización → buscar → elegir, y si no estaba,
 * registrarlo en el otro módulo sin salir de éste—. Esa fricción es la que
 * motivó separar los módulos en la Fase 1a: demasiados pasos para
 * documentar algo con el móvil en la mano, y a veces sin forma de avanzar si
 * el catálogo no estaba cargado.
 *
 * Todos los campos son OPCIONALES y lo único obligatorio es el nombre. No es
 * un descuido: es la regla del modelo —no existe `obligatorio`— para que
 * crear un equipo en obra no se pueda trabar por un dato que no se tiene a
 * mano.
 *
 * ⚠️ Los campos de tipo FOTO se enseñan pero no se pueden rellenar todavía:
 * la imagen se sube contra `carpeta/:id/campo/:campoId/imagen` y esa carpeta
 * aún no existe. Se muestran deshabilitados con el motivo en vez de
 * ocultarlos, para que quien los configuró sepa que están ahí y dónde
 * completarlos.
 */
export function FormularioEquipo({
  nombreDestino,
  ocupado,
  onCrear,
  onCerrar,
}: {
  nombreDestino: string;
  ocupado: boolean;
  onCrear: (datos: {
    nombre: string;
    valores: Record<string, unknown>;
  }) => void;
  onCerrar: () => void;
}) {
  // Solo los activos: aquí se está RELLENANDO, y un campo retirado ya no se
  // pide. Los retirados con valor siguen viéndose en la ficha de dentro.
  const { data: campos } = useCamposEquipo(true);
  const [nombre, setNombre] = useState('');
  const [valores, setValores] = useState<Record<string, unknown>>({});

  const rellenables = (campos ?? []).filter((c) => c.tipo !== 'FOTO');
  const deFoto = (campos ?? []).filter((c) => c.tipo === 'FOTO');

  const enviar = () => {
    const limpio = Object.fromEntries(
      Object.entries(valores).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined,
      ),
    );
    onCrear({ nombre: nombre.trim(), valores: limpio });
  };

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Añadir equipo</DialogTitle>
          <DialogDescription>
            Se creará dentro de {nombreDestino}. Solo el nombre es
            obligatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Nombre del equipo <span className="text-destructive">*</span>
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Chiller 01"
              autoFocus
            />
          </div>

          {rellenables.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {rellenables.map((c) => (
                <ControlDeCampo
                  key={c.id}
                  campo={c}
                  valor={valores[c.clave]}
                  onCambiar={(v) =>
                    setValores((s) => ({ ...s, [c.clave]: v }))
                  }
                />
              ))}
            </div>
          )}

          {deFoto.map((c) => (
            <ControlDeCampo
              key={c.id}
              campo={c}
              valor={null}
              onCambiar={() => {}}
              motivoImagenDeshabilitada="Se sube al abrir el equipo, una vez creado."
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || nombre.trim() === ''}>
            {ocupado && <Spinner />}
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
