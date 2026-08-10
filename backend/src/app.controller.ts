import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Publico } from './auth/decoradores';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Health check: abierto a propósito, es lo que consulta Render para
  // saber si la instancia está viva. No devuelve ningún dato del negocio.
  @Publico()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
