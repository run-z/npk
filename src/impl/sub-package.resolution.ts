import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { recognizeImport } from '../resolution/recognize-import.js';
import { SubPackageResolution } from '../resolution/sub-package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';
import { uriToImport } from './uri-to-import.js';

export abstract class SubPackage$Resolution<TImport extends Import.SubPackage>
  extends Import$Resolution<TImport>
  implements SubPackageResolution<TImport> {

  readonly #resolver: ImportResolver;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport | (() => TImport)) {
    super(resolver, uri, importSpec);

    this.#resolver = resolver;
  }

  abstract override get host(): PackageResolution;

  abstract get subpath(): '' | `/${string}` | `#${string}`;

  override resolveImport(spec: Import | string): ImportResolution {
    spec = recognizeImport(spec);

    switch (spec.kind) {
      case 'path':
        return this.#resolvePath(spec.uri);
      case 'package':
      case 'entry':
        return this.#resolver.resolveEntry(this.host, spec) ?? this.#resolver.resolve(spec);
      case 'private':
        return this.#resolver.resolvePrivate(this.host, spec);
      case 'uri':
        return this.#resolveURI(spec);
      case 'synthetic':
      case 'implied':
      case 'unknown':
        return this.#resolver.resolve(spec);
    }
  }

  #resolveURI(spec: Import.URI): ImportResolution {
    const packageURI = this.#resolver.fs.recognizePackageURI(spec);

    if (packageURI != null) {
      return this.#resolvePath(spec.spec);
    }

    // Non-package URI.
    return this.#resolver.resolveURI(spec);
  }

  #resolvePath(path: string): ImportResolution {
    const uriImport = uriToImport(this.#resolver.fs.resolvePath(this, path));

    return this.#resolver.resolveSubPackage(uriImport);
  }

  asSubPackage(): this {
    return this;
  }

}
