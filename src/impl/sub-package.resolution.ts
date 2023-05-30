import { Import } from '../resolution/import.js';
import { SubPackageResolution } from '../resolution/sub-package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';
import { Package$Resolution } from './package.resolution.js';
import { uriToImport } from './uri-to-import.js';

export abstract class SubPackage$Resolution<
    out TImport extends Import.SubPackage = Import.SubPackage,
  >
  extends Import$Resolution<TImport>
  implements SubPackageResolution<TImport> {

  readonly #resolver: ImportResolver;
  #deref: Import$Resolution;
  #initialized = false;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport) {
    super(resolver, uri, importSpec);

    this.#resolver = resolver;
    this.#deref = this;
  }

  abstract override get host(): Package$Resolution;

  abstract get subpath(): '' | `/${string}` | `#${string}`;

  override deref(): Import$Resolution {
    return this.#deref;
  }

  override async resolveImport(spec: Import | string): Promise<Import$Resolution> {
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

  async #resolveURI(spec: Import.URI): Promise<Import$Resolution> {
    const packageURI = this.#resolver.fs.recognizePackageURI(spec);

    if (packageURI != null) {
      return await this.#resolvePath(packageURI);
    }

    // Non-package URI.
    return await this.#resolver.resolveURI(spec);
  }

  async #resolvePath(path: string): Promise<Import$Resolution> {
    const uriImport = uriToImport(this.#resolver.fs.resolvePath(this, path));

    return await this.#resolver.resolvePackageOrFile(uriImport);
  }

  asSubPackage(): this {
    return this;
  }

  override async init(): Promise<this> {
    if (!this.#initialized) {
      this.#initialized = true;

      const { host, importSpec } = this;

      if (importSpec.kind !== 'path') {
        const deref = await this.#resolver.fs.derefEntry(host, importSpec);

        if (deref) {
          this.#deref = await host.resolveImport(deref);
        }
      }
    }

    return this;
  }

}
