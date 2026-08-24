import { useState } from 'react';
import { PencilIcon, WrenchIcon } from 'lucide-react';

import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { ControlDeCampo } from './ControlDeCampo';
import {
  useCamposDeCarpeta,
  useGuardarCamposDeCarpeta,
  useSubirImagenDeCampo,
  useQuitarImagenDeCampo,
} from '@/modules/fotos/hooks/useCamposEquipo';
import type { CampoDeCarpeta } from '@/modules/fotos/types';

/** Lo que se enseña de un campo cuando NO se está editando. */
function textoDe(campo: CampoDeCarpeta): string {
  if (campo.tipo === 'FOTO') return campo.imagen ? 'Con imagen' : '—';
  if (campo.valor === null || campo.valor === undefined) return '—';
  if (campo.tipo === 'BOOLEANO') return campo.valor === true ? 'Sí' : 'No';
  if (campo.tipo === 'LISTA')
    return (
      campo.opciones.find((o) => o.id === campo.valor)?.etiqueta ??
      String(campo.valor)
    );
  return String(campo.valor);
}

/** El valor con el que arranca el formulario de edición. */
function valorInicial(campo: CampoDeCarpeta): unknown {
  // El FOTO no se controla por valor: se sube por su propia ruta.
  return campo.tipo === 'FOTO' ? null : campo.valor;
}

/**
 * La ficha del equipo dentro de su carpeta (Fase 1b).
 *
 * Sustituye a lo que antes enseñaba el código del catálogo de Gestión de
 * Equipos: la información del equipo es ahora propia de Fotos y la define un
 * ADMIN_GLOBAL sin tocar código.
 *
 * Se monta SOLO en carpetas de tipo EQUIPO —lo decide quien la usa— porque
 * en una corriente el backend contesta 400 y pedirlo en cada carpeta que se
 * abre sería una consulta para nada.
 *
 * ⚠️ Guardar manda **solo los campos que no son FOTO**. Es la semántica
 * parcial del backend: una imagen no cabe en el JSON, así que se sube al
 * vuelo por su propia ruta y no espera al botón «Guardar». Por eso los dos
 * caminos conviven en la misma pantalla sin pisarse.
 */
export function CamposDeEquipo({
  carpetaId,
  puedeEditar,
}: {
  carpetaId: number;
  puedeEditar: boolean;
}) {
  const { data: campos, isError } = useCamposDeCarpeta(carpetaId);
  const guardar = useGuardarCamposDeCarpeta();
  const subir = useSubirImagenDeCampo();
  const quitar = useQuitarImagenDeCampo();

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, unknown>>({});

  // `!data && !isError` y no `isLoading`: una consulta que reintenta deja de
  // estar «cargando» sin haber traído nada, y ahí la pantalla no sabe.
  if (!campos && !isError)
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Spinner />
        </CardContent>
      </Card>
    );

  if (isError)
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-destructive">
            No se pudieron cargar los datos del equipo.
          </p>
        </CardContent>
      </Card>
    );

  if (campos!.length === 0)
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={WrenchIcon}
            title="Sin campos configurados"
            description="Un administrador de Fotos define qué datos se piden de cada equipo."
          />
        </CardContent>
      </Card>
    );

  const abrirEdicion = () => {
    setBorrador(
      Object.fromEntries(campos!.map((c) => [c.clave, valorInicial(c)])),
    );
    setEditando(true);
  };

  const enviar = () => {
    // Solo lo que no es FOTO, y con "" convertido a null: vaciar un campo es
    // borrarlo, que es lo que el backend entiende por null.
    const valores = Object.fromEntries(
      campos!
        .filter((c) => c.tipo !== 'FOTO')
        .map((c) => [
          c.clave,
          borrador[c.clave] === '' ? null : borrador[c.clave],
        ]),
    );
    guardar.mutate(
      { carpetaId, valores },
      { onSuccess: () => setEditando(false) },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium text-foreground">
            <WrenchIcon className="size-4" />
            Datos del equipo
          </h2>
          {puedeEditar && !editando && (
            <Button variant="outline" size="sm" onClick={abrirEdicion}>
              <PencilIcon />
              Editar
            </Button>
          )}
        </div>

        {editando ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {campos!.map((c) => (
                <ControlDeCampo
                  key={c.id}
                  campo={c}
                  valor={borrador[c.clave]}
                  onCambiar={(v) =>
                    setBorrador((b) => ({ ...b, [c.clave]: v }))
                  }
                  // La imagen se sube al vuelo, no al pulsar «Guardar»: es
                  // otra ruta y otro momento.
                  onImagen={(archivo) =>
                    subir.mutate({ carpetaId, campoId: c.id, archivo })
                  }
                  onQuitarImagen={
                    c.imagen
                      ? () => quitar.mutate({ carpetaId, campoId: c.id })
                      : undefined
                  }
                  subiendo={subir.isPending || quitar.isPending}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditando(false)}
                disabled={guardar.isPending}
              >
                Cancelar
              </Button>
              <Button onClick={enviar} disabled={guardar.isPending}>
                {guardar.isPending && <Spinner />}
                Guardar
              </Button>
            </div>
          </>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {campos!.map((c) => (
              <div key={c.id} className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {c.nombre}
                  {/* Un campo retirado que conserva valor: se sigue viendo,
                      pero se dice que ya no se pide. */}
                  {!c.activo && ' (retirado)'}
                </dt>
                <dd className="truncate text-sm text-foreground">
                  {c.tipo === 'FOTO' && c.imagen ? (
                    <img
                      src={c.imagen.urlMiniatura ?? c.imagen.url}
                      alt={c.nombre}
                      className="mt-1 size-16 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    textoDe(c)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
