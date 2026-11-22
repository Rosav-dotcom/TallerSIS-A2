require("dotenv").config();
const { Pool } = require("pg");

// Misma base de datos (Supabase) que los demas microservicios; las tablas de este
// servicio viven en el esquema "devoluciones" (sql/script_devoluciones.sql).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => console.error("Error inesperado en PostgreSQL:", err));

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
