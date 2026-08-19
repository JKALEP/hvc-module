import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Spinner } from '@/shared/ui/spinner';

/**
 * Confirmar una acción antes de hacerla.
 *
 * Sustituye a `window.confirm()` en toda la app. Ese cuadro es un
 * recurso crudo del navegador: bloquea el hilo, no sabe si la acción
 * está en curso, no distingue una acción destructiva de una cualquiera,
 * y se anuncia con un "localhost:5173 dice" que delata que no forma
 * parte del sistema.
 *
 * Lo que este sí hace:
 * — distingue lo destructivo con `destructivo`, que además es lo que
 *   decide el color del botón, para que no haya que acordarse;
 * — muestra el estado de carga mientras la mutación corre, en vez de
 *   cerrarse y dejar al usuario sin saber si pasó algo;
 * — admite un `detalle` para las consecuencias que hay que decir en voz
 *   alta («se borran también sus 12 equipos»).
 */
export function DialogoConfirmar({
  titulo,
  mensaje,
  detalle,
  textoConfirmar = 'Confirmar',
  destructivo = false,
  ocupado = false,
  deshabilitado = false,
  children,
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  mensaje: string;
  /** Lo que pasa además de lo obvio. Se resalta aparte. */
  detalle?: string;
  textoConfirmar?: string;
  destructivo?: boolean;
  ocupado?: boolean;
  /**
   * Confirmar no basta: falta algo. Distinto de `ocupado`, que además
   * pinta el spinner — decir «esperando» cuando en realidad falta
   * escribir un motivo es mentirle al usuario sobre por qué no puede
   * seguir.
   */
  deshabilitado?: boolean;
  /**
   * Lo que hay que rellenar para poder confirmar: el motivo de un
   * rechazo, el de una cancelación. Sin esto, cada módulo tendría que
   * rehacer el diálogo entero para pedir una línea de texto.
   */
  children?: React.ReactNode;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{mensaje}</DialogDescription>
        </DialogHeader>

        {detalle && (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm whitespace-normal text-muted-foreground">
            {detalle}
          </p>
        )}

        {children}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button
            variant={destructivo ? 'destructive' : 'default'}
            onClick={onConfirmar}
            disabled={ocupado || deshabilitado}
          >
            {ocupado && <Spinner />}
            {textoConfirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
