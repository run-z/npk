import { PackageFS } from '../fs/package-fs.js';
import { AmbientDependency, ImportDependency } from '../resolution/import-dependency.js';
import { ImportDependencyRequest, ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { ImportResolver } from './import-resolver.js';
import { Package$Resolution } from './package.resolution.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export abstract class Import$Resolution<out TImport extends Import = Import>
  implements ImportResolution<TImport>
{
  readonly #resolver: ImportResolver;
  readonly #uri: string;
  readonly #importSpec: TImport;

  constructor(resolver: ImportResolver, uri: string, importSpec: TImport) {
    this.#resolver = resolver;
    this.#uri = uri;
    this.#importSpec = importSpec;
  }

  get fs(): PackageFS {
    return this.#resolver.fs;
  }

  get root(): Import$Resolution {
    return this.#resolver.root;
  }

  get host(): Package$Resolution | undefined {
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

  deref(): ImportResolution {
    return this;
  }

  abstract resolveImport(spec: Import | string): Promise<ImportResolution>;

  resolveDependency(
    on: ImportResolution,
    request?: ImportDependencyRequest,
  ): ImportDependency | null {
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
        return host.resolveDependency(on, request);
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

  asPackage(): Package$Resolution | undefined {
    return;
  }

  asSubPackage(): SubPackage$Resolution | undefined {
    return;
  }

  init(): Promise<this> {
    return Promise.resolve(this);
  }
}
