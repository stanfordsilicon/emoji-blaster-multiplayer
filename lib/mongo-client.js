"use strict";

const { MongoClient } = require("mongodb");

let dbPromise = null;

// Single shared connection for the whole process (reused across warm
// invocations) -- mirrors qmoji-2's server/data/mongoClient.js. client.db()
// with no argument silently falls back to a database literally named
// "test" whenever the connection string has no database segment in its
// path (Atlas's own copy-paste string looks exactly like this), so an
// explicit name is always passed instead.
function getMongoDb() {
  if (!dbPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    const dbName = process.env.MONGODB_DB_NAME || "blaster";
    const client = new MongoClient(uri);
    dbPromise = client.connect().then((c) => c.db(dbName));
  }
  return dbPromise;
}

module.exports = { getMongoDb };
