import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test, before, after, beforeEach } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import session from "express-session";

let server;
let client;
let mongooseConnection;

before(async () => {
  server = await MongoMemoryServer.create();
  client = new MongoClient(server.getUri());
  await client.connect();
  mongooseConnection = await mongoose.createConnection(server.getUri("mongoose-store")).asPromise();
});

after(async () => {
  await mongooseConnection.close();
  await client.close();
  await server.stop();
});

beforeEach(async () => {
  await client.db("native-store").dropDatabase();
  await client.db("native-store-db-option").dropDatabase();
  await mongooseConnection.dropDatabase();
});

function futureSession(value = "user-1") {
  return {
    cookie: { expires: new Date(Date.now() + 60_000), originalMaxAge: 60_000 },
    user: value
  };
}

function pastSession(value = "expired-user") {
  return {
    cookie: { expires: new Date(Date.now() - 60_000), originalMaxAge: -60_000 },
    user: value
  };
}

function callStore(store, method, ...args) {
  return new Promise((resolve, reject) => {
    store[method](...args, (error, value) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    });
  });
}

test("ESM exports provide both adapters and default native store", async () => {
  const api = await import("../dist/esm/index.js");

  assert.equal(api.default, api.MongoSessionStore);
  assert.equal(typeof api.MongoSessionStore, "function");
  assert.equal(typeof api.MongooseSessionStore, "function");
  assert.equal(typeof api.createMongoSessionStore, "function");
  assert.equal(typeof api.createMongooseSessionStore, "function");
});

test("CJS require is callable and exposes compatibility properties", () => {
  const require = createRequire(import.meta.url);
  const api = require("../dist/cjs/index.cjs");

  assert.equal(typeof api, "function");
  assert.equal(api(), api.MongooseSessionStore);
  assert.equal(api.default, api.MongoSessionStore);
  assert.equal(typeof api.MongoSessionStore, "function");
  assert.equal(typeof api.MongooseSessionStore, "function");
  assert.equal(typeof api.createMongoSessionStore, "function");
  assert.equal(typeof api.createMongooseSessionStore, "function");
});

test("native adapter supports client/dbName, default collection, callbacks, and TTL index", async () => {
  const { MongoSessionStore } = await import("../dist/esm/index.js");
  const store = new MongoSessionStore({ client, dbName: "native-store" });

  assert.ok(store instanceof session.Store);

  await callStore(store, "set", "sid-1", futureSession());
  const loaded = await callStore(store, "get", "sid-1");
  const length = await callStore(store, "length");
  const all = await callStore(store, "all");

  assert.equal(loaded.user, "user-1");
  assert.equal(length, 1);
  assert.deepEqual(Object.keys(all), ["sid-1"]);
  assert.equal(all["sid-1"].user, "user-1");

  const stored = await client.db("native-store").collection("session").findOne({ _id: "sid-1" });
  assert.equal(stored._id, "sid-1");
  assert.equal(stored.session.user, "user-1");
  assert.ok(stored.expiresAt instanceof Date);
  assert.ok(stored.updatedAt instanceof Date);

  const indexes = await client.db("native-store").collection("session").indexes();
  assert.ok(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
});

test("native adapter supports Db option and custom collectionName", async () => {
  const { createMongoSessionStore } = await import("../dist/esm/index.js");
  const db = client.db("native-store-db-option");
  const store = createMongoSessionStore({ db, collectionName: "mysession" });

  await callStore(store, "set", "sid-1", futureSession("db-option"));

  assert.equal(await db.collection("mysession").countDocuments(), 1);
  assert.equal(await db.collection("session").countDocuments(), 0);
});

test("mongoose adapter uses supplied connection and legacy collection alias", async () => {
  const { MongooseSessionStore } = await import("../dist/esm/index.js");
  const store = new MongooseSessionStore({ connection: mongooseConnection, collection: "legacy_alias" });

  assert.ok(store instanceof session.Store);

  await callStore(store, "set", "sid-1", futureSession("mongoose"));
  const loaded = await callStore(store, "get", "sid-1");

  assert.equal(loaded.user, "mongoose");
  assert.equal(await mongooseConnection.collection("legacy_alias").countDocuments(), 1);
});

test("stores do not close externally supplied MongoDB or Mongoose connections", async () => {
  const { MongoSessionStore, MongooseSessionStore } = await import("../dist/esm/index.js");
  const nativeStore = new MongoSessionStore({ client, dbName: "native-store" });
  const mongooseStore = new MongooseSessionStore({ connection: mongooseConnection });

  await callStore(nativeStore, "set", "native", futureSession("native-open"));
  await callStore(mongooseStore, "set", "mongoose", futureSession("mongoose-open"));

  assert.equal(await client.db("native-store").command({ ping: 1 }).then((result) => result.ok), 1);
  assert.equal(await mongooseConnection.db.command({ ping: 1 }).then((result) => result.ok), 1);
});

test("expired sessions are filtered, removed on get, and excluded from all and length", async () => {
  const { MongoSessionStore } = await import("../dist/esm/index.js");
  const store = new MongoSessionStore({ client, dbName: "native-store" });

  await callStore(store, "set", "expired", pastSession());
  await callStore(store, "set", "active", futureSession("active-user"));

  assert.equal(await callStore(store, "get", "expired"), null);
  assert.equal(await client.db("native-store").collection("session").countDocuments({ _id: "expired" }), 0);
  assert.equal(await callStore(store, "length"), 1);

  const all = await callStore(store, "all");
  assert.deepEqual(Object.keys(all), ["active"]);
  assert.equal(all.active.user, "active-user");
});

test("throwing success callbacks are not re-entered", async () => {
  const script = `
    import { MongoMemoryServer } from "mongodb-memory-server";
    import { MongoClient } from "mongodb";
    import { MongoSessionStore } from "./dist/esm/index.js";

    const server = await MongoMemoryServer.create();
    const client = new MongoClient(server.getUri());
    await client.connect();

    try {
      const store = new MongoSessionStore({ client, dbName: "callback-test" });
      const thrown = new Error("callback throw");
      let callbackCount = 0;
      const rejection = new Promise((resolve) => {
        process.once("unhandledRejection", (error) => resolve(error));
      });

      store.set("sid-throw", {
        cookie: { expires: new Date(Date.now() + 60_000), originalMaxAge: 60_000 },
        user: "throwing-callback"
      }, () => {
        callbackCount += 1;
        throw thrown;
      });

      const error = await rejection;

      if (error !== thrown) {
        throw new Error("unexpected rejection error");
      }

      if (callbackCount !== 1) {
        throw new Error("callback invoked " + callbackCount + " times");
      }
    } finally {
      await client.close();
      await server.stop();
    }
  `;

  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
});

test("TTL index rejection is reported by operation callback without construction-time unhandled rejection", async () => {
  const script = `
    import { MongoSessionStore } from "./dist/esm/index.js";

    const indexError = new Error("ttl index failed");
    let updateCalls = 0;
    let callbackCalls = 0;
    let unhandled = false;

    process.once("unhandledRejection", () => {
      unhandled = true;
    });

    const collection = {
      createIndex() {
        return Promise.reject(indexError);
      },
      updateOne() {
        updateCalls += 1;
        return Promise.resolve();
      }
    };

    const store = new MongoSessionStore({
      db: {
        collection() {
          return collection;
        }
      }
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    if (unhandled) {
      throw new Error("construction emitted unhandled rejection");
    }

    await new Promise((resolve, reject) => {
      store.set("sid-index-error", {
        cookie: { expires: new Date(Date.now() + 60_000), originalMaxAge: 60_000 },
        user: "index-error"
      }, (error) => {
        callbackCalls += 1;

        if (error !== indexError) {
          reject(new Error("callback did not receive TTL index error"));
          return;
        }

        resolve();
      });
    });

    if (callbackCalls !== 1) {
      throw new Error("callback invoked " + callbackCalls + " times");
    }

    if (updateCalls !== 0) {
      throw new Error("operation ran before TTL readiness");
    }
  `;

  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
});

test("TTL index creation is retried after a transient failure", async () => {
  const { MongoSessionStore } = await import("../dist/esm/index.js");
  const indexError = new Error("ttl index failed once");
  const writes = [];
  let createIndexCalls = 0;

  const collection = {
    createIndex() {
      createIndexCalls += 1;

      if (createIndexCalls === 1) {
        return Promise.reject(indexError);
      }

      return Promise.resolve("expiresAt_1");
    },
    updateOne(filter, update, options) {
      writes.push({ filter, update, options });
      return Promise.resolve();
    }
  };

  const store = new MongoSessionStore({
    db: {
      collection() {
        return collection;
      }
    }
  });

  await assert.rejects(
    () => callStore(store, "set", "sid-first", futureSession("first")),
    indexError
  );

  await callStore(store, "set", "sid-second", futureSession("second"));

  assert.equal(createIndexCalls, 2);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].filter._id, "sid-second");
  assert.equal(writes[0].update.$set.session.user, "second");
  assert.deepEqual(writes[0].options, { upsert: true });
});

test("touch updates expiration without replacing existing session payload", async () => {
  const { MongoSessionStore } = await import("../dist/esm/index.js");
  const store = new MongoSessionStore({ client, dbName: "native-store", ttlSeconds: 60 });

  await callStore(store, "set", "sid-touch", {
    cookie: { expires: new Date(Date.now() + 1_000), originalMaxAge: 1_000 },
    user: "kept"
  });

  await callStore(store, "touch", "sid-touch", {
    cookie: { expires: new Date(Date.now() + 120_000), originalMaxAge: 120_000 }
  });

  const loaded = await callStore(store, "get", "sid-touch");
  const stored = await client.db("native-store").collection("session").findOne({ _id: "sid-touch" });

  assert.equal(loaded.user, "kept");
  assert.ok(stored.expiresAt.getTime() > Date.now() + 60_000);
});

test("clear_interval alias enables internal expired-session cleanup", async () => {
  const { MongoSessionStore } = await import("../dist/esm/index.js");
  const store = new MongoSessionStore({
    client,
    dbName: "native-store",
    clear_interval: 60,
    autoCreateTtlIndex: false
  });

  await callStore(store, "set", "expired", pastSession());
  await callStore(store, "set", "active", futureSession("active"));

  const deletedCount = await store["_cleanupExpiredSessions"]();

  assert.equal(deletedCount, 1);
  assert.equal(await callStore(store, "length"), 1);
  store["stopCleanupTimer"]();
});

test("destroy and clear remove sessions through callbacks", async () => {
  const { MongoSessionStore } = await import("../dist/esm/index.js");
  const store = new MongoSessionStore({ client, dbName: "native-store" });

  await callStore(store, "set", "sid-1", futureSession("one"));
  await callStore(store, "set", "sid-2", futureSession("two"));
  await callStore(store, "destroy", "sid-1");

  assert.equal(await callStore(store, "length"), 1);

  await callStore(store, "clear");

  assert.equal(await callStore(store, "length"), 0);
});
