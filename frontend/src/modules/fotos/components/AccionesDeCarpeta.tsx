import { FolderPlusIcon, Share2Icon, WrenchIcon } from 'lucide-react';

import { Button } from '@/shared/ui/button';
import type { ContenidoCarpeta } from '@/modules/fotos/types';

/**
 * Los botones de la cabecera de Fotos.
 *
 * ⚠️ Son TRES, y antes eran seis. «Importar Excel» y «Crear desde plantilla»
 * se bajaron al cuerpo (`CrearEstructura`) porque desbordaban el ancho —en
 * pantallas normales los botones se salían— y porque no son lo mismo: crear
 * una carpeta o compartir son acciones SOBRE esta carpeta, mientras que
 * importar y estampar una plantilla son formas de generar contenido DENTRO,
 * al lado de subir fotos y crear álbumes. La cabecera se llenó por acumular
 * cada fase su botón, no por diseño.
 *
 * En móvil el texto desaparece y quedan los iconos (§21 pide una interfaz
 * limpia, y tres iconos caben donde tres etiquetas no).
 */
export function AccionesDeCarpeta({
  data,
  carpetaId,
  onNuevaCarpeta,
  onAnadirEquipo,
  onCompartir,
}: {
  data: ContenidoCarpeta;
  /** null = raíz. Un equipo no cuelga de la raíz (§12). */
  carpetaId: number | null;
  onNuevaCarpeta: () => void;
  onAnadirEquipo: () => void;
  onCompartir: () => void;
}) {
  return (
    <>
      {data.puedeEscribir && (
        <Button variant="outline" onClick={onNuevaCarpeta}>
          <FolderPlusIcon />
          <span className="hidden sm:inline">Nueva carpeta</span>
        </Button>
      )}

      {/* Solo DENTRO de una carpeta: un equipo vive en una estructura de
          trabajo (§12), no colgando de la raíz. */}
      {data.puedeEscribir && carpetaId !== null && (
        <Button variant="outline" onClick={onAnadirEquipo}>
          <WrenchIcon />
          <span className="hidden sm:inline">Añadir equipo</span>
        </Button>
      )}

      {!data.ramaCerrada && (
        <Button
          variant={carpetaId === null ? 'default' : 'outline'}
          onClick={onCompartir}
        >
          <Share2Icon />
          <span className="hidden sm:inline">Compartir</span>
        </Button>
      )}
    </>
  );
}
