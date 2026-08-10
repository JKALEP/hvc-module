import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/**
 * Pedir un nombre (y opcionalmente una descripción).
 *
 * Lo usan crear sede, crear álbum y renombrar cualquiera de los dos: son
 * el mismo formulario de un campo y no merecen tres diálogos.
 */
export function DialogoNombre({
  titulo,
  descripcion,
  etiqueta,
  valorInicial = '',
  conDescripcion = false,
  descripcionInicial = '',
  textoBoton,
  ocupado,
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  descripcion?: string;
  etiqueta: string;
  valorInicial?: string;
  conDescripcion?: boolean;
  descripcionInicial?: string;
  textoBoton: string;
  ocupado: boolean;
  onConfirmar: (nombre: string, descripcion: string) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(valorInicial);
  const [texto, setTexto] = useState(descripcionInicial);

  const confirmar = () => {
    if (nombre.trim() === '') return;
    onConfirmar(nombre.trim(), texto.trim());
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {etiqueta} <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar();
              }}
              className="h-9"
            />
          </div>

          {conDescripcion && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Descripción
              </label>
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmar();
                }}
                className="h-9"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={nombre.trim() === '' || ocupado}
          >
            {ocupado && <Spinner />}
            {textoBoton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
