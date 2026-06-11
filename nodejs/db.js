const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '../config/.env') });

const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'BeltelecomShop',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

module.exports = { sql, config };
