-- ==========================================================================
-- Script de base de datos: schema soporte
-- Proyecto: Taller de Sistemas de Informacion
-- Servicio: soporte (puerto 4007)
--
-- Cubre:
--   - Esquema soporte con la tabla de incidentes (TDSI-971, historia TDSI-63)
--
-- El script es idempotente: se puede ejecutar varias veces sin error.
-- Soporte NO guarda copias de facturas ni de transacciones: solo su
-- referencia (numero de factura o id_transaccion). Los datos se leen por
-- HTTP desde facturacion (4002) y gestion_pagos (4005).
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS soporte;

-- Numero correlativo legible del incidente (INC-000001, INC-000002, ...)
CREATE SEQUENCE IF NOT EXISTS soporte.incidentes_numero_seq START 1;

CREATE TABLE IF NOT EXISTS soporte.incidentes (
    id                BIGSERIAL PRIMARY KEY,
    numero            VARCHAR(20)  NOT NULL UNIQUE
                      DEFAULT ('INC-' || lpad(nextval('soporte.incidentes_numero_seq')::text, 6, '0')),
    tipo              VARCHAR(30)  NOT NULL
                      CHECK (tipo IN ('Facturacion','Pagos','Acceso','Error del sistema','Otro')),
    -- Referencia opcional a la factura o transaccion relacionada
    referencia_tipo   VARCHAR(20)
                      CHECK (referencia_tipo IN ('factura','transaccion')),
    referencia        VARCHAR(60),
    descripcion       TEXT         NOT NULL CHECK (length(trim(descripcion)) > 0),
    estado            VARCHAR(20)  NOT NULL DEFAULT 'Abierto'
                      CHECK (estado IN ('Abierto','En proceso','Pendiente','Resuelto','Cerrado','Escalado')),
    prioridad         VARCHAR(10)  NOT NULL DEFAULT 'Media'
                      CHECK (prioridad IN ('Baja','Media','Alta','Critica')),
    usuario_afectado  VARCHAR(100),
    registrado_por    VARCHAR(100) NOT NULL,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resuelto_en       TIMESTAMPTZ,
    cerrado_en        TIMESTAMPTZ,
    -- Si hay referencia, deben venir el tipo y el valor juntos
    CONSTRAINT ck_incidentes_referencia
        CHECK ((referencia_tipo IS NULL) = (referencia IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_incidentes_estado     ON soporte.incidentes (estado);
CREATE INDEX IF NOT EXISTS idx_incidentes_tipo       ON soporte.incidentes (tipo);
CREATE INDEX IF NOT EXISTS idx_incidentes_referencia ON soporte.incidentes (referencia_tipo, referencia);
CREATE INDEX IF NOT EXISTS idx_incidentes_creado_en  ON soporte.incidentes (creado_en DESC);

-- --------------------------------------------------------------------------
-- TDSI-209 (TDSI-66): el historial por usuario muestra la solución de cada
-- incidente. La registra TDSI-205 (TDSI-64) al marcarlo como Resuelto.
-- --------------------------------------------------------------------------
ALTER TABLE soporte.incidentes
    ADD COLUMN IF NOT EXISTS solucion                TEXT,
    ADD COLUMN IF NOT EXISTS solucion_registrada_por VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_incidentes_usuario_afectado
    ON soporte.incidentes (lower(usuario_afectado), creado_en DESC);

-- --------------------------------------------------------------------------
-- TDSI-64: historial de cambios de cada incidente (tipo, prioridad y estado),
-- con quién lo hizo y cuándo. Lo llenan TDSI-677, TDSI-680, TDSI-693 y TDSI-205.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soporte.incidentes_historial (
    id              BIGSERIAL PRIMARY KEY,
    incidente_id    BIGINT       NOT NULL REFERENCES soporte.incidentes (id),
    campo           VARCHAR(20)  NOT NULL CHECK (campo IN ('tipo','prioridad','estado')),
    valor_anterior  VARCHAR(30),
    valor_nuevo     VARCHAR(30)  NOT NULL,
    usuario         VARCHAR(100) NOT NULL,
    cambiado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incidentes_historial_incidente
    ON soporte.incidentes_historial (incidente_id, cambiado_en);

-- --------------------------------------------------------------------------
-- TDSI-968 (TDSI-64): comentarios de cada ticket, con autor y fecha.
-- No se pueden editar ni borrar: el trigger lo impide incluso desde SQL.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soporte.incidentes_comentarios (
    id            BIGSERIAL PRIMARY KEY,
    incidente_id  BIGINT       NOT NULL REFERENCES soporte.incidentes (id),
    autor         VARCHAR(100) NOT NULL,
    texto         TEXT         NOT NULL CHECK (length(trim(texto)) > 0),
    creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incidentes_comentarios_incidente
    ON soporte.incidentes_comentarios (incidente_id, creado_en);

CREATE OR REPLACE FUNCTION soporte.comentarios_no_se_modifican() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Los comentarios de un ticket no se pueden editar ni borrar';
END;
$$;

DROP TRIGGER IF EXISTS trg_comentarios_no_se_modifican ON soporte.incidentes_comentarios;
CREATE TRIGGER trg_comentarios_no_se_modifican
    BEFORE UPDATE OR DELETE ON soporte.incidentes_comentarios
    FOR EACH ROW EXECUTE FUNCTION soporte.comentarios_no_se_modifican();

-- --------------------------------------------------------------------------
-- TDSI-207 (TDSI-65): escalar un incidente al Administrador. El incidente
-- pasa a Escalado y guarda el motivo, quién lo escaló y cuándo.
-- --------------------------------------------------------------------------
ALTER TABLE soporte.incidentes
    ADD COLUMN IF NOT EXISTS motivo_escalamiento TEXT,
    ADD COLUMN IF NOT EXISTS escalado_por        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS escalado_en         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_incidentes_escalados
    ON soporte.incidentes (escalado_en) WHERE estado = 'Escalado';

-- TDSI-1092 (TDSI-65): el historial guarda también el motivo del cambio
-- (por ejemplo, por qué se escaló el incidente).
ALTER TABLE soporte.incidentes_historial
    ADD COLUMN IF NOT EXISTS detalle TEXT;
