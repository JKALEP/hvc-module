// DTOs planos, sin `class-validator`. Valida el service, en español.

/**
 * Una versión nueva de la plantilla (§68).
 *
 * No existe «editar una versión»: publicar es crear otra. Una versión ya
 * usada por una solicitud es el registro de lo que se mandó, y
 * reescribirla cambiaría el pasado — que es exactamente lo que §68
 * quiere impedir al guardar `plantillaVersionId` en cada envío.
 */
export interface CrearVersionDto {
  asunto?: string | null;
  cuerpo?: string | null;
  /**
   * Si además pasa a ser la que se usa. Por defecto SÍ: quien escribe
   * una versión nueva casi siempre quiere estrenarla, y dejarla
   * guardada pero apagada sin decirlo sería una trampa silenciosa.
   */
  activar?: boolean | null;
}

/** El nombre de la plantilla; el tipo no se elige, hoy solo hay uno. */
export interface GuardarPlantillaDto {
  nombre?: string | null;
}

/**
 * Con qué datos se previsualiza (§32).
 *
 * Todos opcionales: si no llegan, el service rellena con un ejemplo. Lo
 * importante de la vista previa es ver dónde caen las variables y qué
 * marcador quedó mal escrito, no el contenido concreto.
 */
export interface PrevisualizarDto {
  asunto?: string | null;
  cuerpo?: string | null;
}
