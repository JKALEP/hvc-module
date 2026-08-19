import { SendIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { formatFecha } from '@/shared/lib/format';
import type { SolicitudCotizacion } from '@/modules/costos/types';

/**
 * A quién se le pidió cotización y con qué resultado (§33).
 *
 * §33 pide dejar constancia de a quién, cuándo y si salió; §67 insiste
 * en guardar el error del envío. Sin esa última columna, un correo
 * caído solo se nota porque nadie responde —y para entonces ya se
 * perdió la semana esperando—.
 *
 * Se muestra cuántas cotizaciones llegaron por cada solicitud porque es
 * lo que convierte esta lista en una tarea: las que van por cero son a
 * las que hay que insistir.
 */
export function PanelSolicitudes({
  solicitudes,
  puedePedir,
  onPedir,
}: {
  solicitudes: SolicitudCotizacion[];
  puedePedir: boolean;
  onPedir: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Solicitudes a proveedores
          </h2>
          <p className="text-sm text-muted-foreground">
            {solicitudes.length === 0
              ? 'Todavía no se le ha pedido cotización a nadie.'
              : `${String(solicitudes.length)} envío(s). No des por hecho que todos responderán.`}
          </p>
        </div>
        {puedePedir && (
          <Button onClick={onPedir}>
            <SendIcon />
            {solicitudes.length === 0
              ? 'Pedir cotización'
              : 'Pedir a más proveedores'}
          </Button>
        )}
      </div>

      {solicitudes.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {solicitudes.map((s) => (
            <li key={s.id} className="space-y-1 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {s.proveedor.razonSocial}
                  </span>
                  {s.estadoEnvio === 'ENVIADO' ? (
                    <Badge variant="success">
                      <CheckCircle2Icon />
                      Enviado
                    </Badge>
                  ) : s.estadoEnvio === 'FALLIDO' ? (
                    <Badge variant="destructive">
                      <AlertCircleIcon />
                      Falló
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pendiente</Badge>
                  )}
                  {s._count.cotizaciones > 0 ? (
                    <Badge variant="default">
                      {s._count.cotizaciones} cotización(es)
                    </Badge>
                  ) : (
                    <Badge variant="outline">sin respuesta</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatFecha(s.enviadoEn ?? s.creadoEn)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                A {s.destinatario}
                {s.enviadoPor ? ` · lo mandó ${s.enviadoPor.nombre}` : ''}
              </p>

              {s.errorEnvio && (
                <p className="text-xs text-destructive">
                  El correo no salió: {s.errorEnvio}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
