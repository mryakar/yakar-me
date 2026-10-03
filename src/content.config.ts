import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { locales } from './lib/i18n';
import { FOCUS_STEP, PLACE_NAME } from './lib/photo';
import { allGenres, bookLanguages, categories, categoryOf, isIsbn13 } from './lib/book';

const lang = z.enum(locales);
const translations = (base: string) => glob({ pattern: `*/{${locales.join(',')}}.md`, base });
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const focusPercent = z.number().int().min(0).max(100).multipleOf(FOCUS_STEP);

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
    focus: z.object({ x: focusPercent, y: focusPercent }).strict().optional(),
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
const placeName = z.string().regex(PLACE_NAME);
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
      iso: z.number().int().min(1).max(409600),
      focalLength: z.number().int().positive().max(2000),
      place: z.object({ district: placeName, city: placeName, country: placeName }).strict(),
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

const districts = defineCollection({
  loader: file('./src/content/districts.json'),
  schema: z
    .object({
      id: z.string().regex(/^Q\d+$/),
      district: placeName,
      city: placeName,
      country: placeName,
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      timeZone: z.string().refine((zone) => Intl.supportedValuesOf('timeZone').includes(zone), 'not an IANA time zone'),
    })
    .strict(),
});

const bookLanguage = z.enum(bookLanguages);
const bookText = z.string().trim().min(1);

const book = z
  .object({
    id: z.string().refine(isIsbn13, 'not a valid ISBN-13'),
    title: z.record(lang, bookText),
    originalTitle: bookText,
    author: bookText,
    originalLanguage: bookLanguage,
    readIn: bookLanguage,
    category: z.enum(categories),
    genre: z.enum(allGenres),
    edition: z.number().int().min(2).optional(),
    pages: z.number().int().positive(),
    position: z.number().int().nonnegative(),
  })
  .strict();

const books = defineCollection({
  loader: file('./src/content/books.json', {
    parser: (text) => (JSON.parse(text) as object[]).map((book, position) => ({ ...book, position })),
  }),
  schema: z
    .discriminatedUnion('status', [
      book.extend({ status: z.literal('reading'), nowNote: z.record(lang, bookText).optional() }),
      book.extend({ status: z.literal('finished'), finished: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
    ])
    .refine((b) => categoryOf(b.genre) === b.category, { message: 'genre does not belong to the category' }),
});

export const collections = { writing, writingTranslations, series, seriesTranslations, photos, districts, pages, books };
