import semver from 'semver';
import { PackageDir } from '../fs/package-dir.js';
import { PackageFS } from '../fs/package-fs.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { Generic$Resolution } from './generic.resolution.js';
import { PackageEntry$Resolution } from './package-entry.resolution.js';
import { PackageFile$Resolution } from './package-file.resolution.js';
import { PackagePrivate$Resolution } from './package-private.resolution.js';
import { Package$Resolution } from './package.resolution.js';
import { ANY_RANGE } from './parse-range.js';
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
      this.#addResolution(this.#root.uri, this.#root);
    }
  }

  get root(): ImportResolution {
    return this.#root;
  }

  get fs(): PackageFS {
    return this.#fs;
  }

  resolve(spec: Import): ImportResolution {
    if (spec.kind === 'uri') {
      return this.resolveURI(spec);
    }

    this.#init();

    const uri = this.#genericResolutionURI(spec);

    return this.#addResolution(uri, new Generic$Resolution(this, uri, spec));
  }

  #genericResolutionURI(spec: Exclude<Import, Import.URI>): string {
    switch (spec.kind) {
      case 'implied':
      case 'package':
      case 'entry':
        return `import:${spec.kind}:${spec.spec}`;
      case 'path':
        return `import:${spec.kind}:${spec.uri}`;
      case 'private':
        return `import:${spec.kind}:${spec.spec.slice(1)}`;
      case 'synthetic':
        return `import:${spec.kind}:${encodeURIComponent(spec.spec.slice(1))}`;
      case 'unknown':
        return `import:${spec.kind}:${encodeURIComponent(spec.spec)}`;
    }
  }

  byURI(uri: string): ImportResolution | undefined {
    this.#init();

    return this.#byURI.get(uri);
  }

  resolveURI(
    spec: Import.URI,
    createResolution?: (uri: string) => ImportResolution | undefined,
  ): ImportResolution {
    this.#init();

    const { spec: uri } = spec;

    return (
      this.byURI(uri)
      ?? this.#addResolution(uri, createResolution?.(uri) ?? new URI$Resolution(this, spec))
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

    return newPackage && this.#addResolution(newPackage.uri, newPackage);
  }

  resolvePrivate(host: PackageResolution, spec: Import.Private): ImportResolution {
    return this.resolveURI(
      uriToImport(PackagePrivate$Resolution.uri(host, spec)),
      uri => new PackagePrivate$Resolution(this, host, uri, spec),
    );
  }

  resolveEntry(
    host: PackageResolution,
    { name, subpath }: Import.Package | Import.Entry,
  ): ImportResolution | undefined {
    const dep = this.resolveName(name, ANY_RANGE, () => this.#resolveDepOf(host, name));

    if (!dep || !subpath) {
      return dep;
    }

    return this.resolveURI(
      uriToImport(PackageEntry$Resolution.uri(this, dep, subpath)),
      uri => new PackageEntry$Resolution(this, dep, uri, subpath),
    );
  }

  #resolveDepOf(host: PackageResolution, depName: string): PackageResolution | undefined {
    if (depName === host.packageInfo.name) {
      return host; // Resolve to host package.
    }

    const entryPointURI = this.#fs.resolveName(host, depName);

    return entryPointURI != null
      ? this.resolveSubPackage(uriToImport(entryPointURI))?.host
      : undefined;
  }

  resolveSubPackage(spec: Import.URI): ImportResolution {
    return this.resolveURI(spec, () => {
      const { spec: uri } = spec;
      const packageDir = this.#fs.findPackageDir(uri);

      if (!packageDir) {
        return;
      }

      const pkg = this.#resolvePackageByDir(packageDir);

      if (packageDir.uri === uri) {
        // Package imported directly, rather its subpath.
        return pkg;
      }

      const { host } = pkg;

      return (
        host
        && new PackageFile$Resolution(this, host, `./${uri.slice(host.resolutionBaseURI.length)}`)
      );
    });
  }

  #resolvePackageByDir({ uri, packageInfo }: PackageDir): ImportResolution {
    return this.resolveURI(
      uriToImport(new URL(uri)),
      () => new Package$Resolution(this, uri, packageInfo),
    );
  }

  #addResolution<T extends ImportResolution>(uri: string, resolution: T): T {
    this.#byURI.set(uri, resolution);

    const pkg = resolution.asPackage();

    if (pkg) {
      const withSameName = this.#byName.get(pkg.packageInfo.name);

      if (withSameName) {
        withSameName.push(pkg);
      } else {
        this.#byName.set(pkg.packageInfo.name, [pkg]);
      }
    }

    return resolution;
  }

}
