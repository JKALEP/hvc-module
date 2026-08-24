import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';

/**
 * Pedir un nombre (y opcionalmente una descripción).
 *
 * Sustituye a `window.prompt()` en toda la app. Ese cuadro no es parte
 * del sistema: es un recurso crudo del navegador, sin estado de carga,
 * sin validación y con el "localhost:5173 dice" delante.
 *
 * Vive en `shared/` porque lo usan tres módulos —Fotos, Obra y
 * Equipos— para lo mismo: crear o renombrar algo con un solo campo.
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

        {/* `DialogFooter` y no un `div` a mano: es lo que pinta la barra a
            sangre con fondo del sistema. Escrito a mano, estos dos diálogos
            —que son los más usados de la app— se quedaban fuera del cambio
            y el pie se veía distinto según qué modal abrieras. */}
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
