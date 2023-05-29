import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { SubPackageResolution } from '../resolution/sub-package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';
import { uriToImport } from './uri-to-import.js';

export abstract class SubPackage$Resolution<TImport extends Import.SubPackage>
  extends Import$Resolution<TImport>
  implements SubPackageResolution<TImport> {

  readonly #resolver: ImportResolver;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport) {
    super(resolver, uri, importSpec);

    this.#resolver = resolver;
  }

  abstract override get host(): PackageResolution;

  abstract get subpath(): '' | `/${string}` | `#${string}`;

  override async resolveImport(spec: Import | string): Promise<ImportResolution> {
    spec = this.#resolver.recognizeImport(spec);

    switch (spec.kind) {
      case 'path':
        return await this.#resolvePath(spec.uri);
      case 'package':
      case 'entry':
        return (
          (await this.#resolver.resolveEntry(this.host, spec))
          ?? (await this.#resolver.resolve(spec))
        );
      case 'private':
        return await this.#resolver.resolvePrivate(this.host, spec);
      case 'uri':
        return await this.#resolveURI(spec);
      case 'synthetic':
      case 'implied':
      case 'unknown':
        return await this.#resolver.resolve(spec);
    }
  }

  async #resolveURI(spec: Import.URI): Promise<ImportResolution> {
    const packageURI = this.#resolver.fs.recognizePackageURI(spec);

    if (packageURI != null) {
      return await this.#resolvePath(packageURI);
    }

    // Non-package URI.
    return await this.#resolver.resolveURI(spec);
  }

  async #resolvePath(path: string): Promise<ImportResolution> {
    const uriImport = uriToImport(this.#resolver.fs.resolvePath(this, path));

    return await this.#resolver.resolveSubPackage(uriImport);
  }

  asSubPackage(): this {
    return this;
  }

}
