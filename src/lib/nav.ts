export const isCurrent = (path: string, href: string, home: string) => (href === home ? path === home : path.startsWith(href));
