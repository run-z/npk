import semver from 'semver';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageFS } from '../resolution/package-fs.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { Package$Resolution } from './package.resolution.js';
import { Submodule$Resolution } from './submodule.resolution.js';
import { Unknown$Resolution } from './unknown.resolution.js';
import { uriToImport } from './uri-to-import.js';
import { URI$Resolution } from './uri.resolution.js';

export class ImportResolver {

  readonly #root: ImportResolution;
  readonly #fs: PackageFS;
  readonly #byURI = new Map<string, ImportResolution>();
  readonly #byName = new Map<string, PackageResolution[]>();
  #initialized = false;

  constructor({
    createRoot,
    fs,
  }: {
    readonly createRoot: (resolver: ImportResolver) => ImportResolution;
    readonly fs: PackageFS;
  }) {
    this.#fs = fs;
    this.#root = createRoot(this);
  }

  #init(): void {
    if (!this.#initialized) {
      this.#initialized = true;
      this.#addResolution(this.#root);
    }
  }

  get root(): ImportResolution {
    return this.#root;
  }

  get fs(): PackageFS {
    return this.#fs;
  }

  resolve(spec: Import, createResolution?: () => ImportResolution | undefined): ImportResolution {
    if (spec.kind === 'uri') {
      return this.resolveURI(spec, createResolution);
    }

    this.#init();

    return this.#addResolution(createResolution?.() ?? this.#createDefaultResolution(spec));
  }

  #createDefaultResolution(spec: Exclude<Import, Import.URI>): ImportResolution {
    switch (spec.kind) {
      case 'implied':
      case 'package':
        return new Unknown$Resolution(this, `import:${spec.kind}:${spec.spec}`, spec);
      case 'path':
        return new Unknown$Resolution(this, `import:${spec.kind}:${spec.uri}`, spec);
      case 'subpath':
        return new Unknown$Resolution(this, `import:${spec.kind}:${spec.spec.slice(1)}`, spec);
      case 'synthetic':
        return new Unknown$Resolution(
          this,
          `import:${spec.kind}:${encodeURIComponent(spec.spec.slice(1))}`,
          spec,
        );
      case 'unknown':
        return new Unknown$Resolution(
          this,
          `import:${spec.kind}:${encodeURIComponent(spec.spec)}`,
          spec,
        );
    }
  }

  byURI(uri: string): ImportResolution | undefined {
    this.#init();

    return this.#byURI.get(uri);
  }

  resolveURI(
    spec: Import.URI,
    createResolution?: () => ImportResolution | undefined,
  ): ImportResolution {
    this.#init();

    const { spec: uri } = spec;

    return (
      this.byURI(uri)
      ?? this.#addResolution(createResolution?.() ?? new URI$Resolution(this, spec), uri)
    );
  }

  resolveName(
    name: string,
    range: semver.Range,
    createPackage?: () => PackageResolution | undefined,
  ): PackageResolution | undefined;

  resolveName(
    name: string,
    range: semver.Range,
    createPackage: () => PackageResolution,
  ): PackageResolution;

  resolveName(
    name: string,
    range: semver.Range,
    createPackage?: () => PackageResolution | undefined,
  ): PackageResolution | undefined {
    const candidates = this.#byName.get(name);

    if (candidates) {
      for (const candidate of candidates) {
        if (range.test(candidate.packageInfo.version)) {
          return candidate;
        }
      }
    }

    const newPackage = createPackage?.();

    return newPackage && this.#addResolution(newPackage);
  }

  resolveModule(spec: Import.URI): ImportResolution | undefined {
    return this.resolveURI(spec, () => {
      const packageDir = this.fs.findPackageDir(spec.spec);

      if (!packageDir) {
        return;
      }

      const pkg = this.#resolvePackageByDir(packageDir);

      if (packageDir.uri === spec.spec) {
        // Package imported directly, rather its submodule.
        return pkg;
      }

      const { host } = pkg;

      return host && new Submodule$Resolution(this, spec, host);
    });
  }

  #resolvePackageByDir({ uri, packageInfo: packageJson }: PackageFS.PackageDir): ImportResolution {
    return this.resolveURI(
      uriToImport(new URL(uri)),
      () => new Package$Resolution(this, uri, undefined, packageJson),
    );
  }

  #addResolution<T extends ImportResolution>(resolution: T, uri = resolution.uri): T {
    this.#byURI.set(uri, resolution);

    if (uri === resolution.uri) {
      const pkg = resolution.asPackage();

      if (pkg) {
        const withSameName = this.#byName.get(pkg.packageInfo.name);

        if (withSameName) {
          withSameName.push(pkg);
        } else {
          this.#byName.set(pkg.packageInfo.name, [pkg]);
        }
      }
    }

    return resolution;
  }

}
