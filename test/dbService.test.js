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

test("collection query with page sends page instead of skip", async () => {
  const postCalls = [];
  const api = {
    async post(payload) {
      postCalls.push(payload);
      return { ok: true, status: 200, data: [] };
    },
  };
  const socket = { watchCol: () => () => {} };

  const db = new DbService({ creds, api, socket });
  await db.col("users").page(2).limit(20).get();

  assert.equal(postCalls.length, 1);
  assert.equal(postCalls[0].data.page, 2);
  assert.equal(postCalls[0].data.skip, undefined);
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

test("document replace sends type replace", async () => {
  const putCalls = [];
  const api = {
    async put(payload) {
      putCalls.push(payload);
      return { ok: true, status: 200, data: {} };
    },
  };
  const socket = { watchDoc: () => () => {} };

  const db = new DbService({ creds, api, socket });
  const ok = await db.doc("users/user_1").replace({ name: "Full Replace" });

  assert.equal(ok, true);
  assert.equal(putCalls.length, 1);
  assert.deepEqual(putCalls[0].data, {
    data: { name: "Full Replace" },
    type: "replace",
  });
});

test("collections lists all collections", async () => {
  const postCalls = [];
  const api = {
    async post(payload) {
      postCalls.push(payload);
      return {
        ok: true,
        status: 201,
        data: {
          collections: [{ name: "users", documentsCount: 10 }],
          page: 1,
          ipp: 20,
          totalCount: 1,
        },
      };
    },
  };
  const socket = {};

  const db = new DbService({ creds, api, socket });
  const result = await db.collections({ page: 1, limit: 20 });

  assert.equal(postCalls.length, 1);
  assert.equal(
    postCalls[0].url,
    "https://api.example.com/projects/project_123/db/collections"
  );
  assert.deepEqual(postCalls[0].data, { page: 1, limit: 20 });
  assert.equal(result.collections[0].name, "users");
});

test("createCollection sends name", async () => {
  const postCalls = [];
  const api = {
    async post(payload) {
      postCalls.push(payload);
      return { ok: true, status: 201, data: { success: true } };
    },
  };
  const socket = {};

  const db = new DbService({ creds, api, socket });
  const result = await db.createCollection({ name: "posts" });

  assert.equal(postCalls.length, 1);
  assert.equal(
    postCalls[0].url,
    "https://api.example.com/projects/project_123/db/collections/new"
  );
  assert.deepEqual(postCalls[0].data, { name: "posts" });
  assert.equal(result.success, true);
});

test("renameCollection sends oldName and newName", async () => {
  const putCalls = [];
  const api = {
    async put(payload) {
      putCalls.push(payload);
      return { ok: true, status: 200, data: { success: true } };
    },
  };
  const socket = {};

  const db = new DbService({ creds, api, socket });
  const result = await db.renameCollection({ oldName: "posts", newName: "articles" });

  assert.equal(putCalls.length, 1);
  assert.equal(
    putCalls[0].url,
    "https://api.example.com/projects/project_123/db/collections/posts/rename"
  );
  assert.deepEqual(putCalls[0].data, { newName: "articles" });
  assert.equal(result.success, true);
});

test("renameCollection rejects empty oldName", async () => {
  const api = { async put() { return { ok: true, status: 200, data: {} }; } };
  const db = new DbService({ creds, api, socket: {} });

  await assert.rejects(
    db.renameCollection({ oldName: "", newName: "articles" }),
    /Old collection name must be a non-empty string/
  );
});

test("renameCollection rejects empty newName", async () => {
  const api = { async put() { return { ok: true, status: 200, data: {} }; } };
  const db = new DbService({ creds, api, socket: {} });

  await assert.rejects(
    db.renameCollection({ oldName: "posts", newName: "" }),
    /New collection name must be a non-empty string/
  );
});

test("renameCollection encodes special characters in oldName", async () => {
  const putCalls = [];
  const api = {
    async put(payload) {
      putCalls.push(payload);
      return { ok: true, status: 200, data: { success: true } };
    },
  };

  const db = new DbService({ creds, api, socket: {} });
  await db.renameCollection({ oldName: "my collection", newName: "my_collection" });

  assert.equal(putCalls.length, 1);
  assert.ok(putCalls[0].url.includes("my%20collection"));
});

test("renameCollection throws on server error", async () => {
  const api = {
    async put() {
      return { ok: false, status: 400, data: { message: "Collection with this name already exists" } };
    },
  };

  const db = new DbService({ creds, api, socket: {} });

  await assert.rejects(
    db.renameCollection({ oldName: "posts", newName: "users" }),
    /Collection with this name already exists/
  );
});

test("updateMany sends filter and newData", async () => {
  const putCalls = [];
  const api = {
    async put(payload) {
      putCalls.push(payload);
      return {
        ok: true,
        status: 200,
        data: { message: "Documents were updated successfully" },
      };
    },
  };
  const socket = { watchCol: () => () => {} };

  const db = new DbService({ creds, api, socket });
  const result = await db
    .col("posts")
    .updateMany({ filter: { status: "draft" }, newData: { status: "published" } });

  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].url, "https://api.example.com/projects/project_123/db/posts");
  assert.deepEqual(putCalls[0].data, {
    filter: { status: "draft" },
    newData: { status: "published" },
  });
  assert.equal(result.message, "Documents were updated successfully");
});

test("deleteMany sends filter", async () => {
  const deleteCalls = [];
  const api = {
    async delete(payload) {
      deleteCalls.push(payload);
      return {
        ok: true,
        status: 200,
        data: { message: "Documents were deleted successfully" },
      };
    },
  };
  const socket = { watchCol: () => () => {} };

  const db = new DbService({ creds, api, socket });
  const result = await db
    .col("posts")
    .deleteMany({ filter: { status: "archived" } });

  assert.equal(deleteCalls.length, 1);
  assert.equal(deleteCalls[0].url, "https://api.example.com/projects/project_123/db/posts");
  assert.deepEqual(deleteCalls[0].config, { data: { filter: { status: "archived" } } });
  assert.equal(result.message, "Documents were deleted successfully");
});

test("getFilters fetches field names", async () => {
  const getCalls = [];
  const api = {
    async get(payload) {
      getCalls.push(payload);
      return {
        ok: true,
        status: 200,
        data: { fields: ["_id", "title", "body", "createdAt"] },
      };
    },
  };
  const socket = { watchCol: () => () => {} };

  const db = new DbService({ creds, api, socket });
  const result = await db.col("posts").getFilters();

  assert.equal(getCalls.length, 1);
  assert.equal(
    getCalls[0].url,
    "https://api.example.com/projects/project_123/db/posts/filters"
  );
  assert.deepEqual(result.fields, ["_id", "title", "body", "createdAt"]);
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
