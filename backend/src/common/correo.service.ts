import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Envío de correo del sistema.
 *
 * Nació en el módulo Fotos, para las invitaciones de clientes externos.
 * Vive en `common/` porque Costos tiene que mandar solicitudes de
 * cotización a proveedores, y montar un segundo emisor habría sido dos
 * configuraciones de Resend, dos remitentes y dos sitios donde mirar
 * cuando un correo no llega.
 *
 * `enviar()` es el ÚNICO punto de salida: los tres métodos públicos
 * arman su texto y pasan por ahí. Quien llama no sabe —ni tiene que
 * saber— si detrás hay Resend o una línea de log.
 *
 * ── Modo desarrollo y modo real ──────────────────────────────────────
 * Si NO hay `RESEND_API_KEY`, no se manda nada: se imprime en la consola
 * con una marca imposible de confundir con un envío real, y se devuelve
 * `enviado: false` con el motivo. Eso NO es un fallo disfrazado —es la
 * verdad, y es lo que se guarda en `SolicitudCotizacion.estadoEnvio`
 * (§67): decir «enviado» sin haber enviado dejaría a alguien esperando
 * una respuesta que no puede llegar.
 *
 * Con la clave puesta, sale por Resend de verdad.
 *
 * ── Qué hay que configurar ───────────────────────────────────────────
 *   RESEND_API_KEY          — la clave de la cuenta de Resend
 *   CORREO_REMITENTE        — buzón del dominio VERIFICADO con SPF/DKIM
 *   CORREO_NOMBRE_REMITENTE — cómo se ve el remitente (opcional)
 *   URL_APP                 — base pública, para los enlaces del correo
 *
 * El dominio verificado es el del REMITENTE. El destinatario puede ser
 * de cualquier dominio: Gmail, Outlook, el que sea.
 *
 * Todo va como TEXTO PLANO, no HTML: el cuerpo de la solicitud lleva la
 * tabla de ítems alineada con espacios (`PlantillaService.tablaDeItems`)
 * y eso se lee igual en cualquier cliente de correo. Una tabla maquetada
 * es justo lo que se rompe en el móvil del proveedor.
 */

/** Lo que devuelve cualquier envío. Se guarda tal cual en la bitácora. */
export interface ResultadoEnvio {
  enviado: boolean;
  error: string | null;
}

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

/** Una solicitud de cotización a un proveedor (§33). */
export interface DatosSolicitudCotizacion {
  para: string;
  asunto: string;
  cuerpo: string;
}

@Injectable()
export class CorreoService {
  private readonly log = new Logger('Correo');
  private cliente: Resend | null = null;

  /** ¿Hay un proveedor de correo real configurado? */
  get configurado(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  /**
   * El cliente de Resend, creado la primera vez que hace falta.
   *
   * Perezoso y no en el constructor porque el backend tiene que poder
   * arrancar sin clave —en desarrollo es lo normal— y construirlo con
   * `undefined` reventaría el arranque entero por una función que quizá
   * nadie llame.
   */
  private get resend(): Resend {
    this.cliente ??= new Resend(process.env.RESEND_API_KEY);
    return this.cliente;
  }

  /**
   * El remitente, en el formato que espera Resend.
   *
   * Tiene que ser un buzón del dominio verificado; si no lo es, Resend
   * rechaza el envío y ese error acaba en `errorEnvio`, que es
   * exactamente donde se quiere ver.
   */
  private get remitente(): string {
    const correo = process.env.CORREO_REMITENTE ?? '';
    const nombre = process.env.CORREO_NOMBRE_REMITENTE;
    return nombre ? `${nombre} <${correo}>` : correo;
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
   * Único punto de salida.
   *
   * NUNCA lanza: un correo que no sale no puede tumbar la operación que
   * lo provocó. Compartir un álbum o pedir una cotización tienen que
   * quedar registrados igual, y el fallo se devuelve para guardarlo
   * junto al envío (§67). Perder la solicitud por un problema del
   * servidor de correo sería perder dos cosas en vez de una.
   */
  private async enviar(
    asunto: string,
    datos: { para: string; cuerpo: string },
  ): Promise<ResultadoEnvio> {
    if (!this.configurado) {
      this.log.log(
        `\n📧 [MODO DESARROLLO] No se envió ningún correo.\n` +
          `   Para:   ${datos.para}\n` +
          `   Asunto: ${asunto}\n` +
          `${datos.cuerpo}\n`,
      );
      return {
        enviado: false,
        error: 'MODO DESARROLLO: el correo se imprimió en la consola.',
      };
    }

    if (!process.env.CORREO_REMITENTE) {
      const error =
        'Falta CORREO_REMITENTE: hay clave de Resend pero no desde qué buzón mandar.';
      this.log.error(error);
      return { enviado: false, error };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.remitente,
        to: datos.para,
        subject: asunto,
        text: datos.cuerpo,
      });

      if (error) {
        // El texto de Resend se guarda tal cual: dice si el dominio no
        // está verificado, si el destinatario rebotó o si la clave no
        // vale, y esas tres se arreglan de formas distintas.
        this.log.error(
          `Resend rechazó el correo para ${datos.para}: ${error.message}`,
        );
        return { enviado: false, error: error.message };
      }

      this.log.log(`Correo enviado a ${datos.para} (id ${data?.id ?? '—'})`);
      return { enviado: true, error: null };
    } catch (e) {
      const error = (e as Error).message;
      this.log.error(`No se pudo enviar a ${datos.para}: ${error}`);
      return { enviado: false, error };
    }
  }

  async enviarCorreoInvitacion(
    datos: DatosInvitacion,
  ): Promise<ResultadoEnvio> {
    const dias = Math.round(
      (datos.expiraEn.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return this.enviar(
      `${datos.invitadoPor} compartió "${datos.recurso}" contigo`,
      {
        para: datos.para,
        cuerpo:
          `   ──────────────────────────────────────────────────────────\n` +
          `   🔗 Link de invitación: ${datos.enlace}\n` +
          `   ──────────────────────────────────────────────────────────\n` +
          `   Recurso: ${datos.recurso}\n` +
          `   Caduca en ${dias} día(s) (${datos.expiraEn.toISOString()})`,
      },
    );
  }

  /**
   * La solicitud de cotización de Costos (§33).
   *
   * A diferencia de las de Fotos, el asunto y el cuerpo llegan YA
   * resueltos: los arma `PlantillaService` sustituyendo las variables de
   * §32 sobre la versión activa. Aquí no se decide qué dice el correo,
   * solo se manda.
   *
   * Devuelve si salió o no. Quien llama lo guarda en la solicitud junto
   * con el error, que es lo que §67 pide registrar: sin eso, un envío
   * caído solo se nota porque nadie responde.
   */
  async enviarSolicitudCotizacion(
    datos: DatosSolicitudCotizacion,
  ): Promise<ResultadoEnvio> {
    return this.enviar(datos.asunto, {
      para: datos.para,
      cuerpo: datos.cuerpo,
    });
  }

  /** Para quien YA tiene cuenta: no hay nada que activar, solo avisar. */
  async enviarAvisoDeAcceso(datos: DatosAviso): Promise<ResultadoEnvio> {
    return this.enviar(
      `${datos.invitadoPor} compartió "${datos.recurso}" contigo`,
      {
        para: datos.para,
        cuerpo:
          `   Ya tenías cuenta, así que el acceso quedó activo al instante.\n` +
          `   🔗 Entra en: ${datos.enlace}\n` +
          `   Recurso: ${datos.recurso}`,
      },
    );
  }
}
