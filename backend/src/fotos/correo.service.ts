import { Injectable, Logger } from '@nestjs/common';

/**
 * Envío de correo del módulo Fotos.
 *
 * ⚠️ HOY NO ENVÍA NADA. Está en MODO DESARROLLO: imprime el enlace en la
 * consola del backend para poder probar el ciclo completo sin depender
 * todavía del dominio verificado.
 *
 * ── Punto exacto donde se conecta Resend ─────────────────────────────
 * Cuando el dominio de HVC esté verificado con SPF/DKIM, basta con:
 *   1. `npm i resend`
 *   2. Rellenar `enviar()` de aquí abajo con la llamada real.
 *   3. Añadir al .env: RESEND_API_KEY, CORREO_REMITENTE,
 *      CORREO_NOMBRE_REMITENTE, URL_APP.
 * NADA MÁS del módulo cambia: el resto del código solo llama a
 * `enviarCorreoInvitacion` / `enviarAvisoDeAcceso` y no sabe cómo viajan.
 *
 * El dominio verificado es el del REMITENTE. El destinatario puede ser de
 * cualquier dominio: Gmail, Outlook, upc.edu.pe, el que sea.
 */

export interface DatosInvitacion {
  para: string;
  /** Lo que se comparte, ya en lenguaje de usuario. */
  recurso: string;
  /** Quién invita, para que el correo no llegue de un desconocido. */
  invitadoPor: string;
  enlace: string;
  expiraEn: Date;
}

export interface DatosAviso {
  para: string;
  recurso: string;
  invitadoPor: string;
  enlace: string;
}

@Injectable()
export class CorreoService {
  private readonly log = new Logger('Correo');

  /** ¿Hay un proveedor de correo real configurado? */
  get configurado(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  /** Base pública de la app, para construir enlaces que se puedan pegar. */
  private get urlApp(): string {
    return process.env.URL_APP ?? 'http://localhost:5173';
  }

  enlaceDeInvitacion(token: string): string {
    return `${this.urlApp}/invitacion/${token}`;
  }

  /** Donde entra un cliente que ya tiene cuenta. */
  enlaceDelPortal(): string {
    return `${this.urlApp}/portal`;
  }

  /**
   * Único punto de salida. Mientras no haya proveedor, escribe en el log
   * con una marca imposible de confundir con un envío real.
   */
  private enviar(asunto: string, datos: { para: string; cuerpo: string }) {
    if (!this.configurado) {
      this.log.log(
        `\n📧 [MODO DESARROLLO] No se envió ningún correo.\n` +
          `   Para:   ${datos.para}\n` +
          `   Asunto: ${asunto}\n` +
          `${datos.cuerpo}\n`,
      );
      return;
    }

    // Aquí irá la llamada a Resend. Se deja explícito para que quien la
    // conecte no tenga que buscar dónde.
    this.log.warn(
      `Hay RESEND_API_KEY pero el envío real todavía no está implementado. ` +
        `El correo para ${datos.para} NO salió.`,
    );
  }

  enviarCorreoInvitacion(datos: DatosInvitacion) {
    const dias = Math.round(
      (datos.expiraEn.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    this.enviar(`${datos.invitadoPor} compartió "${datos.recurso}" contigo`, {
      para: datos.para,
      cuerpo:
        `   ──────────────────────────────────────────────────────────\n` +
        `   🔗 Link de invitación: ${datos.enlace}\n` +
        `   ──────────────────────────────────────────────────────────\n` +
        `   Recurso: ${datos.recurso}\n` +
        `   Caduca en ${dias} día(s) (${datos.expiraEn.toISOString()})`,
    });
  }

  /** Para quien YA tiene cuenta: no hay nada que activar, solo avisar. */
  enviarAvisoDeAcceso(datos: DatosAviso) {
    this.enviar(`${datos.invitadoPor} compartió "${datos.recurso}" contigo`, {
      para: datos.para,
      cuerpo:
        `   Ya tenías cuenta, así que el acceso quedó activo al instante.\n` +
        `   🔗 Entra en: ${datos.enlace}\n` +
        `   Recurso: ${datos.recurso}`,
    });
  }
}
