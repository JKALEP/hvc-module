import { Global, Module } from '@nestjs/common';
import { LineasService } from './lineas.service';
import { ExportacionService } from './exportacion.service';
import { CorreoService } from './correo.service';
import { NumeracionService } from './numeracion.service';

/**
 * Los services transversales: los usan dos o más módulos de negocio.
 *
 * El criterio para entrar aquí es el mismo que en `shared/` del
 * frontend: lo comparten DOS o más módulos. Un service que solo usa
 * Equipos se queda en `equipos/`, aunque parezca genérico.
 *
 * `@Global` por la misma razón que `PrismaModule` y `AuthModule`: son
 * cimientos, y obligar a cada módulo a importarlos sería ruido que nadie
 * lee. Lo que NO son cimientos —`texto`, `validacion`, `fechas`— siguen
 * siendo funciones sueltas que se importan donde hagan falta, sin pasar
 * por la inyección de dependencias.
 */
@Global()
@Module({
  providers: [
    LineasService,
    ExportacionService,
    CorreoService,
    NumeracionService,
  ],
  exports: [
    LineasService,
    ExportacionService,
    CorreoService,
    NumeracionService,
  ],
})
export class CommonModule {}
