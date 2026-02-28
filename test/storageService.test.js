import test from "node:test";
import assert from "node:assert/strict";

import StorageService from "../src/storageService.js";

const creds = {
  baseUrl: "https://api.example.com",
  projectCode: "project_123",
  projectToken: "token_123",
};

test("deleteFile sends file ID in URL", async () => {
  const calls = [];
  const api = {
    async delete(payload) {
      calls.push(payload);
      return { ok: true, status: 200, data: {} };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.deleteFile({ fileId: "abc123def456" });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    url: "https://api.example.com/projects/project_123/storage/files/abc123def456",
  });
});

test("getBucketContent sends correct URL and query params", async () => {
  const calls = [];
  const api = {
    async get(payload) {
      calls.push(payload);
      return {
        ok: true,
        status: 200,
        data: { totalCount: 5, content: [{ name: "photo", type: "file" }] },
      };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.getBucketContent({
    bucketId: "home",
    page: 1,
    ipp: 10,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/projects/project_123/storage/buckets/home/content"
  );
  assert.deepEqual(calls[0].config, { params: { page: 1, ipp: 10 } });
  assert.equal(result.totalCount, 5);
});

test("search sends search term and optional params", async () => {
  const calls = [];
  const api = {
    async post(payload) {
      calls.push(payload);
      return {
        ok: true,
        status: 200,
        data: { totalCount: 1, content: [{ name: "image", type: "file" }] },
      };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.search({
    searchTerm: "photo",
    bucketId: "bucket1",
    page: 1,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/projects/project_123/storage/search"
  );
  assert.deepEqual(calls[0].data, {
    searchTerm: "photo",
    bucketId: "bucket1",
    page: 1,
  });
  assert.equal(result.totalCount, 1);
});

test("createBucket sends name and optional fields", async () => {
  const calls = [];
  const api = {
    async post(payload) {
      calls.push(payload);
      return {
        ok: true,
        status: 200,
        data: {
          _id: "b1",
          name: "avatars",
          type: "bucket",
          description: "User avatars",
          parentId: null,
        },
      };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.createBucket({
    name: "avatars",
    description: "User avatars",
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/projects/project_123/storage/buckets"
  );
  assert.deepEqual(calls[0].data, {
    name: "avatars",
    description: "User avatars",
  });
  assert.equal(result.name, "avatars");
});

test("updateBucket sends bucket ID and update fields", async () => {
  const calls = [];
  const api = {
    async put(payload) {
      calls.push(payload);
      return {
        ok: true,
        status: 200,
        data: { message: "Bucket was updated successfully" },
      };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.updateBucket({
    bucketId: "b1",
    name: "new-name",
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/projects/project_123/storage/buckets/b1"
  );
  assert.deepEqual(calls[0].data, { name: "new-name" });
  assert.equal(result.message, "Bucket was updated successfully");
});

test("deleteBucket sends bucket ID", async () => {
  const calls = [];
  const api = {
    async delete(payload) {
      calls.push(payload);
      return { ok: true, status: 200, data: {} };
    },
  };
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const result = await storage.deleteBucket({ bucketId: "b1" });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://api.example.com/projects/project_123/storage/buckets/b1"
  );
});

test("getFileUrl constructs correct URL", () => {
  const api = {};
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const url = storage.getFileUrl({
    fileId: "f1",
    filename: "photo.jpg",
    size: "small",
    token: "jwt123",
  });

  assert.equal(
    url,
    "https://api.example.com/projects/project_123/storage/f1/photo.jpg?size=small&token=jwt123"
  );
});

test("getFileUrl works without optional params", () => {
  const api = {};
  const socket = {};
  const storage = new StorageService({ creds, api, socket });

  const url = storage.getFileUrl({
    fileId: "f1",
    filename: "doc.pdf",
  });

  assert.equal(
    url,
    "https://api.example.com/projects/project_123/storage/f1/doc.pdf"
  );
});

test("upload returns thenable and emits progress", async () => {
  const file = { name: "a.txt", size: 10, type: "text/plain", lastModified: 1000 };
  const progressEvents = [];

  const socket = {
    uploadFile(f, options, onProgress) {
      assert.equal(f.name, "a.txt");
      assert.equal(options.bucketId, "bucket_1");

      queueMicrotask(() => {
        onProgress({
          key: "a.txt_10_1000",
          name: f.name,
          size: f.size,
          status: "complete",
          progress: 100,
          error: null,
          url: "https://cdn.example.com/a.txt",
        });
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
  assert.ok(progressEvents.length >= 1);
});
