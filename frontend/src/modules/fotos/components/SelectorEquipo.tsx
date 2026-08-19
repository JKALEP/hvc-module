import { useState } from 'react';
import { PlusIcon, SearchIcon, WrenchIcon } from 'lucide-react';

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
import { Skeleton } from '@/shared/ui/skeleton';
import { Spinner } from '@/shared/ui/spinner';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  useCrearEquipoDesdeFotos,
  useEquiposDeCatalogo,
  useOrganizacionesDeCatalogo,
  useUbicacionesDeCatalogo,
} from '@/modules/fotos/hooks/useCatalogoEquipos';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { SEARCH_DEBOUNCE_MS } from '@/shared/lib/constants';
import { cn } from '@/shared/lib/utils';
import type { EquipoDeCatalogo } from '@/modules/fotos/types';

/**
 * Elegir un equipo del catálogo de Gestión de equipos (§12).
 *
 * Dos pasos: de qué organización, y cuál. El buscador mira el código interno
 * Y los valores de texto del equipo, así que marca y modelo funcionan aunque
 * NO sean columnas —son campos dinámicos, y cuáles existen lo decide cada
 * organización; de ahí que las columnas de la tabla vengan del servidor y no
 * escritas aquí—.
 *
 * Fotos no administra este catálogo: solo lo lee. Lo único que escribe es el
 * atajo de «registrar uno nuevo», y solo si quien mira tiene nivel para ello
 * — la decisión la toma el backend, aquí solo se esconde el botón para no
 * ofrecer una puerta que responde 403.
 */
export function SelectorEquipo({
  puedeCrear,
  onElegir,
  onCerrar,
}: {
  /** Si se ofrece el atajo de registrar. Lo decide el nivel global (§3.3). */
  puedeCrear: boolean;
  onElegir: (equipo: EquipoDeCatalogo, organizacionId: number) => void;
  onCerrar: () => void;
}) {
  const { data: organizaciones, isLoading: cargandoOrgs } =
    useOrganizacionesDeCatalogo();

  const [organizacionId, setOrganizacionId] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const q = useDebounce(texto, SEARCH_DEBOUNCE_MS);

  const { data: busqueda, isFetching } = useEquiposDeCatalogo(
    organizacionId,
    q,
  );
  const crear = useCrearEquipoDesdeFotos();

  // Formulario del atajo. Se abre bajo la tabla, no en otro diálogo: apilar
  // modales obliga a recordar de dónde venías.
  const [creando, setCreando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nodoId, setNodoId] = useState<number | null>(null);

  // Las ubicaciones solo se piden con el atajo abierto: quien únicamente
  // elige un equipo existente no necesita el árbol.
  const { data: ubicaciones } = useUbicacionesDeCatalogo(
    creando ? organizacionId : null,
  );

  const columnas = busqueda?.columnas ?? [];
  const equipos = busqueda?.equipos ?? [];

  const registrar = () => {
    if (organizacionId === null || codigo.trim() === '' || nodoId === null)
      return;
    crear.mutate(
      { organizacionId, nodoId, codigoInterno: codigo.trim() },
      {
        onSuccess: (equipo) => {
          setCreando(false);
          setCodigo('');
          setNodoId(null);
          onElegir(equipo, organizacionId);
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Elegir equipo</DialogTitle>
          <DialogDescription>
            La carpeta quedará enlazada al equipo del catálogo, sin copiar sus
            datos. Si cambian su marca o su ubicación en Gestión de equipos, la
            carpeta sigue apuntando al mismo equipo.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Organización */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Organización <span className="text-destructive">*</span>
          </label>
          {cargandoOrgs ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              className="h-9"
              value={organizacionId === null ? '' : String(organizacionId)}
              onChange={(e) => {
                setOrganizacionId(
                  e.target.value === '' ? null : Number(e.target.value),
                );
                setCreando(false);
              }}
            >
              <option value="">Elige una organización…</option>
              {(organizaciones ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Select>
          )}
          {!cargandoOrgs && (organizaciones ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay organizaciones activas en el catálogo. Un administrador
              tiene que crearlas en Gestión de equipos.
            </p>
          )}
        </div>

        {/* 2. Buscar */}
        {organizacionId !== null && (
          <>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Buscar equipo
              </label>
              <div className="relative">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Código, marca, modelo…"
                  className="h-9 pl-8"
                />
                {isFetching && (
                  <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
                )}
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-border">
              {equipos.length === 0 ? (
                <EmptyState
                  icon={WrenchIcon}
                  title={
                    q.trim()
                      ? `Ningún equipo coincide con «${q.trim()}»`
                      : 'Esta organización no tiene equipos'
                  }
                  description={
                    puedeCrear
                      ? 'Puedes registrarlo con el botón de abajo.'
                      : 'Pide a un administrador que lo registre en Gestión de equipos.'
                  }
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Código
                      </th>
                      {columnas.map((c) => (
                        <th
                          key={c.clave}
                          className="px-3 py-2 text-left font-medium"
                        >
                          {c.nombre}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium">
                        Ubicación
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map((e) => (
                      <tr
                        key={e.id}
                        className="border-t border-border hover:bg-muted/40"
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {e.codigoInterno ?? '—'}
                        </td>
                        {columnas.map((c) => (
                          <td
                            key={c.clave}
                            className="px-3 py-2 text-muted-foreground"
                          >
                            {e.valores?.[c.clave] || '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-muted-foreground">
                          {e.nodo?.nombre ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onElegir(e, organizacionId)}
                          >
                            Elegir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 3. El atajo de §12 */}
            {puedeCrear && !creando && (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => setCreando(true)}
              >
                <PlusIcon />
                Registrar un equipo nuevo
              </Button>
            )}

            {puedeCrear && creando && (
              <div
                className={cn(
                  'space-y-3 rounded-xl border border-border bg-muted/30 p-3',
                )}
              >
                <p className="text-sm font-medium text-foreground">
                  Registrar en el catálogo
                </p>
                <p className="text-xs text-muted-foreground">
                  Se crea en Gestión de equipos, no en Fotos: queda disponible
                  para todo el sistema y con constancia de que se registró
                  desde aquí. Los demás datos —marca, modelo, ubicación— se
                  completan allá.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1 space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      Código del equipo <span className="text-destructive">*</span>
                    </label>
                    <Input
                      autoFocus
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="CHILLER-001"
                      className="h-9"
                    />
                  </div>
                  {/* La ubicación es obligatoria en el catálogo: un equipo
                      siempre está en algún sitio de la estructura. */}
                  <div className="min-w-40 flex-1 space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      Ubicación <span className="text-destructive">*</span>
                    </label>
                    <Select
                      className="h-9"
                      value={nodoId === null ? '' : String(nodoId)}
                      onChange={(e) =>
                        setNodoId(
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Elige una ubicación…</option>
                      {(ubicaciones ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {' '.repeat(u.nivel * 3)}
                          {u.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    disabled={
                      codigo.trim() === '' || nodoId === null || crear.isPending
                    }
                    onClick={registrar}
                  >
                    {crear.isPending ? <Spinner /> : <PlusIcon />}
                    Registrar y elegir
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCreando(false);
                      setCodigo('');
                      setNodoId(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
