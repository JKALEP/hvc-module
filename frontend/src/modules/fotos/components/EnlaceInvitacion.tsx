import { CopyIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { formatFechaCorta } from '@/shared/lib/format';
import type { ResultadoCompartir } from '@/modules/fotos/types';

/**
 * ═══ TEMPORAL — MODO DESARROLLO ═══
 *
 * El backend no envía correos todavía (`correo.service.ts` solo imprime
 * el enlace en consola), así que la invitación se copia a mano desde
 * aquí.
 *
 * **Este archivo entero se borra el día que se conecte Resend**, junto
 * con la línea que lo usa en `DialogoCompartir`. Está aparte justamente
 * para eso: no hay que ir a buscar un bloque dentro de otro componente,
 * y en cuanto el backend deje de devolver `enlace` esto queda huérfano y
 * se nota.
 */
export function EnlaceInvitacion({
  resultado,
}: {
  resultado: ResultadoCompartir;
}) {
  if (resultado.via !== 'invitacion' || !resultado.enlace) return null;
  const enlace = resultado.enlace;

  const copiar = async () => {
    await navigator.clipboard.writeText(enlace);
    toast.success('Enlace copiado');
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-sm text-foreground">
        Invitación creada para <strong>{resultado.email}</strong>
        {resultado.expiraEn &&
          ` · caduca el ${formatFechaCorta(resultado.expiraEn)}`}
      </p>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={enlace}
          className="h-8 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button variant="outline" size="sm" onClick={() => void copiar()}>
          <CopyIcon />
          Copiar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        El envío por correo aún no está conectado: pásale el enlace por ahora.
      </p>
    </div>
  );
}
