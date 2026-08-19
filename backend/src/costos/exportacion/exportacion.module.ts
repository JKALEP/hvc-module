import { Module } from '@nestjs/common';
import { ExportacionCostosController } from './exportacion.controller';
import { ExportableService } from './exportable.service';
import { RequerimientoModule } from '../requerimiento/requerimiento.module';
import { CotizacionModule } from '../cotizacion/cotizacion.module';
import { CostoModule } from '../costo/costo.module';

/**
 * Las descargas de §69.
 *
 * Módulo propio y no un endpoint más en cada controller: los tres
 * documentos comparten la forma de responder —generar y devolver como
 * adjunto— y ninguno pertenece a un submódulo concreto, porque el
 * comparativo cruza cotizaciones y el costo cruza requerimiento y
 * proveedor.
 *
 * Importa los tres módulos de los que lee para NO volver a consultar por
 * su cuenta lo que ellos ya saben responder.
 */
@Module({
  imports: [RequerimientoModule, CotizacionModule, CostoModule],
  controllers: [ExportacionCostosController],
  providers: [ExportableService],
})
export class ExportacionCostosModule {}
