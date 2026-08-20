import { BadRequestException } from '@nestjs/common';
import {
  PostDocument,
  postDocumentSchema,
} from './post-document.schema';

export function validatePostDocument(
  document: unknown,
): PostDocument {
  const result = postDocumentSchema.safeParse(document);

  if (!result.success) {
    throw new BadRequestException({
      message: 'Invalid post document',
      errors: result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
  }

  return result.data;
}