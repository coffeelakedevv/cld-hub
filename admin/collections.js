// Koleksiyonlar penceresi: elle seçilmiş raflar (katalogda üst düzey `collections`).
// Liste görünümünde sıralanır/silinir; düzenleme görünümünde kimlik, dil başına başlık ve
// açıklama, raftaki uygulamalar ve sırası ayarlanır.

import {
  emptyCollection, missingCollectionApps, resolveText, serializeCollection, slugify, validateCollection,
} from "./catalog.js";
import { logoTile } from "./editor.js";
import { getLang, nativeLanguageName, t } from "./locales.js";
import { defaultLang, state } from "./state.js";
import { $, confirmDialog, emptyState, guardDialog, h, icon, openDialog, segmented, toast } from "./ui.js";

let hooks = { onChange: () => {} };
let edit = null;   // { index, draft, original, lang, idTouched, errors, query }

const collections = () => state.catalog.collections;
const appById = (id) => state.catalog.apps.find((a) => a.id === id);
const titleOf = (c) => resolveText(c.title, getLang(), defaultLang()).text || c.id || t("collections.new_title");
const snapshot = (c) => JSON.stringify(serializeCollection(c, defaultLang()));
const clone = (c) => ({ ...c, title: { ...c.title }, description: { ...c.description }, apps: [...c.apps] });

export function initCollections({ onChange } = {}) {
  hooks = { onChange: onChange || hooks.onChange };
  guardDialog($("collections"), beforeClose);
  $("coll-add").addEventListener("click", () => startEdit(-1));
}

export function openCollections() {
  edit = null;
  showList();
  openDialog($("collections"));
}

export function refreshCollections() {
  if (!$("collections").open) return;
  if (edit) renderEdit(); else renderList();
}

async function beforeClose() {
  if (!edit) return true;
  await leaveEdit();
  return false;   // düzenlemeden çıkınca pencere listede kalır
}

// ── Liste ────────────────────────────────────────────────────

function showList() {
  $("coll-list-view").hidden = false;
  $("coll-edit-view").hidden = true;
  renderList();
}

function renderList() {
  const list = collections();
  const ul = $("coll-list");
  if (!list.length) {
    ul.replaceChildren(h("li", {}, emptyState("collections_bookmark", t("collections.empty"), t("collections.empty_text"))));
    return;
  }
  ul.replaceChildren(...list.map((collection, index) => collectionRow(collection, index, list)));
}

function collectionRow(collection, index, list) {
  const move = (target) => {
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    renderList();
    hooks.onChange();
  };
  const missing = missingCollectionApps(collection, state.catalog.apps.map((a) => a.id)).length;
  const logos = collection.apps.map(appById).filter(Boolean).slice(0, 4);
  const row = h("li", { class: "coll-item", draggable: "true",
    ondragstart: (e) => { e.dataTransfer.setData("text/x-coll", String(index)); row.classList.add("dragging"); },
    ondragend: () => row.classList.remove("dragging"),
    ondragover: (e) => { if (e.dataTransfer.types.includes("text/x-coll")) { e.preventDefault(); row.classList.add("drop-target"); } },
    ondragleave: () => row.classList.remove("drop-target"),
    ondrop: (e) => {
      row.classList.remove("drop-target");
      const from = Number(e.dataTransfer.getData("text/x-coll"));
      if (Number.isNaN(from) || from === index) return;
      e.preventDefault();
      const [item] = list.splice(from, 1);
      list.splice(index, 0, item);
      renderList();
      hooks.onChange();
    },
  },
  icon("drag_indicator", "handle muted"),
  h("div", { class: "grow" },
    h("b", {}, titleOf(collection)),
    h("div", { class: "hint" }, h("span", { class: "mono" }, collection.id), "·", t("collections.count", { count: collection.apps.length }),
      missing > 0 && h("span", { class: "warn-text" }, icon("warning"), t("collections.missing_warning", { count: missing })))),
  h("div", { class: "coll-logos" }, ...logos.map((app) => logoTile(app, "xs"))),
  h("div", { class: "row-tools" },
    h("button", { type: "button", class: "btn btn-icon sm", title: t("collections.move_up"), disabled: index === 0, onclick: () => move(index - 1) }, icon("arrow_upward")),
    h("button", { type: "button", class: "btn btn-icon sm", title: t("collections.move_down"), disabled: index === list.length - 1, onclick: () => move(index + 1) }, icon("arrow_downward")),
    h("button", { type: "button", class: "btn btn-icon sm", title: t("collections.edit"), onclick: () => startEdit(index) }, icon("edit")),
    h("button", { type: "button", class: "btn btn-icon sm danger-text", title: t("common.delete"), onclick: () => removeCollection(index) }, icon("delete"))));
  row.style.setProperty("animation-delay", `${Math.min(index, 8) * 35}ms`);
  return row;
}

async function removeCollection(index) {
  const collection = collections()[index];
  const ok = await confirmDialog({ title: t("collections.remove_title", { name: titleOf(collection) }),
                                   text: t("collections.remove_text"), ok: t("common.delete") });
  // Onay penceresi üstte açılıp kapandı; koleksiyon penceresi açık kalır.
  if (!ok) return;
  collections().splice(index, 1);
  renderList();
  hooks.onChange();
  toast(t("collections.deleted"), "info");
}

// ── Düzenleme ────────────────────────────────────────────────

function startEdit(index) {
  const draft = index >= 0 ? clone(collections()[index]) : emptyCollection();
  edit = { index, draft, original: snapshot(draft), lang: defaultLang(), idTouched: index >= 0, errors: {}, query: "" };
  $("coll-list-view").hidden = true;
  $("coll-edit-view").hidden = false;
  renderEdit();
  requestAnimationFrame(() => $("coll-edit-view").querySelector("[data-key=title] input")?.focus());
}

async function leaveEdit() {
  if (edit && snapshot(edit.draft) !== edit.original) {
    const ok = await confirmDialog({ title: t("editor.discard_title"), text: t("editor.discard_text"), ok: t("editor.discard") });
    if (!ok) return false;
  }
  edit = null;
  showList();
  return true;
}

function field(key, label, control, hint) {
  const error = edit.errors[key];
  return h("label", { class: `field${error ? " invalid" : ""}`, "data-key": key },
    h("span", { class: "field-label" }, label), control,
    hint && h("small", { class: "hint" }, hint),
    error && h("span", { class: "field-error" }, errorText(error)));
}

const errorText = (error) => t(`error.${error.code}`, { ...error, ...(error.lang ? { lang: nativeLanguageName(error.lang) } : {}) });

function renderEdit() {
  const view = $("coll-edit-view");
  const { draft } = edit;
  const base = defaultLang();
  const langs = state.catalog.languages;
  if (!langs.includes(edit.lang)) edit.lang = base;

  const idInput = h("input", { class: "mono", value: draft.id, autocomplete: "off", spellcheck: "false",
    oninput: (e) => { draft.id = e.target.value.trim(); edit.idTouched = true; } });

  const seg = h("div", { class: "seg seg-scroll", role: "group" },
    ...langs.map((lang) => h("button", { type: "button", "data-v": lang },
      h("span", { class: `sd ${draft.title[lang]?.trim() ? "full" : "empty"}` }), nativeLanguageName(lang))));

  const source = edit.lang !== base && draft.title[base] ? t("texts.source", { lang: nativeLanguageName(base) }) + " " + draft.title[base] : null;
  const titleInput = h("input", { value: draft.title[edit.lang] || "", placeholder: edit.lang !== base ? draft.title[base] || "" : "",
    oninput: (e) => {
      setText(draft.title, edit.lang, e.target.value);
      if (!edit.idTouched && edit.lang === base) { draft.id = slugify(e.target.value); idInput.value = draft.id; }
      seg.querySelector(`[data-v="${edit.lang}"] .sd`)?.setAttribute("class", `sd ${draft.title[edit.lang]?.trim() ? "full" : "empty"}`);
    } });
  const descInput = h("textarea", { rows: "2", value: draft.description[edit.lang] || "",
    placeholder: edit.lang !== base ? draft.description[base] || "" : "",
    oninput: (e) => setText(draft.description, edit.lang, e.target.value) });
  descInput.value = draft.description[edit.lang] || "";

  view.replaceChildren(
    h("div", { class: "coll-head" },
      h("button", { type: "button", class: "btn btn-icon", title: t("common.back"), onclick: () => leaveEdit() }, icon("arrow_back")),
      h("h2", {}, edit.index >= 0 ? titleOf(collections()[edit.index]) : t("collections.new_title"))),
    h("div", { class: "seg-row" }, seg),
    field("title", t("collections.title_field"), titleInput, source),
    field("description", t("collections.description"), descInput),
    field("id", t("field.id"), idInput, t("collections.id_hint")),
    appsSection(),
    h("p", { class: "form-error", role: "alert" }, Object.keys(edit.errors).length ? t("editor.errors", { count: Object.keys(edit.errors).length }) : ""),
    h("div", { class: "modal-actions" },
      h("button", { type: "button", class: "btn btn-ghost", onclick: () => leaveEdit() }, t("common.cancel")),
      h("button", { type: "button", class: "btn btn-primary", onclick: saveEdit }, icon("check"), t("collections.save"))));

  segmented(seg, { value: edit.lang, onChange: (lang) => { edit.lang = lang; renderEdit(); } });
}

function setText(map, lang, value) {
  if (value.trim()) map[lang] = value; else delete map[lang];
}

function appsSection() {
  const { draft } = edit;
  const error = edit.errors.apps;
  const selected = h("ol", { class: "coll-apps" },
    ...(draft.apps.length ? draft.apps.map((id, index) => selectedRow(id, index)) : [h("li", { class: "hint empty-line" }, t("collections.no_apps"))]));

  const picker = h("div", { class: "coll-picker" });
  const fill = () => {
    const query = edit.query.trim().toLowerCase();
    const options = state.catalog.apps.filter((app) => !draft.apps.includes(app.id))
      .filter((app) => !query || `${app.name} ${app.id}`.toLowerCase().includes(query));
    picker.replaceChildren(...options.map((app) => h("button", { type: "button", class: "pick",
      onclick: () => { draft.apps.push(app.id); delete edit.errors.apps; renderEdit(); } },
      logoTile(app, "xs"), h("span", { class: "grow" }, h("b", {}, app.name || app.id), h("span", { class: "hint mono" }, app.id)),
      icon("add"))));
    if (!options.length) picker.append(h("div", { class: "hint empty-line" }, t("list.no_match")));
  };
  fill();
  const search = h("input", { type: "search", value: edit.query, placeholder: t("collections.search"), autocomplete: "off",
    oninput: (e) => { edit.query = e.target.value; fill(); } });

  return h("div", { class: `field${error ? " invalid" : ""}`, "data-key": "apps" },
    h("span", { class: "field-label" }, t("collections.apps")),
    h("small", { class: "hint" }, t("collections.apps_hint")),
    selected,
    error && h("span", { class: "field-error" }, errorText(error)),
    h("span", { class: "field-label pick-label" }, t("collections.pick")),
    search, picker);
}

function selectedRow(id, index) {
  const list = edit.draft.apps;
  const app = appById(id);
  const move = (target) => {
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    renderEdit();
  };
  const row = h("li", { class: `coll-app${app ? "" : " missing"}`, draggable: "true",
    ondragstart: (e) => { e.dataTransfer.setData("text/x-coll-app", String(index)); row.classList.add("dragging"); },
    ondragend: () => row.classList.remove("dragging"),
    ondragover: (e) => { if (e.dataTransfer.types.includes("text/x-coll-app")) { e.preventDefault(); row.classList.add("drop-target"); } },
    ondragleave: () => row.classList.remove("drop-target"),
    ondrop: (e) => {
      row.classList.remove("drop-target");
      const from = Number(e.dataTransfer.getData("text/x-coll-app"));
      if (Number.isNaN(from) || from === index) return;
      e.preventDefault();
      const [item] = list.splice(from, 1);
      list.splice(index, 0, item);
      renderEdit();
    },
  },
  h("span", { class: "num muted" }, String(index + 1)),
  app ? logoTile(app, "xs") : h("div", { class: "logo xs" }, icon("help")),
  h("div", { class: "grow" }, h("b", {}, app ? app.name || app.id : id),
    app ? h("span", { class: "hint mono" }, id) : h("span", { class: "hint warn-text" }, icon("warning"), t("collections.missing"))),
  h("button", { type: "button", class: "btn btn-icon sm", title: t("collections.move_up"), disabled: index === 0, onclick: () => move(index - 1) }, icon("arrow_upward")),
  h("button", { type: "button", class: "btn btn-icon sm", title: t("collections.move_down"), disabled: index === list.length - 1, onclick: () => move(index + 1) }, icon("arrow_downward")),
  h("button", { type: "button", class: "btn btn-icon sm danger-text", title: t("common.remove"), onclick: () => { list.splice(index, 1); renderEdit(); } }, icon("close")));
  return row;
}

function saveEdit() {
  const { draft, index } = edit;
  const base = defaultLang();
  draft.id = draft.id.trim();
  const others = collections().filter((_, i) => i !== index);
  edit.errors = validateCollection(draft, others, state.catalog.apps.map((a) => a.id), base);
  if (Object.keys(edit.errors).length) {
    if (edit.errors.title) edit.lang = base;
    renderEdit();
    const panel = $("collections");
    panel.classList.add("shake");
    setTimeout(() => panel.classList.remove("shake"), 450);
    return;
  }
  if (index >= 0) collections()[index] = draft; else collections().push(draft);
  edit = null;
  showList();
  hooks.onChange();
  toast(t("collections.saved"));
}

