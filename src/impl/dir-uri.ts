export function dirURI(uri: string): string {
  const href = URI_PATTERN.exec(uri)![1];

  return href.endsWith('/') ? href : href + '/';
}

const URI_PATTERN = /^([^#?]+)/;
