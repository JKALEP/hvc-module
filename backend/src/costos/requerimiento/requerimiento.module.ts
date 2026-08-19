import { Module } from '@nestjs/common';
import { RequerimientoController } from './requerimiento.controller';
import { RequerimientoService } from './requerimiento.service';
import { ItemService } from './item.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CatalogoModule } from '../catalogo/catalogo.module';

/**
 * El requerimiento: cabecera, ítems y ciclo de vida.
 *
 * Importa `CatalogoModule` para validar los cuatro selectores de §13
 * contra sus dueños en vez de repetir las consultas. `NumeracionService`
 * no se lista: viene de `CommonModule`, que es global.
 *
 * Exporta `RequerimientoService` porque las fases del Gestor y del
 * Aprobador necesitan `aplicarTransicion`: la máquina de estados tiene un
 * solo sitio donde se obedece, y ningún otro submódulo debe escribir el
 * estado por su cuenta.
 */
@Module({
  imports: [AuditoriaModule, CatalogoModule],
  controllers: [RequerimientoController],
  providers: [RequerimientoService, ItemService],
  exports: [RequerimientoService],
})
export class RequerimientoModule {}
