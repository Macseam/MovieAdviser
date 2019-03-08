const express = require('express');
const axios = require('axios');
const _ = require('lodash');
let path = require('path');
const log = require('./log')(module);
const config = require('./config')(module);
const pgp = require("pg-promise")({
    query(e) {
        console.log(` =======> Выполнен запрос в БД ${e.client.database} от пользователя ${e.client.user} (${Date.now()})`);
        console.log(e.query);
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
    const genre = _.get(req, 'query.genre', _.noop());
    const year = _.get(req, 'query.year', _.noop());
    const rating = _.get(req, 'query.rating', _.noop());
    let yearQuery = '> 0'
    let ratingQuery = '> 0'
    switch (year) {
        case 'old':
            yearQuery = '< 2017'
            break
        case 'new':
            yearQuery = '> 2016'
            break
    }
    switch (rating) {
        case 'low':
            ratingQuery = '< 6'
            break
        case 'high':
            ratingQuery = '> 5'
            break
    }
    try {
        const dataToSend = await
            db.any(
                `SELECT \
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
                CAST (title_ratings.average_rating AS FLOAT) ${ratingQuery} AND \
                ${genre ? "title_basics.genres LIKE '" + genre + "%' AND" : ""} \
                CAST (title_basics.start_year AS INTEGER) ${yearQuery} AND \
                title_akas.title IS NOT NULL \
                ORDER BY RANDOM() \
                ASC LIMIT 3`
            )
        res.send(dataToSend)
    } catch(err) {
        console.log("ERROR:", err);
        res.status(500).json({ error: 'Ошибка при выполнении запроса к БД' });
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
        res.status(500).json({ error: 'Ошибка при попытке получения ссылки на постер фильма' });
    }
});

const NODE_ENV = app.get('env');
const port = NODE_ENV !== 'development' ? 8080 : 3000;
console.log(process.env.NODE_ENV)
console.log(app.get('env'))

app.listen(port, function () {
    console.log(`App listening on port ${port}`);
});