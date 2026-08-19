import { useState } from 'react';
import {
  SendIcon,
  EyeIcon,
  CheckCircle2Icon,
  RotateCcwIcon,
  AlertTriangleIcon,
  MailIcon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Spinner } from '@/shared/ui/spinner';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Campo, CLASES_TEXTAREA } from './Campo';
import {
  usePlantilla,
  useCrearVersion,
  useActivarVersion,
  usePrevisualizar,
} from '@/modules/costos/hooks/usePlantilla';
import { formatFecha } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

/**
 * La plantilla del correo de solicitud (§32, §68).
 *
 * ── Publicar es crear, nunca editar ──────────────────────────────────
 * No hay botón de «guardar cambios» sobre una versión existente, y no es
 * un olvido: cada solicitud enviada guarda con qué versión salió, así
 * que reescribir una cambiaría lo que dice un correo que ya está en la
 * bandeja de un proveedor. Corregir una errata es publicar la siguiente;
 * volver atrás es reactivar la anterior. Las dos cosas dejan rastro y
 * ninguna borra nada.
 *
 * El editor arranca con el texto que se está usando, que es lo que casi
 * siempre se quiere retocar. Si nadie ha publicado nunca, arranca con el
 * del código —y se dice que es el del código, para que no parezca que
 * hay una versión guardada que no existe—.
 */
export function AdminPlantilla() {
  const { data, isError } = usePlantilla();
  const crear = useCrearVersion();
  const activar = useActivarVersion();
  const previsualizar = usePrevisualizar();

  const [asunto, setAsunto] = useState<string | null>(null);
  const [cuerpo, setCuerpo] = useState<string | null>(null);
  const [activarAlPublicar, setActivarAlPublicar] = useState(true);

  if (isError)
    return (
      <p className="rounded-xl border border-border p-6 text-center text-sm text-destructive">
        No se pudo cargar la plantilla.
      </p>
    );

  if (!data) return <TableSkeleton rows={6} cols={2} />;

  // El borrador se DERIVA de lo que está en uso mientras nadie lo toque:
  // así, si otro publica una versión, el editor refleja lo nuevo en vez
  // de quedarse con una copia vieja sembrada por un efecto.
  const asuntoActual = asunto ?? data.enUso.asunto;
  const cuerpoActual = cuerpo ?? data.enUso.cuerpo;
  const tocado = asunto !== null || cuerpo !== null;
  const completo = asuntoActual.trim() !== '' && cuerpoActual.trim() !== '';

  const insertar = (clave: string) =>
    setCuerpo(`${cuerpoActual}{{${clave}}}`);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Plantilla del correo de solicitud
        </h2>
        <p className="text-sm text-muted-foreground">
          El texto que reciben los proveedores cuando el gestor les pide
          cotización. Se manda como texto plano: la tabla de ítems se alinea
          con espacios para que se lea igual en cualquier cliente de correo.
        </p>
      </div>

      {/* Qué se está usando ahora mismo. */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4',
          data.enUso.origen === 'DEFECTO'
            ? 'border-amber-600/25 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
            : 'border-emerald-600/25 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10',
        )}
      >
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MailIcon className="size-4" />
            {data.enUso.origen === 'VERSION'
              ? `Se está usando la versión ${String(data.enUso.version)}`
              : 'Todavía no hay ninguna versión publicada'}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.enUso.origen === 'VERSION'
              ? 'Las solicitudes que se manden ahora salen con este texto.'
              : 'Se usa el texto por defecto del sistema, y cada envío queda sin versión asociada. Publica una para poder auditar con qué se mandó cada correo.'}
          </p>
        </div>
      </div>

      {/* ── El editor ── */}
      <div className="space-y-4">
        <Campo label="Asunto" requerido>
          <Input
            value={asuntoActual}
            onChange={(e) => setAsunto(e.target.value)}
            aria-invalid={asuntoActual.trim() === ''}
          />
        </Campo>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Cuerpo<span className="text-destructive"> *</span>
          </label>
          <textarea
            value={cuerpoActual}
            onChange={(e) => setCuerpo(e.target.value)}
            rows={16}
            className={cn(CLASES_TEXTAREA, 'font-mono text-xs')}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Variables disponibles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.variables.map((v) => (
              <button
                key={v.clave}
                onClick={() => insertar(v.clave)}
                title={`${v.descripcion} — clic para añadirla al final`}
                className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground transition-colors hover:bg-muted"
              >
                {`{{${v.clave}}}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Un marcador que no esté en esta lista se rechaza al publicar:
            saldría tal cual en el correo del proveedor.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={activarAlPublicar}
              onChange={(e) => setActivarAlPublicar(e.target.checked)}
              className="size-4 accent-primary"
            />
            Empezar a usarla al publicar
          </label>

          <div className="flex flex-wrap gap-2">
            {tocado && (
              <Button
                variant="ghost"
                onClick={() => {
                  setAsunto(null);
                  setCuerpo(null);
                  previsualizar.reset();
                }}
              >
                Descartar cambios
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!completo || previsualizar.isPending}
              onClick={() =>
                previsualizar.mutate({
                  asunto: asuntoActual,
                  cuerpo: cuerpoActual,
                })
              }
            >
              {previsualizar.isPending ? <Spinner /> : <EyeIcon />}
              Vista previa
            </Button>
            <Button
              disabled={!completo || crear.isPending}
              onClick={() =>
                crear.mutate(
                  {
                    asunto: asuntoActual,
                    cuerpo: cuerpoActual,
                    activar: activarAlPublicar,
                  },
                  {
                    onSuccess: () => {
                      setAsunto(null);
                      setCuerpo(null);
                    },
                  },
                )
              }
            >
              {crear.isPending ? <Spinner /> : <SendIcon />}
              Publicar versión
            </Button>
          </div>
        </div>
      </div>

      {/* ── La vista previa ── */}
      {previsualizar.data && (
        <div className="space-y-2 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Así llegaría
            </p>
            <span className="text-xs text-muted-foreground">
              con datos de ejemplo — no se envió nada
            </span>
          </div>

          {previsualizar.data.desconocidas.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-600/25 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Estos marcadores no existen y saldrían tal cual:{' '}
                {previsualizar.data.desconocidas
                  .map((v) => `{{${v}}}`)
                  .join(', ')}
                . Publicar se rechazará hasta corregirlos.
              </span>
            </p>
          )}

          <p className="text-sm">
            <span className="font-medium text-foreground">Asunto:</span>{' '}
            <span className="text-muted-foreground">
              {previsualizar.data.asunto}
            </span>
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap text-foreground">
            {previsualizar.data.cuerpo}
          </pre>
        </div>
      )}

      {/* ── El historial de versiones (§68) ── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Versiones publicadas
        </h3>
        {data.versiones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ninguna todavía. Al publicar la primera, cada solicitud enviada
            guardará con qué versión salió.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.versiones.map((v) => (
              <li key={v.id} className="space-y-1 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={v.activa ? 'success' : 'secondary'}>
                      {v.activa && <CheckCircle2Icon />}
                      Versión {v.version}
                      {v.activa ? ' · en uso' : ''}
                    </Badge>
                    <span className="text-sm text-foreground">{v.asunto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {v.creadoPor ? `${v.creadoPor.nombre} · ` : ''}
                      {formatFecha(v.creadoEn)}
                    </span>
                    {!v.activa && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activar.isPending}
                        onClick={() => activar.mutate(v.id)}
                      >
                        <RotateCcwIcon />
                        Usar esta
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAsunto(v.asunto);
                        setCuerpo(v.cuerpo);
                        previsualizar.reset();
                      }}
                    >
                      Partir de esta
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
