/** Menü öğesi bu sayfayı mı gösteriyor? Ana sayfa yalnız kendisi; diğerleri alt sayfalarını da kapsar. */
export const isCurrent = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));
