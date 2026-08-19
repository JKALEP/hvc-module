import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  MapPinIcon,
  FolderKanbanIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Badge } from '@/shared/ui/badge';
import { GrillaJornadas } from '@/modules/personal/components/obra/GrillaJornadas';
import { SelectorParticipantes } from '@/modules/personal/components/obra/SelectorParticipantes';
import {
  GraficoAvance,
  TablaEmpresas,
  ParticipacionPersonal,
} from '@/modules/personal/components/obra/AnaliticaObra';
import { ModalPersona } from '@/modules/personal/components/obra/ModalPersona';
import { useProyecto } from '@/modules/personal/hooks/useObra';
import {
  useJornadas,
  useGuardarJornada,
  useEmpresasParticipantes,
  useParticipacion,
} from '@/modules/personal/hooks/useJornadas';
import {
  ETIQUETA_ESTADO,
  VARIANTE_ESTADO,
  etiquetaAtraso,
} from '@/modules/personal/lib/obra';
import type { Jornada } from '@/modules/personal/types';

/** Aviso de que una asignación fija ya no figura en la planilla vigente. */
function Vigente({
  nombre,
  vigente,
  etiqueta,
}: {
  nombre: string | null;
  vigente: boolean;
  etiqueta: string;
}) {
  if (!nombre) return null;
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{etiqueta}:</span>
      <span className="font-medium text-foreground">{nombre}</span>
      {!vigente && (
        <span
          className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500"
          title="Ya no figura en la lista de personal vigente"
        >
          <TriangleAlertIcon className="size-3.5" />
          no vigente
        </span>
      )}
    </span>
  );
}

/**
 * Ficha de una obra.
 *
 * SIN KPIs sueltos arriba: esos números viven en las columnas de resumen
 * de la grilla, ancladas a la izquierda y siempre visibles. Es una
 * decisión deliberada, no un olvido.
 */
export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const proyectoId = Number(id);
  const idValido = Number.isInteger(proyectoId) && proyectoId > 0;

  const [jornadaAbierta, setJornadaAbierta] = useState<string | null>(null);
  const [persona, setPersona] = useState<string | null>(null);

  const { data: proyecto, isError } = useProyecto(idValido ? proyectoId : null);
  const { data: jornadas } = useJornadas(idValido ? proyectoId : null);
  const { data: empresas } = useEmpresasParticipantes(
    idValido ? proyectoId : null,
  );
  const { data: participacion } = useParticipacion(idValido ? proyectoId : null);
  const guardar = useGuardarJornada(proyectoId);

  if (!idValido)
    return (
      <EmptyState
        icon={FolderKanbanIcon}
        title="Proyecto inválido"
        description="La dirección no corresponde a un proyecto."
      />
    );

  const cargando = !proyecto && !isError;
  const porFecha = new Map((jornadas ?? []).map((j) => [j.fecha, j]));

  /**
   * Guarda un número suelto de la grilla.
   *
   * Manda la jornada COMPLETA porque el endpoint es un upsert por día:
   * si solo se mandara el campo, las asistencias ya registradas se
   * borrarían al reemplazar el día.
   */
  const guardarNumero = (
    fecha: string,
    campo: 'equiposEjecutados' | 'equiposProgramados' | 'contratistasProgramados',
    valor: number,
  ) => {
    const j: Jornada | undefined = porFecha.get(fecha);
    guardar.mutate({
      fecha,
      equiposEjecutados: j?.equiposEjecutados ?? 0,
      equiposProgramados: j?.equiposProgramados ?? 0,
      contratistasProgramados: j?.contratistasProgramados ?? 0,
      [campo]: valor,
      supervisorFichaId: j?.supervisorFichaId ?? proyecto?.supervisorFichaId,
      apoyoFichaId: j?.apoyoFichaId ?? proyecto?.apoyoFichaId ?? null,
      participantes: (j?.asistencias ?? [])
        .map((a) => a.fichaPersonalId)
        .filter((x): x is number => x !== null),
    });
  };

  const atraso = proyecto ? etiquetaAtraso(proyecto.diasAtraso) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/proyectos"
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon className="size-4" />
          Volver a proyectos
        </Link>

        {proyecto && proyecto.camino.length > 0 && (
          <p className="mb-1 px-2.5 text-xs text-muted-foreground">
            {proyecto.camino.map((c) => c.nombre).join(' / ')}
          </p>
        )}

        <PageHeader
          title={proyecto?.nombre ?? 'Proyecto'}
          description={
            proyecto
              ? `${proyecto.fechaInicio} → ${proyecto.fechaFinPrevista} (prevista)`
              : undefined
          }
          actions={
            proyecto && atraso ? (
              <div className="flex items-center gap-2">
                <Badge variant={VARIANTE_ESTADO[proyecto.estado]}>
                  {ETIQUETA_ESTADO[proyecto.estado]}
                </Badge>
                <Badge variant={atraso.variante}>{atraso.texto}</Badge>
              </div>
            ) : undefined
          }
        />
      </div>

      {isError && (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No se pudo cargar el proyecto"
          description="Verifica que el backend esté corriendo y que el proyecto exista."
        />
      )}

      {cargando && <TableSkeleton rows={5} cols={5} />}

      {proyecto && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-3 text-sm">
            <Vigente
              etiqueta="Empresa encargada"
              nombre={proyecto.encargadoNombre}
              vigente={proyecto.vigencia.encargado.vigente}
            />
            <Vigente
              etiqueta="Supervisor"
              nombre={proyecto.supervisorNombre}
              vigente={proyecto.vigencia.supervisor.vigente}
            />
            <Vigente
              etiqueta="Apoyo"
              nombre={proyecto.apoyoNombre}
              vigente={proyecto.vigencia.apoyo.vigente}
            />
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinIcon className="size-4" />
              {proyecto.sede}
            </span>
          </div>

          <GrillaJornadas
            proyecto={proyecto}
            jornadas={jornadas ?? []}
            onNumero={guardarNumero}
            onAbrirParticipantes={setJornadaAbierta}
            onAbrirPersonas={setJornadaAbierta}
          />

          <GraficoAvance serie={proyecto.serie} />

          {empresas && (
            <TablaEmpresas empresas={empresas} onPersona={setPersona} />
          )}

          {participacion && (
            <ParticipacionPersonal
              datos={participacion}
              onPersona={setPersona}
            />
          )}
        </>
      )}

      {jornadaAbierta && proyecto && (
        <SelectorParticipantes
          fecha={jornadaAbierta}
          jornada={porFecha.get(jornadaAbierta)}
          encargadoNombre={proyecto.encargadoNombre}
          supervisorPorDefecto={{
            id: proyecto.supervisorFichaId,
            nombre: proyecto.supervisorNombre,
          }}
          guardando={guardar.isPending}
          onCerrar={() => setJornadaAbierta(null)}
          onGuardar={({ participantes, supervisorFichaId, apoyoFichaId }) => {
            const j = porFecha.get(jornadaAbierta);
            guardar.mutate(
              {
                fecha: jornadaAbierta,
                equiposEjecutados: j?.equiposEjecutados ?? 0,
                equiposProgramados: j?.equiposProgramados ?? 0,
                contratistasProgramados: j?.contratistasProgramados ?? 0,
                supervisorFichaId,
                apoyoFichaId,
                participantes,
              },
              { onSuccess: () => setJornadaAbierta(null) },
            );
          }}
        />
      )}

      {persona && (
        <ModalPersona
          proyectoId={proyectoId}
          documento={persona}
          onCerrar={() => setPersona(null)}
        />
      )}
    </div>
  );
}
