import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { collection, fields, type Collection } from "../src/index.js";
import { sample, type TestForge } from "../src/testing/index.js";
import { FileTypeSniffer } from "../src/upload/FileTypeSniffer.js";
import { authForge, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

const avatar = { paramField: "avatar", schemaField: "avatar", type: "image" as const };
const photos = { paramField: "photos", schemaField: "photos", type: "image" as const, multiple: true };

const profiles: Collection = collection({
  type: "crud",
  route: "profiles",
  model: "Profile",
  schema: { name: fields.requiredString, avatar: fields.optionalFileMetaData, photos: fields.optionalFileMetaData, owner: fields.userRef } as never,
  validations: { create: { name: z.string().min(1).optional() }, fileOp: {} },
  routes: [
    { method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create", files: [avatar] },
    { method: "get", path: "/:id", handler: "read", auth: "admin-or-owner" },
    { method: "patch", path: "/update/:id", handler: "update", auth: "admin-or-owner", validation: "create", files: [avatar] },
    { method: "delete", path: "/delete/:id", handler: "remove", auth: "admin-or-owner" },
    { method: "delete", path: "/delete-many", handler: "removeMultiple", auth: "admin-or-owner" },
    { method: "delete", path: "/delete-all", handler: "removeAll", auth: "admin-or-owner" },
    { method: "post", path: "/:id/addFile", handler: "addFile", auth: "admin-or-owner", files: [photos] },
    { method: "post", path: "/:id/setAvatar", handler: "addFile", auth: "admin-or-owner", files: [avatar] },
    { method: "patch", path: "/:id/updateFile", handler: "updateFile", auth: "admin-or-owner", files: [{ ...photos, multiple: false }] },
    { method: "delete", path: "/:id/deleteFile", handler: "deleteFile", auth: "admin-or-owner", files: [{ ...photos, multiple: false }] },
  ],
});

const boot = (options: Record<string, unknown> = {}) =>
  authForge({}, { collections: [profiles], cloudinaryAPIKey: "k", cloudinaryAPISecret: "s", cloudinaryCloudName: "c", ...options });

const form = (fields: Record<string, string>, files: Array<[string, Buffer, string, string?]> = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const [name, buffer, type, filename = "file.bin"] of files) f.append(name, new Blob([new Uint8Array(buffer)], { type }), filename);
  return f;
};

const asUser = async (email = "a@example.com") => {
  const client = t.newClient();
  await signup(client, email);
  return client;
};

describe("uploading on create", () => {
  it("stores the file and returns its metadata with an id", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, { form: form({ name: "Ada" }, [["avatar", sample.png(), "image/png", "me.png"]]) });

    expect(res.status).toBe(201);
    const [file] = res.body.data.avatar;
    expect(file._id).toMatch(/^[0-9a-f]{24}$/);
    expect(file.url).toMatch(/^https:\/\/files\.example\.test\//);
    expect(t.storage.files.has(file.storageKey)).toBe(true);
    expect(t.data.repository("Profile").dump()[0]!.avatar).toHaveLength(1);
  });

  it("works without a file when none is required", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, { form: form({ name: "Ada" }) });
    expect(res.status).toBe(201);
    expect(t.storage.files.size).toBe(0);
  });

  it("rejects content that is not really an image, even with an image Content-Type", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, { form: form({ name: "x" }, [["avatar", sample.fakeImage(), "image/png", "evil.png"]]) });
    expect(res.status).toBe(415);
    expect(res.body.code).toBe("UPLOAD_INVALID_TYPE");
    expect(t.storage.files.size).toBe(0);
    expect(t.data.repository("Profile").dump()).toHaveLength(0);
  });

  it("rejects a real file of the wrong kind (PDF sent as image)", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, { form: form({ name: "x" }, [["avatar", sample.pdf(), "image/png"]]) });
    expect(res.status).toBe(415);
  });

  it("rejects disallowed declared mime types", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, { form: form({ name: "x" }, [["avatar", sample.png(), "text/html"]]) });
    expect(res.status).toBe(415);
    expect(res.body.code).toBe("UPLOAD_INVALID_TYPE");
  });

  it("rejects files in an undeclared field with 400 UPLOAD_FIELD_NOT_FOUND", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, { form: form({ name: "x" }, [["resume", sample.png(), "image/png"]]) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UPLOAD_FIELD_NOT_FOUND");
  });

  it("rejects oversized files with 413 UPLOAD_TOO_LARGE", async () => {
    t = await boot({ uploadMaxFileSize: 100 });
    const a = await asUser();
    const big = Buffer.concat([sample.png(), Buffer.alloc(500)]);
    const res = await a.post("/profiles", undefined, { form: form({ name: "x" }, [["avatar", big, "image/png"]]) });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("UPLOAD_TOO_LARGE");
  });

  it("rejects two files in a single-file field", async () => {
    t = await boot();
    const a = await asUser();
    const res = await a.post("/profiles", undefined, {
      form: form({ name: "x" }, [["avatar", sample.png(), "image/png"], ["avatar", sample.png(), "image/png"]]),
    });
    expect(res.status).toBe(400);
  });

  it("removes the uploaded file when saving the document fails (no orphans)", async () => {
    t = await boot();
    const a = await asUser();
    // 'name' is required by the model but optional in validation, so the database rejects it.
    const res = await a.post("/profiles", undefined, { form: form({}, [["avatar", sample.png(), "image/png"]]) });
    expect(res.status).toBe(422);
    expect(t.storage.files.size).toBe(0);
    expect(t.storage.removed).toHaveLength(1);
  });

  it("returns 500 and saves nothing when storage is down", async () => {
    t = await boot();
    const a = await asUser();
    t.storage.failNext = true;
    const res = await a.post("/profiles", undefined, { form: form({ name: "x" }, [["avatar", sample.png(), "image/png"]]) });
    expect(res.status).toBe(500);
    expect(t.data.repository("Profile").dump()).toHaveLength(0);
  });
});

describe("addFile / updateFile / deleteFile", () => {
  const withProfile = async (email = "a@example.com") => {
    const owner = await asUser(email);
    const id = (await owner.post("/profiles", undefined, { form: form({ name: "P" }) })).body.data._id as string;
    return { owner, id };
  };

  it("adds files to an array field", async () => {
    t = await boot();
    const { owner, id } = await withProfile();
    const res = await owner.post(`/profiles/${id}/addFile`, undefined, { form: form({}, [["photos", sample.png(), "image/png"], ["photos", sample.jpeg(), "image/jpeg"]]) });
    expect(res.status).toBe(200);
    expect(res.body.data.photos).toHaveLength(2);
    expect(t.storage.files.size).toBe(2);
  });

  it("requires a file (400 UPLOAD_REQUIRED)", async () => {
    t = await boot();
    const { owner, id } = await withProfile();
    const res = await owner.post(`/profiles/${id}/addFile`, undefined, { form: form({}) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UPLOAD_REQUIRED");
  });

  it("replaces a file and deletes the old one from storage", async () => {
    t = await boot();
    const { owner, id } = await withProfile();
    const added = await owner.post(`/profiles/${id}/addFile`, undefined, { form: form({}, [["photos", sample.png(), "image/png"]]) });
    const old = added.body.data.photos[0];

    const res = await owner.patch(`/profiles/${id}/updateFile`, undefined, { form: form({ fileId: old._id }, [["photos", sample.jpeg(), "image/jpeg"]]) });
    expect(res.status).toBe(200);
    expect(res.body.data.photos).toHaveLength(1);
    expect(res.body.data.photos[0].storageKey).not.toBe(old.storageKey);
    expect(t.storage.files.has(old.storageKey)).toBe(false);
    expect(t.storage.removed).toContain(old.storageKey);
  });

  it("deletes a file from the document and from storage", async () => {
    t = await boot();
    const { owner, id } = await withProfile();
    const added = await owner.post(`/profiles/${id}/addFile`, undefined, { form: form({}, [["photos", sample.png(), "image/png"]]) });
    const file = added.body.data.photos[0];

    const res = await owner.delete(`/profiles/${id}/deleteFile`, { fileId: file._id });
    expect(res.status).toBe(200);
    expect(res.body.data.photos).toEqual([]);
    expect(t.storage.files.size).toBe(0);
  });

  it("returns 404 FILE_NOT_FOUND for an id that is not attached, 400 for a malformed one", async () => {
    t = await boot();
    const { owner, id } = await withProfile();
    const missing = await owner.delete(`/profiles/${id}/deleteFile`, { fileId: "c".repeat(24) });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("FILE_NOT_FOUND");
    expect((await owner.delete(`/profiles/${id}/deleteFile`, { fileId: "nope" })).status).toBe(400);
    expect((await owner.delete(`/profiles/${id}/deleteFile`, { fileId: { $ne: 1 } })).status).toBe(400);
  });

  it("will not touch another user's files", async () => {
    t = await boot();
    const { owner, id } = await withProfile("a@example.com");
    const added = await owner.post(`/profiles/${id}/addFile`, undefined, { form: form({}, [["photos", sample.png(), "image/png"]]) });
    const file = added.body.data.photos[0];

    const intruder = await asUser("b@example.com");
    const del = await intruder.delete(`/profiles/${id}/deleteFile`, { fileId: file._id });
    expect(del.status).toBe(403);
    const add = await intruder.post(`/profiles/${id}/addFile`, undefined, { form: form({}, [["photos", sample.png(), "image/png"]]) });
    expect(add.status).toBe(403);
    expect(t.storage.files.size).toBe(1);
    expect(t.storage.removed).toHaveLength(0);
  });

  it("refuses a second file in a single-slot field (409) without leaving it in storage", async () => {
    t = await boot();
    const owner = await asUser();
    const created = await owner.post("/profiles", undefined, { form: form({ name: "P" }, [["avatar", sample.png(), "image/png"]]) });
    const id = created.body.data._id;
    expect(t.storage.files.size).toBe(1);

    const res = await owner.post(`/profiles/${id}/setAvatar`, undefined, { form: form({}, [["avatar", sample.jpeg(), "image/jpeg"]]) });
    expect(res.status).toBe(409);
    expect(t.storage.files.size).toBe(1);
    expect(t.data.repository("Profile").dump()[0]!.avatar).toHaveLength(1);
  });

  it("fills an empty single-slot field", async () => {
    t = await boot();
    const { owner, id } = await withProfile();
    const res = await owner.post(`/profiles/${id}/setAvatar`, undefined, { form: form({}, [["avatar", sample.png(), "image/png"]]) });
    expect(res.status).toBe(200);
    expect(res.body.data.avatar).toHaveLength(1);
  });
});

describe("replacing and removing documents with files", () => {
  it("deletes the previous file when an update uploads a new one", async () => {
    t = await boot();
    const owner = await asUser();
    const created = await owner.post("/profiles", undefined, { form: form({ name: "P" }, [["avatar", sample.png(), "image/png"]]) });
    const oldKey = created.body.data.avatar[0].storageKey;

    const res = await owner.patch(`/profiles/update/${created.body.data._id}`, undefined, { form: form({}, [["avatar", sample.jpeg(), "image/jpeg"]]) });
    expect(res.status).toBe(200);
    expect(res.body.data.avatar[0].storageKey).not.toBe(oldKey);
    expect(t.storage.files.has(oldKey)).toBe(false);
    expect(t.storage.files.size).toBe(1);
  });

  it("deletes a document's files from storage when it is removed", async () => {
    t = await boot();
    const owner = await asUser();
    const created = await owner.post("/profiles", undefined, { form: form({ name: "P" }, [["avatar", sample.png(), "image/png"]]) });
    expect(t.storage.files.size).toBe(1);
    expect((await owner.delete(`/profiles/delete/${created.body.data._id}`)).status).toBe(200);
    expect(t.storage.files.size).toBe(0);
  });

  it("deletes the files of every document that removeMultiple and removeAll delete", async () => {
    t = await boot();
    const owner = await asUser();
    const make = async (name: string) =>
      (await owner.post("/profiles", undefined, { form: form({ name }, [["avatar", sample.png(), "image/png"]]) })).body.data;
    const [first, second, third] = [await make("one"), await make("two"), await make("three")];
    const keysOf = (doc: { avatar: Array<{ storageKey: string }> }) => doc.avatar.map((file) => file.storageKey);
    expect(t.storage.files.size).toBe(3);

    const several = await owner.delete("/profiles/delete-many", { ids: [first._id] });
    expect(several.body.data.deleted).toBe(1);
    expect(t.storage.removed).toEqual(keysOf(first));

    const everything = await owner.delete("/profiles/delete-all");
    expect(everything.body.data.deleted).toBe(2);
    expect(t.storage.removed).toEqual(expect.arrayContaining([...keysOf(first), ...keysOf(second), ...keysOf(third)]));
    expect(t.storage.files.size).toBe(0);
  });

  it("keeps working if storage cleanup fails (best effort)", async () => {
    t = await boot();
    const owner = await asUser();
    const created = await owner.post("/profiles", undefined, { form: form({ name: "P" }, [["avatar", sample.png(), "image/png"]]) });
    t.storage.remove = async () => { throw new Error("storage down"); };
    expect((await owner.delete(`/profiles/delete/${created.body.data._id}`)).status).toBe(200);
  });
});

describe("FileTypeSniffer", () => {
  const sniffer = new FileTypeSniffer();
  it.each([
    ["png", sample.png(), "image/png"],
    ["jpeg", sample.jpeg(), "image/jpeg"],
    ["pdf", sample.pdf(), "application/pdf"],
    ["gif", Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(16)]), "image/gif"],
    ["webp", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(8)]), "image/webp"],
    ["mp4", Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(8)]), "video/mp4"],
    ["quicktime", Buffer.concat([Buffer.alloc(4), Buffer.from("ftypqt  "), Buffer.alloc(8)]), "video/quicktime"],
    ["webm", Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]), "video/webm"],
    ["zip", Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(16)]), "application/zip"],
  ])("recognises %s", (_n, buf, mime) => expect(sniffer.sniff(buf)).toBe(mime));

  it("returns undefined for unknown or tiny content", () => {
    expect(sniffer.sniff(sample.fakeImage())).toBeUndefined();
    expect(sniffer.sniff(Buffer.from("abc"))).toBeUndefined();
  });
});
