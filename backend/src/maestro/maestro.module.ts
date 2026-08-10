import { Module } from '@nestjs/common';
import { MaestroController } from './maestro.controller';
import { MaestroService } from './maestro.service';

@Module({
  controllers: [MaestroController],
  providers: [MaestroService],
})
export class MaestroModule {}
