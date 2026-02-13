import test from "node:test";
import assert from "node:assert/strict";

import AuthService from "../src/authService.js";

const creds = {
  baseUrl: "https://api.example.com",
  projectCode: "project_123",
  projectToken: "token_123",
};

test("loginWithEmail sends expected payload and returns response", async () => {
  const calls = [];
  const api = {
    async post(payload) {
      calls.push(payload);
      return { ok: true, status: 200, data: { userId: "u1" } };
    },
  };

  const auth = new AuthService({ creds, api });
  const result = await auth.loginWithEmail({
    email: "user@example.com",
    password: "secret123",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    url: "https://api.example.com/projects/project_123/auth/login-with-email",
    data: { email: "user@example.com", password: "secret123" },
  });
});

test("registerWithEmail validates input before calling API", async () => {
  let called = false;
  const api = {
    async post() {
      called = true;
      return { ok: true, status: 200, data: {} };
    },
  };

  const auth = new AuthService({ creds, api });

  await assert.rejects(
    auth.registerWithEmail({
      name: "User",
      email: "bad-email",
      password: "secret123",
    }),
    /Registration failed: Invalid email format/
  );

  assert.equal(called, false);
});

test("getCurrentUser returns null on non-ok response", async () => {
  const api = {
    async get() {
      return { ok: false, status: 401, data: { message: "Unauthorized" } };
    },
  };

  const auth = new AuthService({ creds, api });
  const user = await auth.getCurrentUser();

  assert.equal(user, null);
});
