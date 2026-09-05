export function extractMediaIds(
  document: unknown,
): string[] {
  const mediaIds = new Set<string>();

  function walk(node: unknown) {
    if (
      !node ||
      typeof node !== 'object'
    ) {
      return;
    }

    const current =
      node as Record<string, unknown>;

    if (
      current.type === 'image' &&
      current.attrs &&
      typeof current.attrs === 'object'
    ) {
      const attrs =
        current.attrs as Record<
          string,
          unknown
        >;

      if (
        typeof attrs.mediaId === 'string'
      ) {
        mediaIds.add(attrs.mediaId);
      }
    }

    const content =
      current.content;

    if (Array.isArray(content)) {
      for (const child of content) {
        walk(child);
      }
    }
  }

  walk(document);

  return [...mediaIds];
}