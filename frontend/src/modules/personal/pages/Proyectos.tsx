import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlusIcon, FolderKanbanIcon, PlusIcon } from 'lucide-react';

import { PageHeader } from '@/shared/components/PageHeader';
import { EmptyState } from '@/shared/components/EmptyState';
import { TableSkeleton } from '@/shared/components/TableSkeleton';
import { Button } from '@/shared/ui/button';
import {
  RutaCarpetas,
  TarjetaCarpeta,
  FiltrosProyectos,
} from '@/modules/personal/components/obra/ExploradorObra';
import { TarjetaProyecto } from '@/modules/personal/components/obra/TarjetaProyecto';
import { DialogoProyecto } from '@/modules/personal/components/obra/DialogoProyecto';
import { DialogoNombre } from '@/shared/components/DialogoNombre';
import { DialogoConfirmar } from '@/shared/components/DialogoConfirmar';
import {
  useNavegacion,
  useCrearCarpeta,
  useRenombrarCarpeta,
  useEliminarCarpeta,
} from '@/modules/personal/hooks/useObra';
import {
  filtrarProyectos,
  type FiltroEstado,
  type FiltroAtraso,
} from '@/modules/personal/lib/obra';
import type { CarpetaObra } from '@/modules/personal/types';

/**
 * Explorador de obras.
 *
 * Mismo patrón que el de Fotos: una carpeta contiene subcarpetas Y
 * proyectos a la vez, y la raíz es simplemente `carpetaId = null`. La
 * carpeta abierta vive en el estado y no en la URL — se navega mucho, y
 * el destino de un enlace que alguien comparte es siempre un proyecto.
 */
export function Proyectos() {
  const navegar = useNavigate();
  const [carpetaId, setCarpetaId] = useState<number | null>(null);
  const [estado, setEstado] = useState<FiltroEstado>('TODOS');
  const [atraso, setAtraso] = useState<FiltroAtraso>('TODOS');
  const [creando, setCreando] = useState(false);

  const { data, isError } = useNavegacion(carpetaId);
  const crearCarpeta = useCrearCarpeta();
  const renombrarCarpeta = useRenombrarCarpeta();
  const eliminarCarpeta = useEliminarCarpeta();

  // Una consulta pausada deja de estar «cargando» sin haber traído nada:
  // el estado se deriva de si hay datos, no de isLoading.
  const cargando = !data && !isError;

  const proyectos = data?.proyectos ?? [];
  const visibles = filtrarProyectos(proyectos, estado, atraso);
  const vacio = (data?.carpetas.length ?? 0) === 0 && proyectos.length === 0;

  /** Un solo estado para los tres diálogos: son excluyentes entre sí. */
  type Dialogo =
    | { tipo: 'nueva-carpeta' }
    | { tipo: 'renombrar-carpeta'; carpeta: CarpetaObra }
    | { tipo: 'borrar-carpeta'; carpeta: CarpetaObra };

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const cerrar = () => setDialogo(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyectos"
        description="Obras en curso, organizadas en carpetas. El avance y el estado se calculan del registro diario."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setDialogo({ tipo: 'nueva-carpeta' })}>
              <FolderPlusIcon />
              Nueva carpeta
            </Button>
            <Button onClick={() => setCreando(true)}>
              <PlusIcon />
              Nuevo proyecto
            </Button>
          </div>
        }
      />

      <RutaCarpetas camino={data?.camino ?? []} onIr={setCarpetaId} />

      {isError && (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No se pudieron cargar los proyectos"
          description="Verifica que el backend esté corriendo en http://localhost:3000."
        />
      )}

      {cargando && <TableSkeleton rows={4} cols={4} />}

      {data && proyectos.length > 0 && (
        <FiltrosProyectos
          estado={estado}
          atraso={atraso}
          onEstado={setEstado}
          onAtraso={setAtraso}
          total={proyectos.length}
          visibles={visibles.length}
        />
      )}

      {data && vacio && (
        <EmptyState
          icon={FolderKanbanIcon}
          title={
            carpetaId === null
              ? 'Todavía no hay proyectos'
              : 'Esta carpeta está vacía'
          }
          description="Crea un proyecto o una carpeta para empezar a organizarlos."
        />
      )}

      {data && data.carpetas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.carpetas.map((c) => (
            <TarjetaCarpeta
              key={c.id}
              carpeta={c}
              onAbrir={setCarpetaId}
              onRenombrar={(carpeta) => setDialogo({ tipo: 'renombrar-carpeta', carpeta })}
              onEliminar={(carpeta) => setDialogo({ tipo: 'borrar-carpeta', carpeta })}
            />
          ))}
        </div>
      )}

      {data && visibles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((p) => (
            <TarjetaProyecto key={p.id} proyecto={p} />
          ))}
        </div>
      )}

      {data && proyectos.length > 0 && visibles.length === 0 && (
        <EmptyState
          icon={FolderKanbanIcon}
          title="Ningún proyecto coincide con los filtros"
          description="Prueba con «Todos» en estado o en atraso."
        />
      )}

      {dialogo?.tipo === 'nueva-carpeta' && (
        <DialogoNombre
          titulo="Nueva carpeta"
          descripcion="Para organizar los proyectos. Una carpeta puede contener otras."
          etiqueta="Nombre"
          textoBoton="Crear"
          ocupado={crearCarpeta.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) =>
            crearCarpeta.mutate(
              { nombre, parentId: carpetaId },
              { onSuccess: cerrar },
            )
          }
        />
      )}

      {dialogo?.tipo === 'renombrar-carpeta' && (
        <DialogoNombre
          titulo="Renombrar carpeta"
          etiqueta="Nombre"
          valorInicial={dialogo.carpeta.nombre}
          textoBoton="Guardar"
          ocupado={renombrarCarpeta.isPending}
          onCerrar={cerrar}
          onConfirmar={(nombre) =>
            renombrarCarpeta.mutate(
              { id: dialogo.carpeta.id, nombre },
              { onSuccess: cerrar },
            )
          }
        />
      )}

      {dialogo?.tipo === 'borrar-carpeta' && (
        <DialogoConfirmar
          titulo={`¿Eliminar "${dialogo.carpeta.nombre}"?`}
          mensaje="Solo se puede eliminar una carpeta vacía."
          detalle={
            (dialogo.carpeta.subcarpetas ?? 0) > 0 ||
            (dialogo.carpeta.proyectos ?? 0) > 0
              ? `Tiene ${dialogo.carpeta.subcarpetas ?? 0} carpeta(s) y ${dialogo.carpeta.proyectos ?? 0} proyecto(s) dentro. El servidor lo rechazará hasta que los muevas.`
              : undefined
          }
          textoConfirmar="Eliminar"
          destructivo
          ocupado={eliminarCarpeta.isPending}
          onCerrar={cerrar}
          onConfirmar={() =>
            eliminarCarpeta.mutate(dialogo.carpeta.id, { onSuccess: cerrar })
          }
        />
      )}

      {creando && (
        <DialogoProyecto
          carpetaId={carpetaId}
          onCerrar={() => setCreando(false)}
          onCreado={(id) => {
            setCreando(false);
            navegar(`/proyectos/${id}`);
          }}
        />
      )}
    </div>
  );
}
