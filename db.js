// this module create a global database object to be used within the API 
const promise = require('bluebird');
const initOptions = {/* initialization option */};
const pgp = require('pg-promise')(initOptions);

const cn = {
    host : 'localhost',
    port : '5432',
    database : 'fyp',
    user : 'postgres',
    password : '1234',
    promiseLib : promise,
    max : 30
};

const db = pgp(cn);

module.exports = db