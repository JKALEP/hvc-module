import { useState } from 'react';
import { SearchIcon, HistoryIcon } from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { Campo } from '@/modules/costos/components/Campo';
import { ListaEventos } from '@/modules/costos/components/ListaEventos';
import { useHistorial } from '@/modules/costos/hooks/useRequerimientos';
import { useAuditoriaEntidad } from '@/modules/costos/hooks/useAuditoria';
import {
  ENTIDADES_CONSULTABLES,
  ETIQUETA_ENTIDAD,
} from '@/modules/costos/lib/auditoria';
import type { EntidadCostos } from '@/modules/costos/types';

type Modo = 'requerimiento' | 'entidad';

/**
 * La bitácora del módulo (§64), bajo SuperAdmin.
 *
 * Dos preguntas distintas y por eso dos modos, no un buscador que
 * intente adivinar:
 *
 *   · POR REQUERIMIENTO — la cadena completa de §64, del primer hecho al
 *     último. Se lee hacia adelante porque es un relato: se creó, se
 *     observó, se pidió precio, se decidió.
 *   · POR FILA — qué le ha pasado a un proveedor, a un valor de catálogo
 *     o a una cotización. De lo más reciente hacia atrás, porque aquí no
 *     hay relato: hay un «¿quién tocó esto y cuándo?».
 *
 * Cada modo usa el endpoint que ya existía para él: el primero es el
 * mismo `/requerimiento/:id/historial` que alimenta el expediente, y el
 * segundo la ruta de administración. No hay un listado general sin
 * filtro a propósito: una bitácora entera sin paginación crece sin techo
 * y no contesta ninguna pregunta concreta.
 *
 * Se pide el ID a mano porque esta pantalla es la herramienta de
 * último recurso —«mira qué pasó con esto»—; el camino corriente para
 * llegar a un historial es el botón que ya está en cada lista de
 * administración y en el propio expediente del requerimiento.
 */
export function AuditoriaCostos() {
  const [modo, setModo] = useState<Modo>('requerimiento');
  const [entidad, setEntidad] = useState<EntidadCostos>('PROVEEDOR');
  const [texto, setTexto] = useState('');
  /** Lo que se está consultando de verdad: solo cambia al pulsar Buscar. */
  const [consulta, setConsulta] = useState<number | null>(null);

  const id = Number(texto);
  const idValido = texto.trim() !== '' && Number.isInteger(id) && id > 0;

  const porRequerimiento = useHistorial(
    modo === 'requerimiento' && consulta !== null ? consulta : undefined,
  );
  const porEntidad = useAuditoriaEntidad(
    entidad,
    consulta ?? undefined,
    modo === 'entidad',
  );

  const activa = modo === 'requerimiento' ? porRequerimiento : porEntidad;
  const buscando = consulta !== null && !activa.data && !activa.isError;

  /** Cambiar de modo invalida lo que se estaba mirando: es otra pregunta. */
  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setConsulta(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría de Costos"
        description="Quién hizo qué, cuándo y por qué. Todo lo que el módulo registra (§64)."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid items-end gap-3 sm:grid-cols-[auto_1fr_auto]">
            <Campo label="Buscar por">
              <Select
                value={modo}
                onChange={(e) => cambiarModo(e.target.value as Modo)}
                className="w-56"
              >
                <option value="requerimiento">Requerimiento</option>
                <option value="entidad">Una fila concreta</option>
              </Select>
            </Campo>

            {modo === 'entidad' && (
              <Campo label="Tipo">
                <Select
                  value={entidad}
                  onChange={(e) => {
                    setEntidad(e.target.value as EntidadCostos);
                    setConsulta(null);
                  }}
                >
                  {ENTIDADES_CONSULTABLES.map((e) => (
                    <option key={e} value={e}>
                      {ETIQUETA_ENTIDAD[e]}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}

            <Campo
              label={
                modo === 'requerimiento'
                  ? 'ID del requerimiento'
                  : `ID ${ETIQUETA_ENTIDAD[entidad].toLowerCase()}`
              }
              ayuda="El número interno, no el de pedido."
            >
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && idValido) setConsulta(id);
                }}
                inputMode="numeric"
                placeholder="Ej.: 21"
                aria-invalid={texto !== '' && !idValido}
              />
            </Campo>

            <Button
              onClick={() => idValido && setConsulta(id)}
              disabled={!idValido}
            >
              {buscando ? <Spinner /> : <SearchIcon />}
              Buscar
            </Button>
          </div>

          {consulta === null && (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border p-8 text-center">
              <HistoryIcon className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Elige qué quieres mirar
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Por requerimiento sale la cadena completa, en el orden en que
                pasaron las cosas. Por fila, lo que le ha ocurrido a un
                proveedor, un cliente o un valor de catálogo.
              </p>
            </div>
          )}

          {consulta !== null && activa.isError && (
            <p className="rounded-xl border border-border p-6 text-center text-sm text-destructive">
              No se encontró nada con ese ID, o no se pudo consultar.
            </p>
          )}

          {consulta !== null && buscando && (
            <div className="flex justify-center p-8">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          )}

          {consulta !== null && activa.data && (
            <>
              <p className="text-sm text-muted-foreground">
                {activa.data.length} movimiento(s)
                {modo === 'requerimiento'
                  ? ' — del primero al último.'
                  : ' — del más reciente hacia atrás.'}
              </p>
              <ListaEventos
                eventos={activa.data}
                mostrarEntidad={modo === 'requerimiento'}
                vacio={
                  modo === 'requerimiento'
                    ? 'Ese requerimiento no tiene movimientos registrados.'
                    : 'Esa fila no tiene movimientos registrados.'
                }
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
