// Küçük DOM yardımcıları: öğe oluşturma, pencereler, bildirimler, kayan göstergeli seçiciler.
// İçerik daima textContent ile eklenir; katalog verisi HTML olarak yorumlanmaz.
// CSP satır içi stil özniteliğine izin vermez; stiller yalnızca el.style (CSSOM) ile verilir.

import { t } from "./locales.js";

export const $ = (id) => document.getElementById(id);

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "style") for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "value") el.value = value;
    else if (key === "checked") el.checked = Boolean(value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export const icon = (name, cls = "") => h("span", { class: `icon ${cls}`.trim(), "aria-hidden": "true" }, name);

export const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animasyon bitince (ya da süre dolunca) çözülür. */
function afterAnimation(el, fallbackMs = 420) {
  return new Promise((resolve) => {
    if (reduceMotion()) return resolve();
    // Yalnızca çıkış animasyonları (adı "out-" ile başlayan) beklenir; içerideki başka animasyonlar sayılmaz.
    const done = (e) => {
      if (e && !e.animationName.startsWith("out-")) return;
      clearTimeout(timer);
      el.removeEventListener("animationend", done);
      resolve();
    };
    const timer = setTimeout(() => done(), fallbackMs);
    el.addEventListener("animationend", done);
  });
}

// ── Pencereler (<dialog>) ────────────────────────────────────

export function openDialog(dialog) {
  dialog.classList.remove("closing");
  if (!dialog.open) dialog.showModal();
}

export async function closeDialog(dialog, value = "") {
  if (!dialog.open || dialog.classList.contains("closing")) return;
  dialog.classList.add("closing");
  await afterAnimation(dialog);
  dialog.classList.remove("closing");
  dialog.close(value);
}

/** Esc ve arka plana tıklama animasyonla kapatır; `beforeClose` false dönerse kapanmaz. */
export function guardDialog(dialog, beforeClose = null) {
  const attempt = async () => {
    if (beforeClose && !(await beforeClose())) return;
    closeDialog(dialog);
  };
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); attempt(); });
  dialog.addEventListener("mousedown", (e) => {
    if (e.target === dialog) dialog.dataset.downOnBackdrop = "1";
  });
  dialog.addEventListener("click", (e) => {
    const onBackdrop = e.target === dialog && dialog.dataset.downOnBackdrop === "1";
    delete dialog.dataset.downOnBackdrop;
    if (onBackdrop) attempt();
  });
  for (const button of dialog.querySelectorAll("[data-close]")) button.addEventListener("click", attempt);
  return attempt;
}

export function confirmDialog({ title, text, ok, danger = true }) {
  const dialog = $("confirm");
  $("confirm-title").textContent = title;
  $("confirm-text").textContent = text;
  const okButton = $("confirm-ok");
  okButton.textContent = ok;
  okButton.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
  openDialog(dialog);
  return new Promise((resolve) => {
    const finish = (value) => {
      okButton.removeEventListener("click", onOk);
      dialog.removeEventListener("close", onClose);
      resolve(value);
    };
    const onOk = async () => { await closeDialog(dialog, "ok"); };
    const onClose = () => finish(dialog.returnValue === "ok");
    okButton.addEventListener("click", onOk);
    dialog.addEventListener("close", onClose);
  });
}

// ── Bildirimler ──────────────────────────────────────────────

export function toast(message, type = "success", link = null) {
  const icons = { info: "info", success: "check_circle", error: "error", warning: "warning" };
  const life = type === "error" ? 8000 : 4500;
  const el = h("div", { class: `toast ${type}`, role: type === "error" ? "alert" : "status", style: { "--life": `${life}ms` } },
    icon(icons[type] || "info"), h("span", { class: "toast-text" }, message),
    link && h("a", { href: link.href, target: "_blank", rel: "noopener" }, link.text),
    h("button", { class: "toast-close", type: "button", "aria-label": t("common.close"), onclick: () => dismiss() }, icon("close")));
  $("toasts").append(el);
  let gone = false;
  const dismiss = async () => {
    if (gone) return;
    gone = true;
    el.classList.add("out");
    await afterAnimation(el, 320);
    el.remove();
  };
  setTimeout(dismiss, life);
}

// ── Kayan göstergeli seçiciler ───────────────────────────────

/** .seg kapsayıcısı: içindeki [data-v] düğmelerinden biri seçilir, hap göstergesi kayar. */
export function segmented(el, { value, onChange } = {}) {
  let pill = el.querySelector(":scope > .pill");
  if (!pill) { pill = h("span", { class: "pill", "aria-hidden": "true" }); el.prepend(pill); }
  const buttons = () => [...el.querySelectorAll(":scope > button[data-v]")];
  const move = () => {
    const active = buttons().find((b) => b.getAttribute("aria-pressed") === "true");
    pill.hidden = !active;
    if (!active) return;
    pill.style.setProperty("left", `${active.offsetLeft}px`);
    pill.style.setProperty("width", `${active.offsetWidth}px`);
  };
  const set = (v) => {
    for (const b of buttons()) b.setAttribute("aria-pressed", String(b.dataset.v === String(v)));
    move();
  };
  el.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-v]");
    if (!button || button.parentElement !== el || button.dataset.action) return;
    set(button.dataset.v);
    onChange?.(button.dataset.v);
  });
  new ResizeObserver(move).observe(el);
  if (value !== undefined) set(value);
  requestAnimationFrame(move);
  return { set, move };
}

/** .tabs kapsayıcısı: [data-tab] sekmeleri ve altta kayan çizgi. */
export function tabStrip(el, { value, onChange } = {}) {
  let bar = el.querySelector(":scope > .tab-bar");
  if (!bar) { bar = h("span", { class: "tab-bar", "aria-hidden": "true" }); el.append(bar); }
  const tabs = () => [...el.querySelectorAll("[data-tab]")];
  const move = () => {
    const active = tabs().find((b) => b.getAttribute("aria-selected") === "true");
    if (!active) return;
    bar.style.setProperty("left", `${active.offsetLeft}px`);
    bar.style.setProperty("width", `${active.offsetWidth}px`);
    active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  };
  const set = (v) => {
    for (const b of tabs()) b.setAttribute("aria-selected", String(b.dataset.tab === v));
    move();
  };
  el.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    set(tab.dataset.tab);
    onChange?.(tab.dataset.tab);
  });
  new ResizeObserver(move).observe(el);
  if (value !== undefined) set(value);
  return { set, move };
}

export function emptyState(iconName, title, text) {
  return h("div", { class: "empty-state" }, h("div", { class: "empty-icon" }, icon(iconName)),
    h("b", {}, title), text && h("p", { class: "muted" }, text));
}

export function skeletonCards(count = 6) {
  return Array.from({ length: count }, (_, i) => h("div", { class: "skeleton", style: { "animation-delay": `${i * 80}ms` } }));
}

/** Kimlikten sabit bir renk (logosu olmayan kayıtlar için). */
export function tileColor(seed) {
  const colors = ["#7C3AED", "#0EA5E9", "#EC4899", "#10B981", "#F97316", "#6366F1", "#14B8A6", "#EF4444"];
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
