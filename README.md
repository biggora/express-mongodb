[![npm version](https://img.shields.io/npm/v/express-mongodb.svg)](https://www.npmjs.com/package/express-mongodb)
[![CI](https://img.shields.io/github/actions/workflow/status/biggora/express-mongodb/ci.yml?branch=master)](https://github.com/biggora/express-mongodb/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# express-mongodb

MongoDB-backed session stores for [express-session](https://www.npmjs.com/package/express-session).

This package is a modern rewrite of the original Express 2/Mongoose store. It now targets Node.js `>=22`, Express 5, `express-session`, and current MongoDB tooling.

## Installation

```sh
npm install express-mongodb express-session mongodb
```

For the Mongoose adapter, install Mongoose as well:

```sh
npm install mongoose
```

## Native MongoDB Usage

```js
import express from "express";
import session from "express-session";
import { MongoClient } from "mongodb";
import { MongoSessionStore } from "express-mongodb";

const app = express();
const client = new MongoClient("mongodb://localhost:27017/test");
await client.connect();

app.use(session({
    secret: "replace-this-secret",
    resave: false,
    saveUninitialized: false,
    store: new MongoSessionStore({
        client,
        dbName: "test",
        collectionName: "session"
    })
}));

app.get("/", (req, res) => {
    req.session.views = (req.session.views || 0) + 1;
    res.json({ views: req.session.views });
});

app.listen(3000);
```

You can also pass a `Db` instance:

```js
new MongoSessionStore({
    db: client.db("test"),
    collectionName: "session"
});
```

## Mongoose Usage

```js
import express from "express";
import session from "express-session";
import mongoose from "mongoose";
import { MongooseSessionStore } from "express-mongodb";

const app = express();
const connection = await mongoose.createConnection("mongodb://localhost:27017/test").asPromise();

app.use(session({
    secret: "replace-this-secret",
    resave: false,
    saveUninitialized: false,
    store: new MongooseSessionStore({
        connection,
        collectionName: "session"
    })
}));
```

The Mongoose adapter uses `connection.collection(collectionName)` directly. It does not create a Mongoose model and does not close the supplied connection.

## CommonJS Compatibility

Named exports are available through `require`:

```js
const {
    MongoSessionStore,
    MongooseSessionStore,
    createMongoSessionStore,
    createMongooseSessionStore
} = require("express-mongodb");
```

The old callable factory is kept only as a deprecated migration aid:

```js
const legacyFactory = require("express-mongodb");
const MongooseStore = legacyFactory(express);
```

The `express` argument is ignored. New code should use `MongoSessionStore` or `MongooseSessionStore` directly with `express-session`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `collectionName` | `session` | MongoDB collection used for session documents. |
| `collection` | `undefined` | Deprecated alias for `collectionName`. |
| `ttlSeconds` | `1209600` | Fallback expiration when `session.cookie.expires` is absent. |
| `autoCreateTtlIndex` | `true` | Creates `{ expiresAt: 1 }` with `{ expireAfterSeconds: 0 }`. |
| `clearIntervalSeconds` | `0` | Deprecated compatibility cleanup interval for expired documents. |
| `clear_interval` | `undefined` | Deprecated alias for `clearIntervalSeconds`. |

The default collection name is `session`.

Store methods use Node-style callbacks. Operation errors are reported through those callbacks, so provide callbacks when you need to observe failures.

## Expiration Behavior

Session documents are stored as:

```js
{
    _id: sid,
    session,
    expiresAt,
    updatedAt
}
```

`expiresAt` is calculated from `session.cookie.expires` when it is a valid date. Otherwise, the store uses `ttlSeconds`. `get`, `all`, and `length` ignore expired sessions; `get` also deletes an expired document opportunistically.

MongoDB TTL cleanup is the primary expiration mechanism. `clearIntervalSeconds` and `clear_interval` exist for compatibility and should not be needed in new applications.

## Manual Smoke Test

Start MongoDB locally at `mongodb://localhost:27017/test`, build the package, and run the smoke app:

```sh
npm run build
node demo/store.js
```

Open `http://localhost:3000`. The app writes sessions to the `mysession` collection and returns the current session counter plus stored session count.

## License

MIT
