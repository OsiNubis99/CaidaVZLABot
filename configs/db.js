// const fs = require("fs");
// class database {
//   constructor() {
//     this.path = "./public/data.json";
//   }

//   read() {
//     return require("." + this.path);
//   }

//   write(data) {
//     fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
//   }
// }

// let bd = new database();

// module.exports = bd;

const { Client } = require("pg");
console.log(process.env.HEROKU_POSTGRESQL_DBNAME_URL);
const client = new Client({
  connectionString:
    "postgres://hclwhudubymjmu:8702c2e92d246aa31a82ee0c09851dddaaab49e11bf38235a30824cdfef46676@ec2-18-211-48-247.compute-1.amazonaws.com:5432/d5lbe4duabiv9b",
  ssl: { rejectUnauthorized: false },
});

client.connect();
