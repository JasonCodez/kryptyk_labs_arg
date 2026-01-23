// test-mysql.js
// Simple MySQL connectivity test using mysql2/promise

const mysql = require('mysql2/promise');

(async () => {
  const {
    DB_HOST = 'db5019454707.hosting-data.io',
    DB_PORT = 3306,
    DB_USER = 'dbu1581612',
    DB_PASS = 'Arm4469nine2686tee!',
    DB_NAME = 'dbs15222973',
    DB_SSL = 'false', // set to 'true' if TLS required
  } = process.env;

  const config = {
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
  };

  if (DB_SSL === 'true') {
    // for testing only: accept invalid certs if necessary
    config.ssl = { rejectUnauthorized: false };
  }

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.execute('SELECT 1 AS ok');
    console.log(JSON.stringify({ ok: true, rows }, null, 2));
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('connection error:');
    console.error(err);
    process.exit(1);
  }
})();
