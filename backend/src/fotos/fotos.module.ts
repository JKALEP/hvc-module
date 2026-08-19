import { Module } from '@nestjs/common';
import { EquiposModule } from '../equipos/equipos.module';
import { AlbumController } from './album.controller';
import { CatalogoEquiposController } from './catalogo-equipos.controller';
import { CarpetaController } from './carpeta.controller';
import { TareaController } from './tarea.controller';
import { AdministracionFotosController } from './administracion.controller';
import { CompartirController } from './compartir.controller';
import { InvitacionController } from './invitacion.controller';
import { PortalController } from './portal.controller';
import { CarpetaService } from './carpeta.service';
import { AlbumService } from './album.service';
import { AccesoService } from './acceso.service';
import { NavegacionService } from './navegacion.service';
import { CompartirService } from './compartir.service';
import { InvitacionService } from './invitacion.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { ImagenService } from './imagen.service';
import { CatalogoEquiposService } from './catalogo-equipos.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { TareaService } from './tarea.service';
import { ComentarioService } from './comentario.service';
import { PlantillaService } from './plantilla.service';
import { ImportacionFotosService } from './importacion.service';

/**
 * Módulo Fotos (v3).
 *
 * `AccesoService` concentra la ÚNICA respuesta a «qué puede hacer este
 * usuario en esta carpeta»: la cascada de §25, la herencia de §7 y la del
 * archivado. El resto de services la usan en vez de repetir la regla, que es
 * lo que pide §25 al hablar de una lógica centralizada.
 *
 * Los demás no opinan sobre permisos: `NavegacionService` solo recorre,
 * `CarpetaService` solo administra el árbol, `AlbumService` es todo lo que
 * toca fotos, y `CompartirService` reparte accesos.
 */
@Module({
  // Fotos REFERENCIA el catálogo de equipos (§12). La flecha va en este
  // sentido y solo en este: Equipos no importa nada de Fotos.
  imports: [EquiposModule],
  controllers: [
    AlbumController,
    CatalogoEquiposController,
    CarpetaController,
    TareaController,
    AdministracionFotosController,
    CompartirController,
    InvitacionController,
    PortalController,
  ],
  providers: [
    CarpetaService,
    AlbumService,
    AccesoService,
    NavegacionService,
    CompartirService,
    InvitacionService,
    AlmacenamientoService,
    ImagenService,
    CatalogoEquiposService,
    AuditoriaFotosService,
    TareaService,
    ComentarioService,
    PlantillaService,
    ImportacionFotosService,
  ],
})
export class FotosModule {}
