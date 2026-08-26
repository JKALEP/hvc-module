import { useRef, useState } from 'react';
import { ImagePlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';
import { formatActualizado } from '@/shared/lib/format';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useFotosDeActividad } from '@/modules/fotos/hooks/useActividades';
import { useSubirA } from '@/modules/fotos/hooks/useBandeja';
import { useEliminarFoto } from '@/modules/fotos/hooks/useFotos';
import { alcanza } from '@/modules/fotos/lib/permisos';
import type {
  PermisoCarpeta,
  TipoEvidencia,
  MomentoEvidencia,
} from '@/modules/fotos/types';

/**
 * Las fotos que documentan una actividad (§15: «actividad relacionada»).
 *
 * ⚠️ Esta pantalla cierra un cabo suelto de la Fase 6: se PODÍAN subir fotos
 * a una actividad desde entonces —`POST /fotos/actividad/:id/foto`— y no había forma
 * de volver a verlas. La galería de la carpeta lista por ÁLBUM y la bandeja
 * solo lo que no está clasificado, así que una foto de actividad quedaba
 * invisible en las dos.
 *
 * Se pide solo cuando la actividad está desplegada: son N actividades por equipo y
 * cargar las fotos de todas al abrir la carpeta serían N llamadas para algo
 * que casi nunca se mira entero.
 */
export function FotosDeActividad({
  actividadId,
  evidencia = 'UNA',
  puedeSubir,
  permiso = null,
  ramaCerrada = false,
  portal = false,
}: {
  actividadId: number;
  /**
   * Qué se le pide a esta actividad (Fase 3).
   *
   * Decide si hay que preguntar por el hueco al subir: con ANTES_DESPUES el
   * servidor EXIGE el momento y sin él contesta 400, así que el formulario
   * tiene que ofrecerlo — no es cosmética.
   */
  evidencia?: TipoEvidencia;
  puedeSubir: boolean;
  /** El de la carpeta, ya resuelto por el servidor. Decide quién borra. */
  permiso?: PermisoCarpeta | null;
  ramaCerrada?: boolean;
  /** Portal del cliente (§22): lee por otra ruta y nunca escribe. */
  portal?: boolean;
}) {
  const { usuario } = useAuth();
  const { data: fotos, isError } = useFotosDeActividad(actividadId, true, portal);
  const subir = useSubirA();
  const eliminar = useEliminarFoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  // El hueco al que va la tanda. Solo se usa —y solo se pregunta— cuando la
  // actividad pide un antes y un después.
  const [momento, setMomento] = useState<MomentoEvidencia>('ANTES');
  const pideDos = evidencia === 'ANTES_DESPUES';

  // ⚠️ La distinción de §5: la foto PROPIA se borra con EDICION, la AJENA
  // exige TOTAL. La decide el backend igual —`exigirSobreFoto`—; esto solo
  // evita ofrecer un botón que va a contestar 403. Es la misma regla que ya
  // aplican la galería y el hilo de comentarios de al lado.
  const puedeBorrarPropia = !portal && alcanza(permiso, 'EDICION') && !ramaCerrada;
  const puedeBorrarAjena = !portal && alcanza(permiso, 'TOTAL') && !ramaCerrada;

  const enviar = () => {
    if (archivos.length === 0) return;
    subir.mutate(
      {
        destino: { tipo: 'actividad', actividadId },
        archivos,
        descripcion: '',
        momento: pideDos ? momento : null,
      },
      {
        onSuccess: () => {
          setArchivos([]);
          if (inputRef.current) inputRef.current.value = '';
        },
      },
    );
  };

  // El estado sale de los datos, no de `isLoading`: una consulta que
  // reintenta deja de estar «cargando» sin haber traído nada.
  if (!fotos && !isError)
    return (
      <div className="flex justify-center py-3">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-2">
      {fotos && fotos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {fotos.map((f) => {
            const esMia = f.subidaPor?.id === usuario?.id;
            const puedeBorrar = esMia ? puedeBorrarPropia : puedeBorrarAjena;
            return (
              <div key={f.id} className="group relative">
                {/* La etiqueta del hueco va SOBRE la miniatura y no debajo:
                    en una rejilla de cinco columnas, lo que se busca es
                    distinguir de un vistazo cuál es el antes. */}
                {f.momento && (
                  <Badge
                    variant={f.momento === 'ANTES' ? 'secondary' : 'success'}
                    className="absolute top-1 left-1 z-10"
                  >
                    {f.momento === 'ANTES' ? 'Antes' : 'Después'}
                  </Badge>
                )}
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  title={`${f.subidaPor?.nombre ?? ''} · ${formatActualizado(f.creadoEn)}`}
                >
                  <img
                    src={f.urlMiniatura}
                    alt={f.descripcion ?? 'Foto de la actividad'}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>

                {/* ⚠️ Borrar UNA foto sin tocar la actividad. Se podía desde la
                    Fase 6 —`DELETE /fotos/foto/:id` trata igual las de
                    actividad— y no había botón: la única forma era borrar la
                    actividad entera, que además el backend rechaza si tiene
                    fotos. Aparece al pasar por encima para no llenar de
                    iconos una rejilla que se mira, no se opera. */}
                {puedeBorrar && (
                  <Button
                    size="icon-sm"
                    variant="outline"
                    className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={
                      esMia ? 'Eliminar mi foto' : 'Eliminar foto de otro usuario'
                    }
                    title="Eliminar foto"
                    disabled={eliminar.isPending}
                    onClick={() => eliminar.mutate(f.id)}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {evidencia === 'NINGUNA'
            ? 'Esta actividad no pide evidencia fotográfica.'
            : 'Sin fotos que documenten esta actividad.'}
        </p>
      )}

      {puedeSubir && !portal && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/webp"
            capture="environment"
            className="h-9 max-w-xs"
            onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
          />
          {/* El selector de hueco solo aparece cuando hace falta: en una
              actividad de tipo UNA el servidor rechaza el momento, así que
              ofrecerlo sería prometer un 400. */}
          {pideDos && (
            <Select
              className="h-9 w-36"
              aria-label="A qué momento va la foto"
              value={momento}
              onChange={(e) => setMomento(e.target.value as MomentoEvidencia)}
            >
              <option value="ANTES">Antes</option>
              <option value="DESPUES">Después</option>
            </Select>
          )}
          <Button
            size="sm"
            onClick={enviar}
            disabled={archivos.length === 0 || subir.isPending}
          >
            {subir.isPending ? <Spinner /> : <UploadIcon />}
            Subir {archivos.length > 0 && `(${archivos.length})`}
          </Button>
          {archivos.length === 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImagePlusIcon className="size-3.5" />
              Se guardan en esta actividad, no en la galería de la carpeta.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
