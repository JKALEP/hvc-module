import { Module } from '@nestjs/common';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresService } from './indicadores.service';
import { IndicadoresMensualService } from './indicadores-mensual.service';

// Dos providers: IndicadoresService agrega sobre un período libre
// (modo "Fechas"); IndicadoresMensualService desglosa mes a mes
// (modo "Meses"). Mismo patrón que proyecto/ con su service de analítica.
@Module({
  controllers: [IndicadoresController],
  providers: [IndicadoresService, IndicadoresMensualService],
  // Los consumen AlertasModule y TrabajadorModule.
  exports: [IndicadoresService, IndicadoresMensualService],
})
export class IndicadoresModule {}
