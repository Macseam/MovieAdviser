const config = require('./config.json');

function configParams(){
    const dbLink = `postgres://${config.keys.postgresql_login}:${config.keys.postgresql_password}@${config.db.host}:${config.db.port}/${config.db.prod_db}`;
    const tmdbKey = config.keys.tmdb_key;
    return {
        dbLink,
        tmdbKey
    }
}

module.exports = configParams;