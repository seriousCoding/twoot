require('dotenv').config({ path: '../.env' });
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: false
  },
  pool: { min: 2, max: 10 }
});

module.exports = db; 