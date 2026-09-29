import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writing = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    topic: z.enum(['Java', 'Databases']),
    mediumUrl: z.url(),
    short: z.string().optional(),
  }),
});

export const collections = { writing };
