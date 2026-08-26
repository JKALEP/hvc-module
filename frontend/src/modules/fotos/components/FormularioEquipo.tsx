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
import { Select } from '@/shared/ui/select';
import { useCamposEquipo } from '@/modules/fotos/hooks/useCamposEquipo';
import {
  useSistemas,
  useCatalogoActividades,
} from '@/modules/fotos/hooks/useCatalogoFotos';

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
    tipoSistemaId: number | null;
    /**
     * El checklist inicial. Va SIEMPRE, incluso vacío: el formulario enseña
     * las casillas, así que lo que salga de aquí es una decisión tomada y no
     * una omisión — y el servidor distingue las dos cosas.
     */
    actividades: number[];
  }) => void;
  onCerrar: () => void;
}) {
  // Solo los activos: aquí se está RELLENANDO, y un campo retirado ya no se
  // pide. Los retirados con valor siguen viéndose en la ficha de dentro.
  const { data: campos } = useCamposEquipo(true);
  const { data: familias } = useSistemas(true);
  const [nombre, setNombre] = useState('');
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [tipoSistemaId, setTipoSistemaId] = useState<number | null>(null);

  // ⚠️ Qué actividades van marcadas se DERIVA del catálogo salvo que alguien
  // toque una casilla, y entonces manda el mapa de excepciones. Un `useState`
  // con la lista dentro habría que resincronizarlo al cambiar el tipo de
  // sistema —con un efecto que `react-hooks/set-state-in-effect` rechaza— y
  // además perdería lo desmarcado en cuanto el catálogo llegara tarde. Mismo
  // patrón que los grupos abiertos del sidebar.
  const [desmarcadas, setDesmarcadas] = useState<Set<number>>(new Set());

  const { data: propuestas } = useCatalogoActividades({
    tipoSistemaId,
    soloActivas: true,
    habilitado: tipoSistemaId !== null,
  });
  const checklist = tipoSistemaId === null ? [] : (propuestas ?? []);

  const rellenables = (campos ?? []).filter((c) => c.tipo !== 'FOTO');
  const deFoto = (campos ?? []).filter((c) => c.tipo === 'FOTO');

  const enviar = () => {
    const limpio = Object.fromEntries(
      Object.entries(valores).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined,
      ),
    );
    onCrear({
      nombre: nombre.trim(),
      valores: limpio,
      tipoSistemaId,
      actividades: checklist
        .filter((d) => !desmarcadas.has(d.id))
        .map((d) => d.id),
    });
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

          {/* El tipo de sistema va ANTES que los campos configurables y que
              el checklist, porque los dos de abajo dependen de él: cambiarlo
              cambia qué se propone. */}
          <div className="space-y-1.5">
            <label
              className="block text-sm font-medium text-foreground"
              htmlFor="tipo-sistema"
            >
              Tipo de sistema
            </label>
            <Select
              id="tipo-sistema"
              value={tipoSistemaId ?? ''}
              onChange={(e) => {
                setTipoSistemaId(e.target.value ? Number(e.target.value) : null);
                // Al cambiar de tipo el checklist es otro, así que las
                // exclusiones del anterior ya no significan nada.
                setDesmarcadas(new Set());
              }}
            >
              <option value="">— Sin definir —</option>
              {(familias ?? []).map((f) => (
                <optgroup key={f.id} label={f.nombre}>
                  {(f.tipos ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Decide qué actividades se proponen. Se puede dejar sin definir y
              ponerlo después.
            </p>
          </div>

          {/* La preselección de la Fase 2: propone, no impone. */}
          {checklist.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                Actividades de la primera visita
              </p>
              <ul className="space-y-1 rounded-md border border-border/60 p-2">
                {checklist.map((d) => (
                  <li key={d.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`act-${d.id}`}
                      className="mt-1"
                      checked={!desmarcadas.has(d.id)}
                      onChange={(e) =>
                        setDesmarcadas((s) => {
                          const siguiente = new Set(s);
                          if (e.target.checked) siguiente.delete(d.id);
                          else siguiente.add(d.id);
                          return siguiente;
                        })
                      }
                    />
                    <label htmlFor={`act-${d.id}`} className="text-sm">
                      {d.nombre}
                      {d.descripcion && (
                        <span className="block text-xs text-muted-foreground">
                          {d.descripcion}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tipoSistemaId !== null && checklist.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Este tipo de sistema todavía no tiene actividades en el catálogo.
              El equipo se crea igual y se le añaden después.
            </p>
          )}

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
