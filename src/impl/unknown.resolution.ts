import { ImportResolution } from '../resolution/import-resolution.js';
import { Import, recognizeImport } from '../resolution/import.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';

export class Unknown$Resolution extends Import$Resolution<Import> {

  readonly #resolver: ImportResolver;

  constructor(resolver: ImportResolver, uri: string, importSpec: Import) {
    super(resolver, uri, importSpec);
    this.#resolver = resolver;
  }

  override resolveImport(spec: Import | string): ImportResolution {
    return this.#resolver.resolve(recognizeImport(spec));
  }

}
