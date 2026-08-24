import { useState } from 'react';
import {
  UploadCloudIcon,
  TriangleAlertIcon,
  CheckCircle2Icon,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import {
  usePrevisualizarExcel,
  useImportarExcel,
} from '@/modules/personal/hooks/useFichas';
import { MESES } from '@/modules/personal/lib/sctr';
import type {
  TipoPersonal,
  HojaDetectada,
  HojaAImportar,
  ResolucionConflicto,
  ResultadoImportacion,
} from '@/modules/personal/types';

/** Cómo se mapea cada hoja, editable antes de confirmar. */
interface Mapeo {
  hoja: string;
  importar: boolean;
  tipo: TipoPersonal;
  colorGrupo: string;
}

export function DialogoImportar({
  anio,
  mes,
  tipo,
  onCerrar,
}: {
  anio: number;
  mes: number;
  tipo: TipoPersonal;
  onCerrar: () => void;
}) {
  const previsualizar = usePrevisualizarExcel();
  const importar = useImportarExcel(anio, mes, tipo);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [hojas, setHojas] = useState<HojaDetectada[]>([]);
  const [mapeo, setMapeo] = useState<Mapeo[]>([]);
  // SOBRESCRIBIR por defecto: el flujo real es corregir el Excel y
  // volver a subirlo esperando que reemplace lo anterior.
  const [conflictos, setConflictos] =
    useState<ResolucionConflicto>('SOBRESCRIBIR');
  const [resultado, setResultado] = useState<ResultadoImportacion[] | null>(
    null,
  );

  const elegir = (file: File) => {
    setArchivo(file);
    setResultado(null);
    previsualizar.mutate(file, {
      onSuccess: (detectadas) => {
        setHojas(detectadas);
        setMapeo(
          detectadas.map((h) => ({
            hoja: h.hoja,
            // Una hoja sin bloques no se puede importar: se deja
            // desmarcada para que el motivo se lea sin bloquear el resto.
            importar: h.bloques.length > 0,
            tipo: h.tipoSugerido ?? tipo,
            colorGrupo: h.colorGrupo ?? 'FFC000',
          })),
        );
      },
    });
  };

  const confirmar = () => {
    if (!archivo) return;
    const seleccionadas: HojaAImportar[] = mapeo
      .filter((m) => m.importar)
      .map((m) => ({
        hoja: m.hoja,
        tipo: m.tipo,
        anio,
        mes,
        colorGrupo: m.colorGrupo,
      }));
    if (seleccionadas.length === 0) return;
    importar.mutate(
      { archivo, hojas: seleccionadas, conflictos },
      { onSuccess: (r) => setResultado(r) },
    );
  };

  const cambiar = (hoja: string, cambios: Partial<Mapeo>) =>
    setMapeo((prev) =>
      prev.map((m) => (m.hoja === hoja ? { ...m, ...cambios } : m)),
    );

  const totalAImportar = mapeo
    .filter((m) => m.importar)
    .reduce(
      (a, m) => a + (hojas.find((h) => h.hoja === m.hoja)?.totalPersonas ?? 0),
      0,
    );

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar desde Excel</DialogTitle>
          <DialogDescription>
            Se detectan los bloques por el color de la fila de grupo. Confirma a
            qué tipo corresponde cada hoja antes de importar; todo entra en{' '}
            <strong>
              {MESES[mes - 1]} {anio}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>

        {/* ── Paso 1: archivo ── */}
        {!resultado && (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 hover:bg-muted/40">
            <UploadCloudIcon className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-sm">
              {archivo ? (
                <span className="font-medium text-foreground">
                  {archivo.name}
                </span>
              ) : (
                'Elige el archivo .xlsx'
              )}
            </span>
            {previsualizar.isPending && <Spinner className="ml-auto size-4" />}
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) elegir(f);
              }}
            />
          </label>
        )}

        {/* ── Paso 2: vista previa y mapeo ── */}
        {!resultado && hojas.length > 0 && (
          <div className="space-y-3">
            {hojas.map((h) => {
              const m = mapeo.find((x) => x.hoja === h.hoja);
              if (!m) return null;
              const importable = h.bloques.length > 0;
              return (
                <div
                  key={h.hoja}
                  className="space-y-2 rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="checkbox"
                      checked={m.importar}
                      disabled={!importable}
                      onChange={(e) =>
                        cambiar(h.hoja, { importar: e.target.checked })
                      }
                      className="size-4 rounded border-input"
                      aria-label={`Importar la hoja ${h.hoja}`}
                    />
                    <span className="font-medium text-foreground">{h.hoja}</span>

                    {importable ? (
                      <>
                        <Badge variant="secondary">
                          {h.bloques.length} grupo(s) · {h.totalPersonas}{' '}
                          persona(s)
                        </Badge>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          color
                          <span
                            className="size-3.5 rounded-sm border border-black/10"
                            style={{ backgroundColor: `#${m.colorGrupo}` }}
                          />
                          <input
                            value={m.colorGrupo}
                            onChange={(e) =>
                              cambiar(h.hoja, {
                                colorGrupo: e.target.value
                                  .replace(/^#/, '')
                                  .toUpperCase(),
                              })
                            }
                            className="w-20 rounded border border-input bg-background px-1 py-0.5 font-mono text-xs"
                            aria-label="Color del grupo"
                          />
                        </span>
                        <Select
                          className="ml-auto h-8 w-40"
                          value={m.tipo}
                          onChange={(e) =>
                            cambiar(h.hoja, {
                              tipo: e.target.value as TipoPersonal,
                            })
                          }
                        >
                          <option value="CONTRATISTA">Contratistas</option>
                          <option value="SUPERVISOR">Supervisores</option>
                        </Select>
                      </>
                    ) : (
                      <Badge variant="outline">No importable</Badge>
                    )}
                  </div>

                  {importable && (
                    <p className="text-xs whitespace-normal text-muted-foreground">
                      {h.bloques
                        .map((b) => `${b.grupo} (${b.personas})`)
                        .join(' · ')}
                    </p>
                  )}

                  {h.problemas.length > 0 && (
                    <div className="flex items-start gap-2 rounded-md bg-warning-soft px-2.5 py-2">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                      <div className="space-y-0.5 text-xs whitespace-normal text-muted-foreground">
                        {h.problemas.slice(0, 5).map((p) => (
                          <p key={`${p.fila}-${p.motivo}`}>
                            {p.fila > 0 && (
                              <span className="font-medium">
                                Fila {p.fila}:{' '}
                              </span>
                            )}
                            {p.motivo}
                          </p>
                        ))}
                        {h.problemas.length > 5 && (
                          <p>y {h.problemas.length - 5} más…</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="space-y-1.5 rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">
                Si alguien ya está en {MESES[mes - 1]}
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={conflictos === 'SOBRESCRIBIR'}
                  onChange={() => setConflictos('SOBRESCRIBIR')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-foreground">
                    Reemplazar con lo del archivo
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Para cuando corriges el Excel y lo vuelves a subir.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={conflictos === 'OMITIR'}
                  onChange={() => setConflictos('OMITIR')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-foreground">
                    Dejar lo que ya está y añadir solo lo nuevo
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Para juntar dos archivos en el mismo mes.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                onClick={confirmar}
                disabled={totalAImportar === 0 || importar.isPending}
              >
                {importar.isPending ? <Spinner /> : <UploadCloudIcon />}
                Importar {totalAImportar} persona(s)
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3: resultado ── */}
        {resultado && (
          <div className="space-y-3">
            {resultado.map((r) => (
              <div
                key={r.hoja}
                className="space-y-1 rounded-lg border border-border p-3"
              >
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <CheckCircle2Icon className="size-4 text-success" />
                  {r.hoja}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.gruposCreados} grupo(s) creados · {r.personasCreadas}{' '}
                  persona(s) nuevas · {r.personasSobrescritas} actualizada(s)
                  {r.personasOmitidas.length > 0 &&
                    ` · ${r.personasOmitidas.length} omitida(s)`}
                </p>
                {r.filasConProblema.length > 0 && (
                  <div className="space-y-0.5 text-xs whitespace-normal text-warning-soft-foreground">
                    {r.filasConProblema.map((p) => (
                      <p key={`${p.fila}-${p.motivo}`}>
                        Fila {p.fila}: {p.motivo}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={onCerrar}>Listo</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
