import { GitHubClient, GitHubError } from "./github.js";
import {
  CATEGORIES, DEFAULT_LANGUAGES, LANG_PATTERN, PLATFORMS, STATUSES,
  diffApp, languageUsage, missingTexts, parseCatalog, removeLanguage, renameInCollections, serializeApp, serializeCatalog,
  translationStatus,
} from "./catalog.js";
import { initCollections, openCollections, refreshCollections } from "./collections.js";
import { initEditor, isEditorOpen, logoTile, normalizeCode, openEditor, refreshEditor, saveShortcut } from "./editor.js";
import { applyStatic, getLang, languageName, nativeLanguageName, setLang, t } from "./locales.js";
import {
  changes, clearPending, defaultLang, mediaChanges, resetBaseline, rowState, state,
} from "./state.js";
import {
  $, closeDialog, confirmDialog, emptyState, guardDialog, h, icon, openDialog, segmented, skeletonCards, toast,
} from "./ui.js";

const CONN_KEY = "cldhub_admin_connection";
const TOKEN_KEY = "cldhub_admin_token";
const THEME_KEY = "cldhub_admin_theme";

const store = {
  get: (area, key) => { try { return area.getItem(key); } catch { return null; } },
  set: (area, key, value) => { try { area.setItem(key, value); } catch { /* depolama kapalı */ } },
  remove: (area, key) => { try { area.removeItem(key); } catch { /* yok say */ } },
};

const errorText = (err) => (err?.code ? t(`error.${err.code}`, err.params || {}) : err?.message || String(err));

// ── Tema ─────────────────────────────────────────────────────

const darkQuery = matchMedia("(prefers-color-scheme: dark)");

function applyTheme(choice) {
  const dark = choice === "dark" || (choice === "system" && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#151312" : "#F7F6F2");
}

// ── Bağlantı ─────────────────────────────────────────────────

function savedConnection() {
  try {
    const conn = JSON.parse(store.get(localStorage, CONN_KEY) || "null");
    if (conn && conn.repo === "cld-hub-store") conn.repo = "cld-hub";   // repo yeniden adlandırıldı
    const token = store.get(sessionStorage, TOKEN_KEY) || store.get(localStorage, TOKEN_KEY);
    return conn ? { ...conn, token, remember: Boolean(store.get(localStorage, TOKEN_KEY)) } : null;
  } catch {
    return null;
  }
}

function storeConnection({ owner, repo, branch, path, token, remember }) {
  store.set(localStorage, CONN_KEY, JSON.stringify({ owner, repo, branch, path }));
  store.remove(localStorage, TOKEN_KEY);
  store.remove(sessionStorage, TOKEN_KEY);
  store.set(remember ? localStorage : sessionStorage, TOKEN_KEY, token);
}

function forgetToken() {
  store.remove(localStorage, TOKEN_KEY);
  store.remove(sessionStorage, TOKEN_KEY);
}

async function connect(conn) {
  const button = $("btn-connect");
  $("connect-error").textContent = "";
  button.disabled = true;
  button.classList.add("loading");
  try {
    const client = new GitHubClient(conn);
    await client.checkAccess();
    const file = await client.readCatalog();
    state.mode = "github";
    state.client = client;
    if (file) {
      state.catalog = parseCatalog(file.text);
      state.sha = file.sha;
    } else {
      state.catalog = { catalog_url: `https://raw.githubusercontent.com/${conn.owner}/${conn.repo}/${conn.branch}/${conn.path}`,
                        languages: [...DEFAULT_LANGUAGES], media_base: "", extra: {}, apps: [] };
      state.sha = null;
      toast(t("connect.created_on_publish", { path: conn.path }), "info");
    }
    storeConnection(conn);
    clearPending();
    resetBaseline();
    showCatalog();
  } catch (err) {
    $("connect-error").textContent = errorText(err);
    if (err instanceof GitHubError && err.status === 401) forgetToken();
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
  }
}

async function openLocalFile(file) {
  try {
    state.catalog = parseCatalog(await file.text());
    state.mode = "local";
    state.client = new GitHubClient();   // token'sız; yalnızca herkese açık sürüm bilgisi için
    state.sha = null;
    state.localName = file.name;
    clearPending();
    resetBaseline();
    showCatalog();
  } catch (err) {
    $("connect-error").textContent = errorText(err);
  }
}

async function reload() {
  if (state.mode !== "github") return;
  if (changes().count && !(await confirmDialog({ title: t("reload.title"), text: t("common.unpublished_lost"), ok: t("reload.ok") }))) return;
  $("app-grid").replaceChildren(...skeletonCards(4));
  try {
    const file = await state.client.readCatalog();
    if (file) {
      state.catalog = parseCatalog(file.text);
      state.sha = file.sha;
    }
    clearPending();
    resetBaseline();
    render(true);
    toast(t("reload.done"));
  } catch (err) {
    render();
    toast(errorText(err), "error");
  }
}

async function disconnect() {
  if (changes().count && !(await confirmDialog({ title: t("disconnect.title"), text: t("common.unpublished_lost"), ok: t("disconnect.ok") }))) return;
  forgetToken();
  clearPending();
  Object.assign(state, { mode: null, client: null, sha: null, catalog: null });
  $("view-catalog").hidden = true;
  $("view-connect").hidden = false;
  $("topbar-actions").hidden = true;
  $("source-label").hidden = true;
  $("dirty-pill").hidden = true;
  $("connect-form").token.value = "";
}

// ── Katalog ekranı ───────────────────────────────────────────

function sourceLabel() {
  if (state.mode === "github") {
    const c = state.client;
    return [h("span", { class: "dot" }), h("span", { class: "mono" }, `${c.owner}/${c.repo} · ${c.branch}`)];
  }
  return [icon("description"), h("span", { class: "mono" }, t("source.local", { name: state.localName || "catalog.json" }))];
}

function showCatalog() {
  $("view-connect").hidden = true;
  $("view-catalog").hidden = false;
  $("topbar-actions").hidden = false;
  $("source-label").hidden = false;
  $("source-label").replaceChildren(...sourceLabel());
  $("btn-publish").hidden = state.mode !== "github";
  $("menu-reload").hidden = state.mode !== "github";
  renderFilters();
  render(true);
}

function renderFilters() {
  const chip = (group, value, label) => h("button", {
    class: "chip", type: "button", "aria-pressed": String(state.filter[group] === value),
    onclick: () => { state.filter[group] = value; renderFilters(); render(true); },
  }, label);
  $("filters").replaceChildren(
    chip("category", "all", t("filter.all")),
    ...CATEGORIES.map((c) => chip("category", c, t(`category.${c}_plural`))),
    h("span", { class: "chip-sep" }),
    chip("status", "all", t("filter.any_status")),
    ...STATUSES.map((s) => chip("status", s, t(`status.${s}`))),
  );
}

function render(animate = false) {
  if (!state.catalog) return;
  const { query, category, status } = state.filter;
  const q = query.trim().toLocaleLowerCase();
  const apps = state.catalog.apps.filter((a) =>
    (category === "all" || a.category === category) &&
    (status === "all" || a.status === status) &&
    (!q || a.name.toLocaleLowerCase().includes(q) || a.id.toLocaleLowerCase().includes(q)));

  const grid = $("app-grid");
  grid.classList.toggle("animate", animate);
  if (!apps.length) {
    grid.replaceChildren(state.catalog.apps.length
      ? emptyState("search_off", t("list.no_match"), t("list.no_match_text"))
      : emptyState("inventory_2", t("list.empty"), t("list.empty_text")));
  } else {
    grid.replaceChildren(...apps.map((app, i) => renderCard(app, i)));
  }
  const total = state.catalog.apps.length;
  $("app-count").textContent = t("list.count", { count: total, langs: state.catalog.languages.join(", ") });
  updateDirty();
}

function updateDirty() {
  if (!state.catalog) return;
  const { count } = changes();
  $("dirty-pill").hidden = !count;
  $("dirty-text").textContent = t("list.unpublished", { count });
  $("publish-count").textContent = count ? String(count) : "";
  $("publish-count").hidden = !count;
  $("btn-publish").disabled = !count;
}

function renderCard(app, index) {
  const marker = rowState(app);
  const base = defaultLang();
  const platforms = PLATFORMS.filter((p) => app.platforms.includes(p.key));
  const subtitle = app.subtitle[getLang()] || app.subtitle[base] || Object.values(app.subtitle)[0] || "";
  const card = h("article", {
    class: `card${marker ? " changed" : ""}`, tabindex: "0", role: "button",
    "aria-label": t("list.edit", { name: app.name || app.id }),
    style: { "--i": String(index) },
    onclick: (e) => { if (!e.target.closest(".card-actions")) openEditor(app); },
    onkeydown: (e) => { if (e.key === "Enter" && e.target === card) openEditor(app); },
  },
  marker && h("span", { class: "unsaved", title: t(marker === "new" ? "list.new" : "list.changed") }),
  h("div", { class: "card-top" },
    logoTile(app),
    h("div", { class: "card-title" },
      h("h3", {}, app.name || app.id),
      h("div", { class: "mono muted" }, app.id))),
  subtitle && h("p", { class: "card-sub" }, subtitle),
  h("div", { class: "card-chips" },
    app.featured && h("span", { class: "status star" }, icon("star"), t("list.featured")),
    h("span", { class: `status ${app.status}` }, t(`status.${app.status}`)),
    app.hidden && h("span", { class: "status hidden" }, icon("visibility_off"), t("list.hidden")),
    h("span", { class: "status plain" }, t(`category.${app.category}`))),
  h("div", { class: "card-meta" },
    h("span", { class: "platforms", title: platforms.map((p) => p.label).join(", ") }, ...platforms.map((p) => icon(p.icon))),
    h("span", { class: "num" }, app.version ? `v${app.version}` : "—"),
    h("span", { class: "langs" }, ...state.catalog.languages.map((lang) => {
      const s = translationStatus(app, lang, base);
      return h("span", { class: `lang ${s.state}`, style: { "--p": `${s.percent}%` },
        title: `${languageName(lang)}: ${s.percent}%` }, lang);
    }))),
  h("div", { class: "card-actions" },
    h("button", { class: "btn btn-icon sm star", type: "button", "aria-pressed": String(app.featured),
      title: t(app.featured ? "list.unfeature" : "list.feature"), onclick: () => toggleFeatured(app) }, icon("star")),
    h("button", { class: "btn btn-icon sm", type: "button", title: t("common.delete"), onclick: () => removeApp(app) }, icon("delete"))));
  return card;
}

function toggleFeatured(app) {
  // Birden çok öne çıkan uygulama Keşfet'in üstünde sırayla gösterilir.
  app.featured = !app.featured;
  render();
}

async function removeApp(app) {
  const ok = await confirmDialog({ title: t("remove.title", { name: app.name || app.id }), text: t("remove.text"), ok: t("common.delete") });
  if (!ok) return;
  state.catalog.apps = state.catalog.apps.filter((a) => a !== app);
  renameInCollections(state.catalog.collections, app.id);
  render();
  toast(t("remove.done", { name: app.name || app.id }), "info");
}

// ── Katalog dilleri ──────────────────────────────────────────

function openLanguages() {
  renderLanguages();
  openDialog($("languages"));
}

function renderLanguages() {
  const langs = state.catalog.languages;
  $("lang-list").replaceChildren(...langs.map((code, index) => h("li", { class: "lang-item" },
    h("span", { class: "lang-code mono" }, code),
    h("div", { class: "grow" }, h("b", {}, nativeLanguageName(code)), h("div", { class: "hint" }, languageName(code))),
    index === 0
      ? h("span", { class: "status star" }, t("languages.default"))
      : h("button", { type: "button", class: "btn btn-icon sm", title: t("common.remove"), onclick: () => removeCatalogLanguage(code) },
        icon("delete")))));
  $("lang-error").textContent = "";
}

function addCatalogLanguage() {
  const box = $("lang-input");
  const code = normalizeCode(box.value);
  if (!code) return;
  if (!LANG_PATTERN.test(code)) { $("lang-error").textContent = t("error.lang_pattern", { lang: code }); return; }
  if (state.catalog.languages.includes(code)) { $("lang-error").textContent = t("languages.exists", { lang: code }); return; }
  state.catalog.languages = [...state.catalog.languages, code];
  box.value = "";
  renderLanguages();
  render();
  refreshEditor();
  toast(t("languages.added", { lang: nativeLanguageName(code) }));
}

async function removeCatalogLanguage(code) {
  const used = languageUsage(state.catalog.apps, code, state.catalog.collections);
  const ok = await confirmDialog({
    title: t("languages.remove_title", { lang: nativeLanguageName(code) }),
    text: used ? t("languages.remove_text_used", { count: used }) : t("languages.remove_text"),
    ok: t("common.remove"),
  });
  if (!ok) return;
  removeLanguage(state.catalog.apps, code, state.catalog.collections);
  state.catalog.languages = state.catalog.languages.filter((c) => c !== code);
  renderLanguages();
  render();
  refreshEditor();
}

// ── Yayınlama ────────────────────────────────────────────────

function describeChange(change) {
  const kind = t(`diff.${change.kind}`);
  switch (change.field) {
    case "name": case "subtitle": case "description": case "notes":
      return `${t(`diff.field.${change.field}`)} · ${nativeLanguageName(change.lang)} ${kind}`;
    case "version": case "date": case "category": case "status":
      return change.from && change.to ? `${t(`diff.field.${change.field}`)}: ${change.from} → ${change.to}`
        : `${t(`diff.field.${change.field}`)} ${kind}`;
    case "platform":
      return `${PLATFORMS.find((p) => p.key === change.platform)?.label || change.platform} ${t("diff.file")} ${kind}`;
    case "screenshots":
      return t("diff.screenshots", { group: change.group === "default" ? t("media.all_languages") : nativeLanguageName(change.group),
                                     from: change.from, to: change.to });
    default:
      return `${t(`diff.field.${change.field}`)} ${kind}`;
  }
}

function defaultCommitMessage(diff) {
  const parts = [];
  if (diff.added.length) parts.push(`add ${diff.added.map((a) => a.id).join(", ")}`);
  if (diff.modified.length) parts.push(`update ${diff.modified.map((a) => a.id).join(", ")}`);
  if (diff.removed.length) parts.push(`remove ${diff.removed.join(", ")}`);
  if (diff.languages) parts.push(`languages ${state.catalog.languages.join(", ")}`);
  if (diff.collections) parts.push("collections");
  const message = `catalog: ${parts.join("; ")}`;
  return message.length > 72 ? `catalog: ${diff.count} changes` : message;
}

function openPublish() {
  const diff = changes();
  if (!diff.count) return;
  const base = defaultLang();
  const media = mediaChanges();
  const items = [];
  const appItem = (iconName, cls, title, lines, warning) => h("li", { class: `change ${cls}` },
    icon(iconName),
    h("div", { class: "grow" }, h("b", {}, title),
      lines.length > 0 && h("ul", { class: "change-details" }, ...lines.map((line) => h("li", {}, line))),
      warning && h("div", { class: "change-warning" }, icon("translate"), warning)));
  const warningFor = (app) => {
    const missing = state.catalog.languages.slice(1).filter((lang) => missingTexts(app, lang, base).length);
    return missing.length ? t("publish.missing", { langs: missing.map(nativeLanguageName).join(", ") }) : null;
  };
  for (const app of diff.added) items.push(appItem("add_circle", "added", t("publish.added", { name: app.name }), [], warningFor(app)));
  for (const app of diff.modified) {
    const before = JSON.parse(state.baseline.get(app.id));
    const lines = diffApp(before, serializeApp(app, base), base).map(describeChange);
    const shown = lines.slice(0, 6);
    if (lines.length > 6) shown.push(t("publish.more", { count: lines.length - 6 }));
    items.push(appItem("edit", "modified", t("publish.modified", { name: app.name }), shown, warningFor(app)));
  }
  for (const id of diff.removed) items.push(appItem("remove_circle", "removed", t("publish.removed", { name: id }), []));
  if (diff.languages) {
    items.push(appItem("translate", "modified", t("publish.languages"),
      [`${state.baselineLanguages.join(", ")} → ${state.catalog.languages.join(", ")}`]));
  }
  if (diff.collections) {
    const before = JSON.parse(state.baselineCollections).map((c) => c.id);
    const after = state.catalog.collections.map((c) => c.id);
    items.push(appItem("collections_bookmark", "modified", t("publish.collections"),
      [`${before.join(", ") || "—"} → ${after.join(", ") || "—"}`]));
  }
  $("change-list").replaceChildren(...items);
  const mediaLines = [
    media.uploads.length && t("publish.uploads", { count: media.uploads.length }),
    media.deletions.length && t("publish.deletions", { count: media.deletions.length }),
  ].filter(Boolean);
  $("media-summary").replaceChildren(...mediaLines.map((line) => h("div", {}, icon("image"), line)));
  $("media-summary").hidden = !mediaLines.length;
  $("commit-message").value = defaultCommitMessage(diff);
  $("publish-error").textContent = "";
  $("publish-progress").hidden = true;
  const dialog = $("publish");
  dialog.classList.remove("done");
  openDialog(dialog);
}

async function publish(event) {
  event.preventDefault();
  const button = $("btn-publish-confirm");
  const message = $("commit-message").value.trim() || defaultCommitMessage(changes());
  const { uploads, deletions } = mediaChanges();
  const bar = $("publish-progress");
  button.disabled = true;
  button.classList.add("loading");
  bar.hidden = false;
  bar.value = 0;
  try {
    const result = await state.client.publish({
      catalogText: serializeCatalog(state.catalog), expectedSha: state.sha, uploads, deletions, message,
      onProgress: (done, total) => { bar.max = total; bar.value = done; },
    });
    state.sha = result.catalogSha;
    clearPending();
    resetBaseline();
    render();
    $("commit-link").href = result.commitUrl;
    $("publish").classList.add("done");
  } catch (err) {
    $("publish-error").textContent = errorText(err);
    bar.hidden = true;
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
  }
}

function exportCatalog() {
  const blob = new Blob([serializeCatalog(state.catalog)], { type: "application/json" });
  const link = h("a", { href: URL.createObjectURL(blob), download: "catalog.json" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  if (state.mode === "local") {
    resetBaseline();
    render();
  }
}

// ── Menü ─────────────────────────────────────────────────────

function toggleMenu(force) {
  const menu = $("menu");
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  $("btn-menu").setAttribute("aria-expanded", String(open));
  if (open) menu.querySelector("button:not([hidden])")?.focus();
}

// ── Başlatma ─────────────────────────────────────────────────

function relocalize() {
  applyStatic();
  if (state.catalog) {
    $("source-label").replaceChildren(...sourceLabel());
    renderFilters();
    render();
  }
  refreshEditor();
  if ($("languages").open) renderLanguages();
  refreshCollections();
}

function init() {
  applyStatic();
  const langSeg = segmented($("seg-lang"), { value: getLang(), onChange: (v) => { setLang(v); relocalize(); } });
  const themeChoice = store.get(localStorage, THEME_KEY) || "system";
  applyTheme(themeChoice);
  segmented($("seg-theme"), { value: themeChoice, onChange: (v) => { store.set(localStorage, THEME_KEY, v); applyTheme(v); } });
  darkQuery.addEventListener("change", () => applyTheme(store.get(localStorage, THEME_KEY) || "system"));
  void langSeg;

  const form = $("connect-form");
  const saved = savedConnection();
  if (saved) {
    for (const key of ["owner", "repo", "branch", "path"]) form[key].value = saved[key] || form[key].value;
    form.remember.checked = saved.remember;
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const conn = Object.fromEntries(["owner", "repo", "branch", "path", "token"].map((k) => [k, form[k].value.trim()]));
    conn.remember = form.remember.checked;
    if (Object.entries(conn).some(([k, v]) => k !== "remember" && !v)) {
      $("connect-error").textContent = t("connect.fill_all");
      return;
    }
    connect(conn);
  });
  $("toggle-token").addEventListener("click", () => {
    const input = form.token;
    input.type = input.type === "password" ? "text" : "password";
    $("toggle-token").firstElementChild.textContent = input.type === "password" ? "visibility" : "visibility_off";
  });
  $("local-file").addEventListener("change", (e) => e.target.files[0] && openLocalFile(e.target.files[0]));

  $("search").addEventListener("input", (e) => { state.filter.query = e.target.value; render(); });
  $("btn-add").addEventListener("click", () => openEditor());
  $("btn-publish").addEventListener("click", openPublish);
  $("btn-menu").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", (e) => { if (!$("menu").hidden && !e.target.closest("#menu")) toggleMenu(false); });
  $("menu-reload").addEventListener("click", () => { toggleMenu(false); reload(); });
  $("menu-export").addEventListener("click", () => { toggleMenu(false); exportCatalog(); });
  $("menu-languages").addEventListener("click", () => { toggleMenu(false); openLanguages(); });
  $("menu-collections").addEventListener("click", () => { toggleMenu(false); openCollections(); });
  $("menu-disconnect").addEventListener("click", () => { toggleMenu(false); disconnect(); });
  $("publish-form").addEventListener("submit", publish);
  $("lang-add").addEventListener("click", addCatalogLanguage);
  $("lang-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCatalogLanguage(); } });
  $("lang-suggestions").replaceChildren(...["de", "fr", "es", "it", "pt-BR", "ru", "ar", "ja", "ko", "zh", "nl", "pl", "uk", "hi", "id"]
    .map((code) => h("option", { value: code }, languageName(code))));

  guardDialog($("publish"));
  guardDialog($("languages"));
  guardDialog($("confirm"));
  initEditor({
    onSaved: (app, originalId) => {
      if (originalId && originalId !== app.id) renameInCollections(state.catalog.collections, originalId, app.id);
      render();
    },
    openLanguages,
  });
  initCollections({ onChange: () => render() });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const dialogOpen = document.querySelector("dialog[open]");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      if (isEditorOpen()) { e.preventDefault(); saveShortcut(); }
      return;
    }
    if (e.key === "Escape" && !$("menu").hidden) { toggleMenu(false); return; }
    if (typing || dialogOpen || !state.catalog || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "/") { e.preventDefault(); $("search").focus(); }
    else if (e.key.toLowerCase() === "n") { e.preventDefault(); openEditor(); }
  });

  window.addEventListener("beforeunload", (e) => {
    if (state.catalog && changes().count) e.preventDefault();
  });

  if (saved?.token) {
    form.token.value = saved.token;
    $("view-connect").hidden = true;
    $("view-catalog").hidden = false;
    $("app-grid").replaceChildren(...skeletonCards(4));
    connect({ ...saved }).then(() => {
      if (!state.catalog) { $("view-catalog").hidden = true; $("view-connect").hidden = false; }
    });
  }
}

init();
