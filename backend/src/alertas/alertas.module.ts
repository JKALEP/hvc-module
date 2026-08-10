import { Module } from '@nestjs/common';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';
import { IndicadoresModule } from '../indicadores/indicadores.module';
import { ProyectoModule } from '../proyecto/proyecto.module';

// Orquesta: no reimplementa agregaciones, reusa los services de
// indicadores y de analítica de proyecto, que ya están probados.
@Module({
  imports: [IndicadoresModule, ProyectoModule],
  controllers: [AlertasController],
  providers: [AlertasService],
})
export class AlertasModule {}
