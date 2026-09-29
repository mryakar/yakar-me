export const locales = ['en', 'tr'] as const;
export type Lang = (typeof locales)[number];
export const defaultLang: Lang = 'en';

export const isLang = (s: unknown): s is Lang => typeof s === 'string' && (locales as readonly string[]).includes(s);

export const other = (lang: Lang): Lang => (lang === 'en' ? 'tr' : 'en');

export const localize = (path: string, lang: Lang) => (lang === defaultLang ? path : `/${lang}${path}`);

export function splitPath(path: string): { lang: Lang; path: string } {
  const m = /^\/([a-z]{2})(\/.*)$/.exec(path);
  if (m && isLang(m[1]) && m[1] !== defaultLang) return { lang: m[1], path: m[2] };
  return { lang: defaultLang, path };
}

export const langPaths = () =>
  locales.map((lang) => ({ params: { lang: lang === defaultLang ? undefined : lang }, props: { lang } }));

export async function langItemPaths<T>(load: (lang: Lang) => Promise<T[]>, params: (item: T) => Record<string, string>) {
  const perLang = await Promise.all(
    langPaths().map(async ({ params: base, props: { lang } }) =>
      (await load(lang)).map((item) => ({ params: { ...base, ...params(item) }, props: { lang, item } })),
    ),
  );
  return perLang.flat();
}

export const ogLocale: Record<Lang, string> = { en: 'en_GB', tr: 'tr_TR' };
export const dateLocale: Record<Lang, string> = { en: 'en-GB', tr: 'tr-TR' };
