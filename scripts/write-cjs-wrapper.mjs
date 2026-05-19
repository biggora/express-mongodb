import {mkdir, writeFile} from "node:fs/promises";

await mkdir(new URL("../dist/cjs/", import.meta.url), {recursive: true});

await writeFile(
    new URL("../dist/cjs/package.json", import.meta.url),
    JSON.stringify({type: "commonjs"}, null, 2) + "\n"
);

await writeFile(
    new URL("../dist/cjs/index.cjs", import.meta.url),
    `'use strict';

const api = require('./index.js');

function legacyFactory() {
  return api.MongooseSessionStore;
}

legacyFactory.default = api.MongoSessionStore;
legacyFactory.MongoSessionStore = api.MongoSessionStore;
legacyFactory.MongooseSessionStore = api.MongooseSessionStore;
legacyFactory.createMongoSessionStore = api.createMongoSessionStore;
legacyFactory.createMongooseSessionStore = api.createMongooseSessionStore;

module.exports = legacyFactory;
`,
    "utf8"
);
