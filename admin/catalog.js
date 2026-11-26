// Katalog veri modeli (v3): okuma (v1/v2 de okunur), doğrulama ve uygulamayla aynı JSON biçimi.
// CLD Hub'daki core/models.py ve schema/catalog.v3.schema.json ile aynı kuralları uygular.
//
// Düzenleyici, kaydı "taslak" denen düz bir nesne üzerinden düzenler. Panelin henüz
// düzenleme alanı olmayan v3 alanları (türler, kapak, video, sürüm geçmişi, diğer dillerin
// ekran görüntüleri…) taslağın `keep` kısmında olduğu gibi korunur ve geri yazılır.

export const CATALOG_VERSION = 3;
export const DEFAULT_LANGUAGES = ["tr", "en"];
export const EDITOR_LANGUAGES = [["tr", "Türkçe"], ["en", "İngilizce"]];   // Faz 3'te dil sekmeleri gelecek

export const PLATFORMS = [
  { key: "windows", label: "Windows", icon: "desktop_windows" },
  { key: "linux", label: "Linux", icon: "terminal" },
  { key: "macos", label: "macOS", icon: "laptop_mac" },
  { key: "android", label: "Android", icon: "android" },
];

export const STATUSES = { upcoming: "Yakında", released: "Yayında", archived: "Arşiv" };
export const CATEGORIES = { app: "Uygulama", game: "Oyun" };

// core/models.py InstallKind ile aynı. CLD Hub otomatik güncellemede dosyayı buna göre kurar.
export const KINDS = {
  "": "Otomatik (dosya adından)",
  file: "Tek dosya (taşınabilir)",
  zip: "ZIP (klasöre açılır)",
  inno: "Inno Setup kurulumu",
  apk: "Android paketi (APK)",
};

/** Dosya adından kurulum tipi tahmini; "Son sürümden doldur" kullanır. */
export function guessKind(filename) {
  const name = filename.toLowerCase();
  if (name.endsWith(".zip")) return "zip";
  if (name.endsWith(".apk")) return "apk";
  if (name.endsWith(".exe") && /setup|install/.test(name)) return "inno";
  return "file";
}

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

const normalizeSha = (value) => String(value || "").trim().toLowerCase().replace(/^sha256:/, "");
const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

/** Düz yazı ya da dil eşlemesi → boş olmayan çevirilerden oluşan eşleme. */
function textMap(value, defaultLang) {
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

function parseDownload(value) {
  const entry = typeof value === "string" ? { url: value } : value || {};
  if (!entry.url) return null;
  return {
    url: entry.url, size_mb: Number(entry.size_mb) || 0,
    sha256: normalizeSha(entry.sha256), kind: KINDS[entry.kind] && entry.kind ? entry.kind : "",
  };
}

export function emptyApp() {
  return {
    id: "", name: "", names: {}, category: "app", status: "upcoming",
    subtitle: {}, description: {}, changelog: {},
    version: "", release_date: "", github_repo: "", icon: "default", logo: "",
    featured: false, hidden: false,
    screenshots: [],          // varsayılan gruptaki ekran görüntüleri (adres/yol)
    platforms: [], downloads: {},
    keep: { captions: {}, platformExtras: {}, otherScreenshots: {}, fields: {} },
  };
}

const KEPT_FIELDS = ["developer", "genres", "age_rating", "app_languages", "links", "history"];

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
    version: String(release.version || ""),
    release_date: String(release.date || ""),
    github_repo: raw.github_repo || "",
    icon: raw.icon || "default",
    logo: typeof media.logo === "string" ? media.logo : "",
    featured: Boolean(raw.featured),
    hidden: Boolean(raw.hidden),
    platforms: Object.keys(platforms),
  });
  for (const [platform, value] of Object.entries(platforms)) {
    const download = parseDownload(value);
    if (download) app.downloads[platform] = download;
    const extras = Object.fromEntries(Object.entries(value || {}).filter(([k]) => k === "min_os" || k === "version"));
    if (Object.keys(extras).length) app.keep.platformExtras[platform] = extras;
  }
  let shots = media.screenshots;
  if (Array.isArray(shots)) shots = { default: shots };
  for (const [group, items] of Object.entries(isObject(shots) ? shots : {})) {
    const list = (Array.isArray(items) ? items : []).map((item) => (typeof item === "string" ? { url: item } : item))
      .filter((item) => item && item.url);
    if (group === "default") {
      app.screenshots = list.map((item) => item.url);
      for (const item of list) if (item.caption) app.keep.captions[item.url] = item.caption;
    } else if (list.length) {
      app.keep.otherScreenshots[group] = list;
    }
  }
  if (media.cover) app.keep.fields.cover = media.cover;
  if (media.video) app.keep.fields.video = media.video;
  for (const key of KEPT_FIELDS) if (raw[key] !== undefined) app.keep.fields[key] = structuredClone(raw[key]);
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
    screenshots: Array.isArray(raw.screenshots) ? raw.screenshots.filter((u) => typeof u === "string" && u) : [],
  });
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
  const fields = app.keep?.fields || {};
  const names = cleanText(app.names);
  if (Object.keys(names).length) names[defaultLang] = app.name;
  const out = { id: app.id, name: Object.keys(names).length ? textValue(names, defaultLang) : app.name,
                category: app.category, status: app.status };
  const subtitle = cleanText(app.subtitle), description = cleanText(app.description);
  if (hasText(subtitle)) out.subtitle = textValue(subtitle, defaultLang);
  if (hasText(description)) out.description = textValue(description, defaultLang);
  for (const key of ["developer", "genres", "age_rating", "app_languages", "links"]) {
    if (fields[key] !== undefined) out[key] = structuredClone(fields[key]);
  }
  if (app.github_repo) out.github_repo = app.github_repo;
  if (app.icon && app.icon !== "default") out.icon = app.icon;
  if (app.featured) out.featured = true;
  if (app.hidden) out.hidden = true;

  const media = {};
  if (app.logo) media.logo = app.logo;
  if (fields.cover) media.cover = fields.cover;
  if (fields.video) media.video = fields.video;
  const screenshots = {};
  if (app.screenshots?.length) {
    screenshots.default = app.screenshots.map((url) => {
      const caption = textMap(app.keep?.captions?.[url], defaultLang);
      return hasText(caption) ? { url, caption: textValue(caption, defaultLang) } : { url };
    });
  }
  Object.assign(screenshots, structuredClone(app.keep?.otherScreenshots || {}));
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
    const extras = app.keep?.platformExtras?.[p.key] || {};
    if (extras.version && d?.url) entry.version = extras.version;
    if (extras.min_os) entry.min_os = extras.min_os;
    return [p.key, entry];
  }));
  out.release = release;
  if (fields.history?.length) {
    out.history = fields.history.map((past) => {
      const entry = { version: past.version };
      if (past.date) entry.date = past.date;
      const pastNotes = textMap(past.notes, defaultLang);
      if (hasText(pastNotes)) entry.notes = textValue(pastNotes, defaultLang);
      return entry;
    });
  }
  return out;
}

/** Sürüm değiştiyse önceki sürüm (tarih ve notlarıyla) sürüm geçmişinin başına eklenir. */
export function archivePreviousRelease(previous, app) {
  if (!previous?.version || previous.version === app.version || !app.version) return;
  const history = (app.keep.fields.history || []).filter((h) => h.version !== previous.version);
  const entry = { version: previous.version };
  if (previous.release_date) entry.date = previous.release_date;
  const notes = cleanText(previous.changelog);
  if (hasText(notes)) entry.notes = notes;
  app.keep.fields.history = [entry, ...history];
}

// Panelin değiştirmediği üst düzey alanlar (ör. stats_url) olduğu gibi korunur.
const MANAGED_KEYS = new Set(["catalog_version", "last_updated", "catalog_url", "languages", "media_base", "apps"]);
const TOP_ORDER = ["catalog_version", "last_updated", "languages", "catalog_url", "stats_url", "media_base"];

export function parseCatalog(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`catalog.json geçerli bir JSON değil: ${err.message}`);
  }
  if (!data || !Array.isArray(data.apps)) throw new Error("catalog.json içinde 'apps' listesi yok.");
  const languages = Array.isArray(data.languages) && data.languages.length ? data.languages : DEFAULT_LANGUAGES;
  return {
    catalog_url: data.catalog_url || "",
    languages: [...languages],
    media_base: data.media_base || "",
    extra: Object.fromEntries(Object.entries(data).filter(([key]) => !MANAGED_KEYS.has(key))),
    apps: data.apps.filter((a) => a && a.id).map((a) => normalizeApp(a, languages[0])),
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
  return JSON.stringify(data, null, 2) + "\n";
}

/** Değişiklik tespiti için zaman damgasından bağımsız karşılaştırma anahtarı. */
export function fingerprint(app) {
  return JSON.stringify(serializeApp(app, "tr"));
}

/** Logo/ekran görüntüsü yolunu tarayıcıda gösterilebilir adrese çevirir. */
export function resolveMedia(path, { base = "", owner, repo, branch } = {}) {
  if (!path || /^https?:\/\//.test(path)) return path;
  // Yeni yüklenen bir görsel Pages'e henüz çıkmamış olabilir; repodan doğrudan gösterilir.
  if (owner && repo && branch) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return base ? new URL(path, base).href : path;
}

// schema/catalog.v3.schema.json ile aynı kalıplar.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const MEDIA_PATTERN = /^(https?:\/\/\S+|media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+)$/;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Alan adı → hata mesajı sözlüğü döner; boşsa kayıt geçerlidir. */
export function validateApp(app, allApps, originalId = null) {
  const errors = {};
  if (!app.id) errors.id = "ID zorunlu.";
  else if (!ID_PATTERN.test(app.id)) errors.id = "Yalnızca harf, rakam, tire ve alt çizgi kullan.";
  else if (app.id !== originalId && allApps.some((a) => a.id === app.id)) errors.id = "Bu ID zaten kullanılıyor.";

  if (!app.name.trim()) errors.name = "Ad zorunlu.";
  const published = app.status !== "upcoming";
  if (published && !app.version.trim()) errors.version = "Yayındaki ya da arşivdeki bir uygulamanın sürümü olmalı.";
  else if (app.version && !VERSION_PATTERN.test(app.version)) errors.version = "Sürüm boşluk içeremez (ör. 1.2.0, 1.0.1-beta).";
  if (app.release_date && !DATE_PATTERN.test(app.release_date)) errors.release_date = "Tarih YYYY-AA-GG biçiminde olmalı.";
  if (app.github_repo && !REPO_PATTERN.test(app.github_repo)) errors.github_repo = "'kullanıcı/repo' biçiminde yaz.";
  if (app.logo && !MEDIA_PATTERN.test(app.logo)) errors.logo = "Logo, bir adres ya da media/<id>/… yolu olmalı.";

  for (const { key, label } of PLATFORMS) {
    const d = app.downloads[key];
    if (!d) continue;
    if (d.url && !isHttpUrl(d.url)) errors[`dl_${key}`] = `${label} bağlantısı geçerli bir URL değil.`;
    if (d.size_mb < 0) errors[`dl_${key}`] = `${label} boyutu negatif olamaz.`;
    if (d.sha256 && !SHA_PATTERN.test(d.sha256)) errors[`sha_${key}`] = "64 karakterlik bir SHA-256 değeri olmalı.";
    if (d.kind === "apk" && key !== "android") errors[`kind_${key}`] = "APK yalnızca Android için.";
    if (key === "android" && d.kind && d.kind !== "apk") errors[`kind_${key}`] = "Android'de yalnızca APK kurulabilir.";
  }
  const badShot = (app.screenshots || []).find((url) => !MEDIA_PATTERN.test(url));
  if (badShot) errors.screenshots = `Geçerli bir adres ya da media/ yolu değil: ${badShot}`;
  if (published && !Object.values(app.downloads).some((d) => d.url)) {
    errors.downloads = "Yayındaki ya da arşivdeki bir uygulamanın en az bir indirme bağlantısı olmalı.";
  }
  return errors;
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
