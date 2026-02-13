import test from "node:test";
import assert from "node:assert/strict";

import StorageService from "../src/storageService.js";

const creds = {
  baseUrl: "https://api.example.com",
  projectCode: "project_123",
  projectToken: "token_123",
};

test("delete forwards URL as query param", async () => {
  const calls = [];
  const api = {
    async delete(payload) {
      calls.push(payload);
      return { ok: true, status: 200, data: {} };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.delete({ url: "https://cdn.example.com/a.png" });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    url: "https://api.example.com/projects/project_123/storage/delete",
    config: { params: { url: "https://cdn.example.com/a.png" } },
  });
});

test("upload returns thenable and emits progress", async () => {
  const file = { name: "a.txt", size: 10, type: "text/plain" };
  const progressEvents = [];

  const socket = {
    uploadFiles({ files, options, cb }) {
      assert.equal(files.length, 1);
      assert.equal(files[0].name, "a.txt");
      assert.equal(options.bucketId, "bucket_1");

      queueMicrotask(() => {
        cb([
          {
            file,
            progress: 100,
            status: "completed",
            url: "https://cdn.example.com/a.txt",
          },
        ]);
      });

      return () => {};
    },
  };

  const api = {};
  const storage = new StorageService({ creds, api, socket });

  const upload = storage.upload({
    files: file,
    options: { bucketId: "bucket_1" },
  });

  upload.onProgress((uploads) => progressEvents.push(uploads));
  const urls = await upload;

  assert.deepEqual(urls, ["https://cdn.example.com/a.txt"]);
  assert.equal(progressEvents.length, 1);
  assert.equal(progressEvents[0][0].status, "completed");
});
