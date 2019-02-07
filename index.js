const express = require('express');
const axios = require('axios');
const _ = require('lodash');
let path = require('path');
const log = require('./log')(module);
const config = require('./config')(module);
const pgp = require("pg-promise")({
    query(e) {
        console.log(' =======> Выполнен запрос:');
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

app.get('/', async function (req, res) {
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
        const moviesInfo = dataToSend.map(async movieItem =>
            axios.get(`https://api.themoviedb.org/3/find/${movieItem.tconst}?api_key=${config.tmdbKey}&external_source=imdb_id`))
        Promise.all(moviesInfo).then((completed) => {
            const placeholder = `http://${req.headers.host}/noimg.png`
            const mutatedData = dataToSend
            _.each(mutatedData, (dataItem, index) => {
                const posterPath = _.get(completed[index], 'data.movie_results[0].poster_path', _.noop())
                mutatedData[index].cover = posterPath
                    ? `https://image.tmdb.org/t/p/w300${posterPath}`
                    : placeholder
            })
            res.send(mutatedData)
        })
    } catch(err) {
        console.log("ERROR:", error);
        res.send(error);
    }
});

app.listen(3000, function () {
    console.log('App listening on port 3000');
});