import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Yazılar: src/content/writing/<slug>/index.md, görseller aynı klasörde.
const writing = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    topic: z.enum(['Java', 'Databases']),
    mediumUrl: z.url(),
    // Plak kılıfında görünen kısa ad; yoksa başlık.
    short: z.string().optional(),
  }),
});

export const collections = { writing };
