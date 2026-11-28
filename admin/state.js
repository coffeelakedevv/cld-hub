// Panelin ortak durumu ve değişiklik takibi.

import { collectionsFingerprint, fingerprint, mediaPaths, resolveMedia } from "./catalog.js";

export const state = {
  mode: null,              // "github" | "local"
  client: null,
  sha: null,               // kataloğun yüklendiği andaki blob sha'sı (çakışma denetimi)
  catalog: null,           // { catalog_url, languages, media_base, extra, apps }
  baseline: new Map(),     // id → serileştirilmiş kayıt (son yükleme/yayın anı)
  baselineLanguages: [],
  baselineCollections: "[]",
  baselineMedia: new Set(),
  pending: new Map(),      // media/… yolu → { bytes, url } (henüz yayınlanmamış görseller)
  filter: { query: "", category: "all", status: "all" },
  editing: null,
};

export const defaultLang = () => state.catalog?.languages?.[0] || "en";

export function resetBaseline() {
  const lang = defaultLang();
  state.baseline = new Map(state.catalog.apps.map((a) => [a.id, fingerprint(a, lang)]));
  state.baselineLanguages = [...state.catalog.languages];
  state.catalog.collections ||= [];
  state.baselineCollections = collectionsFingerprint(state.catalog.collections, lang);
  state.baselineMedia = new Set(state.catalog.apps.flatMap(mediaPaths));
}

export function clearPending() {
  for (const { url } of state.pending.values()) URL.revokeObjectURL(url);
  state.pending.clear();
}

export function addPending(path, image) {
  state.pending.get(path) && URL.revokeObjectURL(state.pending.get(path).url);
  state.pending.set(path, { bytes: image.bytes, url: image.url });
}

/** Görsel yolunu tarayıcıda gösterilebilir adrese çevirir (yayınlanmamışsa yerel önizleme). */
export function mediaUrl(path) {
  if (!path) return "";
  if (state.pending.has(path)) return state.pending.get(path).url;
  const client = state.mode === "github" ? state.client : null;
  return resolveMedia(path, {
    base: state.catalog?.media_base,
    ...(client ? { owner: client.owner, repo: client.repo, branch: client.branch } : {}),
  });
}

export function rowState(app) {
  if (!state.baseline.has(app.id)) return "new";
  return state.baseline.get(app.id) !== fingerprint(app, defaultLang()) ? "changed" : null;
}

export function changes() {
  const lang = defaultLang();
  const current = new Map(state.catalog.apps.map((a) => [a.id, a]));
  const added = [], modified = [], removed = [];
  for (const [id, app] of current) {
    if (!state.baseline.has(id)) added.push(app);
    else if (state.baseline.get(id) !== fingerprint(app, lang)) modified.push(app);
  }
  for (const id of state.baseline.keys()) if (!current.has(id)) removed.push(id);
  const languages = state.baselineLanguages.join(",") !== state.catalog.languages.join(",");
  const collections = state.baselineCollections !== collectionsFingerprint(state.catalog.collections, lang);
  return { added, modified, removed, languages, collections,
           count: added.length + modified.length + removed.length + (languages ? 1 : 0) + (collections ? 1 : 0) };
}

/** Yayında yüklenecek ve silinecek görseller. */
export function mediaChanges() {
  const used = new Set(state.catalog.apps.flatMap(mediaPaths));
  const uploads = [...state.pending.entries()].filter(([path]) => used.has(path))
    .map(([path, { bytes }]) => ({ path, bytes }));
  const deletions = [...state.baselineMedia].filter((path) => !used.has(path));
  return { uploads, deletions };
}
