const SUPPORTED_LOCALES = ["en", "ja", "zh_CN", "ko", "es"];
const FALLBACK_LOCALE = "en";
const LOCALE_CACHE = {};
const UI_LANGUAGE_KEY = "uiLanguage";

let activeLocale = FALLBACK_LOCALE;
let userChoice = "auto";
let initPromise = null;

function resolveBrowserLocale() {
  const raw = (chrome.i18n.getUILanguage() || "en").toLowerCase().replace("-", "_");
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("zh")) return "zh_CN";
  if (raw.startsWith("ko")) return "ko";
  if (raw.startsWith("es")) return "es";
  return FALLBACK_LOCALE;
}

function formatMessage(entry, substitutions) {
  let msg = entry?.message ?? "";
  if (!entry?.placeholders || substitutions === undefined) return msg;

  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  for (const [name, placeholder] of Object.entries(entry.placeholders)) {
    const index = Number(String(placeholder.content || "").replace("$", ""));
    if (!index) continue;
    msg = msg.split(`$${name}$`).join(values[index - 1] ?? "");
  }
  return msg;
}

async function loadLocaleMessages(locale) {
  if (LOCALE_CACHE[locale]) return LOCALE_CACHE[locale];
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load locale: ${locale}`);
  LOCALE_CACHE[locale] = await response.json();
  return LOCALE_CACHE[locale];
}

function htmlLangTag(locale) {
  if (locale === "zh_CN") return "zh-CN";
  return locale.replace("_", "-");
}

async function initI18n() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const stored = await chrome.storage.local.get(UI_LANGUAGE_KEY);
    userChoice = stored[UI_LANGUAGE_KEY] || "auto";
    activeLocale =
      userChoice === "auto"
        ? resolveBrowserLocale()
        : SUPPORTED_LOCALES.includes(userChoice)
          ? userChoice
          : FALLBACK_LOCALE;
    await loadLocaleMessages(FALLBACK_LOCALE);
    if (activeLocale !== FALLBACK_LOCALE) {
      await loadLocaleMessages(activeLocale);
    }
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = htmlLangTag(activeLocale);
    }
  })();

  return initPromise;
}

/** @param {string} key @param {string|string[]} [substitutions] */
function t(key, substitutions) {
  const entry =
    LOCALE_CACHE[activeLocale]?.[key] ?? LOCALE_CACHE[FALLBACK_LOCALE]?.[key];
  if (entry) return formatMessage(entry, substitutions) || key;
  const subs =
    substitutions === undefined ? undefined : Array.isArray(substitutions) ? substitutions : [substitutions];
  return chrome.i18n.getMessage(key, subs) || key;
}

function uiLocale() {
  return activeLocale || resolveBrowserLocale();
}

function getLanguageChoice() {
  return userChoice;
}

async function setLanguageChoice(choice) {
  const next = choice === "auto" || SUPPORTED_LOCALES.includes(choice) ? choice : "auto";
  userChoice = next;
  await chrome.storage.local.set({ [UI_LANGUAGE_KEY]: next });
  initPromise = null;
  await initI18n();
}

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const text = t(key);
    const attr = el.getAttribute("data-i18n-attr");
    if (attr) el.setAttribute(attr, text);
    else el.textContent = text;
  });
}

if (typeof self !== "undefined") {
  self.t = t;
  self.uiLocale = uiLocale;
  self.applyI18n = applyI18n;
  self.initI18n = initI18n;
  self.getLanguageChoice = getLanguageChoice;
  self.setLanguageChoice = setLanguageChoice;
}
