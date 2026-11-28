// Admin paneli testleri (tarayıcısız): katalog modeli ve GitHub'a tek commit'te yayın.
//     node tests/admin.test.mjs
// Pages iş akışı yayından önce çalıştırır; bir test düşerse site yayınlanmaz.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "tests", "fixtures");
const catalogJs = await import(pathToFileURL(join(root, "admin", "catalog.js")).href);
const githubJs = await import(pathToFileURL(join(root, "admin", "github.js")).href);
const {
  parseCatalog, serializeCatalog, serializeApp, archivePreviousRelease, validateApp, resolveMedia, resolveText,
  translationStatus, missingTexts, removeLanguage, languageUsage, diffApp, mediaPaths, emptyApp, guessPlatform, guessKind,
} = catalogJs;
const { GitHubClient, GitHubError } = githubJs;

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n${err.stack}`);
    process.exitCode = 1;
  }
}

// ── Katalog modeli ───────────────────────────────────────────

await test("v3 catalog round trip keeps every app identical", () => {
  const text = readFileSync(join(root, "catalog.json"), "utf8");
  const original = JSON.parse(text);
  const again = JSON.parse(serializeCatalog(parseCatalog(text)));
  assert.deepEqual(again.apps, original.apps);
  for (const key of ["catalog_version", "languages", "catalog_url", "stats_url", "media_base"]) {
    assert.deepEqual(again[key], original[key], key);
  }
});

await test("v2 catalog converts like the Python migration", () => {
  const fromV2 = JSON.parse(serializeCatalog(parseCatalog(readFileSync(join(fixtures, "catalog_v2.json"), "utf8"))));
  const expected = JSON.parse(readFileSync(join(fixtures, "catalog_v3_expected.json"), "utf8"));
  for (const app of fromV2.apps) {   // logo taşıma (logos/ → media/<id>/) göç aracının işi
    if (app.media?.logo?.includes("/logos/")) app.media.logo = expected.apps.find((a) => a.id === app.id).media.logo;
  }
  assert.deepEqual(fromV2.apps, expected.apps);
});

const rich = {
  id: "R", name: { tr: "Ad", en: "Name" }, category: "game", status: "released",
  subtitle: { tr: "Kısa", en: "Short", de: "Kurz" }, description: "Tek dil", developer: "Lumina Software",
  genres: ["puzzle"], age_rating: 7, app_languages: ["tr"], links: { website: "https://e.com", support: "mailto:a@e.com" },
  github_repo: "o/r", icon: "game_puzzle", featured: true,
  media: { logo: "media/R/logo.png", cover: "media/R/cover.webp", video: "https://youtu.be/x",
           screenshots: { default: [{ url: "media/R/1.webp", caption: { tr: "Bir", en: "One" } }, { url: "media/R/2.webp" }],
                          en: [{ url: "media/R/en.webp", caption: "Only English" }] } },
  release: { version: "2.0", date: "2026-11-01", notes: "- yeni",
             platforms: { windows: { url: "https://e.com/s.exe", size_mb: 3, sha256: "a".repeat(64), kind: "inno", min_os: "Windows 10" },
                          android: { min_os: "Android 8" } } },
  history: [{ version: "1.0", date: "2026-01-01", notes: "- ilk" }],
};
const richDraft = () => parseCatalog(JSON.stringify({ catalog_version: 3, languages: ["tr", "en"], apps: [rich] })).apps[0];

await test("every v3 field survives editing round trip", () => {
  assert.deepEqual(serializeApp(richDraft(), "tr"), rich);
});

await test("previous release moves to history on version bump", () => {
  const draft = richDraft();
  const edited = structuredClone(draft);
  edited.version = "2.1";
  edited.changelog = { tr: "- daha yeni" };
  archivePreviousRelease(draft, edited);
  const out = serializeApp(edited, "tr");
  assert.deepEqual(out.history[0], { version: "2.0", date: "2026-11-01", notes: "- yeni" });
  assert.equal(out.history.length, 2);
  // Aynı sürüm yeniden kaydedilirse geçmiş değişmez.
  const same = structuredClone(edited);
  archivePreviousRelease(edited, same);
  assert.equal(same.history.length, 2);
});

await test("language screenshot groups, captions and empty groups", () => {
  const draft = richDraft();
  draft.screenshots.de = [];   // açılmış ama boş grup yazılmaz (şema en az bir öğe ister)
  draft.screenshots.default[1].caption = { de: "Zwei" };
  const out = serializeApp(draft, "tr");
  assert.deepEqual(Object.keys(out.media.screenshots), ["default", "en"]);
  assert.deepEqual(out.media.screenshots.default[1], { url: "media/R/2.webp", caption: { de: "Zwei" } });
});

await test("empty optional fields are left out", () => {
  const app = { ...emptyApp(), id: "E", name: "E", developer: "  ", links: { website: " " }, age_rating: null };
  const out = serializeApp(app, "en");
  for (const key of ["developer", "links", "age_rating", "genres", "app_languages", "media", "history"]) {
    assert.equal(out[key], undefined, key);
  }
});

await test("validation codes", () => {
  const draft = richDraft();
  assert.deepEqual(validateApp(draft, []), {});
  const bad = { ...draft, logo: "logos/x.png", video: "nope", genres: ["puzzle", "dance"], app_languages: ["TR"],
                links: { website: "ftp://x", support: "help" }, release_date: "1.1.2026" };
  const errors = validateApp(bad, []);
  assert.equal(errors.logo.code, "media_pattern");
  assert.equal(errors.video.code, "url_invalid");
  assert.deepEqual(errors.genres, { code: "genre_unknown", genre: "dance" });
  assert.equal(errors.app_languages.code, "lang_pattern");
  assert.equal(errors.link_website.code, "url_invalid");
  assert.equal(errors.link_support.code, "support_invalid");
  assert.equal(errors.release_date.code, "date_pattern");
  assert.equal(validateApp({ ...draft, id: "R" }, [{ id: "R" }]).id.code, "id_taken");
  assert.equal(validateApp({ ...draft, downloads: {} }, []).downloads.code, "downloads_required");
});

await test("text fallback chain matches the app", () => {
  const map = { en: "English", pt: "Português", tr: "Türkçe" };
  assert.deepEqual(resolveText(map, "pt-BR", "tr"), { text: "Português", lang: "pt" });
  assert.deepEqual(resolveText(map, "de", "tr"), { text: "English", lang: "en" });
  assert.deepEqual(resolveText({ tr: "Türkçe" }, "de", "tr"), { text: "Türkçe", lang: "tr" });
  assert.deepEqual(resolveText({ fr: "Français" }, "de", "en"), { text: "Français", lang: "fr" });
  assert.deepEqual(resolveText({}, "de", "en"), { text: "", lang: null });
});

await test("translation status and missing texts", () => {
  const app = { ...emptyApp(), subtitle: { en: "S", de: "S" }, description: { en: "D" }, changelog: { en: "C", tr: "C" } };
  assert.deepEqual(translationStatus(app, "en", "en"), { state: "full", percent: 100 });
  assert.equal(translationStatus(app, "de", "en").state, "part");
  assert.equal(translationStatus(app, "de", "en").percent, 33);
  assert.equal(translationStatus(app, "fr", "en").state, "empty");
  assert.deepEqual(missingTexts(app, "de", "en"), ["description", "changelog"]);
});

await test("removing a catalog language deletes its content", () => {
  const apps = [richDraft(), { ...emptyApp(), id: "X", name: "X" }];
  assert.equal(languageUsage(apps, "en"), 1);
  assert.equal(removeLanguage(apps, "en"), 1);
  const app = apps[0];
  assert.equal(app.subtitle.en, undefined);
  assert.equal(app.names.en, undefined);
  assert.equal(app.screenshots.en, undefined);
  assert.equal(app.screenshots.default[0].caption.en, undefined);
  assert.equal(app.screenshots.default[0].caption.tr, "Bir");
  assert.equal(languageUsage(apps, "en"), 0);
});

await test("diff lists field-level changes", () => {
  const before = serializeApp(richDraft(), "tr");
  const draft = richDraft();
  draft.version = "2.1";
  draft.description = { tr: "Tek dil", de: "Neu" };
  draft.screenshots.default.push({ url: "media/R/3.webp", caption: {} });
  draft.downloads.windows.url = "https://e.com/s2.exe";
  draft.genres = ["puzzle", "arcade"];
  const changes = diffApp(before, serializeApp(draft, "tr"), "tr");
  const has = (match) => changes.some((c) => Object.entries(match).every(([k, v]) => c[k] === v));
  assert.ok(has({ field: "version", from: "2.0", to: "2.1" }));
  assert.ok(has({ field: "description", lang: "de", kind: "added" }));
  assert.ok(has({ field: "screenshots", group: "default", from: 2, to: 3 }));
  assert.ok(has({ field: "platform", platform: "windows", kind: "changed" }));
  assert.ok(has({ field: "genres" }));
  assert.ok(!has({ field: "history" }), "history change is implied by the version bump");
});

await test("media paths and resolution", () => {
  assert.deepEqual(mediaPaths(richDraft()).sort(),
    ["media/R/1.webp", "media/R/2.webp", "media/R/cover.webp", "media/R/en.webp", "media/R/logo.png"]);
  assert.equal(resolveMedia("media/R/1.webp", { base: "https://x.io/cld-hub/" }), "https://x.io/cld-hub/media/R/1.webp");
  assert.equal(resolveMedia("media/R/1.webp", { base: "https://x.io/", owner: "o", repo: "r", branch: "main" }),
    "https://raw.githubusercontent.com/o/r/main/media/R/1.webp");
  assert.equal(resolveMedia("https://cdn/x.png", { base: "https://x.io/" }), "https://cdn/x.png");
});

await test("release file guesses", () => {
  assert.equal(guessPlatform("App-Setup-1.0.exe"), "windows");
  assert.equal(guessPlatform("app-1.0.apk"), "android");
  assert.equal(guessPlatform("app-linux-x64.tar.gz"), "linux");
  assert.equal(guessKind("App-Setup-1.0.exe"), "inno");
  assert.equal(guessKind("app.zip"), "zip");
});

// ── Koleksiyonlar ────────────────────────────────────────────

await test("collections round trip, order and plain default-language text", () => {
  const raw = {
    catalog_version: 3, languages: ["en", "tr"], apps: [rich],
    collections: [
      { id: "game-night", title: { en: "Game night", tr: "Oyun gecesi" }, description: "Play together", apps: [rich.id, "GONE"] },
      { id: "starter", title: "Starter pack", apps: [rich.id] },
    ],
  };
  const catalog = parseCatalog(JSON.stringify(raw));
  assert.equal(catalog.collections.length, 2);
  assert.deepEqual(catalog.collections[0].title, { en: "Game night", tr: "Oyun gecesi" });
  assert.ok(!("collections" in catalog.extra), "collections are managed, not passed through");
  const again = JSON.parse(serializeCatalog(catalog));
  assert.deepEqual(again.collections, raw.collections);
  assert.deepEqual(Object.keys(again).slice(-2), ["apps", "collections"]);
  catalog.collections = [];
  assert.ok(!("collections" in JSON.parse(serializeCatalog(catalog))), "an empty list is left out");
});

await test("collection validation, slugs and app renames", () => {
  const { validateCollection, slugify, renameInCollections, missingCollectionApps, emptyCollection } = catalogJs;
  const draft = emptyCollection();
  assert.deepEqual(Object.fromEntries(Object.entries(validateCollection(draft, [], [], "en")).map(([k, v]) => [k, v.code])),
    { id: "id_required", title: "title_required", apps: "collection_empty" });
  Object.assign(draft, { id: "Game Night", title: { tr: "Oyun" }, apps: ["A"] });
  assert.equal(validateCollection(draft, [], ["A"], "en").id.code, "collection_id_pattern");
  assert.equal(validateCollection(draft, [], ["A"], "en").title.code, "title_required");
  Object.assign(draft, { id: "game-night", title: { en: "Game night" } });
  assert.deepEqual(validateCollection(draft, [], ["A"], "en"), {});
  assert.equal(validateCollection(draft, [{ id: "game-night" }], ["A"], "en").id.code, "id_taken");
  assert.equal(slugify("Çılgın Oyun Gecesi!"), "cilgin-oyun-gecesi");
  assert.equal(slugify("  Été — Top 10  "), "ete-top-10");
  const list = [{ apps: ["A", "B"] }, { apps: ["B", "C"] }];
  renameInCollections(list, "B", "C");
  assert.deepEqual(list.map((c) => c.apps), [["A", "C"], ["C"]]);
  renameInCollections(list, "C");
  assert.deepEqual(list.map((c) => c.apps), [["A"], []]);
  assert.deepEqual(missingCollectionApps({ apps: ["A", "Z"] }, ["A"]), ["Z"]);
});

await test("removing a language also clears collection texts", () => {
  const collections = [{ id: "x", title: { en: "X", tr: "İks" }, description: { tr: "Açıklama" }, apps: [] }];
  assert.equal(languageUsage([], "tr", collections), 1);
  removeLanguage([], "tr", collections);
  assert.deepEqual(collections[0].title, { en: "X" });
  assert.deepEqual(collections[0].description, {});
});
// ── Arayüz metinleri ─────────────────────────────────────────

const { DICTIONARIES, t } = await import(pathToFileURL(join(root, "admin", "locales.js")).href);

function leaves(tree, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(tree)) {
    if (value && typeof value === "object" && !("other" in value)) leaves(value, `${prefix}${key}.`, out);
    else out.set(prefix + key, value);
  }
  return out;
}
const placeholders = (value) => new Set([...String(typeof value === "object" ? Object.values(value).join(" ") : value)
  .matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

await test("English and Turkish UI texts have the same keys and placeholders", () => {
  const en = leaves(DICTIONARIES.en), tr = leaves(DICTIONARIES.tr);
  assert.deepEqual([...tr.keys()].filter((k) => !en.has(k)), [], "extra in tr");
  assert.deepEqual([...en.keys()].filter((k) => !tr.has(k)), [], "missing in tr");
  for (const [key, value] of en) {
    assert.deepEqual([...placeholders(tr.get(key))].sort(), [...placeholders(value)].sort(), `placeholders of ${key}`);
  }
});

await test("every UI text key used in the panel exists", () => {
  const en = leaves(DICTIONARIES.en);
  const used = new Set();
  for (const file of ["app.js", "editor.js", "ui.js", "collections.js"]) {
    const code = readFileSync(join(root, "admin", file), "utf8");
    for (const m of code.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
  }
  const html = readFileSync(join(root, "admin", "index.html"), "utf8");
  for (const m of html.matchAll(/data-i18n(?:-placeholder|-title)?="([\w.]+)"/g)) used.add(m[1]);
  // Şablonla kurulan anahtarlar
  for (const s of ["upcoming", "released", "archived"]) used.add(`status.${s}`);
  for (const c of ["app", "game"]) { used.add(`category.${c}`); used.add(`category.${c}_plural`); }
  for (const k of ["auto", "file", "zip", "inno", "apk"]) used.add(`kind.${k}`);
  for (const tab of ["general", "texts", "media", "release", "preview"]) used.add(`editor.tab.${tab}`);
  for (const step of ["pick", "notes", "files", "review"]) used.add(`wizard.${step}`);
  for (const kind of ["logo", "cover", "screenshot"].filter((k) => k !== "screenshot")) used.add(`media.${kind}_rules`);
  for (const link of ["website", "privacy", "support"]) used.add(`field.link_${link}`);
  for (const d of ["added", "removed", "changed"]) used.add(`diff.${d}`);
  for (const f of ["name", "subtitle", "description", "notes", "version", "date", "category", "status", "logo", "cover", "video",
                   "developer", "genres", "age_rating", "app_languages", "links", "github_repo", "icon", "featured", "hidden", "history"]) {
    used.add(`diff.field.${f}`);
  }
  for (const genre of Object.values(catalogJs.GENRES).flat()) used.add(`genre.${genre}`);
  // Kodlu hatalar: doğrulama, görsel, GitHub ve katalog okuma
  const errorCodes = new Set();
  for (const file of ["catalog.js", "images.js", "github.js", "editor.js"]) {
    const code = readFileSync(join(root, "admin", file), "utf8");
    for (const m of code.matchAll(/(?:fail\([^,]+,\s*|Error\(|code:\s*)"(\w+)"/g)) errorCodes.add(m[1]);
  }
  for (const code of ["gh_401", "gh_403", "gh_404", "gh_422", "gh_other"]) errorCodes.add(code);
  for (const code of errorCodes) used.add(`error.${code}`);
  const missing = [...used].filter((key) => !en.has(key));
  assert.deepEqual(missing, []);
});

await test("plural forms and placeholders", () => {
  assert.equal(t("list.count", { count: 1, langs: "en" }, "en"), "1 app · languages: en");
  assert.equal(t("list.count", { count: 1200, langs: "en" }, "en"), "1,200 apps · languages: en");
  assert.equal(t("list.count", { count: 2, langs: "en" }, "tr"), "2 uygulama · diller: en");
  assert.equal(t("genre.puzzle", {}, "de"), "Puzzle", "unknown UI language falls back to English");
  assert.equal(t("no.such.key"), "no.such.key");
});

// ── GitHub: tek commit'te yayın (sahte API) ──────────────────

function fakeGitHub({ catalogSha = "cat1", existing = [], refConflict = false } = {}) {
  const calls = [];
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = url.replace("https://api.github.com", "");
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, path, body });
    if (method === "GET" && path.startsWith("/repos/o/r/git/ref/heads/main")) return json(200, { object: { sha: "head1" } });
    if (method === "GET" && path.startsWith("/repos/o/r/contents/catalog.json?ref=head1")) {
      return json(200, { sha: catalogSha, content: Buffer.from("{}").toString("base64") });
    }
    if (method === "GET" && path === "/repos/o/r/git/commits/head1") return json(200, { tree: { sha: "tree1" } });
    if (method === "GET" && path === "/repos/o/r/git/trees/tree1?recursive=1") {
      return json(200, { tree: ["catalog.json", ...existing].map((p) => ({ path: p, type: "blob" })) });
    }
    if (method === "POST" && path === "/repos/o/r/git/blobs") return json(201, { sha: `blob${calls.length}` });
    if (method === "POST" && path === "/repos/o/r/git/trees") return json(201, { sha: "tree2" });
    if (method === "POST" && path === "/repos/o/r/git/commits") return json(201, { sha: "commit2", html_url: "https://github.com/o/r/commit/commit2" });
    if (method === "PATCH" && path === "/repos/o/r/git/refs/heads/main") {
      return refConflict ? json(422, { message: "Update is not a fast forward" }) : json(200, { object: { sha: "commit2" } });
    }
    return json(404, { message: "Not Found" });
  };
  return calls;
}

const client = () => new GitHubClient({ token: "t", owner: "o", repo: "r", branch: "main", path: "catalog.json" });

await test("publish writes images, deletions and catalog in one commit", async () => {
  const calls = fakeGitHub({ existing: ["media/A/old.webp", "media/A/same.webp"] });
  const progress = [];
  const result = await client().publish({
    catalogText: '{"apps":[]}\n', expectedSha: "cat1", message: "catalog: test",
    uploads: [{ path: "media/A/new.webp", bytes: new Uint8Array([1, 2, 3]) }, { path: "media/A/same.webp", bytes: new Uint8Array([4]) }],
    deletions: ["media/A/old.webp", "media/A/missing.webp"],
    onProgress: (done, total) => progress.push(`${done}/${total}`),
  });
  const blobs = calls.filter((c) => c.path.endsWith("/git/blobs"));
  assert.equal(blobs.length, 2, "existing same-hash file is not uploaded again");
  assert.equal(blobs[0].body.content, Buffer.from([1, 2, 3]).toString("base64"));
  assert.equal(Buffer.from(blobs[1].body.content, "base64").toString("utf8"), '{"apps":[]}\n');
  const tree = calls.find((c) => c.path.endsWith("/git/trees")).body;
  assert.equal(tree.base_tree, "tree1");
  assert.deepEqual(tree.tree.map((e) => [e.path, e.sha === null ? "delete" : "write"]),
    [["media/A/new.webp", "write"], ["catalog.json", "write"], ["media/A/old.webp", "delete"]]);
  const commit = calls.find((c) => c.path.endsWith("/git/commits")).body;
  assert.deepEqual(commit, { message: "catalog: test", tree: "tree2", parents: ["head1"] });
  assert.deepEqual(calls.at(-1), { method: "PATCH", path: "/repos/o/r/git/refs/heads/main", body: { sha: "commit2" } });
  assert.equal(result.commitUrl, "https://github.com/o/r/commit/commit2");
  assert.equal(result.deleted, 1);
  assert.deepEqual(progress, ["0/3", "1/3", "2/3", "3/3"]);
});

await test("publish refuses when the catalog changed elsewhere", async () => {
  const calls = fakeGitHub({ catalogSha: "someone-else" });
  await assert.rejects(client().publish({ catalogText: "{}", expectedSha: "cat1", message: "m" }),
    (err) => err instanceof GitHubError && err.code === "gh_conflict");
  assert.ok(!calls.some((c) => c.method === "POST"), "nothing is written");
});

await test("publish reports a conflict when the branch moved", async () => {
  fakeGitHub({ refConflict: true });
  await assert.rejects(client().publish({ catalogText: "{}", expectedSha: "cat1", message: "m" }),
    (err) => err.code === "gh_conflict");
});

await test("GitHub errors carry codes", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: "Bad credentials" }) });
  await assert.rejects(client().checkAccess(), (err) => err.code === "gh_401" && err.params.detail === "Bad credentials");
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(client().checkAccess(), (err) => err.code === "gh_offline");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
