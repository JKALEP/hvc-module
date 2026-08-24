import { useState } from 'react';
import { SendIcon } from 'lucide-react';

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
import { Textarea } from '@/shared/ui/textarea';

/** §27 pide que la observación diga algo, no que exista. */
const MINIMO = 10;

/**
 * Observar un requerimiento (§27-28).
 *
 * Una observación por cada cosa que falta, no un texto que se reescribe:
 * el backend guarda una fila por cada una y §53 prohíbe perder las
 * anteriores. Por eso el diálogo se abre en blanco aunque ya haya
 * observaciones previas — se está añadiendo otra, no editando la de
 * antes.
 *
 * El mínimo de caracteres no es cosmético: al otro lado hay una persona
 * que tiene que saber qué corregir, y «falta info» no se lo dice. Es el
 * mismo criterio que la justificación de §39, con otro número porque
 * aquélla la lee el Aprobador para decidir y ésta solo señala un hueco.
 */
export function DialogoObservar({
  numero,
  ocupado,
  onGuardar,
  onCerrar,
}: {
  /** El del requerimiento, para que se vea sobre cuál se está escribiendo. */
  numero: string | null;
  ocupado: boolean;
  onGuardar: (texto: string) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const limpio = texto.trim();
  const valido = limpio.length >= MINIMO;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Observar el requerimiento</DialogTitle>
          <DialogDescription>
            {numero ?? 'Sin número'} — vuelve al solicitante para que lo
            corrija. No se pierde nada: sigue siendo el mismo requerimiento y
            conserva su número.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Qué hay que corregir<span className="text-destructive"> *</span>
          </label>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            autoFocus
            placeholder="Ej.: el ítem 3 no dice la cantidad, y la referencia del ítem 5 apunta a un modelo descontinuado."
          />
          <p className="text-xs text-muted-foreground">
            {valido
              ? 'Se guarda como una observación aparte, con tu nombre y la fecha.'
              : `Sé concreto: el solicitante solo va a leer esto. Faltan ${String(MINIMO - limpio.length)} caracteres.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            onClick={() => valido && onGuardar(limpio)}
            disabled={!valido || ocupado}
          >
            {ocupado ? <Spinner /> : <SendIcon />}
            Observar y devolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
