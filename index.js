const express = require('express');
const axios = require('axios');
const _ = require('lodash');
let path = require('path');
const log = require('./log')(module);
const config = require('./config')(module);
const pgp = require("pg-promise")({
    query(e) {
        console.log(` =======> Выполнен запрос в БД ${e.client.database} от пользователя ${e.client.user} (${Date.now()})`);
    }
});
const app = express();
const db = pgp(config.dbLink);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/random', async function (req, res) {
    try {
        const dataToSend = await
            db.any(
                "SELECT \
                title_basics.tconst,\
                title_basics.primary_title,\
                title_akas.title,\
                title_basics.start_year,\
                title_basics.runtime_minutes,\
                title_basics.genres, \
                title_ratings.average_rating \
                FROM title_basics \
                LEFT JOIN title_akas \
                ON \
                (title_basics.tconst = title_akas.title_id) \
                LEFT JOIN title_ratings \
                ON \
                (title_basics.tconst = title_ratings.tconst) \
                WHERE \
                CAST (title_ratings.average_rating AS FLOAT) > 5 AND \
                CAST (title_basics.start_year AS INTEGER) > 2000 AND \
                title_akas.title IS NOT NULL \
                ORDER BY RANDOM() \
                ASC LIMIT 3"
            )
        res.send(dataToSend)
    } catch(err) {
        console.log("ERROR:", err);
        res.send(err);
    }
});

app.get('/cover', async function (req, res) {
    try {
        const movieId = _.get(req, 'query.movie_id', null);
        const placeholder = await axios({
            method: 'get',
            url: `http://${req.headers.host}/noimg.png`,
            responseType: 'arraybuffer'
        });
        const returnPlaceholder = () => {
            res.writeHead(200, {'Content-Type': 'image/jpeg'});
            res.end(placeholder.data, 'binary');
        }
        if (!movieId) {
            returnPlaceholder()
            return;
        }
        const tmdbLink = await axios({
            method: 'get',
            url: `https://api.themoviedb.org/3/find/${movieId}?api_key=${config.tmdbKey}&external_source=imdb_id`,
        })
        const posterPath = _.get(tmdbLink, 'data.movie_results[0].poster_path', _.noop())
        if (!posterPath) {
            returnPlaceholder()
            return;
        }
        const coverLink = await axios({
            method: 'get',
            url: `https://image.tmdb.org/t/p/w300${posterPath}`,
            responseType: 'arraybuffer'
        });
        res.writeHead(200, {'Content-Type': 'image/jpeg'});
        res.end(coverLink.data, 'binary');
    } catch(err) {
        console.log("ERROR:", err);
        res.send(err);
    }
});

const NODE_ENV = app.get('env') || 'production';
const port = NODE_ENV === 'production' ? 8080 : 3000;
console.log(NODE_ENV)

app.listen(port, function () {
    console.log(`App listening on port ${port}`);
});