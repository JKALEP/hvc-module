import { Module } from '@nestjs/common';
import { TrabajadorController } from './trabajador.controller';
import { TrabajadorService } from './trabajador.service';
import { IndicadoresModule } from '../indicadores/indicadores.module';

// Importa IndicadoresModule para la serie mensual de /trabajador/:id/mensual,
// en vez de duplicar la agregación por mes.
@Module({
  imports: [IndicadoresModule],
  controllers: [TrabajadorController],
  providers: [TrabajadorService],
})
export class TrabajadorModule {}
