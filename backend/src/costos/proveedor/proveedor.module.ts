import { Module } from '@nestjs/common';
import { ProveedorController } from './proveedor.controller';
import { ProveedorService } from './proveedor.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * Proveedores.
 *
 * Exporta su service: el flujo de compartir con proveedores (Fase 4) y
 * el registro del costo (Fase 5) necesitan leerlos, y una segunda
 * consulta suelta sería una segunda definición de «qué proveedor está
 * disponible».
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [ProveedorController],
  providers: [ProveedorService],
  exports: [ProveedorService],
})
export class ProveedorModule {}
