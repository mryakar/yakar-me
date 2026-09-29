import { defineHastPlugin, defineMdastPlugin } from 'satteri';

export const noRawHtml = defineMdastPlugin({
  name: 'no-raw-html',
  html(node, ctx) {
    const file = ctx.fileURL?.pathname ?? 'markdown';
    throw new Error(`Raw HTML is not allowed in content (${file}): ${String(node.value).slice(0, 60)}`);
  },
});

type Hast = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Hast[] };
const copy = <T>(node: T): T => JSON.parse(JSON.stringify(node));
const blank = (n: Hast | undefined) => n?.type === 'text' && !n.value?.trim();

const SUMMARY = ['in short', 'kısaca'];
export const isSummaryHeading = (text: string) => SUMMARY.includes(text.trim().toLowerCase());

export const articleBlocks = defineHastPlugin({
  name: 'article-blocks',
  element: {
    filter: ['p', 'h2', 'h3'],
    visit(node, ctx) {
      const el = node as unknown as Hast;
      if (el.tagName === 'p') {
        const kids = (el.children ?? []).filter((c) => !blank(c));
        const img = kids.length === 1 && kids[0].tagName === 'img' ? kids[0] : undefined;
        if (!img?.properties?.title) return;
        const { title, ...props } = img.properties;
        ctx.replaceNode(node, {
          type: 'element',
          tagName: 'figure',
          properties: {},
          children: [
            { type: 'element', tagName: 'img', properties: props, children: [] },
            { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: String(title) }] },
          ],
        } as never);
        return;
      }
      const text = ctx.textContent(node);
      const tldr = text.trim().toLowerCase() === 'tl;dr';
      if (!tldr && !isSummaryHeading(text)) return;
      const siblings = (ctx.parent(node) as unknown as Hast | undefined)?.children ?? [];
      let j = (ctx.indexOf(node) ?? -1) + 1;
      while (blank(siblings[j])) j++;
      const list = siblings[j];
      if (list?.tagName !== 'ul' && list?.tagName !== 'ol') return;
      ctx.replaceNode(node, {
        type: 'element',
        tagName: tldr ? 'section' : 'aside',
        properties: { className: [tldr ? 'tldr' : 'in-short'] },
        children: [copy(el), copy(list)],
      } as never);
      ctx.removeNode(list as never);
    },
  },
});
