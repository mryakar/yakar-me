import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { locales } from './lib/i18n';

const lang = z.enum(locales);
const translations = (base: string) => glob({ pattern: `*/{${locales.join(',')}}.md`, base });
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const writing = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    topic: z.enum(['Java', 'Databases']),
    mediumUrl: z.url(),
    short: z.string().optional(),
    lang,
  }),
});

const writingTranslations = defineCollection({
  loader: translations('./src/content/writing'),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      mediumUrl: z.url(),
      short: z.string().optional(),
    })
    .strict(),
});

const series = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/photos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().int(),
    cover: slug.optional(),
    lang,
  }),
});

const seriesTranslations = defineCollection({
  loader: translations('./src/content/photos'),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      alt: z.record(slug, z.string().min(1).max(250)),
    })
    .strict(),
});

const pages = defineCollection({
  loader: translations('./src/content/pages'),
  schema: z.object({}).strict(),
});

const text = z.string().regex(/^[\x20-\x7e]{1,60}$/);
const variant = z.object({
  file: z.string().regex(/^[a-z0-9-]+-\d+-[0-9a-f]{8}\.(avif|webp)$/),
  width: z.number().int().positive().max(2560),
  height: z.number().int().positive().max(2560),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
const signedStep = z.number().min(-5).max(5);
const effect = z.enum(['Off', 'Weak', 'Strong']);

const photos = defineCollection({
  loader: glob({ pattern: '*/*.json', base: './src/content/photos' }),
  schema: z
    .object({
      alt: z.string().min(1).max(250),
      kind: z.enum(['fujifilm', 'phone']),
      make: z.enum(['Fujifilm', 'Apple']),
      model: text,
      lens: text.optional(),
      taken: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2})?$/),
      aperture: z.number().min(0.7).max(64),
      shutter: z.number().positive().max(3600),
      iso: z.number().int().min(25).max(409600),
      focalLength: z.number().int().positive().max(2000),
      place: z.object({ district: text, city: text, country: text }).strict(),
      recipe: z
        .object({
          filmSimulation: text,
          dynamicRange: text.optional(),
          highlight: signedStep.optional(),
          shadow: signedStep.optional(),
          color: signedStep.optional(),
          monochromaticColor: z.tuple([z.number().int().min(-18).max(18), z.number().int().min(-18).max(18)]).optional(),
          whiteBalance: text.optional(),
          whiteBalanceShift: z.tuple([z.number().int().min(-9).max(9), z.number().int().min(-9).max(9)]).optional(),
          noiseReduction: signedStep.optional(),
          clarity: signedStep.optional(),
          grain: text.optional(),
          colorChrome: effect.optional(),
          colorChromeBlue: effect.optional(),
        })
        .strict()
        .optional(),
      variants: z.object({
        avif: z.array(variant).min(1),
        webp: z.array(variant).min(1),
      }),
    })
    .strict()
    .refine((p) => (p.kind === 'fujifilm') === (p.recipe !== undefined && p.lens !== undefined), {
      message: 'Fujifilm photos need a lens and a recipe; phone photos have neither',
    }),
});

export const collections = { writing, writingTranslations, series, seriesTranslations, photos, pages };
