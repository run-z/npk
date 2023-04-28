import { ImportResolution } from '../resolution/import-resolution.js';
import { Import, recognizeImport } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { Import$Resolution } from './import.resolution.js';
import { ANY_RANGE } from './parse-range.js';
import { uriToImport } from './uri-to-import.js';

export abstract class Module$Resolution<TImport extends Import> extends Import$Resolution<TImport> {

  readonly #resolver: ImportResolver;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport | (() => TImport)) {
    super(resolver, uri, importSpec);

    this.#resolver = resolver;
  }
  abstract override get host(): PackageResolution;

  override resolveImport(spec: Import | string): ImportResolution {
    spec = recognizeImport(spec);

    switch (spec.kind) {
      case 'uri':
        return this.#resolveURI(spec);
      case 'path':
        return this.#resolvePath(spec.uri);
      case 'package':
        return this.#resolveName(spec.name) ?? this.#resolver.resolve(spec);
      default:
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

    return this.#resolver.resolveURI(uriImport, () => this.#resolver.resolveModule(uriImport));
  }

  #resolveName(name: string): ImportResolution | undefined {
    return this.#resolver.resolveName(name, ANY_RANGE, () => this.resolveDep(name));
  }

  resolveDep(depName: string): PackageResolution | undefined {
    const { host } = this;

    if (depName === host.packageInfo.name) {
      return host; // Resolve to host package.
    }

    const submoduleURI = this.#resolver.fs.resolveName(host, depName);

    return submoduleURI != null
      ? this.#resolver.resolveModule(uriToImport(submoduleURI))?.host
      : undefined;
  }

}
