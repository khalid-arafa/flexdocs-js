import test from "node:test";
import assert from "node:assert/strict";

import DbService from "../src/dbService.js";

const creds = {
  baseUrl: "https://api.example.com",
  projectCode: "project_123",
  projectToken: "token_123",
};

test("collection query chain sends expected filter payload", async () => {
  const postCalls = [];
  const api = {
    async post(payload) {
      postCalls.push(payload);
      return { ok: true, status: 200, data: [{ id: 1 }] };
    },
  };
  const socket = { watchCol: () => () => {} };

  const db = new DbService({ creds, api, socket });
  const result = await db
    .col("users")
    .where("age", { isGreaterThanOrEqualTo: 18 })
    .sort({ createdAt: -1 })
    .select({ name: 1, age: 1 })
    .limit(10)
    .skip(5)
    .get();

  assert.deepEqual(result, [{ id: 1 }]);
  assert.equal(postCalls.length, 1);
  assert.equal(postCalls[0].url, "https://api.example.com/projects/project_123/db/users");
  assert.deepEqual(postCalls[0].data, {
    sort: { createdAt: -1 },
    select: { name: 1, age: 1 },
    query: { age: { $gte: 18 } },
    limit: 10,
    skip: 5,
  });
});

test("document update sends expected payload", async () => {
  const putCalls = [];
  const api = {
    async put(payload) {
      putCalls.push(payload);
      return { ok: true, status: 200, data: {} };
    },
  };
  const socket = { watchDoc: () => () => {} };

  const db = new DbService({ creds, api, socket });
  const ok = await db.doc("users/user_1").update({ name: "Updated" });

  assert.equal(ok, true);
  assert.equal(putCalls.length, 1);
  assert.deepEqual(putCalls[0], {
    url: "https://api.example.com/projects/project_123/db/users/user_1",
    data: { data: { name: "Updated" }, type: "update" },
  });
});

test("collection watch performs initial fetch and subscribes", async () => {
  const changes = [];
  const unsub = () => {};
  const socket = {
    watchCol(path, cb) {
      changes.push({ watchPath: path, hasCb: typeof cb === "function" });
      return unsub;
    },
  };
  const api = {
    async post() {
      return { ok: true, status: 200, data: [{ id: "u1" }] };
    },
  };

  const db = new DbService({ creds, api, socket });
  const returnedUnsub = db.col("users").watch((evt) => changes.push(evt));

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(returnedUnsub, unsub);
  assert.equal(changes[0].watchPath, "users");
  assert.equal(changes[1].add[0].id, "u1");
});
