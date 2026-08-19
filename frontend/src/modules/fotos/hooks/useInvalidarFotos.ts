import { useQueryClient } from '@tanstack/react-query';

/**
 * Refresca todo el módulo tras una mutación.
 *
 * TODAS las claves de Fotos empiezan por `['fotos', …]` —incluidas las del
 * portal y las del catálogo de equipos—, así que basta invalidar esa raíz:
 * son pocas consultas y evita la lista de claves que hizo falta en el módulo
 * de proyectos.
 *
 * ⚠️ Eso ANTES no era cierto. Las claves eran sueltas (`['carpeta']`,
 * `['galeria']`, `['portal-carpeta']`…) y aquí se invalidaba `['fotos']` y
 * `['portal']`, que no coincidían con ninguna: crear, renombrar, archivar o
 * eliminar dejaban la pantalla con datos viejos hasta que alguien recargaba.
 * Se arregló dándole a las claves la raíz que este comentario ya afirmaba
 * —ver `QUERY_KEYS` en `shared/lib/constants.ts`—, no añadiendo aquí una
 * lista que habría que mantener a la par.
 */
export function useInvalidarFotos() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['fotos'] });
  };
}
