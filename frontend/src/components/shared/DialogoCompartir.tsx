import { useState } from 'react';
import {
  ClockIcon,
  CopyIcon,
  MailIcon,
  SendIcon,
  UserMinusIcon,
  UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  useCompartidos,
  useCompartir,
  useDejarDeCompartir,
  useReenviarInvitacion,
  useCancelarInvitacion,
} from '@/hooks/useFotos';
import { formatFechaCorta } from '@/lib/format';
import type { ResultadoCompartir, TipoCompartible } from '@/types/models';

/**
 * Compartir: un solo campo, un solo botón.
 *
 * Quien comparte NO elige entre "colaborador interno" e "invitación
 * externa": escribe un correo y el sistema resuelve según exista o no la
 * cuenta. Pedirle esa decisión sería pedirle que sepa algo que el
 * sistema ya sabe.
 */
export function DialogoCompartir({
  tipo,
  id,
  nombre,
  onCerrar,
}: {
  tipo: TipoCompartible;
  id: number;
  nombre: string;
  onCerrar: () => void;
}) {
  const { data, isLoading } = useCompartidos(tipo, id);
  const compartir = useCompartir();
  const quitar = useDejarDeCompartir();
  const reenviar = useReenviarInvitacion();
  const cancelar = useCancelarInvitacion();

  const [email, setEmail] = useState('');
  /** Enlace de la última invitación, para poder copiarlo a mano. */
  const [ultimo, setUltimo] = useState<ResultadoCompartir | null>(null);

  const enviar = () => {
    if (email.trim() === '') return;
    compartir.mutate(
      { tipo, id, email: email.trim() },
      {
        onSuccess: (r) => {
          setEmail('');
          setUltimo(r);
        },
      },
    );
  };

  const copiar = async (enlace: string) => {
    await navigator.clipboard.writeText(enlace);
    toast.success('Enlace copiado');
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Compartir «{nombre}»</DialogTitle>
          <DialogDescription>
            Escribe un correo. Si ya tiene cuenta, el acceso queda activo al
            instante; si no, le llega una invitación para crearla.
            {tipo === 'carpeta' &&
              ' Lo que está dentro de esta carpeta se comparte también.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Correo
            </label>
            <Input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enviar();
              }}
              placeholder="nombre@empresa.com"
              className="h-9"
            />
          </div>
          <Button
            onClick={enviar}
            disabled={email.trim() === '' || compartir.isPending}
          >
            {compartir.isPending ? <Spinner /> : <SendIcon />}
            Compartir
          </Button>
        </div>

        {/* Mientras el correo real no esté conectado, el enlace se copia
            a mano desde aquí. */}
        {ultimo?.via === 'invitacion' && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm text-foreground">
              Invitación creada para <strong>{ultimo.email}</strong>. Caduca el{' '}
              {formatFechaCorta(ultimo.expiraEn)}.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={ultimo.enlace}
                className="h-8 font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copiar(ultimo.enlace)}
              >
                <CopyIcon />
                Copiar
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-80 space-y-1 overflow-y-auto border-t border-border pt-3">
          {isLoading && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          )}

          {data &&
            data.accesos.length === 0 &&
            data.invitaciones.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Todavía no lo compartiste con nadie.
              </p>
            )}

          {data?.accesos.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  <UsersIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  {a.usuario.nombre}
                  <Badge variant={a.puede === 'ver' ? 'secondary' : 'outline'}>
                    {a.puede === 'ver' ? 'Solo ver' : 'Ver y subir'}
                  </Badge>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.usuario.email} · desde {formatFechaCorta(a.creadoEn)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={quitar.isPending}
                onClick={() =>
                  quitar.mutate({ tipo, id, usuarioId: a.usuario.id })
                }
              >
                <UserMinusIcon />
                Quitar
              </Button>
            </div>
          ))}

          {data?.invitaciones.map((i) => (
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
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Invitó {i.invitadoPor.nombre} ·{' '}
                  {i.vencida ? 'caducó' : 'caduca'} el{' '}
                  {formatFechaCorta(i.expiraEn)}
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
      </DialogContent>
    </Dialog>
  );
}
