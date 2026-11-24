CREATE SCHEMA IF NOT EXISTS devoluciones;

-- TDSI-71: catalogo de motivos predefinidos (los 4 de la historia se cargan en el bloque TDSI-71/219)
CREATE TABLE IF NOT EXISTS devoluciones.motivos (
    id      BIGSERIAL PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL UNIQUE,
    activo  BOOLEAN      NOT NULL DEFAULT true,
    orden   SMALLINT     NOT NULL DEFAULT 0      -- orden en el selector de la pantalla
);

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

-- ==========================================================================
-- TDSI-71/219: los 4 motivos de devolucion de la historia
-- --------------------------------------------------------------------------
-- El selector muestra solo estos 4 (PA TDSI-1011), en este orden. Los 4 de
-- ejemplo que traia la primera version del script se desactivan (no se
-- borran: una devolucion vieja podria apuntar a ellos). Un motivo agregado
-- a mano no se toca. Idempotente.
-- ==========================================================================
ALTER TABLE devoluciones.motivos ADD COLUMN IF NOT EXISTS orden SMALLINT NOT NULL DEFAULT 0;

INSERT INTO devoluciones.motivos (nombre, activo, orden) VALUES
    ('Producto vencido',   true, 1),
    ('Empaque dañado',     true, 2),
    ('Error de cobro',     true, 3),
    ('Cambio de producto', true, 4)
ON CONFLICT (nombre) DO UPDATE SET activo = true, orden = EXCLUDED.orden;

UPDATE devoluciones.motivos SET activo = false
 WHERE nombre IN ('Producto defectuoso', 'Producto equivocado', 'Cliente se arrepintio', 'Otro');

-- ==========================================================================
-- TDSI-72/221: reglas metodo de pago -> opciones de reembolso
-- --------------------------------------------------------------------------
-- Para cada metodo con que se pago la compra (facturacion.factura_metodos_pago:
-- Efectivo, Tarjeta o QR) dice que opcion de reembolso se permite y, si no,
-- por que (el texto que la pantalla muestra al pasar el mouse, PA TDSI-1015).
--   EFECTIVO           : se devuelve en caja.
--   REVERSION_TARJETA  : "Reversion electronica"; la hace gestion_pagos y solo
--                        revierte lo pagado con tarjeta (contrato TDSI-1027).
--   VALE               : vale de compra (gestion_pagos, TDSI-75).
-- En un pago mixto una opcion se habilita solo si TODOS los metodos de la
-- compra la permiten. Para cambiar una regla basta un UPDATE. Idempotente:
-- si una regla ya existe no se pisa.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS devoluciones.reglas_reembolso (
    metodo_pago  VARCHAR(20)  NOT NULL,
    opcion       VARCHAR(20)  NOT NULL CHECK (opcion IN ('EFECTIVO','REVERSION_TARJETA','VALE')),
    permitido    BOOLEAN      NOT NULL,
    explicacion  VARCHAR(200),
    CHECK (permitido OR explicacion IS NOT NULL),          -- una opcion bloqueada siempre dice por que
    PRIMARY KEY (metodo_pago, opcion)
);
ALTER TABLE devoluciones.reglas_reembolso ENABLE ROW LEVEL SECURITY;

INSERT INTO devoluciones.reglas_reembolso (metodo_pago, opcion, permitido, explicacion) VALUES
    ('Efectivo', 'EFECTIVO',          true,  NULL),
    ('Efectivo', 'REVERSION_TARJETA', false, 'La compra se pagó en efectivo: no hay un cobro con tarjeta que revertir.'),
    ('Efectivo', 'VALE',              true,  NULL),
    ('Tarjeta',  'EFECTIVO',          false, 'Lo pagado con tarjeta se devuelve a la misma tarjeta (reversión electrónica) o con un vale, no en efectivo.'),
    ('Tarjeta',  'REVERSION_TARJETA', true,  NULL),
    ('Tarjeta',  'VALE',              true,  NULL),
    ('QR',       'EFECTIVO',          true,  NULL),
    ('QR',       'REVERSION_TARJETA', false, 'Los pagos con QR no se pueden revertir en la pasarela: devuelva en efectivo o con un vale.'),
    ('QR',       'VALE',              true,  NULL)
ON CONFLICT (metodo_pago, opcion) DO NOTHING;

-- La opcion elegida al registrar la devolucion (TDSI-1106).
ALTER TABLE devoluciones.devoluciones ADD COLUMN IF NOT EXISTS opcion_reembolso VARCHAR(20);
ALTER TABLE devoluciones.devoluciones DROP CONSTRAINT IF EXISTS devoluciones_opcion_reembolso_check;
ALTER TABLE devoluciones.devoluciones ADD CONSTRAINT devoluciones_opcion_reembolso_check
  CHECK (opcion_reembolso IS NULL OR opcion_reembolso IN ('EFECTIVO','REVERSION_TARJETA','VALE'));

-- ==========================================================================
-- TDSI-81/1124: tabla de historial (estado anterior, estado nuevo, usuario, fecha)
-- --------------------------------------------------------------------------
-- devoluciones.historial_estados ya existia; aqui se completa:
-- - comentario: el detalle del cambio (p. ej. el motivo de un rechazo).
-- - estados validos (los mismos de devoluciones.estado).
-- - cambiado_en con clock_timestamp(): dos cambios en la misma transaccion
--   quedan con horas distintas y en orden.
-- - indice para leer la linea de tiempo de una devolucion en orden.
-- Idempotente.
-- ==========================================================================
ALTER TABLE devoluciones.historial_estados ADD COLUMN IF NOT EXISTS comentario VARCHAR(300);
ALTER TABLE devoluciones.historial_estados ALTER COLUMN cambiado_en SET DEFAULT clock_timestamp();

ALTER TABLE devoluciones.historial_estados DROP CONSTRAINT IF EXISTS historial_estados_estados_check;
ALTER TABLE devoluciones.historial_estados ADD CONSTRAINT historial_estados_estados_check CHECK (
  estado_nuevo IN ('PENDIENTE','APROBADA','RECHAZADA','PROCESADA')
  AND (estado_anterior IS NULL OR estado_anterior IN ('PENDIENTE','APROBADA','RECHAZADA','PROCESADA'))
);

CREATE INDEX IF NOT EXISTS idx_historial_estados_devolucion
    ON devoluciones.historial_estados (devolucion_id, cambiado_en, id);

-- ==========================================================================
-- TDSI-81/239: el historial no se puede editar ni borrar
-- --------------------------------------------------------------------------
-- devoluciones.historial_estados es de solo agregar (append-only):
-- - UPDATE: siempre se rechaza.
-- - DELETE: se rechaza. Unica excepcion: cuando se borra la devolucion
--   completa (ON DELETE CASCADE), su historial se va con ella. No hay ningun
--   endpoint que borre devoluciones; solo lo hacen las pruebas para limpiar.
-- - TRUNCATE: se rechaza.
-- El error es SQLSTATE DV002 (el microservicio lo responde como 409), venga
-- de la API, de otro servicio o del editor de Supabase. Idempotente.
-- ==========================================================================
CREATE OR REPLACE FUNCTION devoluciones.proteger_historial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM devoluciones.devoluciones d WHERE d.id = OLD.devolucion_id
  ) THEN
    RETURN OLD; -- la devolucion ya se borro: es el ON DELETE CASCADE
  END IF;
  RAISE EXCEPTION 'El historial de la devolucion no se puede editar ni borrar (%)', TG_OP
    USING ERRCODE = 'DV002';
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_inmutable ON devoluciones.historial_estados;
CREATE TRIGGER trg_historial_inmutable
  BEFORE UPDATE OR DELETE ON devoluciones.historial_estados
  FOR EACH ROW EXECUTE FUNCTION devoluciones.proteger_historial();

DROP TRIGGER IF EXISTS trg_historial_sin_truncate ON devoluciones.historial_estados;
CREATE TRIGGER trg_historial_sin_truncate
  BEFORE TRUNCATE ON devoluciones.historial_estados
  FOR EACH STATEMENT EXECUTE FUNCTION devoluciones.proteger_historial();

-- ==========================================================================
-- TDSI-81/1057: registrar cada cambio de estado
-- --------------------------------------------------------------------------
-- Lo hace la BD (trigger), asi ningun camino puede cambiar el estado sin
-- dejarlo en el historial:
-- - al registrar la devolucion: (sin estado anterior) -> PENDIENTE, por
--   creado_por, "Devolucion registrada".
-- - en cada UPDATE que cambie devoluciones.estado: anterior -> nuevo.
--   El usuario y el comentario los pone el microservicio en la misma
--   transaccion (set_config 'devoluciones.usuario' / 'devoluciones.comentario',
--   ver devolucionesRepo.cambiarEstado). Si el cambio se hace a mano (p. ej.
--   desde el editor de Supabase) queda igual, con el usuario de la BD. Un
--   rechazo sin comentario usa motivo_rechazo.
-- Las devoluciones que ya existian sin historial reciben su registro inicial.
-- Idempotente.
-- ==========================================================================
CREATE OR REPLACE FUNCTION devoluciones.registrar_cambio_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  usuario    TEXT := NULLIF(current_setting('devoluciones.usuario', true), '');
  comentario TEXT := NULLIF(current_setting('devoluciones.comentario', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO devoluciones.historial_estados (devolucion_id, estado_anterior, estado_nuevo, cambiado_por, comentario)
    VALUES (NEW.id, NULL, NEW.estado, COALESCE(NEW.creado_por, usuario, session_user), COALESCE(comentario, 'Devolución registrada'));
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO devoluciones.historial_estados (devolucion_id, estado_anterior, estado_nuevo, cambiado_por, comentario)
    VALUES (NEW.id, OLD.estado, NEW.estado, COALESCE(usuario, session_user),
            COALESCE(comentario, CASE WHEN NEW.estado = 'RECHAZADA' THEN NEW.motivo_rechazo END));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_devoluciones_historial ON devoluciones.devoluciones;
CREATE TRIGGER trg_devoluciones_historial
  AFTER INSERT OR UPDATE OF estado ON devoluciones.devoluciones
  FOR EACH ROW EXECUTE FUNCTION devoluciones.registrar_cambio_estado();

INSERT INTO devoluciones.historial_estados (devolucion_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en, comentario)
SELECT d.id, NULL, d.estado, COALESCE(d.creado_por, 'sistema'), d.fecha_solicitud, 'Devolución registrada'
  FROM devoluciones.devoluciones d
 WHERE NOT EXISTS (SELECT 1 FROM devoluciones.historial_estados h WHERE h.devolucion_id = d.id);

-- ==========================================================================
-- TDSI-78/1116: una devolucion RECHAZADA no genera reembolso, nota de
-- credito ni aviso a Inventario (PA TDSI-1050)
-- --------------------------------------------------------------------------
-- El microservicio ya no deja rechazar una devolucion procesada o con
-- reembolso / nota de credito emitidos; esto cubre el otro lado: ninguna
-- historia (TDSI-72/74, 73, 77) ni nadie desde la BD puede crearle un
-- reembolso, una nota de credito o un aviso a Inventario a una devolucion
-- RECHAZADA. Lee la devolucion con FOR SHARE: si en ese momento se la esta
-- rechazando, espera y ve el estado final. Error SQLSTATE DV003 (409 en el
-- microservicio). Idempotente.
-- ==========================================================================
CREATE OR REPLACE FUNCTION devoluciones.bloquear_si_rechazada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_estado  TEXT;
  v_codigo  TEXT;
BEGIN
  SELECT d.estado, d.codigo INTO v_estado, v_codigo
    FROM devoluciones.devoluciones d WHERE d.id = NEW.devolucion_id FOR SHARE;
  IF v_estado = 'RECHAZADA' THEN
    RAISE EXCEPTION 'La devolucion % esta RECHAZADA: no genera reembolso, nota de credito ni aviso a Inventario (%)',
      v_codigo, TG_TABLE_NAME USING ERRCODE = 'DV003';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reembolsos_no_rechazada ON devoluciones.reembolsos;
CREATE TRIGGER trg_reembolsos_no_rechazada
  BEFORE INSERT ON devoluciones.reembolsos
  FOR EACH ROW EXECUTE FUNCTION devoluciones.bloquear_si_rechazada();

DROP TRIGGER IF EXISTS trg_notas_credito_no_rechazada ON devoluciones.notas_credito;
CREATE TRIGGER trg_notas_credito_no_rechazada
  BEFORE INSERT ON devoluciones.notas_credito
  FOR EACH ROW EXECUTE FUNCTION devoluciones.bloquear_si_rechazada();

DROP TRIGGER IF EXISTS trg_notificaciones_inventario_no_rechazada ON devoluciones.notificaciones_inventario;
CREATE TRIGGER trg_notificaciones_inventario_no_rechazada
  BEFORE INSERT ON devoluciones.notificaciones_inventario
  FOR EACH ROW EXECUTE FUNCTION devoluciones.bloquear_si_rechazada();

-- ==========================================================================
-- TDSI-80/237: monto limite que exige autorizacion del supervisor
-- --------------------------------------------------------------------------
-- limite_autorizacion (Bs): una devolucion de MAS de este monto necesita el
-- usuario y PIN de un supervisor para registrarse. Por defecto 500. Para
-- cambiarlo:
--   UPDATE devoluciones.configuracion SET valor = '800', actualizado_en = now(),
--          actualizado_por = '<quien>' WHERE clave = 'limite_autorizacion';
-- El CHECK solo acepta un monto mayor a 0 con hasta 2 decimales. Idempotente:
-- si ya hay un valor no se pisa.
-- ==========================================================================
ALTER TABLE devoluciones.configuracion DROP CONSTRAINT IF EXISTS configuracion_limite_valido;
ALTER TABLE devoluciones.configuracion ADD CONSTRAINT configuracion_limite_valido CHECK (
  clave <> 'limite_autorizacion'
  OR (valor ~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' AND valor !~ '^0+(\.0+)?$')
);

INSERT INTO devoluciones.configuracion (clave, valor, descripcion, actualizado_por)
VALUES ('limite_autorizacion', '500',
        'Monto (Bs) desde el cual una devolucion necesita la autorizacion de un supervisor (usuario y PIN)',
        'SISTEMA')
ON CONFLICT (clave) DO NOTHING;

-- ==========================================================================
-- TDSI-80/1085: quien autorizo una devolucion sobre el limite
-- --------------------------------------------------------------------------
-- autorizado_por (ya existia) guarda el usuario del supervisor (supervisor_id
-- de facturacion), autorizado_por_nombre su nombre para mostrarlo en el
-- detalle y autorizado_en la hora. El registro en el historial dice tambien
-- que supervisor la autorizo. Idempotente.
-- ==========================================================================
ALTER TABLE devoluciones.devoluciones ADD COLUMN IF NOT EXISTS autorizado_por_nombre VARCHAR(150);

CREATE OR REPLACE FUNCTION devoluciones.registrar_cambio_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  usuario    TEXT := NULLIF(current_setting('devoluciones.usuario', true), '');
  comentario TEXT := NULLIF(current_setting('devoluciones.comentario', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO devoluciones.historial_estados (devolucion_id, estado_anterior, estado_nuevo, cambiado_por, comentario)
    VALUES (NEW.id, NULL, NEW.estado, COALESCE(NEW.creado_por, usuario, session_user), COALESCE(comentario,
      'Devolución registrada' || CASE WHEN NEW.autorizado_por IS NOT NULL
        THEN ' · autorizada por el supervisor ' || COALESCE(NEW.autorizado_por_nombre, NEW.autorizado_por)
             || ' (' || NEW.autorizado_por || ')'
        ELSE '' END));
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO devoluciones.historial_estados (devolucion_id, estado_anterior, estado_nuevo, cambiado_por, comentario)
    VALUES (NEW.id, OLD.estado, NEW.estado, COALESCE(usuario, session_user),
            COALESCE(comentario, CASE WHEN NEW.estado = 'RECHAZADA' THEN NEW.motivo_rechazo END));
  END IF;
  RETURN NULL;
END;
$$;

-- ==========================================================================
-- TDSI-80/1069: caja donde se atendio la devolucion
-- --------------------------------------------------------------------------
-- caja_id es el codigo de la caja (caja.cajas.codigo de gestion_caja, p. ej.
-- CAJA-01) donde se atendio / pago la devolucion. Es opcional: sin caja la
-- devolucion se muestra como "Sin caja". gestion_caja lo lee por HTTP para
-- el resumen del dia por caja (no entra a este esquema). Idempotente.
-- ==========================================================================
ALTER TABLE devoluciones.devoluciones ADD COLUMN IF NOT EXISTS caja_id VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_devoluciones_fecha_caja ON devoluciones.devoluciones (fecha_solicitud, caja_id);

-- ==========================================================================
-- TDSI-77/231: aviso a Inventario (devolucion_stock)
-- --------------------------------------------------------------------------
-- devoluciones.notificaciones_inventario es la bandeja de salida (outbox) del
-- aviso: se guarda en la misma transaccion en que la devolucion pasa a
-- PROCESADA, y despues se publica en Pub/Sub. Si la publicacion falla, el
-- aviso no se pierde: queda Pendiente y lo reintenta el worker (TDSI-1039).
-- - Una devolucion tiene un solo aviso (UNIQUE): Inventario no recibe el
--   mismo aviso dos veces. "version" sube en cada "Reenviar" (TDSI-1041) y
--   forma el mensaje_id DEV-000123-<version> (clave de idempotencia).
-- - Estados: PENDIENTE -> ENVIADO -> CONFIRMADO / RECHAZADO, o ERROR.
-- Idempotente.
-- ==========================================================================
ALTER TABLE devoluciones.notificaciones_inventario
  ADD COLUMN IF NOT EXISTS version             INT          NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payload             JSONB,
  ADD COLUMN IF NOT EXISTS intentos            INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_intento_en   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_error        VARCHAR(400),
  ADD COLUMN IF NOT EXISTS proximo_intento_en  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pubsub_message_id   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resultado_motivo    VARCHAR(400),
  ADD COLUMN IF NOT EXISTS resultado_en        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now();

ALTER TABLE devoluciones.notificaciones_inventario DROP CONSTRAINT IF EXISTS notificaciones_inventario_estado_check;
ALTER TABLE devoluciones.notificaciones_inventario ADD CONSTRAINT notificaciones_inventario_estado_check
  CHECK (estado IN ('PENDIENTE','ENVIADO','CONFIRMADO','RECHAZADO','ERROR'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacion_inventario_devolucion
    ON devoluciones.notificaciones_inventario (devolucion_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_inventario_pendientes
    ON devoluciones.notificaciones_inventario (estado, proximo_intento_en);
