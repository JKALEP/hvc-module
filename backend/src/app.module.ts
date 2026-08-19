import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/guards/jwt.guard';
import { ModuloGuard } from './auth/guards/modulo.guard';
import { CatalogoModule } from './costos/catalogo/catalogo.module';
import { ProveedorModule } from './costos/proveedor/proveedor.module';
import { RequerimientoModule } from './costos/requerimiento/requerimiento.module';
import { ObservacionModule } from './costos/observacion/observacion.module';
import { PlantillaModule } from './costos/plantilla/plantilla.module';
import { CotizacionModule } from './costos/cotizacion/cotizacion.module';
import { AprobacionModule } from './costos/aprobacion/aprobacion.module';
import { CostoModule } from './costos/costo/costo.module';
import { ExportacionCostosModule } from './costos/exportacion/exportacion.module';
import { GestionPersonalModule } from './personal/gestion-personal/gestion-personal.module';
import { ObraModule } from './personal/obra/obra.module';
import { EquiposModule } from './equipos/equipos.module';
import { FotosModule } from './fotos/fotos.module';

@Module({
  imports: [
    /**
     * Límite de intentos. El global es holgado a propósito: no está para
     * frenar el uso normal, sino para que las rutas públicas —login y
     * activación de invitación— no queden expuestas a fuerza bruta a
     * ritmo de red. Esas dos aprietan más el límite con @Throttle.
     */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    // Services que usan dos o más módulos: líneas, exportación, correo y
    // numeración. Global, igual que Prisma y Auth.
    CommonModule,
    AuthModule,
    // Módulo Costos: el proceso completo de requerimiento a costo.
    CatalogoModule,
    ProveedorModule,
    RequerimientoModule,
    ObservacionModule,
    PlantillaModule,
    CotizacionModule,
    AprobacionModule,
    CostoModule,
    ExportacionCostosModule,
    // Módulo Personal / Proyectos
    GestionPersonalModule,
    ObraModule,
    EquiposModule,
    // Módulo Fotos
    FotosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards GLOBALES. El orden importa: JwtGuard resuelve el usuario y
    // ModuloGuard comprueba sus permisos.
    //
    // Al ser globales, todo endpoint nace protegido: para abrir uno hay
    // que escribir @Publico() a mano, y eso salta a la vista en revisión.
    // Lo contrario —tener que acordarse de proteger cada ruta nueva— es
    // como se filtran los agujeros.
    // Va primero: no tiene sentido gastar una consulta a la BD para
    // resolver el usuario de una petición que se va a rechazar por ritmo.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: ModuloGuard },
  ],
})
export class AppModule {}
