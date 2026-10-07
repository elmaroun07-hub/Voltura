import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  createTranslator,
  formatDate,
  formatNumber,
  monthName,
  parseLocale,
  type Locale,
  type Translate,
} from "@workspace/i18n";
import type { ZodErrorMap } from "zod";
import { catalog } from "./catalog";

export { catalog } from "./catalog";
export type { Locale } from "@workspace/i18n";
export type WebTranslate = Translate<typeof catalog.es>;

/**
 * The reader's language, held in one module-level store rather than in React
 * state, because two things outside the component tree need it: sessionFetch
 * (the one place request headers are set) sends it as Accept-Language so the
 * API answers in the same language, and toasts raised from mutation callbacks
 * translate at the moment they fire.
 *
 * Spanish unless the person chose otherwise (2b.1). The choice is remembered
 * in localStorage, which can be absent or throw; then the default stands and
 * nothing breaks.
 */
const STORAGE_KEY = "voltura.locale";

function readStored(): Locale | null {
  try {
    return parseLocale(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

let current: Locale = readStored() ?? DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function applyToDocument(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.title = createTranslator(catalog, locale)("meta.title");
}

applyToDocument(current);

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Not remembered across visits; the switch still applies now.
  }
  applyToDocument(locale);
  for (const notify of listeners) notify();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const translators: Record<Locale, WebTranslate> = {
  es: createTranslator(catalog, "es"),
  en: createTranslator(catalog, "en"),
};

/** For code outside components (mutation callbacks): translate in the language chosen right now. */
export function tNow(): WebTranslate {
  return translators[current];
}

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: WebTranslate;
  /** A number in the reader's language: 12.345,6 in Spanish, 12,345.6 in English. */
  num: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  month: (month: number) => string;
}

export function useI18n(): I18n {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return {
    locale,
    setLocale,
    t: translators[locale],
    num: (value, options) => formatNumber(locale, value, options),
    date: (value, options) => formatDate(locale, value, options),
    month: (m) => monthName(locale, m),
  };
}

/**
 * Form validation messages in the reader's language. The schemas carry no
 * prose of their own; this maps zod's issue codes to catalog entries, read at
 * the moment validation runs.
 */
export const zodErrorMap: ZodErrorMap = (issue) => {
  const t = tNow();
  const n = (v: number | bigint) => formatNumber(getLocale(), Number(v));
  switch (issue.code) {
    case "too_small":
      // The only string with a minimum length on the form is the location.
      if (issue.type === "string") return { message: t("validation.location") };
      return { message: t("validation.min", { min: n(issue.minimum) }) };
    case "too_big":
      return { message: t("validation.max", { max: n(issue.maximum) }) };
    case "invalid_type":
      return { message: issue.expected === "number" ? t("validation.number") : t("validation.invalid") };
    default:
      return { message: t("validation.invalid") };
  }
};

/**
 * An error whose message is written for the person, in their language. A
 * toast shows `message` only for this class; any other error is a developer
 * error and the toast shows the translated fallback instead, so an English
 * stack-trace line cannot reach the screen.
 */
export class UserMessage extends Error {
  readonly name = "UserMessage";
}

export function userFacing(error: unknown, fallback: string): string {
  return error instanceof UserMessage ? error.message : fallback;
}
