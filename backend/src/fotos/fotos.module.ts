import { Module } from '@nestjs/common';
import { FotoController } from './foto.controller';
import { CarpetaController } from './carpeta.controller';
import { ActividadController } from './actividad.controller';
import { AdministracionFotosController } from './administracion.controller';
import { CompartirController } from './compartir.controller';
import { InvitacionController } from './invitacion.controller';
import { PortalController } from './portal.controller';
import { ExportacionFotosController } from './exportacion.controller';
import { CarpetaService } from './carpeta.service';
import { CampoFotosService } from './campo.service';
import { IntervencionService } from './intervencion.service';
import { IntervencionController } from './intervencion.controller';
import { EstadoEquipoService } from './estado-equipo.service';
import { SistemaFotosService } from './sistema.service';
import { CatalogoActividadService } from './catalogo-actividad.service';
import { ObservacionService } from './observacion.service';
import { ConfiguracionFotosService } from './configuracion.service';
import { ValorCampoFotosService } from './valor-campo-fotos.service';
import { FotoService } from './foto.service';
import { AccesoService } from './acceso.service';
import { NavegacionService } from './navegacion.service';
import { CompartirService } from './compartir.service';
import { InvitacionService } from './invitacion.service';
import { AlmacenamientoService } from './almacenamiento.service';
import { ImagenService } from './imagen.service';
import { AuditoriaFotosService } from './auditoria-fotos.service';
import { ActividadService } from './actividad.service';
import { ComentarioService } from './comentario.service';
import { PlantillaService } from './plantilla.service';
import { ImportacionFotosService } from './importacion.service';
import { ExportableFotosService } from './exportable-fotos.service';

/**
 * Módulo Fotos (v3).
 *
 * `AccesoService` concentra la ÚNICA respuesta a «qué puede hacer este
 * usuario en esta carpeta»: la cascada de §25, la herencia de §7 y la del
 * archivado. El resto de services la usan en vez de repetir la regla, que es
 * lo que pide §25 al hablar de una lógica centralizada.
 *
 * Los demás no opinan sobre permisos: `NavegacionService` solo recorre,
 * `CarpetaService` solo administra el árbol, `FotoService` es todo lo que
 * toca fotos, y `CompartirService` reparte accesos.
 */
@Module({
  // ⚠️ Sin `imports`. Hasta la Fase 1a de «Gestión de contenido» esto
  // importaba `EquiposModule`: una carpeta de tipo EQUIPO referenciaba al
  // equipo real del catálogo (§12), y `CatalogoEquiposController` era la
  // puerta autorizada a buscarlo y registrarlo. Se retiró entero —el flujo
  // cruzado generaba fricción en obra y ninguna carpeta llegó a
  // enlazarse—, así que hoy **Fotos no depende de ningún otro módulo de
  // negocio**. La información del equipo pasa a ser propia y configurable
  // (Fase 1b).
  controllers: [
    FotoController,
    IntervencionController,
    CarpetaController,
    ActividadController,
    AdministracionFotosController,
    CompartirController,
    InvitacionController,
    PortalController,
    ExportacionFotosController,
  ],
  providers: [
    CarpetaService,
    // Los campos configurables de una carpeta de tipo EQUIPO (Fase 1b):
    // `CampoFotosService` los DEFINE (ADMIN_GLOBAL) y
    // `ValorCampoFotosService` los RELLENA (EDICION sobre la carpeta).
    // Dos services y no uno porque son dos permisos distintos.
    // Las intervenciones (Fase 1): el historial de intervenciónes de un equipo, con su
    // catálogo administrable de estados.
    IntervencionService,
    EstadoEquipoService,
    SistemaFotosService,
    CatalogoActividadService,
    ObservacionService,
    CampoFotosService,
    ValorCampoFotosService,
    ConfiguracionFotosService,
    FotoService,
    AccesoService,
    NavegacionService,
    CompartirService,
    InvitacionService,
    AlmacenamientoService,
    ImagenService,
    AuditoriaFotosService,
    ActividadService,
    ComentarioService,
    PlantillaService,
    ImportacionFotosService,
    ExportableFotosService,
  ],
})
export class FotosModule {}
