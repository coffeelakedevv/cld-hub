// Uygulama düzenleyicisi: sağdan kayan panel, beş sekme (Genel · Metinler · Medya · Sürüm · Önizleme),
// ekran görüntüsü galerisi, sürüm sihirbazı ve uygulamadaki görünümün önizlemesi.
// Girdiler taslağı (state.editing.draft) doğrudan günceller; Kaydet doğrulayıp kataloğa yazar.

import {
  AGE_RATINGS, CATEGORIES, GENRES, ICONS, KINDS, LANG_PATTERN, LINK_KEYS, PLATFORMS, STATUSES,
  archivePreviousRelease, emptyApp, fingerprint, guessKind, guessPlatform, resolveText, translationStatus,
  validateApp,
} from "./catalog.js";
import { ImageError, processImage, shortHash, ACCEPT } from "./images.js";
import { formatDate, getLang, languageName, nativeLanguageName, t } from "./locales.js";
import { addPending, defaultLang, mediaUrl, state } from "./state.js";
import {
  $, closeDialog, confirmDialog, emptyState, guardDialog, h, icon, openDialog, segmented, tabStrip, tileColor, toast,
} from "./ui.js";

const TAB_OF_FIELD = (key) => {
  if (/^(logo|cover|video|screenshots)$/.test(key)) return "media";
  if (/^(version|release_date|github_repo|downloads)$/.test(key) || /^(dl|size|sha|kind)_/.test(key)) return "release";
  return "general";
};
const TABS = [
  ["general", "tune"], ["texts", "translate"], ["media", "photo_library"], ["release", "new_releases"], ["preview", "visibility"],
];
const COMMON_LANGS = ["en", "tr", "de", "fr", "es", "it", "pt", "pt-BR", "nl", "pl", "ru", "uk", "ar", "fa", "hi",
                      "id", "ja", "ko", "zh", "zh-TW", "sv", "cs", "ro", "el", "he", "vi", "th"];

let hooks = { onSaved: () => {} };
let tabs = null;

export function initEditor(options) {
  hooks = { ...hooks, ...options };
  const dialog = $("editor");
  guardDialog(dialog, confirmDiscard);
  $("btn-save").addEventListener("click", save);
  tabs = tabStrip($("editor-tabs"), { onChange: (tab) => showTab(tab) });
}

const ed = () => state.editing;
const draft = () => state.editing.draft;
const isDirty = () => ed() && fingerprint(draft(), defaultLang()) !== ed().original;

async function confirmDiscard() {
  if (!isDirty()) return true;
  return confirmDialog({ title: t("editor.discard_title"), text: t("editor.discard_text"), ok: t("editor.discard") });
}

export function isEditorOpen() {
  return $("editor").open;
}

export function openEditor(app = null) {
  const lang = defaultLang();
  const data = structuredClone(app || emptyApp());
  if (!app) data.developer = "Lumina Software";
  state.editing = {
    originalId: app ? app.id : null, draft: data, original: fingerprint(data, lang), errors: {},
    tab: "general", textLang: lang, shotGroup: "default",
    preview: { lang: getLang() === "tr" && state.catalog.languages.includes("tr") ? "tr" : lang, theme: "dark", width: "desktop" },
    wizard: null,
  };
  renderHeader();
  tabs.set("general");
  showTab("general");
  $("editor-error").textContent = "";
  openDialog($("editor"));
  requestAnimationFrame(() => tabs.move());
}

/** Dil değişince açık düzenleyiciyi yeniden çizer. */
export function refreshEditor() {
  if (!isEditorOpen() || !ed()) return;
  for (const [tab] of TABS) $("editor-tabs").querySelector(`[data-tab="${tab}"] .tab-label`).textContent = t(`editor.tab.${tab}`);
  renderHeader();
  showTab(ed().tab);
  tabs.move();
}

function renderHeader() {
  const app = draft();
  $("editor-logo").replaceChildren(logoTile(app, "lg"));
  $("editor-title").textContent = app.name || (ed().originalId ? app.id : t("editor.new_title"));
  $("editor-sub").replaceChildren(
    h("span", { class: "mono" }, app.id || "—"),
    h("span", { class: `status ${app.status}` }, t(`status.${app.status}`)));
  markTabErrors();
}

export function logoTile(app, size = "") {
  const tile = h("div", { class: `logo ${size}`.trim() });
  if (app.logo) {
    tile.append(h("img", { src: mediaUrl(app.logo), alt: "", loading: "lazy",
      onerror: (e) => { e.target.remove(); tile.append(initial(app)); tile.classList.add("tinted"); } }));
  } else {
    tile.classList.add("tinted");
    tile.append(initial(app));
  }
  if (!app.logo) tile.style.setProperty("--tile", tileColor(app.id || app.name));
  return tile;
}

function initial(app) {
  const word = (app.name || app.id || "?").trim().split(/\s+/).pop();
  return h("span", {}, (word[0] || "?").toUpperCase());
}

function showTab(tab) {
  ed().tab = tab;
  const body = $("editor-body");
  const content = { general: generalTab, texts: textsTab, media: mediaTab, release: releaseTab, preview: previewTab }[tab]();
  const pane = h("div", { class: "pane" }, content);
  body.replaceChildren(pane);
  body.scrollTop = 0;
  markTabErrors();
}

function rerender() {
  const body = $("editor-body");
  const scroll = body.scrollTop;
  const content = { general: generalTab, texts: textsTab, media: mediaTab, release: releaseTab, preview: previewTab }[ed().tab]();
  body.replaceChildren(h("div", { class: "pane still" }, content));
  body.scrollTop = scroll;
  markTabErrors();
}

function markTabErrors() {
  const withErrors = new Set(Object.keys(ed()?.errors || {}).map(TAB_OF_FIELD));
  for (const tab of $("editor-tabs").querySelectorAll("[data-tab]")) {
    tab.classList.toggle("has-error", withErrors.has(tab.dataset.tab));
  }
}

// ── Alan yardımcıları ────────────────────────────────────────

function field(label, control, key, hint) {
  const error = key && ed().errors[key];
  return h("label", { class: `field${error ? " invalid" : ""}`, "data-key": key || null },
    h("span", { class: "field-label" }, label), control,
    hint && h("small", { class: "hint" }, hint),
    error && h("small", { class: "field-error" }, t(`error.${error.code}`, error)));
}

function input(props, onValue) {
  return h("input", { ...props, oninput: (e) => onValue(e.target.value) });
}

function select(options, value, onValue) {
  return h("select", { onchange: (e) => onValue(e.target.value) },
    ...options.map(([v, label]) => h("option", { value: v, selected: String(v) === String(value) }, label)));
}

function toggleChip(label, pressed, onToggle, iconName) {
  return h("button", {
    class: "chip", type: "button", "aria-pressed": String(pressed),
    onclick: (e) => {
      const next = e.currentTarget.getAttribute("aria-pressed") !== "true";
      e.currentTarget.setAttribute("aria-pressed", String(next));
      onToggle(next);
    },
  }, iconName && icon(iconName), label);
}

const section = (iconName, title, extra) =>
  h("div", { class: "section" }, icon(iconName), h("span", { class: "grow" }, title), extra);

function langSeg(langs, value, onChange, { dots = null, addButton = false } = {}) {
  const el = h("div", { class: "seg seg-scroll", role: "group" },
    ...langs.map((code) => h("button", { type: "button", "data-v": code, title: languageName(code) },
      dots && h("span", { class: `sd ${dots(code)}` }),
      code === "default" ? t("media.all_languages") : nativeLanguageName(code))),
    addButton && h("button", { type: "button", "data-v": "__add", "data-action": "add", class: "seg-add",
      title: t("languages.title"), onclick: () => hooks.openLanguages() }, icon("add")));
  segmented(el, { value, onChange });
  return el;
}

/** Katalog dilleri + taslakta içeriği olan başka diller. */
function editorLanguages() {
  const langs = [...state.catalog.languages];
  const app = draft();
  for (const map of [app.subtitle, app.description, app.changelog, app.names]) {
    for (const code of Object.keys(map || {})) if (!langs.includes(code)) langs.push(code);
  }
  return langs;
}

function updateHeaderLater() {
  clearTimeout(updateHeaderLater.timer);
  updateHeaderLater.timer = setTimeout(renderHeader, 120);
}

// ── Genel ────────────────────────────────────────────────────

function generalTab() {
  const app = draft();
  const isExisting = Boolean(ed().originalId);
  const genres = [...GENRES[app.category] || [], ...app.genres.filter((g) => !(GENRES[app.category] || []).includes(g))];
  return [
    h("div", { class: "grid-2" },
      field(t("field.id"), input({ value: app.id, disabled: isExisting, class: "mono", placeholder: "CLD-XX-01012026",
        autocomplete: "off", spellcheck: "false" }, (v) => { app.id = v.trim(); updateHeaderLater(); }), "id",
      isExisting ? t("hint.id_locked") : t("hint.id")),
      field(t("field.name"), input({ value: app.name, placeholder: "CLD …" }, (v) => { app.name = v; updateHeaderLater(); }), "name")),
    h("div", { class: "grid-3" },
      field(t("field.category"), select(CATEGORIES.map((c) => [c, t(`category.${c}`)]), app.category,
        (v) => { app.category = v; rerender(); }), "category"),
      field(t("field.status"), select(STATUSES.map((s) => [s, t(`status.${s}`)]), app.status,
        (v) => { app.status = v; renderHeader(); }), "status"),
      field(t("field.developer"), input({ value: app.developer }, (v) => { app.developer = v; }), "developer")),

    section("visibility", t("section.visibility")),
    h("div", { class: "chips" },
      toggleChip(t("field.featured"), app.featured, (v) => { app.featured = v; }, "star"),
      toggleChip(t("field.hidden"), app.hidden, (v) => { app.hidden = v; }, "visibility_off")),
    h("p", { class: "hint" }, t("hint.featured_hidden")),

    section("category", t("section.genres")),
    h("div", { class: "chips" }, ...genres.map((g) => toggleChip(t(`genre.${g}`), app.genres.includes(g), (on) => {
      app.genres = on ? [...app.genres, g] : app.genres.filter((x) => x !== g);
    }))),
    errorLine("genres"),

    section("shield_person", t("section.age")),
    (() => {
      const el = h("div", { class: "seg" },
        h("button", { type: "button", "data-v": "" }, t("common.none")),
        ...AGE_RATINGS.map((a) => h("button", { type: "button", "data-v": String(a) }, `${a}+`)));
      segmented(el, { value: app.age_rating ? String(app.age_rating) : "", onChange: (v) => { app.age_rating = v ? Number(v) : null; } });
      return el;
    })(),

    section("language", t("section.app_languages")),
    appLanguagesEditor(app),
    h("p", { class: "hint" }, t("hint.app_languages")),

    section("link", t("section.links")),
    h("div", { class: "grid-3" }, ...LINK_KEYS.map((key) => field(t(`field.link_${key}`),
      input({ value: app.links[key] || "", type: key === "support" ? "text" : "url",
              placeholder: key === "support" ? "https://… / mailto:…" : "https://…" },
        (v) => { app.links = { ...app.links, [key]: v }; }), `link_${key}`))),
  ];
}

function errorLine(key) {
  const error = ed().errors[key];
  return error ? h("small", { class: "field-error block" }, t(`error.${error.code}`, error)) : null;
}

function appLanguagesEditor(app) {
  const list = h("div", { class: "chips" });
  const draw = () => list.replaceChildren(
    ...app.app_languages.map((code) => h("span", { class: "token" }, nativeLanguageName(code),
      h("button", { type: "button", "aria-label": t("common.remove"), onclick: () => {
        app.app_languages = app.app_languages.filter((c) => c !== code); draw();
      } }, icon("close")))),
    adder);
  const datalist = h("datalist", { id: "lang-suggestions" },
    ...COMMON_LANGS.map((code) => h("option", { value: code }, languageName(code))));
  const box = h("input", { class: "token-input mono", list: "lang-suggestions", placeholder: t("hint.lang_code"),
    autocomplete: "off", spellcheck: "false",
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } } });
  const add = () => {
    const code = normalizeCode(box.value);
    if (!code) return;
    if (!LANG_PATTERN.test(code)) { box.classList.add("shake"); setTimeout(() => box.classList.remove("shake"), 400); return; }
    if (!app.app_languages.includes(code)) app.app_languages = [...app.app_languages, code];
    box.value = "";
    draw();
    box.focus();
  };
  const adder = h("span", { class: "token-adder" }, box, datalist,
    h("button", { type: "button", class: "btn btn-icon sm", "aria-label": t("common.add"), onclick: add }, icon("add")));
  draw();
  return h("div", {}, list, errorLine("app_languages"));
}

export function normalizeCode(value) {
  const [lang, region] = String(value || "").trim().replace("_", "-").split("-");
  if (!lang) return "";
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}

// ── Metinler ─────────────────────────────────────────────────

function textsTab() {
  const app = draft();
  const base = defaultLang();
  const langs = editorLanguages();
  if (!langs.includes(ed().textLang)) ed().textLang = base;
  const lang = ed().textLang;
  const source = (key) => (lang !== base && app[key][base]
    ? h("div", { class: "source-hint" }, h("b", {}, t("texts.source", { lang: nativeLanguageName(base) })), " ", app[key][base])
    : null);
  const counter = h("small", { class: "counter" });
  const updateCounter = (v) => { counter.textContent = `${v.length}/80`; counter.classList.toggle("warn", v.length > 70); };
  const setText = (key, v) => {
    const map = { ...app[key] };
    if (v.trim()) map[lang] = v; else delete map[lang];
    app[key] = map;
    refreshDots();
  };
  const seg = langSeg(langs, lang, (v) => { ed().textLang = v; rerender(); },
    { dots: (code) => translationStatus(app, code, base).state, addButton: true });
  const refreshDots = () => {
    for (const code of langs) {
      const dot = seg.querySelector(`[data-v="${CSS.escape(code)}"] .sd`);
      if (dot) dot.className = `sd ${translationStatus(app, code, base).state}`;
    }
  };
  const pitch = input({ value: app.subtitle[lang] || "", maxlength: "80",
    placeholder: lang === base ? t("texts.pitch_placeholder") : (app.subtitle[base] || "") },
  (v) => { setText("subtitle", v); updateCounter(v); });
  updateCounter(pitch.value);
  return [
    h("div", { class: "seg-row" }, seg),
    lang !== base && field(t("texts.name", { lang: nativeLanguageName(lang) }),
      input({ value: app.names?.[lang] || "", placeholder: app.name },
        (v) => { const names = { ...app.names }; if (v.trim()) names[lang] = v; else delete names[lang]; app.names = names; }),
      null, t("hint.name_translation")),
    field(h("span", { class: "label-row" }, t("texts.pitch"), counter), pitch, null, lang === base ? t("hint.pitch") : null),
    source("subtitle"),
    field(t("texts.description"), h("textarea", { rows: "7", placeholder: lang === base ? "" : (app.description[base] || ""),
      oninput: (e) => setText("description", e.target.value) }, app.description[lang] || "")),
    source("description"),
    field(t("texts.changelog"), h("textarea", { rows: "4", placeholder: t("texts.changelog_placeholder"),
      oninput: (e) => setText("changelog", e.target.value) }, app.changelog[lang] || ""), null, t("hint.changelog")),
    source("changelog"),
    lang !== base && h("p", { class: "hint" }, icon("info"), " ", t("texts.fallback_note", { lang: nativeLanguageName(base) })),
  ];
}

// ── Medya ────────────────────────────────────────────────────

function canUpload() {
  return state.mode === "github";
}

async function prepareImage(file, kind) {
  const app = draft();
  if (!app.id || !/^[A-Za-z0-9_-]+$/.test(app.id)) throw new ImageError("image_need_id");
  const image = await processImage(file, kind);
  const hash = await shortHash(image.bytes);
  const prefix = { logo: "logo", cover: "cover", screenshot: "shot" }[kind];
  const path = `media/${app.id}/${prefix}-${hash}.${image.ext}`;
  addPending(path, image);
  return { path, image };
}

function imageError(err) {
  if (err instanceof ImageError) return t(`error.${err.code}`, err.params);
  return err.message;
}

function singleImage(kind, key) {
  const app = draft();
  const wide = kind === "cover";
  const status = h("small", { class: "hint" }, t(`media.${kind}_rules`));
  const preview = h("div", { class: `media-preview ${wide ? "wide" : "square"}` });
  const drawPreview = () => {
    preview.replaceChildren(app[key]
      ? h("img", { src: mediaUrl(app[key]), alt: "", onerror: (e) => e.target.replaceWith(icon("broken_image")) })
      : icon(wide ? "panorama" : "image"));
    if (kind === "logo") renderHeader();
  };
  const pathInput = input({ value: app[key], class: "mono", spellcheck: "false", placeholder: `media/${app.id || "<ID>"}/…` },
    (v) => { app[key] = v.trim(); drawPreview(); });
  const fileInput = h("input", { type: "file", accept: ACCEPT.join(","), hidden: true, onchange: async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    preview.classList.add("busy");
    status.className = "hint";
    status.textContent = t("media.processing");
    try {
      const { path, image } = await prepareImage(file, kind);
      app[key] = path;
      pathInput.value = path;
      status.textContent = t("media.ready", { size: `${image.width}×${image.height}`, kb: Math.round(image.bytes.length / 1024), type: image.ext.toUpperCase() });
      drawPreview();
    } catch (err) {
      status.className = "field-error";
      status.textContent = imageError(err);
    } finally {
      preview.classList.remove("busy");
    }
  } });
  drawPreview();
  const error = ed().errors[key];
  return h("div", { class: `media-row${error ? " invalid" : ""}`, "data-key": key },
    preview,
    h("div", { class: "media-fields" },
      h("div", { class: "media-actions" },
        canUpload() && h("button", { type: "button", class: "btn btn-ghost", onclick: () => fileInput.click() },
          icon("upload"), t(app[key] ? "media.replace" : "media.upload")),
        app[key] && h("button", { type: "button", class: "btn btn-ghost", onclick: () => { app[key] = ""; pathInput.value = ""; drawPreview(); rerender(); } },
          icon("delete"), t("common.remove")),
        fileInput),
      field(t("media.address"), pathInput, null),
      error ? h("small", { class: "field-error" }, t(`error.${error.code}`, error)) : status,
      !canUpload() && h("small", { class: "hint" }, t("media.local_mode"))));
}

function mediaTab() {
  const app = draft();
  const iconGrid = h("div", { class: "icon-grid", role: "group" },
    ...Object.entries(ICONS).map(([key, name]) => h("button", {
      class: "icon-option", type: "button", title: key, "aria-pressed": String(app.icon === key),
      onclick: (e) => {
        app.icon = key;
        for (const b of iconGrid.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
      },
    }, icon(name))));
  return [
    section("account_box", t("media.logo")),
    singleImage("logo", "logo"),
    h("p", { class: "hint" }, t("media.icon_fallback")),
    iconGrid,
    section("panorama", t("media.cover")),
    singleImage("cover", "cover"),
    section("smart_display", t("media.video")),
    field(t("media.video_url"), input({ value: app.video, type: "url", placeholder: "https://www.youtube.com/watch?v=…" },
      (v) => { app.video = v.trim(); }), "video"),
    section("photo_library", t("media.screenshots")),
    screenshotsEditor(),
  ];
}

function screenshotsEditor() {
  const app = draft();
  const groups = ["default", ...editorLanguages()];
  if (!groups.includes(ed().shotGroup)) ed().shotGroup = "default";
  const group = ed().shotGroup;
  const seg = langSeg(groups, group, (v) => { ed().shotGroup = v; rerender(); },
    { dots: (code) => (code === "default" ? (app.screenshots.default?.length ? "full" : "empty")
      : app.screenshots[code]?.length ? "full" : "empty") });
  const shots = app.screenshots[group];
  const parts = [h("div", { class: "seg-row" }, seg)];
  if (group !== "default" && !shots) {
    parts.push(h("div", { class: "group-off" },
      emptyState("translate", t("media.group_off_title", { lang: nativeLanguageName(group) }), t("media.group_off_text")),
      h("button", { type: "button", class: "btn btn-primary", onclick: () => {
        app.screenshots = { ...app.screenshots, [group]: [] };
        rerender();
      } }, icon("add_photo_alternate"), t("media.group_on", { lang: nativeLanguageName(group) }))));
    return parts;
  }
  const list = shots || [];
  const gallery = h("div", { class: "gallery" });
  const captionLangs = group === "default" ? editorLanguages() : [group];
  const drawGallery = () => {
    gallery.replaceChildren(...list.map((shot, index) => shotCard(shot, index, list, captionLangs, drawGallery)));
    const dot = seg.querySelector(`[data-v="${CSS.escape(group)}"] .sd`);
    if (dot) dot.className = `sd ${list.length ? "full" : "empty"}`;
  };
  drawGallery();

  const fileInput = h("input", { type: "file", accept: ACCEPT.join(","), multiple: true, hidden: true,
    onchange: () => { addShots([...fileInput.files]); fileInput.value = ""; } });
  const drop = h("div", { class: `drop${canUpload() ? "" : " disabled"}`, tabindex: canUpload() ? "0" : null, role: "button",
    onclick: () => canUpload() && fileInput.click(),
    onkeydown: (e) => { if ((e.key === "Enter" || e.key === " ") && canUpload()) { e.preventDefault(); fileInput.click(); } },
    ondragenter: (e) => { e.preventDefault(); if (canUpload()) drop.classList.add("over"); },
    ondragover: (e) => { e.preventDefault(); },
    ondragleave: (e) => { if (!drop.contains(e.relatedTarget)) drop.classList.remove("over"); },
    ondrop: (e) => {
      e.preventDefault();
      drop.classList.remove("over");
      if (canUpload()) addShots([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
    },
  }, icon("cloud_upload", "drop-icon"), h("b", {}, t("media.drop")), h("span", { class: "hint" },
    canUpload() ? t("media.drop_rules") : t("media.local_mode")), fileInput);

  async function addShots(files) {
    for (const file of files) {
      const placeholder = h("div", { class: "shot loading" }, h("div", { class: "shot-img" }, ring()), h("div", { class: "shot-body" }, file.name));
      gallery.append(placeholder);
      try {
        const { path } = await prepareImage(file, "screenshot");
        if (!list.some((s) => s.url === path)) list.push({ url: path, caption: {} });
        if (!app.screenshots[group]) app.screenshots = { ...app.screenshots, [group]: list };
      } catch (err) {
        toast(`${file.name}: ${imageError(err)}`, "error");
      }
      placeholder.remove();
      drawGallery();
    }
  }

  const add = h("div", { class: "url-add" },
    h("input", { class: "mono", placeholder: t("media.add_url"), spellcheck: "false",
      onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(e.target); } } }),
    h("button", { type: "button", class: "btn btn-ghost", onclick: (e) => addUrl(e.currentTarget.previousElementSibling) },
      icon("add_link"), t("common.add")));
  function addUrl(box) {
    const url = box.value.trim();
    if (!url) return;
    list.push({ url, caption: {} });
    if (!app.screenshots[group]) app.screenshots = { ...app.screenshots, [group]: list };
    box.value = "";
    drawGallery();
  }

  parts.push(drop, errorLine("screenshots"), gallery, add);
  if (group !== "default") {
    parts.push(h("button", { type: "button", class: "btn btn-ghost danger-text", onclick: async () => {
      const ok = !list.length || await confirmDialog({ title: t("media.group_remove_title", { lang: nativeLanguageName(group) }),
        text: t("media.group_remove_text"), ok: t("common.remove") });
      if (!ok) return;
      const next = { ...app.screenshots };
      delete next[group];
      app.screenshots = next;
      rerender();
    } }, icon("delete_sweep"), t("media.group_remove", { lang: nativeLanguageName(group) })));
  }
  return parts;
}

function ring() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 44 44");
  svg.setAttribute("class", "ring");
  svg.innerHTML = '<circle class="ring-bg" cx="22" cy="22" r="18"/><circle class="ring-fg" cx="22" cy="22" r="18"/>';
  return svg;
}

function shotCard(shot, index, list, captionLangs, redraw) {
  const move = (delta) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    redraw();
  };
  const card = h("div", { class: "shot", draggable: "true",
    ondragstart: (e) => { e.dataTransfer.setData("text/x-shot", String(index)); card.classList.add("dragging"); },
    ondragend: () => card.classList.remove("dragging"),
    ondragover: (e) => { if (e.dataTransfer.types.includes("text/x-shot")) { e.preventDefault(); card.classList.add("drop-target"); } },
    ondragleave: () => card.classList.remove("drop-target"),
    ondrop: (e) => {
      const from = Number(e.dataTransfer.getData("text/x-shot"));
      card.classList.remove("drop-target");
      if (Number.isNaN(from) || from === index) return;
      e.preventDefault();
      const [item] = list.splice(from, 1);
      list.splice(index, 0, item);
      redraw();
    },
  },
  h("div", { class: "shot-img" },
    h("img", { src: mediaUrl(shot.url), alt: "", loading: "lazy", onerror: (e) => e.target.replaceWith(icon("broken_image")) }),
    h("span", { class: "badge" }, String(index + 1)),
    state.pending.has(shot.url) && h("span", { class: "badge new" }, t("media.not_published")),
    h("div", { class: "shot-tools" },
      h("button", { type: "button", title: t("media.move_left"), disabled: index === 0, onclick: () => move(-1) }, icon("chevron_left")),
      h("button", { type: "button", title: t("media.move_right"), disabled: index === list.length - 1, onclick: () => move(1) }, icon("chevron_right")),
      h("button", { type: "button", title: t("common.remove"), class: "danger", onclick: () => { list.splice(index, 1); redraw(); } }, icon("delete")))),
  h("div", { class: "shot-body" },
    ...captionLangs.map((lang) => h("label", { class: "caption" },
      captionLangs.length > 1 && h("span", { class: "caption-lang" }, lang),
      h("input", { value: shot.caption?.[lang] || "", placeholder: t("media.caption"),
        oninput: (e) => {
          const caption = { ...shot.caption };
          if (e.target.value.trim()) caption[lang] = e.target.value; else delete caption[lang];
          shot.caption = caption;
        } })))));
  return card;
}

// ── Sürüm ────────────────────────────────────────────────────

function releaseTab() {
  if (ed().wizard) return wizardView();
  const app = draft();
  const platformRows = PLATFORMS.map(({ key, label, icon: iconName }) => {
    const enabled = app.platforms.includes(key);
    const d = app.downloads[key] || { url: "", size_mb: 0, sha256: "", kind: "" };
    const extras = app.platformExtras[key] || {};
    const setDownload = (patch) => {
      app.downloads = { ...app.downloads, [key]: { ...d, ...app.downloads[key], ...patch } };
      if (!app.downloads[key].url) { const next = { ...app.downloads }; delete next[key]; app.downloads = next; }
    };
    const kinds = KINDS.filter((k) => (key === "android" ? k === "" || k === "apk" : k !== "apk"));
    const row = h("div", { class: `platform${enabled ? "" : " off"}` },
      h("label", { class: "switch-row" },
        h("input", { type: "checkbox", class: "switch", checked: enabled, onchange: (e) => {
          app.platforms = e.target.checked ? PLATFORMS.map((p) => p.key).filter((k) => k === key || app.platforms.includes(k))
            : app.platforms.filter((k) => k !== key);
          row.classList.toggle("off", !e.target.checked);
        } }),
        icon(iconName), h("b", {}, label),
        h("span", { class: "hint grow" }, enabled && !d.url ? t("release.planned") : "")),
      h("div", { class: "platform-fields" },
        field(t("release.download_url"), input({ type: "url", value: d.url, placeholder: "https://github.com/…/releases/download/…" },
          (v) => setDownload({ url: v.trim() })), `dl_${key}`),
        h("div", { class: "grid-3" },
          field(t("release.kind"), select(kinds.map((k) => [k, t(`kind.${k || "auto"}`)]), d.kind || "",
            (v) => setDownload({ kind: v })), `kind_${key}`),
          field(t("release.size"), input({ type: "number", min: "0", step: "0.01", value: d.size_mb || "" },
            (v) => setDownload({ size_mb: Number(v) || 0 })), `size_${key}`),
          field(t("release.min_os"), input({ value: extras.min_os || "", placeholder: key === "android" ? "Android 8" : key === "windows" ? "Windows 10" : "" },
            (v) => { app.platformExtras = { ...app.platformExtras, [key]: { ...extras, min_os: v } }; }), null)),
        field("SHA-256", input({ value: d.sha256 || "", class: "mono", spellcheck: "false", placeholder: t("release.sha_hint") },
          (v) => setDownload({ sha256: v.trim().toLowerCase().replace(/^sha256:/, "") })), `sha_${key}`)));
    return row;
  });

  return [
    h("div", { class: "release-hero" },
      h("div", { class: "grow" },
        h("div", { class: "eyebrow" }, t("release.current")),
        h("div", { class: "release-version" }, app.version ? `v${app.version}` : t("release.none")),
        h("div", { class: "hint" }, app.release_date ? formatDate(app.release_date) : "")),
      h("button", { type: "button", class: "btn btn-primary", onclick: startWizard }, icon("rocket_launch"), t("release.new"))),
    h("div", { class: "grid-3" },
      field(t("field.github_repo"), input({ value: app.github_repo, placeholder: "coffeelakedevv/app-name", class: "mono", spellcheck: "false" },
        (v) => { app.github_repo = v.trim(); }), "github_repo"),
      field(t("field.version"), input({ value: app.version, placeholder: "1.0.0", class: "mono" },
        (v) => { app.version = v.trim().replace(/^v/i, ""); }), "version"),
      field(t("field.release_date"), input({ type: "date", value: app.release_date }, (v) => { app.release_date = v; }), "release_date")),
    section("devices", t("release.platforms")),
    errorLine("downloads"),
    ...platformRows,
    section("history", t("release.history")),
    app.history.length
      ? h("div", { class: "history" }, ...app.history.map((past, index) => h("div", { class: "history-item" },
        h("div", { class: "history-dot" }),
        h("div", { class: "grow" },
          h("b", {}, `v${past.version}`), " ", h("span", { class: "hint" }, past.date ? formatDate(past.date) : ""),
          resolveText(past.notes, getLang(), defaultLang()).text &&
            h("div", { class: "history-notes" }, resolveText(past.notes, getLang(), defaultLang()).text)),
        h("button", { type: "button", class: "btn btn-icon sm", title: t("common.remove"), onclick: () => {
          app.history = app.history.filter((_, i) => i !== index); rerender();
        } }, icon("close")))))
      : h("p", { class: "hint" }, t("release.history_empty")),
  ];
}

// Sihirbaz: 1 sürüm seç → 2 notlar → 3 dosyalar → 4 özet.
async function startWizard() {
  const app = draft();
  if (!app.github_repo) {
    ed().errors = { ...ed().errors, github_repo: { code: "wizard_repo" } };
    rerender();
    return;
  }
  ed().wizard = { step: 1, loading: true, releases: [], error: "" };
  rerender();
  try {
    ed().wizard.releases = await state.client.listReleases(app.github_repo);
  } catch (err) {
    ed().wizard.error = err.code ? t(`error.${err.code}`, err.params) : err.message;
  }
  ed().wizard.loading = false;
  if (ed().tab === "release") rerender();
}

function chooseRelease(release) {
  const app = draft();
  const base = defaultLang();
  const version = (release.tag_name || "").replace(/^v/i, "");
  const sameVersion = version === app.version;
  const notes = sameVersion ? { ...app.changelog } : {};
  if (!notes[base] && release.body?.trim()) notes[base] = release.body.trim();
  const files = {};
  for (const { key } of PLATFORMS) {
    const asset = (release.assets || []).find((a) => guessPlatform(a.name) === key);
    const current = app.downloads[key];
    files[key] = {
      asset: asset ? asset.id : "",
      kind: asset ? guessKind(asset.name) : current?.kind || "",
      min_os: app.platformExtras[key]?.min_os || "",
    };
    if (key === "android" && files[key].kind && files[key].kind !== "apk") files[key].kind = "apk";
  }
  // Aynı sürüm yeniden seçilirse katalogdaki tarih korunur (elle düzeltilmiş olabilir).
  const date = sameVersion && app.release_date ? app.release_date : (release.published_at || "").slice(0, 10);
  Object.assign(ed().wizard, { step: 2, release, version, date, notes, files,
                               noteLang: base });
  rerender();
}

function wizardView() {
  const w = ed().wizard;
  const steps = ["pick", "notes", "files", "review"];
  const stepper = h("div", { class: "steps" }, ...steps.map((name, i) => h("div", {
    class: `step${w.step === i + 1 ? " on" : ""}${w.step > i + 1 ? " done" : ""}` },
  h("b", {}, w.step > i + 1 ? icon("check") : String(i + 1)), h("span", {}, t(`wizard.${name}`)))));
  const head = h("div", { class: "wizard-head" }, h("h3", {}, t("wizard.title")),
    h("button", { type: "button", class: "btn btn-ghost sm", onclick: () => { ed().wizard = null; rerender(); } },
      icon("close"), t("common.cancel")));
  const nav = (back, next, nextLabel = t("common.next"), nextIcon = "arrow_forward") => h("div", { class: "wizard-nav" },
    back && h("button", { type: "button", class: "btn btn-ghost", onclick: back }, icon("arrow_back"), t("common.back")),
    h("span", { class: "grow" }),
    next && h("button", { type: "button", class: "btn btn-primary", onclick: next }, h("span", {}, nextLabel), icon(nextIcon)));
  const go = (step) => () => { w.step = step; rerender(); };
  const app = draft();
  let body;
  if (w.step === 1) {
    body = w.loading ? h("div", { class: "rel-list" }, ...Array.from({ length: 3 }, () => h("div", { class: "skeleton rel-skeleton" })))
      : w.error ? h("p", { class: "field-error" }, w.error)
      : !w.releases.length ? emptyState("sell", t("wizard.no_releases"), app.github_repo)
      : h("div", { class: "rel-list" }, ...w.releases.map((r, i) => {
        const version = (r.tag_name || "").replace(/^v/i, "");
        return h("button", { type: "button", class: "rel", style: { "animation-delay": `${i * 50}ms` }, onclick: () => chooseRelease(r) },
          icon("sell", "accent"),
          h("div", { class: "grow" },
            h("b", {}, r.tag_name || r.name), r.prerelease && h("span", { class: "status upcoming" }, t("wizard.prerelease")),
            version === app.version && h("span", { class: "status released" }, t("wizard.current")),
            h("div", { class: "hint" }, [r.published_at && formatDate(r.published_at.slice(0, 10)),
              t("wizard.file_count", { count: (r.assets || []).length })].filter(Boolean).join(" · "))),
          icon("chevron_right", "muted"));
      }));
    return [head, stepper, body];
  }
  if (w.step === 2) {
    const langs = editorLanguages();
    const area = h("textarea", { rows: "9", oninput: (e) => {
      if (e.target.value.trim()) w.notes[w.noteLang] = e.target.value; else delete w.notes[w.noteLang];
      seg.querySelector(`[data-v="${CSS.escape(w.noteLang)}"] .sd`).className = `sd ${w.notes[w.noteLang] ? "full" : "empty"}`;
    } }, w.notes[w.noteLang] || "");
    const seg = langSeg(langs, w.noteLang, (v) => { w.noteLang = v; area.value = w.notes[v] || ""; area.focus(); },
      { dots: (code) => (w.notes[code] ? "full" : "empty") });
    return [head, stepper,
      h("p", { class: "hint" }, t("wizard.notes_hint", { version: w.version })),
      h("div", { class: "seg-row" }, seg), area,
      nav(go(1), go(3))];
  }
  if (w.step === 3) {
    const assets = w.release.assets || [];
    return [head, stepper,
      h("p", { class: "hint" }, t("wizard.files_hint")),
      ...PLATFORMS.map(({ key, label, icon: iconName }) => {
        const f = w.files[key];
        const kinds = KINDS.filter((k) => (key === "android" ? k === "" || k === "apk" : k !== "apk"));
        return h("div", { class: `platform${f.asset ? "" : " dim"}` },
          h("div", { class: "switch-row" }, icon(iconName), h("b", {}, label)),
          h("div", { class: "grid-3 platform-fields" },
            field(t("wizard.file"), select([["", t("wizard.no_file")], ...assets.map((a) => [a.id, `${a.name} (${(a.size / 1048576).toFixed(1)} MB)`])],
              f.asset, (v) => { f.asset = v ? Number(v) : ""; const a = assets.find((x) => x.id === f.asset); if (a) f.kind = guessKind(a.name); rerender(); })),
            field(t("release.kind"), select(kinds.map((k) => [k, t(`kind.${k || "auto"}`)]), f.kind, (v) => { f.kind = v; })),
            field(t("release.min_os"), input({ value: f.min_os }, (v) => { f.min_os = v; }))));
      }),
      nav(go(2), go(4))];
  }
  // 4: özet
  const chosen = PLATFORMS.filter(({ key }) => w.files[key].asset);
  const assets = w.release.assets || [];
  return [head, stepper,
    h("div", { class: "review" },
      reviewRow("new_releases", t("field.version"), app.version && app.version !== w.version ? `v${app.version} → v${w.version}` : `v${w.version}`),
      reviewRow("event", t("field.release_date"), w.date ? formatDate(w.date) : "—"),
      reviewRow("translate", t("wizard.notes"), Object.keys(w.notes).map((c) => nativeLanguageName(c)).join(", ") || "—"),
      ...chosen.map(({ key, label, icon: iconName }) => {
        const asset = assets.find((a) => a.id === w.files[key].asset);
        return reviewRow(iconName, label, `${asset.name} · ${(asset.size / 1048576).toFixed(1)} MB${asset.digest ? " · SHA-256 ✓" : ""}`);
      }),
      !chosen.length && h("p", { class: "field-error" }, t("wizard.no_files_warning")),
      app.version && app.version !== w.version && h("p", { class: "hint" }, icon("history"), " ", t("wizard.history_note", { version: app.version }))),
    nav(go(3), applyWizard, t("wizard.apply"), "check")];
}

function reviewRow(iconName, label, value) {
  return h("div", { class: "review-row" }, icon(iconName, "accent"), h("span", { class: "hint" }, label), h("b", {}, value));
}

function applyWizard() {
  const w = ed().wizard;
  const app = draft();
  const assets = w.release.assets || [];
  app.version = w.version;
  if (w.date) app.release_date = w.date;
  app.changelog = { ...w.notes };
  const downloads = {}, platforms = [];
  for (const { key } of PLATFORMS) {
    const f = w.files[key];
    const asset = assets.find((a) => a.id === f.asset);
    const extras = { ...app.platformExtras[key] };
    if (f.min_os) extras.min_os = f.min_os; else delete extras.min_os;
    delete extras.version;
    app.platformExtras = { ...app.platformExtras, [key]: extras };
    if (asset) {
      platforms.push(key);
      downloads[key] = { url: asset.browser_download_url, size_mb: Number((asset.size / 1048576).toFixed(2)),
                         sha256: (asset.digest || "").replace(/^sha256:/, ""), kind: f.kind };
    } else if (app.platforms.includes(key) && !app.downloads[key]) {
      platforms.push(key);   // planlanan platform kalır
    }
  }
  app.platforms = platforms;
  app.downloads = downloads;
  ed().wizard = null;
  rerender();
  renderHeader();
  toast(t("wizard.applied", { version: w.version }));
}

// ── Önizleme ─────────────────────────────────────────────────

function previewTab() {
  const app = draft();
  const p = ed().preview;
  const base = defaultLang();
  const langs = editorLanguages();
  if (!langs.includes(p.lang)) p.lang = base;
  const controls = h("div", { class: "preview-controls" },
    langSeg(langs, p.lang, (v) => { p.lang = v; rerender(); }),
    (() => {
      const el = h("div", { class: "seg" },
        h("button", { type: "button", "data-v": "dark", title: t("theme.dark") }, icon("dark_mode")),
        h("button", { type: "button", "data-v": "light", title: t("theme.light") }, icon("light_mode")));
      segmented(el, { value: p.theme, onChange: (v) => { p.theme = v; rerender(); } });
      return el;
    })(),
    (() => {
      const el = h("div", { class: "seg" },
        h("button", { type: "button", "data-v": "desktop", title: t("preview.desktop") }, icon("computer")),
        h("button", { type: "button", "data-v": "phone", title: t("preview.phone") }, icon("smartphone")));
      segmented(el, { value: p.width, onChange: (v) => { p.width = v; rerender(); } });
      return el;
    })());
  const text = (map) => resolveText(map, p.lang, base);
  const fallbackMark = (resolved) => (resolved.lang && resolved.lang !== p.lang && resolved.lang !== p.lang.split("-")[0]
    ? h("span", { class: "fallback", title: t("preview.fallback_title") }, `(${resolved.lang})`) : null);
  const name = text({ ...app.names, [base]: app.name });
  const subtitle = text(app.subtitle);
  const description = text(app.description);
  const notes = text(app.changelog);
  const shots = app.screenshots[p.lang] || app.screenshots[p.lang.split("-")[0]] || app.screenshots.default || [];
  const platforms = PLATFORMS.filter((pl) => app.platforms.includes(pl.key));
  const caption = (shot) => resolveText(shot.caption, p.lang, base).text;

  const tile = h("div", { class: "pv-tile" },
    app.cover ? h("img", { class: "pv-tile-cover", src: mediaUrl(app.cover), alt: "" }) : h("div", { class: "pv-tile-cover blank" }),
    h("div", { class: "pv-tile-body" }, logoTile(app, "sm"),
      h("div", {}, h("b", {}, name.text || "—"), h("div", { class: "pv-muted" }, subtitle.text || t(`category.${app.category}`, {}, p.lang), fallbackMark(subtitle)))));

  const detail = h("div", { class: "pv-detail" },
    h("div", { class: "pv-hero" }, logoTile(app, "xl"),
      h("div", { class: "grow" },
        h("div", { class: "pv-title" }, name.text || "—"),
        h("div", { class: "pv-muted" }, [app.developer, app.version && `v${app.version}`,
          app.release_date && formatDate(app.release_date, p.lang)].filter(Boolean).join(" · ")),
        h("div", { class: "pv-chips" }, ...platforms.map((pl) => h("span", { class: "pv-chip" }, icon(pl.icon), pl.label)),
          app.age_rating && h("span", { class: "pv-chip" }, `${app.age_rating}+`)),
        h("button", { type: "button", class: "pv-install" }, icon("download"), t("preview.install", {}, p.lang)))),
    shots.length > 0 && h("div", { class: "pv-shots" }, ...shots.map((shot) => h("figure", {},
      h("img", { src: mediaUrl(shot.url), alt: "", loading: "lazy" }), caption(shot) && h("figcaption", {}, caption(shot))))),
    h("div", { class: "pv-section" }, h("b", {}, t("preview.about", {}, p.lang)), fallbackMark(description),
      h("p", {}, description.text || h("span", { class: "pv-muted" }, t("preview.no_description", {}, p.lang)))),
    notes.text && h("div", { class: "pv-section" }, h("b", {}, t("preview.whats_new", {}, p.lang)), fallbackMark(notes), h("p", { class: "pre" }, notes.text)),
    app.genres.length > 0 && h("div", { class: "pv-chips" }, ...app.genres.map((g) => h("span", { class: "pv-chip" }, t(`genre.${g}`, {}, p.lang)))));

  return [
    controls,
    h("p", { class: "hint" }, t("preview.note")),
    h("div", { class: `pv pv-${p.theme} pv-${p.width}` },
      h("div", { class: "pv-label" }, t("preview.tile")), tile,
      h("div", { class: "pv-label" }, t("preview.detail")), detail),
  ];
}

// ── Kaydetme ─────────────────────────────────────────────────

function save() {
  if (!isEditorOpen() || !ed()) return;
  const app = draft();
  const { originalId } = ed();
  app.name = app.name.trim();
  const others = state.catalog.apps.filter((a) => a.id !== originalId);
  const errors = validateApp(app, others, originalId);
  ed().errors = errors;
  const keys = Object.keys(errors);
  if (keys.length) {
    $("editor-error").textContent = t("editor.errors", { count: keys.length });
    const tab = TAB_OF_FIELD(keys[0]);
    if (ed().wizard && tab === "release") ed().wizard = null;
    tabs.set(tab);
    showTab(tab);
    requestAnimationFrame(() => $("editor-body").querySelector(".invalid")?.scrollIntoView({ block: "center", behavior: "smooth" }));
    $("editor").querySelector(".sheet-panel")?.classList.add("shake");
    setTimeout(() => $("editor").querySelector(".sheet-panel")?.classList.remove("shake"), 450);
    return;
  }
  $("editor-error").textContent = "";
  if (app.featured) for (const other of state.catalog.apps) other.featured = false;
  const index = state.catalog.apps.findIndex((a) => a.id === originalId);
  if (index >= 0) {
    archivePreviousRelease(state.catalog.apps[index], app);
    state.catalog.apps[index] = app;
  } else {
    state.catalog.apps.unshift(app);
  }
  state.editing = null;
  closeDialog($("editor"));
  hooks.onSaved(app);
  toast(t("editor.saved", { name: app.name }));
}

export function saveShortcut() {
  save();
}
