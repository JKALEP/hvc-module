import { useRef, useState } from 'react';
import { CameraIcon, InboxIcon, UploadIcon } from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { cn } from '@/shared/lib/utils';
import { useCarpeta } from '@/modules/fotos/hooks/useCarpetas';
import { useTareas } from '@/modules/fotos/hooks/useTareas';
import {
  useBandeja,
  useSubirA,
  useClasificar,
} from '@/modules/fotos/hooks/useBandeja';
import type { DestinoFotos } from '@/modules/fotos/types';

/**
 * Captura rápida (§17) y bandeja de pendientes (§18).
 *
 * §17 marca este punto como «muy importante» y dice por qué: el supervisor
 * está en obra con el celular y no se le puede pedir «entrar a carpeta →
 * crear subcarpeta → buscar equipo → buscar tarea → seleccionar foto →
 * repetir». Así que aquí NO se navega: se elige el destino en dos selects y
 * se sube.
 *
 * Las dos secciones viven en la MISMA pantalla a propósito, aunque sean dos
 * apartados de la especificación: son un solo flujo de trabajo —subo ahora
 * lo que pueda asignar, dejo el resto sin asignar y lo clasifico al bajar de
 * la obra—, y separarlas obligaba a recordar que la bandeja existe.
 */
export function CapturaRapida() {
  // El árbol se pide desde la raíz: aquí se ELIGE un destino, no se navega.
  const { data: raiz } = useCarpeta(null);
  const [carpetaId, setCarpetaId] = useState<number | null>(null);
  const { data: dentro } = useCarpeta(carpetaId);

  const esEquipo = dentro?.carpetaActual?.tipo === 'EQUIPO';
  const { data: tareas } = useTareas(carpetaId, { habilitado: esEquipo });
  const [tareaId, setTareaId] = useState<number | null>(null);

  const subir = useSubirA();
  const { data: bandeja, isError } = useBandeja();
  const clasificar = useClasificar();

  const [archivos, setArchivos] = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Selección de la bandeja, para clasificar por lotes.
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());

  const carpetasRaiz = (raiz?.secciones ?? []).flatMap((s) => s.carpetas);
  // ⚠️ Solo cuando hay proyecto elegido. `useCarpeta(null)` devuelve la
  // RAÍZ, así que sin este guardia el segundo select ofrecía otra vez los
  // proyectos —parecía un nivel de profundidad y era el mismo—.
  const subcarpetas =
    carpetaId === null
      ? []
      : (dentro?.secciones ?? []).flatMap((s) => s.carpetas);

  const limpiar = () => {
    setArchivos([]);
    setDescripcion('');
    if (inputRef.current) inputRef.current.value = '';
  };

  /**
   * El destino, derivado de lo elegido. La tarea gana a la carpeta: si se
   * eligió una, es más específica que la carpeta que la contiene.
   */
  const destino: DestinoFotos =
    tareaId !== null
      ? { tipo: 'tarea', tareaId }
      : carpetaId !== null
        ? { tipo: 'carpeta', carpetaId }
        : { tipo: 'bandeja' };

  const enviar = (aBandeja: boolean) => {
    if (archivos.length === 0) return;
    subir.mutate(
      {
        destino: aBandeja ? { tipo: 'bandeja' } : destino,
        archivos,
        descripcion,
      },
      { onSuccess: limpiar },
    );
  };

  const alternar = (id: number) =>
    setElegidas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const clasificarElegidas = () => {
    if (elegidas.size === 0 || destino.tipo === 'bandeja') return;
    clasificar.mutate(
      { fotoIds: [...elegidas], destino },
      { onSuccess: () => setElegidas(new Set()) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Captura rápida"
        description="Sube fotos desde obra sin navegar por las carpetas. Lo que no puedas asignar ahora queda en la bandeja."
      />

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground">1 · A dónde van</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Proyecto
            </label>
            <Select
              value={carpetaId === null ? '' : String(carpetaId)}
              onChange={(e) => {
                setCarpetaId(e.target.value === '' ? null : Number(e.target.value));
                setTareaId(null);
              }}
            >
              <option value="">Sin asignar</option>
              {carpetasRaiz.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>

          {/* Un solo nivel de profundidad, y es deliberado: §17 se queja
              justamente de tener que bajar carpeta a carpeta. Lo que no
              esté a un paso se sube sin asignar y se clasifica luego. */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Estructura o equipo
            </label>
            <Select
              disabled={carpetaId === null || subcarpetas.length === 0}
              value=""
              onChange={(e) => {
                if (e.target.value === '') return;
                setCarpetaId(Number(e.target.value));
                setTareaId(null);
              }}
            >
              <option value="">
                {subcarpetas.length === 0 ? 'Sin subcarpetas' : 'Bajar a…'}
              </option>
              {subcarpetas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Tarea
            </label>
            <Select
              disabled={!esEquipo}
              value={tareaId === null ? '' : String(tareaId)}
              onChange={(e) =>
                setTareaId(e.target.value === '' ? null : Number(e.target.value))
              }
            >
              <option value="">
                {esEquipo ? 'Al álbum de la carpeta' : 'Solo en equipos'}
              </option>
              {(tareas ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Destino:{' '}
          <span className="font-medium text-foreground">
            {destino.tipo === 'bandeja'
              ? 'Bandeja de pendientes'
              : destino.tipo === 'tarea'
                ? `Tarea «${(tareas ?? []).find((t) => t.id === tareaId)?.titulo ?? ''}»`
                : (dentro?.carpetaActual?.nombre ?? '—')}
          </span>
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground">2 · Las fotos</h2>

        <Input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/webp"
          // `capture` abre la cámara directamente en el móvil, que es de lo
          // que va §17. En escritorio el navegador lo ignora.
          capture="environment"
          onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
        />
        <p className="text-xs text-muted-foreground">
          Hasta 10 fotos por vez, máximo 15 MB cada una. JPEG, PNG, HEIC o WebP.
        </p>

        <Input
          placeholder="Comentario (opcional) — se aplica a todas las de esta subida"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => enviar(false)}
            disabled={archivos.length === 0 || subir.isPending}
          >
            {subir.isPending ? <Spinner /> : <UploadIcon />}
            Guardar {archivos.length > 0 && `(${archivos.length})`}
          </Button>
          {/* «Subir fotos sin asignar» de §17, siempre disponible: es la
              salida cuando no se sabe todavía dónde va lo que se acaba de
              fotografiar. */}
          <Button
            variant="outline"
            onClick={() => enviar(true)}
            disabled={archivos.length === 0 || subir.isPending}
          >
            <InboxIcon />
            Subir sin asignar
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-foreground">
            Fotos pendientes de organizar
            {bandeja && bandeja.total > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                {bandeja.total}
              </span>
            )}
          </h2>
          {elegidas.size > 0 && (
            <Button
              onClick={clasificarElegidas}
              disabled={destino.tipo === 'bandeja' || clasificar.isPending}
            >
              Clasificar {elegidas.size} aquí
            </Button>
          )}
        </div>

        {/* El estado sale de los datos y no de `isLoading`: una consulta que
            reintenta deja de estar «cargando» sin haber traído nada. */}
        {!bandeja && !isError ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : bandeja?.fotos.length === 0 ? (
          <EmptyState
            icon={CameraIcon}
            title="Nada pendiente"
            description="Lo que subas sin asignar aparecerá aquí para clasificarlo después."
          />
        ) : (
          <>
            {elegidas.size > 0 && destino.tipo === 'bandeja' && (
              <p className="text-sm text-muted-foreground">
                Elige arriba a dónde van antes de clasificar.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {bandeja?.fotos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => alternar(f.id)}
                  aria-pressed={elegidas.has(f.id)}
                  className={cn(
                    'overflow-hidden rounded-lg border-2 transition-colors',
                    elegidas.has(f.id)
                      ? 'border-primary'
                      : 'border-transparent hover:border-border',
                  )}
                >
                  <img
                    src={f.urlMiniatura}
                    alt={f.descripcion ?? 'Foto pendiente de organizar'}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
