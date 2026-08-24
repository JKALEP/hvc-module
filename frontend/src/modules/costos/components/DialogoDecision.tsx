import { useState } from 'react';
import { CheckCircle2Icon, XCircleIcon, BanIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';
import { formatPrecio } from '@/shared/lib/format';
import type { DecisionAprobacion } from '@/modules/costos/types';
import { Textarea } from '@/shared/ui/textarea';

/** Lo mínimo que hay que escribir cuando el motivo es obligatorio. */
const MINIMO_MOTIVO = 10;

/**
 * Cada decisión con sus palabras.
 *
 * Un solo diálogo parametrizado y no tres componentes: es el mismo acto
 * —pronunciarse— y el mismo endpoint. Lo que cambia de verdad entre los
 * tres es el TEXTO, y eso es una tabla, no tres copias del mismo JSX
 * esperando a divergir.
 *
 * `exigeMotivo` sale de §43 y §45, no de una preferencia: rechazar
 * devuelve el requerimiento al gestor y cerrar sin acuerdo lo cierra
 * para siempre. En los dos casos alguien se queda esperando una
 * explicación que solo puede dar quien decidió. Aceptar no la exige
 * porque el «porqué» ya está escrito: es la justificación del gestor.
 */
const DECISIONES: Record<
  DecisionAprobacion,
  {
    titulo: string;
    descripcion: string;
    consecuencia: string;
    etiquetaMotivo: string;
    ayudaMotivo: string;
    textoBoton: string;
    exigeMotivo: boolean;
    destructivo: boolean;
    icono: typeof CheckCircle2Icon;
  }
> = {
  ACEPTADA: {
    titulo: 'Aceptar la recomendación',
    descripcion: 'Se aprueba la cotización recomendada por el gestor.',
    consecuencia:
      'El requerimiento pasa al solicitante para que registre cuánto costó. La cotización queda aprobada y ya no se puede modificar.',
    etiquetaMotivo: 'Comentario',
    ayudaMotivo: 'Opcional. Queda en el expediente junto a tu decisión.',
    textoBoton: 'Aceptar',
    exigeMotivo: false,
    destructivo: false,
    icono: CheckCircle2Icon,
  },
  RECHAZADA: {
    titulo: 'Rechazar la recomendación',
    descripcion: 'Vuelve al gestor para que evalúe otra vez.',
    consecuencia:
      'No es un cierre: el gestor puede recomendar otra cotización —o la misma con mejor justificación— y volver a traerla. Esta vuelta queda registrada.',
    etiquetaMotivo: 'Motivo del rechazo',
    ayudaMotivo:
      'Es lo que el gestor va a leer para saber qué corregir. Sé concreto.',
    textoBoton: 'Rechazar y devolver',
    exigeMotivo: true,
    destructivo: true,
    icono: XCircleIcon,
  },
  SIN_ACUERDO: {
    titulo: 'Cerrar sin acuerdo',
    descripcion: 'El requerimiento se cierra sin compra.',
    consecuencia:
      'Esto SÍ cierra y no se puede reabrir. Úsalo cuando no se llegó a acuerdo con los proveedores, no para devolverle el trabajo al gestor —para eso está rechazar—.',
    etiquetaMotivo: 'Motivo del cierre',
    ayudaMotivo:
      'El solicitante se queda sin lo que pidió: tiene que poder saber por qué.',
    textoBoton: 'Cerrar sin acuerdo',
    exigeMotivo: true,
    destructivo: true,
    icono: BanIcon,
  },
};

/**
 * El acto de decidir (§41-45).
 *
 * Se muestra sobre QUÉ se decide —proveedor y total— dentro del propio
 * diálogo. Es lo último que se ve antes de pulsar, y una decisión de
 * dinero no debería confirmarse con el dato tapado por la ventana.
 */
export function DialogoDecision({
  decision,
  proveedor,
  total,
  ocupado,
  onConfirmar,
  onCerrar,
}: {
  decision: DecisionAprobacion;
  /** De la cotización recomendada. Falta si se cierra sin que haya ninguna. */
  proveedor?: string;
  total?: number | null;
  ocupado: boolean;
  onConfirmar: (comentario: string) => void;
  onCerrar: () => void;
}) {
  const [comentario, setComentario] = useState('');
  const cfg = DECISIONES[decision];
  const limpio = comentario.trim();
  const valido = !cfg.exigeMotivo || limpio.length >= MINIMO_MOTIVO;
  const Icono = cfg.icono;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cfg.titulo}</DialogTitle>
          <DialogDescription>{cfg.descripcion}</DialogDescription>
        </DialogHeader>

        {proveedor && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <span className="text-sm font-medium text-foreground">
              {proveedor}
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatPrecio(total)}
            </span>
          </div>
        )}

        <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          {cfg.consecuencia}
        </p>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {cfg.etiquetaMotivo}
            {cfg.exigeMotivo && <span className="text-destructive"> *</span>}
          </label>
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={4}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {cfg.exigeMotivo && !valido
              ? `${cfg.ayudaMotivo} Faltan ${String(MINIMO_MOTIVO - limpio.length)} caracteres.`
              : cfg.ayudaMotivo}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            variant={cfg.destructivo ? 'destructive' : 'default'}
            onClick={() => valido && onConfirmar(limpio)}
            disabled={!valido || ocupado}
          >
            {ocupado ? <Spinner /> : <Icono />}
            {cfg.textoBoton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
