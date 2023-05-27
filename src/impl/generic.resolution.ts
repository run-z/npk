import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { recognizeImport } from '../resolution/recognize-import.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';

export class Generic$Resolution extends Import$Resolution<Import> {

  readonly #resolver: ImportResolver;

  constructor(resolver: ImportResolver, uri: string, importSpec: Import) {
    super(resolver, uri, importSpec);
    this.#resolver = resolver;
  }

  override async resolveImport(spec: Import | string): Promise<ImportResolution> {
    return await this.#resolver.resolve(recognizeImport(spec));
  }

}
