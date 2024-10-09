import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';
import { uriToImport } from './uri-to-import.js';

export class URI$Resolution extends Import$Resolution<Import.URI> {
  readonly #resolver: ImportResolver;

  constructor(resolver: ImportResolver, importSpec: Import.URI) {
    super(resolver, importSpec.spec, importSpec);
    this.#resolver = resolver;
  }

  override async resolveImport(spec: Import | string): Promise<ImportResolution> {
    spec = this.#resolver.recognizeImport(spec);

    switch (spec.kind) {
      case 'uri':
        return await this.#resolveURIImport(spec.spec);
      case 'path':
        return await this.#resolveURIImport(spec.uri);
      default:
        return await this.#resolver.resolve(spec);
    }
  }

  async #resolveURIImport(path: string): Promise<ImportResolution> {
    return this.#resolver.resolveURI(uriToImport(new URL(path, this.uri)));
  }
}
