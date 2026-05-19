import express from "express";
import session from "express-session";
import { MongoClient } from "mongodb";
import { MongoSessionStore } from "../dist/esm/index.js";

var app = express();
var url = "mongodb://localhost:27017/test";
var options = {
    collectionName: "mysession",
    clearIntervalSeconds: 60
};

async function main() {
    var client = new MongoClient(url);
    await client.connect();

    app.use(session({
        cookie: {
            maxAge: 60000
        },
        secret: "Wild Express-MongoDB",
        resave: false,
        saveUninitialized: true,
        store: new MongoSessionStore({
            client: client,
            dbName: "test",
            collectionName: options.collectionName,
            clearIntervalSeconds: options.clearIntervalSeconds
        })
    }));

    app.get("/", async function(req, res, next) {
        try {
            req.session.views = (req.session.views || 0) + 1;

            var sessions = await client
                .db("test")
                .collection(options.collectionName)
                .find({})
                .toArray();

            res.json({
                views: req.session.views,
                sessions: sessions
            });
        } catch (err) {
            next(err);
        }
    });

    app.listen(3000, function() {
        console.log("express-mongodb smoke app listening on http://localhost:3000");
    });
}

main().catch(function(err) {
    console.error(err);
    process.exitCode = 1;
});
