import express from "express";
import session from "express-session";
import { MongoClient } from "mongodb";
import { MongoSessionStore } from "../dist/esm/index.js";

const app = express();
const url = process.env.MONGODB_URI || "mongodb://localhost:27017/test";
const port = process.env.PORT || 3000;
const options = {
    collectionName: "mysession",
    clearIntervalSeconds: 60
};

async function main() {
    const client = new MongoClient(url, {
        serverSelectionTimeoutMS: 5000
    });
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

            const sessions = await client
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

    app.listen(port, function() {
        console.log("express-mongodb smoke app listening on http://localhost:" + port);
    });
}

main().catch(function(err) {
    console.error(err);
    console.error("Start MongoDB or set MONGODB_URI before running demo/store.js.");
    process.exitCode = 1;
});
