import { Module } from '@nestjs/common';
import { ReporteDiarioController } from './reporte-diario.controller';
import { ReporteDiarioService } from './reporte-diario.service';

@Module({
  controllers: [ReporteDiarioController],
  providers: [ReporteDiarioService],
})
export class ReporteDiarioModule {}
