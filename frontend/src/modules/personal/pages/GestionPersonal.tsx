import { useState } from 'react';
import {
  UsersIcon,
  UserCogIcon,
  BuildingIcon,
  FolderPlusIcon,
  UploadCloudIcon,
  DownloadIcon,
  Trash2Icon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
import {
  SelectorPeriodo,
  PeriodoVacio,
} from '@/modules/personal/components/gestion/SelectorPeriodo';
import { PanelGrupo } from '@/modules/personal/components/gestion/PanelGrupo';
import { MESES, ETIQUETA_GRUPO } from '@/modules/personal/lib/sctr';
import { DialogoImportar } from '@/modules/personal/components/gestion/DialogoImportar';
import { DialogoNombre } from '@/shared/components/DialogoNombre';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import { DialogoExportar } from '@/modules/personal/components/gestion/DialogoExportar';
import {
  usePeriodos,
  usePeriodo,
  useCrearPeriodo,
  useCopiarPeriodo,
  useCrearGrupo,
  useEditarGrupo,
  useEliminarGrupo,
  useCatalogo,
} from '@/modules/personal/hooks/useGestionPersonal';
import {
  useCrearFicha,
  useEditarFicha,
  useDuplicarFicha,
  useEliminarFichas,
  useMoverFichas,
} from '@/modules/personal/hooks/useFichas';
import type {
  TipoPersonal,
  DatosFicha,
  GrupoPersonal,
} from '@/modules/personal/types';

const TABS: { id: TipoPersonal; label: string; icon: typeof UsersIcon }[] = [
  { id: 'SUPERVISOR', label: 'Supervisores', icon: UserCogIcon },
  { id: 'CONTRATISTA', label: 'Contratistas', icon: BuildingIcon },
];

/** Fila nueva: lo mínimo para que exista y se pueda editar encima. */
function fichaEnBlanco(sugerencias: Partial<DatosFicha>): DatosFicha {
  const hoy = new Date();
  return {
    nombres: 'NUEVO',
    apellidoPaterno: 'APELLIDO',
    apellidoMaterno: '',
    tipoTrabajador: sugerencias.tipoTrabajador ?? 'RIESGO MEDIO',
    paisNacimiento: sugerencias.paisNacimiento ?? 'PERU',
    tipoDocumento: sugerencias.tipoDocumento ?? 'DNI',
    // Provisional y único: se sustituye escribiendo encima.
    numeroDocumento: `NUEVO-${hoy.getTime().toString().slice(-6)}`,
    sexo: sugerencias.sexo ?? 'M',
    fechaNacimiento: '1990-01-01',
    moneda: sugerencias.moneda ?? 'S/.',
    remuneracion: '0',
    estadoCivil: sugerencias.estadoCivil ?? 'SOLTERO',
    sede: sugerencias.sede ?? 'PRINCIPAL',
  };
}

export function GestionPersonal() {
  const hoy = new Date();
  const [tipo, setTipo] = useState<TipoPersonal>('CONTRATISTA');
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const { data: periodos } = usePeriodos(tipo);
  const { data, isError, isFetching } = usePeriodo(anio, mes, tipo);
  const { data: catalogo } = useCatalogo();

  const crearPeriodo = useCrearPeriodo(anio, mes, tipo);
  const copiarPeriodo = useCopiarPeriodo(anio, mes, tipo);
  const crearGrupo = useCrearGrupo(anio, mes, tipo);
  const editarGrupo = useEditarGrupo(anio, mes, tipo);
  const eliminarGrupo = useEliminarGrupo(anio, mes, tipo);
  const crearFicha = useCrearFicha(anio, mes, tipo);
  const editarFicha = useEditarFicha(anio, mes, tipo);
  const duplicarFicha = useDuplicarFicha(anio, mes, tipo);
  const eliminarFichas = useEliminarFichas(anio, mes, tipo);
  const moverFichas = useMoverFichas(anio, mes, tipo);

  // Igual que en las pantallas de Fotos: una consulta pausada deja de
  // estar «cargando» sin haber traído nada, así que el estado se deriva
  // de si hay datos, no de isLoading.
  const cargando = !data && !isError;

  const cambiarTab = (nuevo: TipoPersonal) => {
    setTipo(nuevo);
    setSeleccionadas(new Set());
  };

  const alternarSeleccion = (id: number, marcada: boolean) =>
    setSeleccionadas((prev) => {
      const s = new Set(prev);
      if (marcada) s.add(id);
      else s.delete(id);
      return s;
    });

  const agregarFila = (grupoId: number) => {
    const primera = data?.existe
      ? data.grupos.flatMap((g) => g.fichas)[0]
      : undefined;
    crearFicha.mutate({ grupoId, ...fichaEnBlanco(primera ?? {}) });
  };

  /** Un solo estado para los tres diálogos: son excluyentes entre sí. */
  type Dialogo =
    | { tipo: 'nuevo-grupo' }
    | { tipo: 'borrar-grupo'; grupo: GrupoPersonal }
    | { tipo: 'borrar-seleccion' };

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);

  const traerSeleccion = (grupoDestinoId: number) => {
    if (seleccionadas.size === 0) return;
    moverFichas.mutate(
      { fichaIds: [...seleccionadas], grupoDestinoId },
      { onSuccess: () => setSeleccionadas(new Set()) },
    );
  };

  const totalPersonas = data?.existe
    ? data.grupos.reduce((a, g) => a + g.fichas.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de personal"
        description="La lista SCTR, mes a mes. Supervisores por área y contratistas por empresa; se importa y se exporta en el mismo formato de Excel de siempre."
        actions={
          data?.existe && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setImportando(true)}>
                <UploadCloudIcon />
                Importar
              </Button>
              <Button variant="outline" onClick={() => setExportando(true)}>
                <DownloadIcon />
                Exportar
              </Button>
            </div>
          )
        }
      />

      {/* Tabs: cada tipo tiene sus propios periodos y grupos. */}
      <div className="flex w-fit items-center gap-1 rounded-lg border border-border p-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={tipo === id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => cambiarTab(id)}
          >
            <Icon />
            {label}
          </Button>
        ))}
      </div>

      <SelectorPeriodo
        anio={anio}
        mes={mes}
        onAnio={setAnio}
        onMes={setMes}
        periodos={periodos ?? []}
        actualizando={isFetching}
      />

      {isError && (
        <EmptyState
          icon={UsersIcon}
          title="No se pudo cargar la lista"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {cargando && <TableSkeleton rows={6} cols={8} />}

      {/* Mes sin lista: crear vacío o copiar del anterior. */}
      {data && !data.existe && (
        <>
          <PeriodoVacio
            anio={anio}
            mes={mes}
            puedeCopiarDe={data.puedeCopiarDe}
            onCrear={() => crearPeriodo.mutate()}
            onCopiar={() => copiarPeriodo.mutate(data.puedeCopiarDe?.id)}
            ocupado={crearPeriodo.isPending || copiarPeriodo.isPending}
          />
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setImportando(true)}>
              <UploadCloudIcon />
              …o importar un Excel a este mes
            </Button>
          </div>
        </>
      )}

      {/* La lista */}
      {data?.existe && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {MESES[mes - 1]} {anio}
              </span>{' '}
              · {data.grupos.length} {ETIQUETA_GRUPO[tipo].toLowerCase()}(s) ·{' '}
              {totalPersonas} persona(s)
            </p>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {seleccionadas.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {seleccionadas.size} seleccionada(s)
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDialogo({ tipo: 'borrar-seleccion' })}
                    disabled={eliminarFichas.isPending}
                  >
                    <Trash2Icon />
                    Eliminar
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setDialogo({ tipo: 'nuevo-grupo' })}>
                <FolderPlusIcon />
                Nueva {ETIQUETA_GRUPO[tipo].toLowerCase()}
              </Button>
            </div>
          </div>

          {seleccionadas.size > 0 && (
            <p className="text-xs text-muted-foreground">
              Para mover la selección, pulsa «Traer selección» en la cabecera
              del grupo de destino.
            </p>
          )}

          {data.grupos.length === 0 ? (
            <EmptyState
              icon={BuildingIcon}
              title={`Sin ${ETIQUETA_GRUPO[tipo].toLowerCase()}s`}
              description="Crea la primera o importa un Excel para llenar el mes."
            />
          ) : (
            <div className="space-y-4">
              {data.grupos.map((g) => (
                <PanelGrupo
                  key={g.id}
                  grupo={g}
                  tipo={tipo}
                  color={data.colorGrupo}
                  catalogo={catalogo}
                  seleccionadas={seleccionadas}
                  onSeleccionar={alternarSeleccion}
                  onRenombrar={(id, nombre) => editarGrupo.mutate({ id, nombre })}
                  onEliminarGrupo={(grupo) => setDialogo({ tipo: 'borrar-grupo', grupo })}
                  onAgregar={agregarFila}
                  onCambiar={(id, cambios) =>
                    editarFicha.mutate({ id, cambios })
                  }
                  onDuplicar={(id) => duplicarFicha.mutate(id)}
                  onEliminarFicha={(id) => eliminarFichas.mutate([id])}
                  onMoverSeleccion={traerSeleccion}
                />
              ))}
            </div>
          )}
        </>
      )}

      {dialogo?.tipo === 'nuevo-grupo' && data?.existe && (
        <DialogoNombre
          titulo={`Nueva ${ETIQUETA_GRUPO[tipo].toLowerCase()}`}
          etiqueta="Nombre"
          textoBoton="Crear"
          ocupado={crearGrupo.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) =>
            crearGrupo.mutate(
              { periodoId: data.id, nombre },
              { onSuccess: cerrar },
            )
          }
        />
      )}

      {dialogo?.tipo === 'borrar-grupo' && (
        <DialogoConfirmar
          titulo={`¿Eliminar "${dialogo.grupo.nombre}"?`}
          mensaje={`Se quita del periodo de ${MESES[mes - 1]} ${anio}.`}
          detalle={
            dialogo.grupo.fichas.length > 0
              ? `Tiene ${dialogo.grupo.fichas.length} persona(s) dentro y se borran con él. Esto NO se puede deshacer.`
              : undefined
          }
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminarGrupo.isPending}
          onCerrar={cerrar}
          onConfirmar={() =>
            eliminarGrupo.mutate(dialogo.grupo.id, { onSuccess: cerrar })
          }
        />
      )}

      {dialogo?.tipo === 'borrar-seleccion' && (
        <DialogoConfirmar
          titulo={`¿Eliminar ${seleccionadas.size} persona(s)?`}
          mensaje="Salen de la lista de este periodo."
          detalle="Los otros meses no se tocan: cada periodo tiene sus propias filas."
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminarFichas.isPending}
          onCerrar={cerrar}
          onConfirmar={() =>
            eliminarFichas.mutate([...seleccionadas], {
              onSuccess: () => {
                setSeleccionadas(new Set());
                cerrar();
              },
            })
          }
        />
      )}

      {importando && (
        <DialogoImportar
          anio={anio}
          mes={mes}
          tipo={tipo}
          onCerrar={() => setImportando(false)}
        />
      )}
      {exportando && (
        <DialogoExportar
          anio={anio}
          mes={mes}
          tipoActual={tipo}
          onCerrar={() => setExportando(false)}
        />
      )}
    </div>
  );
}
