import {
  Controller,
  Get,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { SoloSuperAdmin } from '../../auth/decoradores';
import { EntidadCostos } from '../../../generated/prisma/enums';
import { limpiar, describir } from '../../common/texto';

/**
 * La bitácora del módulo, para consultarla (§64).
 *
 * Existe solo para exponer `deEntidad`, que no tenía ruta: la cadena de
 * un requerimiento ya sale por `GET /costos/requerimiento/:id/historial`
 * —con el control de acceso del requerimiento, que es el correcto para
 * quien participa en él— y duplicarla aquí sería tener dos rutas para la
 * misma pregunta con dos reglas de alcance distintas.
 *
 * Lo que faltaba es la otra mitad de §64: qué le ha pasado a UNA fila
 * concreta —un proveedor, un catálogo, una cotización— que puede no
 * colgar de ningún requerimiento. Eso no es consulta de proceso, es
 * auditoría, y por eso va con `@SoloSuperAdmin()` y bajo
 * `costos/admin`: mismo criterio que los maestros.
 *
 * No hay un «lista todos los eventos» a propósito. Una bitácora entera
 * sin filtro ni paginación es una consulta que crece sin techo y que no
 * responde a ninguna pregunta concreta; cuando haga falta, se añade con
 * su paginación y sus filtros pensados, no como efecto secundario de
 * esto.
 */
@SoloSuperAdmin()
@Controller('costos/admin')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  /** GET /costos/admin/auditoria?entidad=PROVEEDOR&entidadId=3 */
  @Get('auditoria')
  deEntidad(
    @Query('entidad') entidad: string,
    @Query('entidadId', ParseIntPipe) entidadId: number,
  ) {
    return this.auditoria.deEntidad(this.aEntidad(entidad), entidadId);
  }

  private aEntidad(valor: unknown): EntidadCostos {
    const s = limpiar(valor)?.toUpperCase();
    const validos = Object.values(EntidadCostos) as string[];
    if (s && validos.includes(s)) return s as EntidadCostos;
    throw new BadRequestException(
      `Entidad inválida: "${describir(valor)}". ` +
        `Valores permitidos: ${validos.join(', ')}.`,
    );
  }
}
