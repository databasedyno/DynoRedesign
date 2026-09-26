import type { StaticImageData } from "next/image";

import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";

export type LanguageCode = "en" | "pt" | "fr" | "es" | "de" | "nl";

export interface AppLanguage {
  readonly code: LanguageCode;
  /** The language's own name — what a native speaker scans for. */
  readonly name: string;
  readonly english: string;
  readonly flag: StaticImageData;
}

/** Single source of truth for every language switcher in the app. */
export const LANGUAGES: readonly AppLanguage[] = [
  { code: "en", name: "English", english: "English", flag: unitedStatesFlag },
  { code: "pt", name: "Português", english: "Portuguese", flag: portugalFlag },
  { code: "fr", name: "Français", english: "French", flag: franceFlag },
  { code: "es", name: "Español", english: "Spanish", flag: spainFlag },
  { code: "de", name: "Deutsch", english: "German", flag: germanyFlag },
  { code: "nl", name: "Nederlands", english: "Dutch", flag: netherlandsFlag },
] as const;

export const baseLang = (lng?: string | null): LanguageCode => {
  const base = (lng || "en").split("-")[0].toLowerCase();
  return (LANGUAGES.some((l) => l.code === base) ? base : "en") as LanguageCode;
};

export const languageFor = (lng?: string | null): AppLanguage =>
  LANGUAGES.find((l) => l.code === baseLang(lng)) ?? LANGUAGES[0];
