import { z } from 'zod';

const textMarkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bold'),
  }),

  z.object({
    type: z.literal('italic'),
  }),

  z.object({
    type: z.literal('underline'),
  }),

  z.object({
    type: z.literal('strike'),
  }),

  z.object({
    type: z.literal('code'),
  }),

  z.object({
    type: z.literal('link'),
    href: z.string().url().max(2048),
  }),
]);

const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
  marks: z.array(textMarkSchema).optional(),
});

const paragraphSchema = z.object({
  type: z.literal('paragraph'),
  content: z.array(textNodeSchema).default([]),
});

const headingSchema = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(1).max(3),
  content: z.array(textNodeSchema).default([]),
});

const listItemSchema = z.object({
  type: z.literal('listItem'),
  content: z.array(textNodeSchema).default([]),
});

const bulletListSchema = z.object({
  type: z.literal('bulletList'),
  content: z.array(listItemSchema).min(1),
});

const orderedListSchema = z.object({
  type: z.literal('orderedList'),
  content: z.array(listItemSchema).min(1),
});

const blockquoteSchema = z.object({
  type: z.literal('blockquote'),
  content: z.array(textNodeSchema).default([]),
});

const codeBlockSchema = z.object({
  type: z.literal('codeBlock'),
  language: z
    .string()
    .max(50)
    .optional(),

  content: z.array(textNodeSchema).default([]),
});

const imageSchema = z.object({
  type: z.literal('image'),
  mediaId: z.string().uuid(),
  altText: z.string().max(500).optional(),
});

const documentNodeSchema = z.discriminatedUnion('type', [
  paragraphSchema,
  headingSchema,
  bulletListSchema,
  orderedListSchema,
  blockquoteSchema,
  codeBlockSchema,
  imageSchema,
]);

export const postDocumentSchema = z.object({
  type: z.literal('doc'),

  version: z.literal(1),

  content: z
    .array(documentNodeSchema)
    .min(1)
    .max(500),
});

export type PostDocument = z.infer<typeof postDocumentSchema>;