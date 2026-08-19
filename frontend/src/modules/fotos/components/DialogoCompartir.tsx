import { useMemo, useState } from 'react';
import { FolderIcon, SearchIcon, SendIcon } from 'lucide-react';

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
import { AccesosDeCarpeta } from '@/modules/fotos/components/AccesosDeCarpeta';
import { EnlaceInvitacion } from '@/modules/fotos/components/EnlaceInvitacion';
import {
  useCarpetasCompartibles,
  useCompartir,
} from '@/modules/fotos/hooks/useCompartir';
import {
  DESCRIPCION_PERMISO,
  ETIQUETA_PERMISO,
  GRADOS_OTORGABLES,
} from '@/modules/fotos/lib/permisos';
import { cn } from '@/shared/lib/utils';
import type {
  CarpetaCompartible,
  PermisoCarpeta,
  ResultadoCompartir,
} from '@/modules/fotos/types';

/** Los tres grados que se pueden conceder: `SIN_ACCESO` no se comparte. */
type PermisoOtorgable = Exclude<PermisoCarpeta, 'SIN_ACCESO'>;

/**
 * Compartir: correo primero, carpetas después.
 *
 * No hay que navegar hasta cada carpeta para compartirla desde dentro —
 * se escribe un correo, se marcan las carpetas y se confirma. Y quien
 * comparte no elige entre "colaborador interno" e "invitación externa":
 * lo decide el sistema según exista o no la cuenta.
 */
export function DialogoCompartir({
  carpetaInicial,
  onCerrar,
}: {
  /** Si se abre desde una carpeta concreta, viene marcada de entrada. */
  carpetaInicial?: { id: number; nombre: string };
  onCerrar: () => void;
}) {
  const { data: carpetas, isLoading } = useCarpetasCompartibles();
  const compartir = useCompartir();

  const [email, setEmail] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [elegidas, setElegidas] = useState<number[]>(
    carpetaInicial ? [carpetaInicial.id] : [],
  );
  // LECTURA por defecto: es el grado de §5 que menos concede, y compartir
  // con un cliente —el caso corriente de §9— es exactamente eso. Subirlo es
  // un clic; bajarlo, después de haber dado edición por descuido, no.
  const [permiso, setPermiso] = useState<PermisoOtorgable>('LECTURA');
  // Los dos opcionales de §9. Solo se usan si el correo NO tiene cuenta y
  // acaba en invitación — el sistema decide cuál de los dos caminos es.
  const [nombre, setNombre] = useState('');
  const [expiraEn, setExpiraEn] = useState('');
  const [ultimo, setUltimo] = useState<ResultadoCompartir | null>(null);

  /** Nivel de indentación desde la ruta materializada, sin más consultas. */
  const nivelDe = (c: CarpetaCompartible) => c.ruta.split('/').length - 1;

  const visibles = useMemo(() => {
    const todas = carpetas ?? [];
    if (busqueda.trim() === '') return todas;
    const q = busqueda.trim().toLowerCase();
    return todas.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [carpetas, busqueda]);

  const alternar = (id: number) =>
    setElegidas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const enviar = () => {
    if (email.trim() === '' || elegidas.length === 0) return;
    compartir.mutate(
      { email: email.trim(), carpetaIds: elegidas, permiso, nombre, expiraEn },
      {
        onSuccess: (r) => {
          setEmail('');
          setElegidas(carpetaInicial ? [carpetaInicial.id] : []);
          // El grado NO se resetea: quien comparte una carpeta con tres
          // clientes seguidos les da el mismo, y volver a LECTURA en cada
          // envío obligaría a corregirlo tres veces.
          setUltimo(r);
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compartir</DialogTitle>
          <DialogDescription>
            Escribe un correo y marca a qué carpetas darle acceso. Si ya tiene
            cuenta, el acceso queda activo al instante; si no, recibe una
            invitación para crearla. Lo que hay dentro de cada carpeta se
            comparte también.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Correo */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Correo <span className="text-destructive">*</span>
          </label>
          <Input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            className="h-9"
          />
        </div>

        {/* Los dos opcionales del formulario de §9. Se marcan como «solo
            si hay que invitar» para que nadie los rellene esperando que
            caduque el acceso de alguien que ya tiene cuenta. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Nombre <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cómo se llama"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Caduca el <span className="text-muted-foreground">(opcional)</span>
            </label>
            <Input
              type="date"
              value={expiraEn}
              onChange={(e) => setExpiraEn(e.target.value)}
              className="h-9"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Solo se aplican si hay que enviar invitación. Sin fecha, el enlace
            vale 7 días.
          </p>
        </div>

        {/* 2. Grado de acceso (§5, §10) */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Permiso <span className="text-destructive">*</span>
          </label>
          <Select
            className="h-9"
            value={permiso}
            onChange={(e) => setPermiso(e.target.value as PermisoOtorgable)}
          >
            {GRADOS_OTORGABLES.map((g) => (
              <option key={g} value={g}>
                {ETIQUETA_PERMISO[g]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            {DESCRIPCION_PERMISO[permiso]}
          </p>
        </div>

        {/* 3. Selector de carpetas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-foreground">
              Carpetas <span className="text-destructive">*</span>
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {elegidas.length} seleccionada(s)
            </span>
          </div>

          <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-2.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar carpeta"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
            {isLoading && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Cargando carpetas…
              </p>
            )}
            {!isLoading && visibles.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {busqueda
                  ? 'Ninguna carpeta coincide.'
                  : 'No hay carpetas que puedas compartir.'}
              </p>
            )}
            {visibles.map((c) => {
              const marcada = elegidas.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50',
                    marcada && 'bg-muted/40',
                  )}
                  // La indentación sale de la ruta: enseña la jerarquía sin
                  // tener que montar un árbol plegable.
                  style={{
                    paddingLeft: `${12 + (busqueda ? 0 : nivelDe(c) * 16)}px`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => alternar(c.id)}
                    className="size-4 shrink-0 rounded border-input"
                  />
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.nombre}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={enviar}
            disabled={
              email.trim() === '' ||
              elegidas.length === 0 ||
              compartir.isPending
            }
          >
            {compartir.isPending ? <Spinner /> : <SendIcon />}
            Compartir
          </Button>
        </div>

        {/* TEMPORAL: se borra junto con EnlaceInvitacion al conectar Resend. */}
        {ultimo && <EnlaceInvitacion resultado={ultimo} />}

        {ultimo?.via === 'acceso-directo' && ultimo.yaTenia.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Ya tenía acceso a: {ultimo.yaTenia.map((c) => c.nombre).join(', ')}.
          </p>
        )}

        {/* Administración de lo ya concedido: trae sus propios datos. */}
        {carpetaInicial && <AccesosDeCarpeta carpeta={carpetaInicial} />}
      </DialogContent>
    </Dialog>
  );
}
