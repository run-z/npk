import { AmbientDependency, ImportDependency } from '../resolution/import-dependency.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { SubPackageResolution } from '../resolution/sub-package-resolution.js';
import { ImportResolver } from './import-resolver.js';

export abstract class Import$Resolution<TImport extends Import>
  implements ImportResolution<TImport> {

  readonly #resolver: ImportResolver;
  readonly #uri: string;
  readonly #importSpec: TImport;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport) {
    this.#resolver = resolver;
    this.#uri = uri;
    this.#importSpec = importSpec;
  }

  get root(): ImportResolution {
    return this.#resolver.root;
  }

  get host(): PackageResolution | undefined {
    return;
  }

  get uri(): string {
    return this.#uri;
  }

  get resolutionBaseURI(): string {
    return this.uri;
  }

  get importSpec(): TImport {
    return this.#importSpec;
  }

  abstract resolveImport(spec: Import | string): ImportResolution;

  resolveDependency(on: ImportResolution): ImportDependency | null {
    if (on.uri === this.uri) {
      // Import itself.
      return { kind: 'self', on };
    }

    const { host } = this;

    if (host) {
      if (host.uri === on.host?.uri) {
        // Import submodule of the same host.
        return { kind: 'self', on };
      }

      if (host.uri !== this.uri) {
        // Resolve host package dependency instead.
        return host.resolveDependency(on);
      }
    }

    const {
      importSpec: { kind },
    } = on;

    if (kind === 'implied' || kind === 'synthetic') {
      return { kind, on } as AmbientDependency;
    }

    return null;
  }

  asPackage(): PackageResolution | undefined {
    return;
  }

  asSubPackage(): SubPackageResolution | undefined {
    return;
  }

}
