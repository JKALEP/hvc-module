import { ClockIcon, MailIcon, UserMinusIcon, UsersIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Select } from '@/shared/ui/select';
import {
  useCompartidos,
  useCambiarGrado,
  useDejarDeCompartir,
  useReenviarInvitacion,
  useCancelarInvitacion,
} from '@/modules/fotos/hooks/useCompartir';
import { formatFechaCorta } from '@/shared/lib/format';
import {
  ETIQUETA_PERMISO,
  varianteDePermiso,
  GRADOS_OTORGABLES,
} from '@/modules/fotos/lib/permisos';
import type { PermisoCarpeta } from '@/modules/fotos/types';

/**
 * Quién entra hoy a una carpeta, y las acciones sobre cada uno.
 *
 * Se muestra dentro del diálogo de Compartir pero no comparte nada con
 * él: no toca el correo ni las carpetas marcadas, y trae sus propios
 * datos. Es administración de lo ya concedido, no parte del flujo de
 * conceder — por eso vive en su propio archivo con sus cuatro hooks.
 *
 * Distingue dos cosas que se parecen en pantalla y no lo son: un
 * **acceso** es una cuenta que ya existe y entra; una **invitación** es
 * un correo al que todavía no le corresponde ninguna cuenta. De ahí que
 * una se «quite» y la otra se «reenvíe» o se «cancele».
 */
export function AccesosDeCarpeta({
  carpeta,
}: {
  carpeta: { id: number; nombre: string };
}) {
  const { data: compartidos } = useCompartidos(carpeta.id);
  const quitar = useDejarDeCompartir();
  const cambiar = useCambiarGrado();
  const reenviar = useReenviarInvitacion();
  const cancelar = useCancelarInvitacion();

  if (!compartidos) return null;

  const vacio =
    compartidos.accesos.length === 0 && compartidos.invitaciones.length === 0;

  return (
    <div className="space-y-1 border-t border-border pt-3">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Con acceso a «{carpeta.nombre}»
      </h4>

      {vacio && (
        <p className="py-3 text-sm text-muted-foreground">
          Todavía no la compartiste con nadie.
        </p>
      )}

      <div className="max-h-52 overflow-y-auto">
        {compartidos.accesos.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                <UsersIcon className="size-3.5 shrink-0 text-muted-foreground" />
                {a.usuario.nombre}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {a.usuario.email} · desde {formatFechaCorta(a.creadoEn)} ·
                invitado por {a.otorgadoPor?.nombre ?? '—'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* §10 pide «cambiar permiso» como acción propia: el grado se
                  edita en su sitio en vez de revocar y volver a compartir.
                  SIN_ACCESO va en la misma lista porque es la restricción de
                  §7 —cortar una subcarpeta que se heredaba— y no un cuarto
                  grado suelto. */}
              <Select
                className="h-8 w-40"
                value={a.permiso}
                disabled={cambiar.isPending}
                onChange={(e) =>
                  cambiar.mutate({
                    carpetaId: carpeta.id,
                    usuarioId: a.usuario.id,
                    permiso: e.target.value as PermisoCarpeta,
                  })
                }
              >
                {GRADOS_OTORGABLES.map((g) => (
                  <option key={g} value={g}>
                    {ETIQUETA_PERMISO[g]}
                  </option>
                ))}
                <option value="SIN_ACCESO">
                  {ETIQUETA_PERMISO.SIN_ACCESO} (restringir)
                </option>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                disabled={quitar.isPending}
                onClick={() =>
                  quitar.mutate({
                    carpetaId: carpeta.id,
                    usuarioId: a.usuario.id,
                  })
                }
              >
                <UserMinusIcon />
                Quitar
              </Button>
            </div>
          </div>
        ))}

        {compartidos.invitaciones.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                <MailIcon className="size-3.5 shrink-0 text-muted-foreground" />
                {i.email}
                <Badge variant={i.vencida ? 'destructive' : 'warning'}>
                  <ClockIcon className="size-3" />
                  {i.vencida ? 'Caducada' : 'Sin activar'}
                </Badge>
                {/* Qué concederá al aceptarse: es lo que se prometió en el
                    enlace, no algo que se decida al activar la cuenta. */}
                {i.permiso && (
                  <Badge variant={varianteDePermiso(i.permiso)}>
                    {ETIQUETA_PERMISO[i.permiso]}
                  </Badge>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Invitó {i.invitadoPor.nombre} · {i.vencida ? 'caducó' : 'caduca'}{' '}
                el {formatFechaCorta(i.expiraEn)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={reenviar.isPending}
                onClick={() => reenviar.mutate(i.id)}
              >
                Reenviar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={cancelar.isPending}
                onClick={() => cancelar.mutate(i.id)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
