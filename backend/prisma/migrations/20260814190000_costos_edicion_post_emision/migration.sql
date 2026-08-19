-- Fase 6 del módulo Costos — reglas de edición después de emitir (§54).
--
-- §54 era el punto que la especificación dejaba abierto: qué se puede
-- tocar cuando el requerimiento ya salió a proveedores. Las reglas que
-- fijó HVC obligan a poder decir una cosa que hasta ahora no se podía:
-- que una cotización sigue siendo lo que el proveedor respondió, pero ya
-- no cotiza lo que se está pidiendo.
--
-- Eso son DOS columnas y no un valor más de "EstadoCotizacionProveedor":
-- «el Aprobador la aceptó» y «lo pedido cambió después» son hechos
-- ortogonales que pueden ser ciertos a la vez. Meterlos en la misma
-- columna obligaría a borrar el primero para poder decir el segundo, y
-- §53 no admite perder un valor histórico.
--
-- Sin pérdida de datos: dos columnas nuevas con default.
--
-- Verificar después de aplicar:
--   SELECT count(*) FROM costos_cotizaciones_proveedor
--    WHERE "requiereRevision" = false;   -- todas, ninguna nace marcada

ALTER TABLE "costos_cotizaciones_proveedor"
  ADD COLUMN "requiereRevision" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "revisionMotivo"   TEXT;

-- Se busca «las que hay que volver a pedir», nunca al revés.
CREATE INDEX "costos_cotizaciones_proveedor_requiereRevision_idx"
  ON "costos_cotizaciones_proveedor"("requerimientoId", "requiereRevision");
