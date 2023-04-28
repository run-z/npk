import { DependencyResolution } from '../resolution/dependency-resolution.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { ImportResolver } from './import-resolver.js';

export abstract class Import$Resolution<TImport extends Import> implements ImportResolution {

  readonly #resolver: ImportResolver;
  readonly #uri: string;
  #getImportSpec: () => TImport;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport | (() => TImport)) {
    this.#resolver = resolver;
    this.#uri = uri;
    if (typeof importSpec === 'function') {
      this.#getImportSpec = () => {
        const spec = importSpec();

        this.#getImportSpec = () => spec;

        return spec;
      };
    } else {
      this.#getImportSpec = () => importSpec;
    }
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

  get importSpec(): TImport {
    return this.#getImportSpec();
  }

  abstract resolveImport(spec: Import | string): ImportResolution;

  resolveDependency(another: ImportResolution): DependencyResolution | null {
    if (another.uri === this.uri) {
      // Import itself.
      return { kind: 'self' };
    }

    const { host } = this;

    if (host) {
      if (host.uri === another.host?.uri) {
        // Import submodule of the same host.
        return { kind: 'self' };
      }

      if (host.uri !== this.uri) {
        // Resolve host package dependency instead.
        return host.resolveDependency(another);
      }
    }

    const {
      importSpec: { kind },
    } = another;

    if (kind === 'implied' || kind === 'synthetic') {
      return { kind };
    }

    return null;
  }

  asPackage(): PackageResolution | undefined {
    return;
  }

}
