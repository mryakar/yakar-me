export const isCurrent = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));
