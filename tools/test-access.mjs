// Tests for the access code and cookie logic. Run with: node --test tools/
import { test } from "node:test";
import assert from "node:assert/strict";
import { issueCode, verifyCode, signCookie, readCookie, getCookie, dropClosesAt } from "../functions/_lib/access.mjs";

const SECRET = "test-secret-not-real-0123456789";
const DROP = "signal-drop-01";

test("a freshly issued code verifies and returns its reference", async () => {
  const code = await issueCode(SECRET, DROP, "0042");
  assert.match(code, /^BSS-0042-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
  assert.equal(await verifyCode(SECRET, DROP, code), "0042");
});

test("codes are forgiving about case, spaces and hyphens", async () => {
  const code = await issueCode(SECRET, DROP, "0007");
  assert.equal(await verifyCode(SECRET, DROP, code.toLowerCase().replace(/-/g, " ")), "0007");
});

test("a code cannot be changed by one character", async () => {
  const code = await issueCode(SECRET, DROP, "0042");
  const last = code.slice(-1);
  const flipped = code.slice(0, -1) + (last === "A" ? "B" : "A");
  assert.equal(await verifyCode(SECRET, DROP, flipped), null);
});

test("a changed buyer reference is rejected", async () => {
  const code = await issueCode(SECRET, DROP, "0042");
  assert.equal(await verifyCode(SECRET, DROP, code.replace("0042", "0043")), null);
});

test("a code for one drop does not work on another drop", async () => {
  const code = await issueCode(SECRET, DROP, "0042");
  assert.equal(await verifyCode(SECRET, "other-drop", code), null);
});

test("a code made with a different secret is rejected", async () => {
  const code = await issueCode("some-other-secret", DROP, "0042");
  assert.equal(await verifyCode(SECRET, DROP, code), null);
});

test("garbage and empty input are rejected", async () => {
  for (const bad of ["", "SIGNAL07", "BSS-12", "hello", null, undefined]) {
    assert.equal(await verifyCode(SECRET, DROP, bad), null);
  }
});

test("issuing requires a 4-digit reference", async () => {
  await assert.rejects(issueCode(SECRET, DROP, "42"));
  await assert.rejects(issueCode(SECRET, DROP, "abcd"));
});

test("cookie round-trips while unexpired", async () => {
  const exp = Date.now() + 60_000;
  const cookie = await signCookie(SECRET, { drop: DROP, ref: "0042", exp });
  const payload = await readCookie(SECRET, cookie);
  assert.deepEqual(payload, { drop: DROP, ref: "0042", exp });
});

test("cookie is rejected once expired", async () => {
  const cookie = await signCookie(SECRET, { drop: DROP, ref: "0042", exp: Date.now() - 1 });
  assert.equal(await readCookie(SECRET, cookie), null);
});

test("cookie is rejected if its payload is edited", async () => {
  const exp = Date.now() + 60_000;
  const cookie = await signCookie(SECRET, { drop: DROP, ref: "0042", exp });
  const [body, mac] = cookie.split(".");
  const forged = Buffer.from(JSON.stringify({ drop: DROP, ref: "0042", exp: exp + 10_000_000 })).toString("base64url");
  assert.equal(await readCookie(SECRET, `${forged}.${mac}`), null);
  assert.ok(body);
});

test("cookie signed with another secret is rejected", async () => {
  const cookie = await signCookie("another-secret", { drop: DROP, ref: "0042", exp: Date.now() + 60_000 });
  assert.equal(await readCookie(SECRET, cookie), null);
});

test("getCookie finds the named cookie among others", () => {
  assert.equal(getCookie("a=1; bss_drop=xyz.abc; b=2", "bss_drop"), "xyz.abc");
  assert.equal(getCookie("a=1", "bss_drop"), null);
  assert.equal(getCookie(null, "bss_drop"), null);
});

test("drops close at midnight Ghana time (GMT)", () => {
  assert.equal(dropClosesAt("2027-08-15"), Date.parse("2027-08-15T00:00:00Z"));
});
