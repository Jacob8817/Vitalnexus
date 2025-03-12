const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',        
  host: 'localhost',       
  database: 'vitalnexus',  
  password: 'postgres',
  port: 5432,             
});

pool.connect()
  .then(() => console.log('Connected to PostgreSQL successfully!'))
  .catch(err => console.error('Connection failed!', err));

module.exports = pool;
