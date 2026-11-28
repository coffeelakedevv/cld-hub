// Katalog veri modeli (v3): okuma (v1/v2 de okunur), doğrulama, karşılaştırma ve uygulamayla
// aynı JSON biçimi. CLD Hub'daki core/models.py ve schema/catalog.v3.schema.json ile aynı kuralları uygular.
//
// Düzenleyici kaydı "taslak" denen düz bir nesne üzerinden düzenler. Bu modül arayüz metni
// içermez: hatalar ve farklar kod + parametre olarak döner, çeviriyi locales.js yapar.

export const CATALOG_VERSION = 3;
export const DEFAULT_LANGUAGES = ["en", "tr"];   // ilki varsayılan dil: CLD Hub küresel, ana dil İngilizce
export const FALLBACK_LANG = "en";
export const LANG_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

export const PLATFORMS = [
  { key: "windows", label: "Windows", icon: "desktop_windows" },
  { key: "linux", label: "Linux", icon: "terminal" },
  { key: "macos", label: "macOS", icon: "laptop_mac" },
  { key: "android", label: "Android", icon: "android" },
];

export const STATUSES = ["upcoming", "released", "archived"];
export const CATEGORIES = ["app", "game"];
// core/models.py InstallKind ile aynı. "" = dosya adından otomatik.
export const KINDS = ["", "file", "zip", "inno", "apk"];
export const AGE_RATINGS = [3, 7, 12, 16, 18];
export const LINK_KEYS = ["website", "privacy", "support"];
// Şemadaki sabit tür listesi; uygulamadaki genre.* çevirileriyle aynı kimlikler.
export const GENRES = {
  app: ["productivity", "utilities", "security", "media", "graphics", "music", "education",
        "communication", "developer_tools", "finance", "health"],
  game: ["action", "adventure", "arcade", "casual", "puzzle", "racing", "rpg", "simulation",
         "sports", "strategy"],
};
const ALL_GENRES = new Set([...GENRES.app, ...GENRES.game]);
export const TEXT_FIELDS = ["subtitle", "description", "changelog"];

// Masaüstü uygulamasındaki ui/components/common.py ICON_MAP ile eşleşir.
export const ICONS = {
  default: "apps",
  media_kit: "video_library",
  password_gen: "password",
  notes: "note_alt",
  calculator: "calculate",
  game_puzzle: "extension",
  game_adventure: "explore",
  game_strategy: "psychology",
  browser: "language",
  chat: "chat",
  music: "music_note",
  photo: "photo_camera",
  file_manager: "folder",
  tools: "build",
  security: "security",
};

/** Kodlu hata: `code` locales.js'deki `error.<code>` anahtarıdır. */
export class CatalogError extends Error {
  constructor(code, params = {}) {
    super(`${code}${params.detail ? `: ${params.detail}` : ""}`);
    this.code = code;
    this.params = params;
  }
}

/** Dosya adından kurulum tipi tahmini ("Son sürümden doldur" ve sürüm sihirbazı kullanır). */
export function guessKind(filename) {
  const name = filename.toLowerCase();
  if (name.endsWith(".zip")) return "zip";
  if (name.endsWith(".apk")) return "apk";
  if (name.endsWith(".exe") && /setup|install/.test(name)) return "inno";
  return "file";
}

/** Dosya adından platform tahmini (sürüm dosyalarını otomatik eşlemek için). */
export function guessPlatform(filename) {
  const name = filename.toLowerCase();
  if (name.endsWith(".apk") || name.endsWith(".aab") || name.includes("android")) return "android";
  if (name.endsWith(".dmg") || name.endsWith(".pkg") || /mac|darwin|osx/.test(name)) return "macos";
  if (/\.(appimage|deb|rpm|flatpak|snap)$/.test(name) || name.includes("linux")) return "linux";
  if (/\.(exe|msi|msix)$/.test(name) || /win(dows)?(32|64)?/.test(name)) return "windows";
  return null;
}

const normalizeSha = (value) => String(value || "").trim().toLowerCase().replace(/^sha256:/, "");
const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const clone = (value) => (value === undefined ? undefined : structuredClone(value));

/** Düz yazı ya da dil eşlemesi → boş olmayan çevirilerden oluşan eşleme. */
export function textMap(value, defaultLang) {
  if (typeof value === "string") return value.trim() ? { [defaultLang]: value } : {};
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, t]) => typeof t === "string" && t.trim()));
}

/** Yazarken: yalnızca varsayılan dilde olan metin düz yazı olarak kalır (Python ile aynı). */
function textValue(map, defaultLang) {
  const keys = Object.keys(map);
  return keys.length === 1 && keys[0] === defaultLang ? map[defaultLang] : { ...map };
}

const hasText = (map) => Object.values(map || {}).some((t) => t && t.trim());
const cleanText = (map) => Object.fromEntries(
  Object.entries(map || {}).filter(([, t]) => typeof t === "string" && t.trim()).map(([k, t]) => [k, t.trim()]));

const baseLanguage = (lang) => lang.split("-")[0];

/** Uygulamanın yedek zinciri: tam dil → ana dil → en → kataloğun varsayılanı → ilk çeviri.
 *  `{ text, lang }` döner; `lang` istenen dilden farklıysa metin yedekten gelmiştir. */
export function resolveText(map, lang, defaultLang) {
  const texts = cleanText(map);
  const order = [lang, baseLanguage(lang), FALLBACK_LANG, defaultLang];
  for (const code of order) if (code && texts[code]) return { text: texts[code], lang: code };
  const first = Object.entries(texts)[0];
  return first ? { text: first[1], lang: first[0] } : { text: "", lang: null };
}

function parseDownload(value) {
  const entry = typeof value === "string" ? { url: value } : value || {};
  if (!entry.url) return null;
  return {
    url: entry.url, size_mb: Number(entry.size_mb) || 0,
    sha256: normalizeSha(entry.sha256), kind: KINDS.includes(entry.kind) && entry.kind ? entry.kind : "",
  };
}

function parseShots(value, defaultLang) {
  const list = (Array.isArray(value) ? value : []).map((item) => (typeof item === "string" ? { url: item } : item))
    .filter((item) => item && typeof item.url === "string" && item.url);
  return list.map((item) => ({ url: item.url, caption: textMap(item.caption, defaultLang) }));
}

export function emptyApp() {
  return {
    id: "", name: "", names: {}, category: "app", status: "upcoming",
    subtitle: {}, description: {}, changelog: {},
    developer: "", genres: [], age_rating: null, app_languages: [], links: {},
    version: "", release_date: "", github_repo: "", icon: "default",
    logo: "", cover: "", video: "",
    featured: false, hidden: false,
    screenshots: {},          // grup ("default" ya da dil) → [{ url, caption: {dil: metin} }]
    platforms: [], downloads: {}, platformExtras: {},   // platformExtras: { p: { min_os, version } }
    history: [],
  };
}

/** Ham katalog kaydını (v3; eski v1/v2 de olur) düzenlenebilir taslağa çevirir. */
export function normalizeApp(raw, defaultLang) {
  const isV3 = "release" in raw || "media" in raw || "description" in raw;
  return isV3 ? fromV3(raw, defaultLang) : fromLegacy(raw, defaultLang);
}

function fromV3(raw, defaultLang) {
  const app = emptyApp();
  const media = isObject(raw.media) ? raw.media : {};
  const release = isObject(raw.release) ? raw.release : {};
  const platforms = isObject(release.platforms) ? release.platforms : {};
  const names = isObject(raw.name) ? textMap(raw.name, defaultLang) : {};
  Object.assign(app, {
    id: raw.id,
    name: Object.keys(names).length ? (names[defaultLang] || Object.values(names)[0]) : String(raw.name || ""),
    names,
    category: raw.category || "app",
    status: raw.status || "released",
    subtitle: textMap(raw.subtitle, defaultLang),
    description: textMap(raw.description, defaultLang),
    changelog: textMap(release.notes, defaultLang),
    developer: typeof raw.developer === "string" ? raw.developer : "",
    genres: Array.isArray(raw.genres) ? [...raw.genres] : [],
    age_rating: AGE_RATINGS.includes(raw.age_rating) ? raw.age_rating : null,
    app_languages: Array.isArray(raw.app_languages) ? [...raw.app_languages] : [],
    links: isObject(raw.links) ? { ...raw.links } : {},
    version: String(release.version || ""),
    release_date: String(release.date || ""),
    github_repo: raw.github_repo || "",
    icon: raw.icon || "default",
    logo: typeof media.logo === "string" ? media.logo : "",
    cover: typeof media.cover === "string" ? media.cover : "",
    video: typeof media.video === "string" ? media.video : "",
    featured: Boolean(raw.featured),
    hidden: Boolean(raw.hidden),
    platforms: Object.keys(platforms),
    history: (Array.isArray(raw.history) ? raw.history : []).filter((h) => h && h.version).map((h) => ({
      version: String(h.version), date: h.date || "", notes: textMap(h.notes, defaultLang),
    })),
  });
  for (const [platform, value] of Object.entries(platforms)) {
    const download = parseDownload(value);
    if (download) app.downloads[platform] = download;
    const extras = Object.fromEntries(Object.entries(value || {}).filter(([k]) => k === "min_os" || k === "version"));
    if (Object.keys(extras).length) app.platformExtras[platform] = extras;
  }
  let shots = media.screenshots;
  if (Array.isArray(shots)) shots = { default: shots };
  for (const [group, items] of Object.entries(isObject(shots) ? shots : {})) {
    const list = parseShots(items, defaultLang);
    if (list.length) app.screenshots[group] = list;
  }
  return app;
}

function fromLegacy(raw, defaultLang) {
  const app = emptyApp();
  const description = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("description_") && typeof value === "string" && value) description[key.slice(12)] = value;
  }
  Object.assign(app, {
    id: raw.id, name: String(raw.name || ""), category: raw.category || "app", status: raw.status || "released",
    description, changelog: textMap(raw.changelog, defaultLang),
    version: String(raw.version || ""), release_date: raw.release_date || "", github_repo: raw.github_repo || "",
    icon: raw.icon || "default", logo: typeof raw.logo === "string" ? raw.logo : "",
    featured: Boolean(raw.featured), hidden: Boolean(raw.hidden),
  });
  const shots = parseShots(raw.screenshots, defaultLang);
  if (shots.length) app.screenshots.default = shots;
  for (const [platform, value] of Object.entries(raw.downloads || {})) {
    const download = parseDownload(value);
    if (download) app.downloads[platform] = download;
  }
  if (!Object.keys(app.downloads).length && raw.download_url) {
    for (const platform of raw.platforms?.length ? raw.platforms : ["windows"]) {
      app.downloads[platform] = parseDownload({ url: raw.download_url, size_mb: raw.size_mb });
    }
  }
  app.platforms = raw.platforms?.length ? [...raw.platforms] : Object.keys(app.downloads);
  return app;
}

/** Taslağı uygulamanın okuduğu v3 kaydına çevirir (alan sırası core/models.py ile aynı). */
export function serializeApp(app, defaultLang) {
  const names = cleanText(app.names);
  if (Object.keys(names).length) names[defaultLang] = app.name;
  const out = { id: app.id, name: Object.keys(names).length ? textValue(names, defaultLang) : app.name,
                category: app.category, status: app.status };
  const subtitle = cleanText(app.subtitle), description = cleanText(app.description);
  if (hasText(subtitle)) out.subtitle = textValue(subtitle, defaultLang);
  if (hasText(description)) out.description = textValue(description, defaultLang);
  if (app.developer?.trim()) out.developer = app.developer.trim();
  if (app.genres?.length) out.genres = [...app.genres];
  if (app.age_rating) out.age_rating = app.age_rating;
  if (app.app_languages?.length) out.app_languages = [...app.app_languages];
  const links = Object.fromEntries(LINK_KEYS.filter((k) => app.links?.[k]?.trim()).map((k) => [k, app.links[k].trim()]));
  if (Object.keys(links).length) out.links = links;
  if (app.github_repo) out.github_repo = app.github_repo;
  if (app.icon && app.icon !== "default") out.icon = app.icon;
  if (app.featured) out.featured = true;
  if (app.hidden) out.hidden = true;

  const media = {};
  if (app.logo) media.logo = app.logo;
  if (app.cover) media.cover = app.cover;
  if (app.video) media.video = app.video;
  const screenshots = {};
  const groups = Object.keys(app.screenshots || {}).sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : 0));
  for (const group of groups) {
    const list = (app.screenshots[group] || []).filter((s) => s.url);
    if (!list.length) continue;
    screenshots[group] = list.map(({ url, caption }) => {
      const text = cleanText(caption);
      return hasText(text) ? { url, caption: textValue(text, defaultLang) } : { url };
    });
  }
  if (Object.keys(screenshots).length) media.screenshots = screenshots;
  if (Object.keys(media).length) out.media = media;

  const release = {};
  if (app.version) release.version = app.version;
  if (app.release_date) release.date = app.release_date;
  const notes = cleanText(app.changelog);
  if (hasText(notes)) release.notes = textValue(notes, defaultLang);
  release.platforms = Object.fromEntries(PLATFORMS.filter((p) => app.platforms.includes(p.key)).map((p) => {
    const d = app.downloads[p.key];
    const entry = {};
    if (d?.url) {
      entry.url = d.url;
      if (d.size_mb) entry.size_mb = d.size_mb;
      if (d.sha256) entry.sha256 = d.sha256;
      if (d.kind) entry.kind = d.kind;
    }
    const extras = app.platformExtras?.[p.key] || {};
    if (extras.version && d?.url) entry.version = extras.version;
    if (extras.min_os?.trim()) entry.min_os = extras.min_os.trim();
    return [p.key, entry];
  }));
  out.release = release;
  if (app.history?.length) {
    out.history = app.history.map((past) => {
      const entry = { version: past.version };
      if (past.date) entry.date = past.date;
      const pastNotes = cleanText(past.notes);
      if (hasText(pastNotes)) entry.notes = textValue(pastNotes, defaultLang);
      return entry;
    });
  }
  return out;
}

/** Sürüm değiştiyse önceki sürüm (tarih ve notlarıyla) sürüm geçmişinin başına eklenir. */
export function archivePreviousRelease(previous, app) {
  if (!previous?.version || previous.version === app.version || !app.version) return;
  const history = (app.history || []).filter((h) => h.version !== previous.version && h.version !== app.version);
  const entry = { version: previous.version, date: previous.release_date || "", notes: cleanText(previous.changelog) };
  app.history = [entry, ...history];
}

/** Bir dilin çeviri durumu: varsayılan dilde dolu olan metin alanlarının kaçı bu dilde de dolu. */
export function translationStatus(app, lang, defaultLang) {
  const reference = TEXT_FIELDS.filter((f) => hasText(cleanText(app[f])) && cleanText(app[f])[defaultLang]);
  if (lang === defaultLang) {
    const filled = TEXT_FIELDS.filter((f) => cleanText(app[f])[lang]).length;
    if (!filled) return { state: "empty", percent: 0 };
    return cleanText(app.description)[lang] ? { state: "full", percent: 100 } : { state: "part", percent: 50 };
  }
  if (!reference.length) return { state: "empty", percent: 0 };
  const done = reference.filter((f) => cleanText(app[f])[lang]).length;
  const percent = Math.round((done / reference.length) * 100);
  return { state: done === reference.length ? "full" : done ? "part" : "empty", percent };
}

/** Bir dilde, varsayılan dilde olup bu dilde eksik olan metin alanları. */
export function missingTexts(app, lang, defaultLang) {
  return TEXT_FIELDS.filter((f) => cleanText(app[f])[defaultLang] && !cleanText(app[f])[lang]);
}

/** Bir dilin tüm uygulamalardaki metinlerini ve ekran görüntüsü grubunu siler (dil kataloğdan çıkarılınca). */
export function removeLanguage(apps, lang, collections = []) {
  for (const collection of collections) {
    delete collection.title?.[lang];
    delete collection.description?.[lang];
  }
  let touched = 0;
  for (const app of apps) {
    let changed = false;
    for (const field of ["names", ...TEXT_FIELDS]) {
      if (app[field]?.[lang] !== undefined) { delete app[field][lang]; changed = true; }
    }
    for (const shots of Object.values(app.screenshots || {})) {
      for (const shot of shots) if (shot.caption?.[lang] !== undefined) { delete shot.caption[lang]; changed = true; }
    }
    if (app.screenshots?.[lang]) { delete app.screenshots[lang]; changed = true; }
    for (const past of app.history || []) if (past.notes?.[lang] !== undefined) { delete past.notes[lang]; changed = true; }
    if (changed) touched += 1;
  }
  return touched;
}

/** Bir dilde içerik olan uygulama sayısı (dil çıkarılmadan önce uyarı için). */
export function languageUsage(apps, lang, collections = []) {
  return apps.filter((app) => ["names", ...TEXT_FIELDS].some((f) => app[f]?.[lang]) || app.screenshots?.[lang]).length
    + collections.filter((c) => c.title?.[lang] || c.description?.[lang]).length;
}

// Panelin değiştirmediği üst düzey alanlar (ör. stats_url) olduğu gibi korunur.
const MANAGED_KEYS = new Set(["catalog_version", "last_updated", "catalog_url", "languages", "media_base", "apps",
                              "collections"]);
const TOP_ORDER = ["catalog_version", "last_updated", "languages", "catalog_url", "stats_url", "media_base"];

export function parseCatalog(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new CatalogError("catalog_json", { detail: err.message });
  }
  if (!data || !Array.isArray(data.apps)) throw new CatalogError("catalog_apps");
  const languages = Array.isArray(data.languages) && data.languages.length ? data.languages : DEFAULT_LANGUAGES;
  return {
    catalog_url: data.catalog_url || "",
    languages: [...languages],
    media_base: data.media_base || "",
    extra: Object.fromEntries(Object.entries(data).filter(([key]) => !MANAGED_KEYS.has(key))),
    apps: data.apps.filter((a) => a && a.id).map((a) => normalizeApp(a, languages[0])),
    collections: (Array.isArray(data.collections) ? data.collections : [])
      .filter((c) => c && typeof c === "object").map((c) => normalizeCollection(c, languages[0])),
  };
}

export function serializeCatalog(catalog) {
  const top = {
    catalog_version: CATALOG_VERSION,
    last_updated: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    languages: catalog.languages,
    catalog_url: catalog.catalog_url,
    ...(catalog.extra || {}),
  };
  if (catalog.media_base) top.media_base = catalog.media_base;
  const data = {};
  for (const key of TOP_ORDER) if (top[key] !== undefined) data[key] = top[key];
  for (const [key, value] of Object.entries(top)) if (!(key in data)) data[key] = value;
  data.apps = catalog.apps.map((app) => serializeApp(app, catalog.languages[0]));
  if (catalog.collections?.length) {
    data.collections = catalog.collections.map((c) => serializeCollection(c, catalog.languages[0]));
  }
  return JSON.stringify(data, null, 2) + "\n";
}

/** Değişiklik tespiti için zaman damgasından bağımsız karşılaştırma anahtarı. */
export function fingerprint(app, defaultLang = FALLBACK_LANG) {
  return JSON.stringify(serializeApp(app, defaultLang));
}

/** Kaydın kullandığı repo içi görsel yolları (media/…). */
export function mediaPaths(app) {
  const paths = [app.logo, app.cover, ...Object.values(app.screenshots || {}).flat().map((s) => s.url)];
  return paths.filter((p) => typeof p === "string" && p.startsWith("media/"));
}

/** Logo/ekran görüntüsü yolunu tarayıcıda gösterilebilir adrese çevirir. */
export function resolveMedia(path, { base = "", owner, repo, branch } = {}) {
  if (!path || /^https?:\/\//.test(path)) return path;
  // Yeni yayınlanan bir görsel Pages'e henüz çıkmamış olabilir; repodan doğrudan gösterilir.
  if (owner && repo && branch) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return base ? new URL(path, base).href : path;
}

/** İki serileştirilmiş kayıt arasındaki farklar: [{ field, kind, lang?, platform?, group?, from?, to? }].
 *  kind: added | removed | changed. Yayın özetinde gösterilir. */
export function diffApp(before, after, defaultLang) {
  const out = [];
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const kindOf = (a, b) => (a == null || a === "" ? "added" : b == null || b === "" ? "removed" : "changed");
  const texts = (field, a, b) => {
    const A = textMap(a, defaultLang), B = textMap(b, defaultLang);
    for (const lang of new Set([...Object.keys(A), ...Object.keys(B)])) {
      if (A[lang] !== B[lang]) out.push({ field, lang, kind: kindOf(A[lang], B[lang]) });
    }
  };
  texts("name", before.name, after.name);
  for (const key of ["category", "status"]) {
    if (before[key] !== after[key]) out.push({ field: key, kind: "changed", from: before[key], to: after[key] });
  }
  texts("subtitle", before.subtitle, after.subtitle);
  texts("description", before.description, after.description);
  const rb = before.release || {}, ra = after.release || {};
  if (rb.version !== ra.version) out.push({ field: "version", kind: kindOf(rb.version, ra.version), from: rb.version, to: ra.version });
  if (rb.date !== ra.date) out.push({ field: "date", kind: kindOf(rb.date, ra.date), from: rb.date, to: ra.date });
  texts("notes", rb.notes, ra.notes);
  const pb = rb.platforms || {}, pa = ra.platforms || {};
  for (const platform of new Set([...Object.keys(pb), ...Object.keys(pa)])) {
    if (!same(pb[platform], pa[platform])) {
      out.push({ field: "platform", platform, kind: !pb[platform] ? "added" : !pa[platform] ? "removed" : "changed" });
    }
  }
  const mb = before.media || {}, ma = after.media || {};
  for (const key of ["logo", "cover", "video"]) {
    if (mb[key] !== ma[key]) out.push({ field: key, kind: kindOf(mb[key], ma[key]) });
  }
  const sb = mb.screenshots || {}, sa = ma.screenshots || {};
  for (const group of new Set([...Object.keys(sb), ...Object.keys(sa)])) {
    if (!same(sb[group], sa[group])) {
      out.push({ field: "screenshots", group, kind: "changed", from: (sb[group] || []).length, to: (sa[group] || []).length });
    }
  }
  for (const key of ["developer", "genres", "age_rating", "app_languages", "links", "github_repo", "icon",
                     "featured", "hidden"]) {
    if (!same(before[key], after[key])) out.push({ field: key, kind: "changed" });
  }
  if (rb.version === ra.version && !same(before.history, after.history)) out.push({ field: "history", kind: "changed" });
  return out;
}

// schema/catalog.v3.schema.json ile aynı kalıplar.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const MEDIA_PATTERN = /^(https?:\/\/\S+|media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+)$/;
const HTTP_PATTERN = /^https?:\/\/\S+$/;
const SUPPORT_PATTERN = /^(https?:\/\/|mailto:)\S+$/;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && HTTP_PATTERN.test(value);
  } catch {
    return false;
  }
}

/** Alan anahtarı → { code, ...params } sözlüğü döner; boşsa kayıt geçerlidir.
 *  Alan anahtarları düzenleyicideki `data-key` değerleridir (ör. dl_windows, link_website). */
export function validateApp(app, allApps, originalId = null) {
  const errors = {};
  const fail = (key, code, params = {}) => { errors[key] = { code, ...params }; };
  if (!app.id) fail("id", "id_required");
  else if (!ID_PATTERN.test(app.id)) fail("id", "id_pattern");
  else if (app.id !== originalId && allApps.some((a) => a.id === app.id)) fail("id", "id_taken");

  if (!app.name.trim()) fail("name", "name_required");
  const published = app.status !== "upcoming";
  if (published && !app.version.trim()) fail("version", "version_required");
  else if (app.version && !VERSION_PATTERN.test(app.version)) fail("version", "version_pattern");
  if (app.release_date && !DATE_PATTERN.test(app.release_date)) fail("release_date", "date_pattern");
  if (app.github_repo && !REPO_PATTERN.test(app.github_repo)) fail("github_repo", "repo_pattern");
  if (app.logo && !MEDIA_PATTERN.test(app.logo)) fail("logo", "media_pattern");
  if (app.cover && !MEDIA_PATTERN.test(app.cover)) fail("cover", "media_pattern");
  if (app.video && !isHttpUrl(app.video)) fail("video", "url_invalid");
  for (const key of LINK_KEYS) {
    const value = app.links?.[key]?.trim();
    if (value && !(key === "support" ? SUPPORT_PATTERN : HTTP_PATTERN).test(value)) {
      fail(`link_${key}`, key === "support" ? "support_invalid" : "url_invalid");
    }
  }
  const badGenre = (app.genres || []).find((g) => !ALL_GENRES.has(g));
  if (badGenre) fail("genres", "genre_unknown", { genre: badGenre });
  const badLang = (app.app_languages || []).find((l) => !LANG_PATTERN.test(l));
  if (badLang) fail("app_languages", "lang_pattern", { lang: badLang });

  for (const { key, label } of PLATFORMS) {
    const d = app.downloads[key];
    if (!d) continue;
    if (d.url && !isHttpUrl(d.url)) fail(`dl_${key}`, "download_url", { platform: label });
    if (d.size_mb < 0) fail(`size_${key}`, "size_negative");
    if (d.sha256 && !SHA_PATTERN.test(d.sha256)) fail(`sha_${key}`, "sha_pattern");
    if (d.kind === "apk" && key !== "android") fail(`kind_${key}`, "apk_android_only");
    if (key === "android" && d.kind && d.kind !== "apk") fail(`kind_${key}`, "android_apk_only");
  }
  for (const [group, shots] of Object.entries(app.screenshots || {})) {
    const bad = shots.find((s) => !MEDIA_PATTERN.test(s.url));
    if (bad) fail("screenshots", "screenshot_pattern", { url: bad.url });
    if (group !== "default" && !LANG_PATTERN.test(group)) fail("screenshots", "lang_pattern", { lang: group });
  }
  if (published && !Object.values(app.downloads).some((d) => d.url)) fail("downloads", "downloads_required");
  return errors;
}

// ── Koleksiyonlar ────────────────────────────────────────────
// Katalogda üst düzey `collections`: [{ id, title, description, apps: [id…] }]. Sıra = mağazadaki sıra.

export const COLLECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function emptyCollection() {
  return { id: "", title: {}, description: {}, apps: [] };
}

export function normalizeCollection(raw, defaultLang) {
  const apps = Array.isArray(raw?.apps) ? raw.apps.filter((a) => typeof a === "string" && a) : [];
  return {
    id: typeof raw?.id === "string" ? raw.id : "",
    title: textMap(raw?.title, defaultLang),
    description: textMap(raw?.description, defaultLang),
    apps: [...new Set(apps)],
  };
}

export function serializeCollection(collection, defaultLang) {
  const out = { id: collection.id, title: textValue(cleanText(collection.title), defaultLang) };
  const description = cleanText(collection.description);
  if (hasText(description)) out.description = textValue(description, defaultLang);
  out.apps = [...collection.apps];
  return out;
}

export function collectionsFingerprint(collections, defaultLang = FALLBACK_LANG) {
  return JSON.stringify((collections || []).map((c) => serializeCollection(c, defaultLang)));
}

/** Başlıktan kimlik önerisi: "Game night!" → "game-night". */
export function slugify(text) {
  return String(text || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Alan anahtarı → { code, ...params }; boşsa koleksiyon geçerlidir. */
export function validateCollection(collection, others, appIds, defaultLang) {
  const errors = {};
  const fail = (key, code, params = {}) => { errors[key] = { code, ...params }; };
  if (!collection.id) fail("id", "id_required");
  else if (!COLLECTION_ID_PATTERN.test(collection.id)) fail("id", "collection_id_pattern");
  else if (others.some((c) => c.id === collection.id)) fail("id", "id_taken");
  if (!cleanText(collection.title)[defaultLang]) fail("title", "title_required", { lang: defaultLang });
  if (!collection.apps.length) fail("apps", "collection_empty");
  return errors;
}

/** Koleksiyonda olup katalogda olmayan uygulama kimlikleri. */
export function missingCollectionApps(collection, appIds) {
  const known = new Set(appIds);
  return collection.apps.filter((id) => !known.has(id));
}

/** Uygulama silinince ya da kimliği değişince koleksiyonları günceller. */
export function renameInCollections(collections, oldId, newId = null) {
  for (const collection of collections || []) {
    collection.apps = collection.apps.flatMap((id) => (id !== oldId ? [id] : newId ? [newId] : []));
    collection.apps = [...new Set(collection.apps)];
  }
}