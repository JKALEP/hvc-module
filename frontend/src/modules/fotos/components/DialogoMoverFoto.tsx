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
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { useCarpeta } from '@/modules/fotos/hooks/useCarpetas';
import { useGaleria } from '@/modules/fotos/hooks/useAlbumes';
import { useTareas } from '@/modules/fotos/hooks/useTareas';
import type { DestinoFotos } from '@/modules/fotos/types';

/**
 * A dónde mover una foto (§1.2 de gestión de contenido).
 *
 * Se elige navegando de arriba abajo —proyecto → subcarpeta → álbum o
 * tarea— igual que en la captura rápida, y por lo mismo: aquí se ELIGE un
 * destino, no se navega, así que el árbol se pide desde la raíz y no desde
 * donde estaba el usuario.
 *
 * ⚠️ «Sin clasificar» devuelve la foto a la BANDEJA, que es privada de quien
 * la subió (§18). Solo se ofrece si la foto es tuya: el servidor lo rechaza
 * igual, pero un botón que contesta 400 es peor que no tenerlo. Y se avisa
 * de lo que implica, porque saca la foto del árbol de carpetas y deja de
 * verla todo el mundo salvo su autor.
 */
export function DialogoMoverFoto({
  esMia,
  moviendo,
  onMover,
  onCerrar,
}: {
  /** La subió quien está mirando. Decide si «sin clasificar» se ofrece. */
  esMia: boolean;
  moviendo: boolean;
  onMover: (destino: DestinoFotos) => void;
  onCerrar: () => void;
}) {
  const { data: raiz } = useCarpeta(null);
  // ⚠️ DOS estados y no uno. `carpetaId` es el destino real y baja al elegir
  // una subcarpeta; `raizId` es solo lo que enseña el primer select. Con un
  // único estado, al descender el primer select volvía a «— Elige —»
  // —porque la subcarpeta no está entre sus opciones— y parecía que se
  // había perdido la selección cuando el destino era correcto.
  const [raizId, setRaizId] = useState<number | null>(null);
  const [carpetaId, setCarpetaId] = useState<number | null>(null);
  const { data: dentro } = useCarpeta(carpetaId);

  // Álbumes y tareas del sitio elegido. `useGaleria` se desactiva sola con
  // un id inválido, así que el 0 de «sin carpeta» no dispara consulta.
  const albumes = useGaleria(carpetaId ?? 0, {
    subidaPorId: null,
    desde: '',
    hasta: '',
  });
  const esEquipo = dentro?.carpetaActual?.tipo === 'EQUIPO';
  const { data: tareas } = useTareas(carpetaId, { habilitado: esEquipo });

  const [destinoFino, setDestinoFino] = useState<string>('');

  const carpetasRaiz = (raiz?.secciones ?? []).flatMap((s) => s.carpetas);
  // ⚠️ El mismo guardia que en la captura rápida: `useCarpeta(null)` es la
  // RAÍZ, así que sin esto el segundo select volvía a ofrecer los proyectos.
  const subcarpetas =
    carpetaId === null
      ? []
      : (dentro?.secciones ?? []).flatMap((s) => s.carpetas);

  const albumesDe = (albumes.data?.pages ?? []).flatMap((p) => p.albumes);

  /**
   * El destino final.
   *
   * `destinoFino` codifica qué se eligió dentro de la carpeta: un álbum, una
   * tarea, o nada —en cuyo caso la foto va a la carpeta y el servidor le
   * crea un álbum, igual que al subir—.
   */
  const destino: DestinoFotos | null = (() => {
    if (destinoFino === 'bandeja') return { tipo: 'bandeja' };
    if (carpetaId === null) return null;
    if (destinoFino.startsWith('album:'))
      return { tipo: 'album', albumId: Number(destinoFino.slice(6)) };
    if (destinoFino.startsWith('tarea:'))
      return { tipo: 'tarea', tareaId: Number(destinoFino.slice(6)) };
    return { tipo: 'carpeta', carpetaId };
  })();

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover la foto</DialogTitle>
          <DialogDescription>
            Hace falta permiso de edición tanto donde está como a donde va.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Proyecto
            </label>
            <Select
              value={raizId === null ? '' : String(raizId)}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setRaizId(id);
                setCarpetaId(id);
                setDestinoFino('');
              }}
            >
              <option value="">— Elige —</option>
              {carpetasRaiz.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>

          {subcarpetas.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Dentro de
              </label>
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setCarpetaId(Number(e.target.value));
                    setDestinoFino('');
                  }
                }}
              >
                <option value="">— Quedarse aquí —</option>
                {subcarpetas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Dónde caerá exactamente. Con la cascada de selects es fácil
              perder la cuenta de en qué nivel se está. */}
          {carpetaId !== null && dentro?.carpetaActual && (
            <p className="text-xs text-muted-foreground">
              Destino:{' '}
              <span className="font-medium text-foreground">
                {dentro.carpetaActual.nombre}
              </span>
            </p>
          )}

          {carpetaId !== null && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Álbum o tarea
              </label>
              <Select
                value={destinoFino}
                onChange={(e) => setDestinoFino(e.target.value)}
              >
                <option value="">Álbum nuevo en esta carpeta</option>
                {albumesDe.map((a) => (
                  <option key={a.id} value={`album:${a.id}`}>
                    Álbum: {a.nombre ?? a.descripcion ?? `del ${a.creadoEn.slice(0, 10)}`}
                  </option>
                ))}
                {(tareas ?? []).map((t) => (
                  <option key={t.id} value={`tarea:${t.id}`}>
                    Tarea: {t.titulo}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {esMia && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={destinoFino === 'bandeja'}
                onChange={(e) => setDestinoFino(e.target.checked ? 'bandeja' : '')}
              />
              <span>
                Devolver a «sin clasificar»
                <span className="block text-xs text-muted-foreground">
                  Sale del árbol de carpetas y vuelve a tu bandeja. Nadie más
                  la verá, ni un administrador.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={moviendo}>
            Cancelar
          </Button>
          <Button
            disabled={moviendo || destino === null}
            onClick={() => destino && onMover(destino)}
          >
            {moviendo && <Spinner />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
