CREATE SCHEMA IF NOT EXISTS devoluciones;

-- TDSI-71: catalogo de motivos predefinidos
CREATE TABLE IF NOT EXISTS devoluciones.motivos (
    id      BIGSERIAL PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL UNIQUE,
    activo  BOOLEAN      NOT NULL DEFAULT true
);
INSERT INTO devoluciones.motivos (nombre) VALUES
    ('Producto defectuoso'), ('Producto equivocado'), ('Cliente se arrepintio'), ('Otro')
ON CONFLICT DO NOTHING;

-- TDSI-68/69/70/71/76/78/80/81: cabecera de la devolucion
CREATE TABLE IF NOT EXISTS devoluciones.devoluciones (
    id                    BIGSERIAL PRIMARY KEY,
    codigo                VARCHAR(20)  NOT NULL UNIQUE,          -- TDSI-76: correlativo unico
    factura_numero        VARCHAR(20)  NOT NULL,                 -- TDSI-68: busqueda por comprobante
    venta_id              VARCHAR(60),
    cliente_nit           VARCHAR(30),
    fecha_venta           TIMESTAMPTZ  NOT NULL,
    fecha_solicitud       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    dentro_de_plazo       BOOLEAN      NOT NULL,                 -- TDSI-69
    tipo                  VARCHAR(10)  NOT NULL CHECK (tipo IN ('TOTAL','PARCIAL')),  -- TDSI-70
    motivo_id             BIGINT       REFERENCES devoluciones.motivos(id),           -- TDSI-71
    observaciones         VARCHAR(300),
    metodo_pago_original  VARCHAR(60)  NOT NULL,                 -- TDSI-72: define opciones de reembolso ("Efectivo + QR")
    monto_total           NUMERIC(14,2) NOT NULL CHECK (monto_total > 0),
    estado                VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                           CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','PROCESADA')),  -- TDSI-78
    motivo_rechazo        VARCHAR(300),
    requiere_autorizacion BOOLEAN      NOT NULL DEFAULT false,   -- TDSI-80: monto sobre el limite
    autorizado_por        VARCHAR(60),
    autorizado_en         TIMESTAMPTZ,
    creado_por            VARCHAR(60)
);
CREATE INDEX IF NOT EXISTS idx_devoluciones_factura ON devoluciones.devoluciones (factura_numero);
CREATE INDEX IF NOT EXISTS idx_devoluciones_estado   ON devoluciones.devoluciones (estado);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha    ON devoluciones.devoluciones (fecha_solicitud);

-- TDSI-70: items devueltos (para devolucion parcial)
CREATE TABLE IF NOT EXISTS devoluciones.devolucion_items (
    id              BIGSERIAL PRIMARY KEY,
    devolucion_id   BIGINT NOT NULL REFERENCES devoluciones.devoluciones(id) ON DELETE CASCADE,
    factura_item_id BIGINT,                                       -- TDSI-217: facturacion.factura_items.id
    codigo_producto VARCHAR(60),                                  -- TDSI-217: para Inventario (TDSI-77)
    descripcion     VARCHAR(200) NOT NULL,
    cantidad        NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    condicion       VARCHAR(10)  NOT NULL DEFAULT 'REINGRESO'
                     CHECK (condicion IN ('REINGRESO','MERMA')),  -- TDSI-217/77: vuelve al stock o se da de baja
    precio_unitario NUMERIC(14,2) NOT NULL,
    subtotal        NUMERIC(14,2) NOT NULL
);

-- TDSI-81: historial inmutable de cambios de estado (append-only, nunca se actualiza ni borra)
CREATE TABLE IF NOT EXISTS devoluciones.historial_estados (
    id              BIGSERIAL PRIMARY KEY,
    devolucion_id   BIGINT NOT NULL REFERENCES devoluciones.devoluciones(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(20),
    estado_nuevo    VARCHAR(20) NOT NULL,
    cambiado_por    VARCHAR(60),
    cambiado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TDSI-72/74: reembolsos derivados de la devolucion (efectivo, reversion de tarjeta, etc.)
CREATE TABLE IF NOT EXISTS devoluciones.reembolsos (
    id                  BIGSERIAL PRIMARY KEY,
    devolucion_id       BIGINT NOT NULL REFERENCES devoluciones.devoluciones(id) ON DELETE CASCADE,
    tipo                VARCHAR(20)  NOT NULL CHECK (tipo IN ('EFECTIVO','REVERSION_TARJETA','REVERSION_QR','VALE')),
    referencia          VARCHAR(60),   -- TDSI-217: reversion_id o vale_codigo que devuelve gestion_pagos
    monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    estado              VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PROCESADO','ERROR')),
    procesado_en        TIMESTAMPTZ
);

-- TDSI-73/79: notas de credito electronicas
CREATE TABLE IF NOT EXISTS devoluciones.notas_credito (
    id              BIGSERIAL PRIMARY KEY,
    devolucion_id   BIGINT NOT NULL REFERENCES devoluciones.devoluciones(id) ON DELETE CASCADE,
    numero          VARCHAR(20)  NOT NULL UNIQUE,
    monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'EMITIDA' CHECK (estado IN ('EMITIDA','ANULADA')),
    emitida_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    enviada_por_correo BOOLEAN   NOT NULL DEFAULT false,          -- TDSI-79
    enviada_en      TIMESTAMPTZ
);

-- TDSI-77: notificacion al subsistema de inventario
CREATE TABLE IF NOT EXISTS devoluciones.notificaciones_inventario (
    id              BIGSERIAL PRIMARY KEY,
    devolucion_id   BIGINT NOT NULL REFERENCES devoluciones.devoluciones(id) ON DELETE CASCADE,
    estado          VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','ERROR')),
    enviado_en      TIMESTAMPTZ
);

-- NOTA: TDSI-29/135/136 (supervision de devoluciones en caja) no crea tabla nueva aqui.
-- El microservicio "cajeros" consulta esta informacion via HTTP (GET a devoluciones.devoluciones),
-- no accede directo a este schema.

ALTER TABLE devoluciones.motivos                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones.devoluciones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones.devolucion_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones.historial_estados          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones.reembolsos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones.notas_credito              ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones.notificaciones_inventario  ENABLE ROW LEVEL SECURITY;
-- ==========================================================================
-- TDSI-76/229: codigo DEV-NNNNNN correlativo de cada devolucion
-- --------------------------------------------------------------------------
-- El codigo lo pone la BD al insertar (trigger), nunca el que llama: asi dos
-- devoluciones seguidas siempre tienen codigos consecutivos, aunque se
-- registren al mismo tiempo desde dos cajas. El contador vive en una tabla
-- (no en un SEQUENCE) para que una devolucion que falla y se deshace
-- (ROLLBACK) no deje un hueco en la numeracion. Idempotente.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS devoluciones.correlativos (
    nombre  VARCHAR(30) PRIMARY KEY,
    ultimo  BIGINT      NOT NULL DEFAULT 0 CHECK (ultimo >= 0)
);
ALTER TABLE devoluciones.correlativos ENABLE ROW LEVEL SECURITY;

-- Arranca desde el mayor codigo que ya exista (0 si no hay devoluciones).
INSERT INTO devoluciones.correlativos (nombre, ultimo)
SELECT 'devolucion', COALESCE(MAX(substring(codigo FROM '^DEV-([0-9]+)$')::BIGINT), 0)
  FROM devoluciones.devoluciones
ON CONFLICT (nombre) DO NOTHING;

CREATE OR REPLACE FUNCTION devoluciones.asignar_codigo_devolucion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  n BIGINT;
BEGIN
  -- El UPDATE bloquea la fila del contador hasta el COMMIT: los registros simultaneos esperan su turno.
  UPDATE devoluciones.correlativos SET ultimo = ultimo + 1 WHERE nombre = 'devolucion' RETURNING ultimo INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'Falta el correlativo de devoluciones: corra sql/script_devoluciones.sql';
  END IF;
  NEW.codigo := 'DEV-' || CASE WHEN n < 1000000 THEN lpad(n::TEXT, 6, '0') ELSE n::TEXT END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devoluciones_codigo ON devoluciones.devoluciones;
CREATE TRIGGER trg_devoluciones_codigo
  BEFORE INSERT ON devoluciones.devoluciones
  FOR EACH ROW EXECUTE FUNCTION devoluciones.asignar_codigo_devolucion();

-- ==========================================================================
-- TDSI-76/1111: el codigo es unico, con formato DEV-NNNNNN y no se puede editar
-- --------------------------------------------------------------------------
-- Unico: la columna ya se creo con UNIQUE; el bloque DO la asegura si la
-- tabla vino de una version sin esa restriccion. Formato: CHECK. No editable:
-- trigger BEFORE UPDATE que rechaza cualquier cambio del codigo (SQLSTATE
-- DV001, el microservicio lo responde como 409). Idempotente.
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'devoluciones.devoluciones'::regclass
       AND c.contype = 'u' AND a.attname = 'codigo' AND array_length(c.conkey, 1) = 1
  ) THEN
    ALTER TABLE devoluciones.devoluciones ADD CONSTRAINT devoluciones_codigo_key UNIQUE (codigo);
  END IF;
END;
$$;

ALTER TABLE devoluciones.devoluciones DROP CONSTRAINT IF EXISTS devoluciones_codigo_formato;
ALTER TABLE devoluciones.devoluciones ADD CONSTRAINT devoluciones_codigo_formato
  CHECK (codigo ~ '^DEV-[0-9]{6,}$');

CREATE OR REPLACE FUNCTION devoluciones.proteger_codigo_devolucion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION 'El codigo de la devolucion no se puede editar (%)', OLD.codigo
      USING ERRCODE = 'DV001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devoluciones_codigo_inmutable ON devoluciones.devoluciones;
CREATE TRIGGER trg_devoluciones_codigo_inmutable
  BEFORE UPDATE OF codigo ON devoluciones.devoluciones
  FOR EACH ROW EXECUTE FUNCTION devoluciones.proteger_codigo_devolucion();

-- ==========================================================================
-- TDSI-69/1097: configuracion de Devoluciones (clave -> valor)
-- --------------------------------------------------------------------------
-- plazo_dias_habiles: dias habiles (lunes a viernes) que tiene el cliente para
-- devolver una compra, contados desde la emision de la factura. Por defecto 7.
-- Para cambiarlo:
--   UPDATE devoluciones.configuracion SET valor = '10', actualizado_en = now(),
--          actualizado_por = '<quien>' WHERE clave = 'plazo_dias_habiles';
-- El CHECK solo acepta un entero de 1 a 60. Idempotente: si ya hay un valor,
-- no se pisa.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS devoluciones.configuracion (
    clave            VARCHAR(60)  PRIMARY KEY,
    valor            VARCHAR(200) NOT NULL,
    descripcion      VARCHAR(300),
    actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_por  VARCHAR(60)
);
ALTER TABLE devoluciones.configuracion ENABLE ROW LEVEL SECURITY;

ALTER TABLE devoluciones.configuracion DROP CONSTRAINT IF EXISTS configuracion_plazo_valido;
ALTER TABLE devoluciones.configuracion ADD CONSTRAINT configuracion_plazo_valido
  CHECK (clave <> 'plazo_dias_habiles' OR valor ~ '^([1-9]|[1-5][0-9]|60)$');

INSERT INTO devoluciones.configuracion (clave, valor, descripcion, actualizado_por)
VALUES ('plazo_dias_habiles', '7',
        'Dias habiles (lunes a viernes) para devolver una compra, desde la emision de la factura',
        'SISTEMA')
ON CONFLICT (clave) DO NOTHING;

-- ==========================================================================
-- TDSI-70/217: correcciones del esquema para el registro de devoluciones
-- --------------------------------------------------------------------------
-- Para las BD donde el script ya se corrio (en una nueva, el CREATE de arriba
-- ya trae todo esto). Idempotente.
-- - devolucion_items: item de la factura que se devuelve (para validar lo ya
--   devuelto), codigo de producto (Inventario, TDSI-77) y condicion
--   REINGRESO (vuelve al stock) o MERMA (se da de baja).
-- - metodo_pago_original de 20 a 60: un pago mixto "Efectivo + Tarjeta + QR"
--   no entraba.
-- - reembolsos: opcion VALE y la referencia que devuelve gestion_pagos.
-- - Acuerdo de equipo (un dato, un dueño): los vales, la reversion con
--   tarjeta y el correo del comprobante los hace gestion_pagos (TDSI-74, 75 y
--   79, contrato TDSI-1027). Devoluciones solo guarda la referencia
--   (reembolsos.referencia y devoluciones.envio_comprobante_id), asi que se
--   retiran vales_compra, envios_pasarela y envios_comprobante. Solo se
--   borran si estan vacias; si tienen filas se avisa y se dejan.
-- ==========================================================================
ALTER TABLE devoluciones.devolucion_items
  ADD COLUMN IF NOT EXISTS factura_item_id BIGINT,
  ADD COLUMN IF NOT EXISTS codigo_producto VARCHAR(60),
  ADD COLUMN IF NOT EXISTS condicion       VARCHAR(10) NOT NULL DEFAULT 'REINGRESO';
ALTER TABLE devoluciones.devolucion_items DROP CONSTRAINT IF EXISTS devolucion_items_condicion_check;
ALTER TABLE devoluciones.devolucion_items ADD CONSTRAINT devolucion_items_condicion_check
  CHECK (condicion IN ('REINGRESO','MERMA'));
CREATE INDEX IF NOT EXISTS idx_devolucion_items_factura_item ON devoluciones.devolucion_items (factura_item_id);

ALTER TABLE devoluciones.devoluciones ALTER COLUMN metodo_pago_original TYPE VARCHAR(60);
ALTER TABLE devoluciones.devoluciones ADD COLUMN IF NOT EXISTS envio_comprobante_id VARCHAR(60);

ALTER TABLE devoluciones.reembolsos ADD COLUMN IF NOT EXISTS referencia VARCHAR(60);
ALTER TABLE devoluciones.reembolsos DROP CONSTRAINT IF EXISTS reembolsos_tipo_check;
ALTER TABLE devoluciones.reembolsos ADD CONSTRAINT reembolsos_tipo_check
  CHECK (tipo IN ('EFECTIVO','REVERSION_TARJETA','REVERSION_QR','VALE'));

DO $$
DECLARE
  tabla TEXT;
  filas BIGINT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['envios_pasarela', 'vales_compra', 'envios_comprobante'] LOOP
    IF to_regclass('devoluciones.' || tabla) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM devoluciones.%I', tabla) INTO filas;
      IF filas = 0 THEN
        EXECUTE format('DROP TABLE devoluciones.%I', tabla);
      ELSE
        RAISE NOTICE 'devoluciones.% tiene % filas: no se borra (pasar los datos a gestion_pagos)', tabla, filas;
      END IF;
    END IF;
  END LOOP;
END;
$$;
