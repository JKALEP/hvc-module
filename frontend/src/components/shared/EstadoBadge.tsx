import { CheckCircle2Icon, CircleAlertIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Estado } from '@/types/models';

// Badge de estado con color e ícono: verde COMPLETO / amarillo INCOMPLETO.
export function EstadoBadge({ estado }: { estado: Estado }) {
  if (estado === 'COMPLETO') {
    return (
      <Badge variant="success">
        <CheckCircle2Icon />
        Completo
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <CircleAlertIcon />
      Incompleto
    </Badge>
  );
}
