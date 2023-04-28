import { Import } from '../resolution/import.js';

export function uriToImport(uri: URL | string): Import.URI {
  if (typeof uri === 'string') {
    uri = new URL(uri);
  }

  return {
    kind: 'uri',
    spec: uri.href,
    scheme: uri.protocol.slice(0, -1),
    path: uri.pathname,
  };
}
