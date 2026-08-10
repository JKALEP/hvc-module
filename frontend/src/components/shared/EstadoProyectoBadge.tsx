import { PlayCircleIcon, CheckCircle2Icon, PauseCircleIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ETIQUETAS_ESTADO_PROYECTO } from '@/lib/constants';
import type { EstadoProyecto } from '@/types/models';

// Estado del proyecto con color e ícono: el ícono importa porque el color
// solo no debe ser el único portador del significado.
export function EstadoProyectoBadge({ estado }: { estado: EstadoProyecto }) {
  if (estado === 'EN_EJECUCION') {
    return (
      <Badge variant="success">
        <PlayCircleIcon />
        {ETIQUETAS_ESTADO_PROYECTO.EN_EJECUCION}
      </Badge>
    );
  }
  if (estado === 'PAUSADO') {
    return (
      <Badge variant="warning">
        <PauseCircleIcon />
        {ETIQUETAS_ESTADO_PROYECTO.PAUSADO}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CheckCircle2Icon />
      {ETIQUETAS_ESTADO_PROYECTO.FINALIZADO}
    </Badge>
  );
}
