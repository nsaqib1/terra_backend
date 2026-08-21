import { PostDocument } from './post-document.schema';

export function extractPostSearchText(
  document: PostDocument,
): string {
  const parts: string[] = [];

  for (const node of document.content) {
    switch (node.type) {
      case 'paragraph':
      case 'heading':
      case 'blockquote':
      case 'codeBlock':
        parts.push(
          node.content
            .map((item) => item.text)
            .join(' '),
        );
        break;

      case 'bulletList':
      case 'orderedList':
        for (const item of node.content) {
          parts.push(
            item.content
              .map((text) => text.text)
              .join(' '),
          );
        }
        break;

      case 'image':
        if (node.altText) {
          parts.push(node.altText);
        }
        break;
    }
  }

  return parts
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractPostMediaIds(
  document: PostDocument,
): string[] {
  const mediaIds: string[] = [];

  for (const node of document.content) {
    if (node.type === 'image') {
      mediaIds.push(node.mediaId);
    }
  }

  return [...new Set(mediaIds)];
}