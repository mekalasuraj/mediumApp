
const {Client} = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'mediumApp',
    password: '*****',
    port: 5432,
  })
client.connect(err => {
  if (err) {
    console.error('connection error', err.stack)
  } else {
    console.log(' database connected')
  }
})
module.exports = client;
