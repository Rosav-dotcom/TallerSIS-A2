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
