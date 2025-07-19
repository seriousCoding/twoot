require('dotenv').config({ path: '../.env' });
const knex = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});
const bcrypt = require('bcryptjs');

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }
  const existing = await knex('users').where({ email }).first();
  if (existing) {
    console.log('Admin user already exists.');
    process.exit(0);
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await knex('users').insert({ username, email, password_hash: hashedPassword });
  console.log('Admin user created.');
  process.exit(0);
}

seed(); 