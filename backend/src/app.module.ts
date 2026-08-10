import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/jwt.guard';
import { ModuloGuard } from './auth/modulo.guard';
import { ImportacionModule } from './importacion/importacion.module';
import { MaestroModule } from './maestro/maestro.module';
import { ProyectoModule } from './proyecto/proyecto.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { TrabajadorModule } from './trabajador/trabajador.module';
import { ReporteDiarioModule } from './reporte-diario/reporte-diario.module';
import { IndicadoresModule } from './indicadores/indicadores.module';
import { AlertasModule } from './alertas/alertas.module';
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
    AuthModule,
    // Módulo Costos
    ImportacionModule,
    MaestroModule,
    // Módulo Personal / Proyectos
    ProyectoModule,
    SupervisorModule,
    TrabajadorModule,
    ReporteDiarioModule,
    IndicadoresModule,
    AlertasModule,
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
