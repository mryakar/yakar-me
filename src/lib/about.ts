import { dateLocale, type Lang } from './i18n.ts';
import { yearRange } from './format.ts';

export const bagGroups = ['saxophone', 'recording', 'camera'] as const;
export type BagGroup = (typeof bagGroups)[number];

export const levels = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'] as const;
export type Level = (typeof levels)[number];

export const SCALE = 6;

export const levelSteps = (level: Level) => Math.min(SCALE, levels.length - levels.indexOf(level));

export const PRESENT = 'present';

export function period(from: number, to: number | typeof PRESENT | undefined, present: string) {
  if (to === PRESENT) return `${from}–${present}`;
  return to === undefined ? String(from) : yearRange(from, to);
}

export const languageName = (code: string, lang: Lang) => {
  const name = new Intl.DisplayNames(dateLocale[lang], { type: 'language' }).of(code);
  if (!name || name === code) throw new Error(`no ${lang} name for the language ${code}`);
  return name.charAt(0).toLocaleUpperCase(dateLocale[lang]) + name.slice(1);
};
