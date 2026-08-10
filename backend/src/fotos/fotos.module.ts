import { Module } from '@nestjs/common';
import { SedeController } from './sede.controller';
import { AlbumController } from './album.controller';
import { NavegacionController } from './navegacion.controller';
import { CompartirController } from './compartir.controller';
import { InvitacionController } from './invitacion.controller';
import { PortalController } from './portal.controller';
import { SedeService } from './sede.service';
import { AlbumService } from './album.service';
import { FotoService } from './foto.service';
import { AccesoService } from './acceso.service';
import { NavegacionService } from './navegacion.service';
import { CompartirService } from './compartir.service';
import { InvitacionService } from './invitacion.service';
import { CorreoService } from './correo.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { ImagenService } from './imagen.service';

/**
 * Módulo Fotos.
 *
 * `AccesoService` concentra la única respuesta a "qué ve este usuario",
 * incluida la cascada de carpetas, y lo usan el resto de services en vez
 * de repetir la regla. `NavegacionService` solo recorre; `SedeService`
 * solo administra.
 */
@Module({
  controllers: [
    SedeController,
    AlbumController,
    NavegacionController,
    CompartirController,
    InvitacionController,
    PortalController,
  ],
  providers: [
    SedeService,
    AlbumService,
    FotoService,
    AccesoService,
    NavegacionService,
    CompartirService,
    InvitacionService,
    CorreoService,
    AlmacenamientoService,
    ImagenService,
  ],
})
export class FotosModule {}
