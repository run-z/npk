import { PackageDir } from '../fs/package-dir.js';
import { PackageFS } from '../fs/package-fs.js';
import { PackageJson } from '../package/package.json.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { Generic$Resolution } from './generic.resolution.js';
import { PackageEntry$Resolution } from './package-entry.resolution.js';
import { PackageFile$Resolution } from './package-file.resolution.js';
import { PackagePrivate$Resolution } from './package-private.resolution.js';
import { Package$Resolution } from './package.resolution.js';
import { parseRange } from './parse-range.js';
import { uriToImport } from './uri-to-import.js';
import { URI$Resolution } from './uri.resolution.js';

export class ImportResolver {

  readonly #root: ImportResolution;
  readonly #fs: PackageFS;
  readonly #byURI = new Map<string, Promise<ImportResolution>>();
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
      this.#addResolution(this.#root.uri, () => this.#root).catch(null);
    }
  }

  get root(): ImportResolution {
    return this.#root;
  }

  get fs(): PackageFS {
    return this.#fs;
  }

  async resolve(spec: Import): Promise<ImportResolution> {
    if (spec.kind === 'uri') {
      return await this.resolveURI(spec);
    }

    this.#init();

    const uri = this.#genericResolutionURI(spec);

    return await this.#addResolution(uri, () => new Generic$Resolution(this, uri, spec));
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

  resolveURI(
    spec: Import.URI,
    createResolution?: (
      uri: string,
    ) => ImportResolution | undefined | Promise<ImportResolution | undefined>,
  ): Promise<ImportResolution> {
    this.#init();

    const { spec: uri } = spec;

    return (
      this.#findByURI(uri)
      ?? this.#addResolution(
        uri,
        async uri => (await createResolution?.(uri)) ?? new URI$Resolution(this, spec),
      )
    );
  }

  #findByURI(uri: string): Promise<ImportResolution> | undefined {
    this.#init();

    return this.#byURI.get(uri);
  }

  #addResolution<T extends ImportResolution>(
    uri: string,
    createResolution: (uri: string) => T | Promise<T>,
  ): Promise<T> {
    const result = this.#resolve(uri, createResolution);

    this.#byURI.set(uri, result);

    return result;
  }

  async #resolve<T extends ImportResolution | undefined>(
    uri: string,
    createResolution: (uri: string) => T | Promise<T>,
  ): Promise<T> {
    const resolution = await createResolution(uri);

    this.#registerName(resolution);

    return resolution;
  }

  #registerName<T extends ImportResolution | undefined>(resolution: T): void {
    const pkg = resolution?.asPackage();

    if (pkg) {
      const {
        packageInfo: { name },
      } = pkg;
      const withSameName = this.#byName.get(name);

      if (withSameName) {
        withSameName.push(pkg);
      } else {
        this.#byName.set(name, [pkg]);
      }
    }
  }

  async resolvePrivate(host: PackageResolution, spec: Import.Private): Promise<ImportResolution> {
    return this.resolveURI(
      uriToImport(PackagePrivate$Resolution.uri(host, spec)),
      uri => new PackagePrivate$Resolution(this, host, uri, spec),
    );
  }

  async resolveEntry(
    host: PackageResolution,
    { name, subpath }: Import.Package | Import.Entry,
  ): Promise<ImportResolution | undefined> {
    const {
      packageInfo: { packageJson },
    } = host;
    const dep =
      this.#findByName(name, packageJson.dependencies)
      ?? this.#findByName(name, packageJson.devDependencies)
      ?? (await this.#resolveDepOf(host, name));

    if (!dep || !subpath) {
      return dep;
    }

    return await this.resolveURI(
      uriToImport(PackageEntry$Resolution.uri(this, dep, subpath)),
      uri => new PackageEntry$Resolution(this, dep, uri, subpath),
    );
  }

  #findByName(
    name: string,
    dependencies: PackageJson.Dependencies | undefined,
  ): PackageResolution | undefined {
    const range = parseRange(dependencies?.[name]);

    if (!range) {
      return;
    }

    const candidates = this.#byName.get(name);

    if (candidates) {
      for (const candidate of candidates) {
        if (range.test(candidate.packageInfo.version)) {
          return candidate;
        }
      }
    }

    return;
  }

  async #resolveDepOf(
    host: PackageResolution,
    depName: string,
  ): Promise<PackageResolution | undefined> {
    if (depName === host.packageInfo.name) {
      return host; // Resolve to host package.
    }

    const entryPointURI = this.#fs.resolveName(host, depName);

    if (entryPointURI == null) {
      return undefined;
    }

    const subPackage = await this.resolveSubPackage(uriToImport(entryPointURI));

    return subPackage?.host;
  }

  async resolveSubPackage(spec: Import.URI): Promise<ImportResolution> {
    return await this.resolveURI(spec, async uri => {
      const packageDir = this.#fs.findPackageDir(uri);

      if (!packageDir) {
        return;
      }

      const pkg = await this.#resolvePackageByDir(packageDir);

      if (pkg.uri === uri) {
        // Package imported directly rather its subpath.
        return pkg;
      }

      const { host } = pkg;

      return (
        host
        && new PackageFile$Resolution(this, host, `./${uri.slice(host.resolutionBaseURI.length)}`)
      );
    });
  }

  async #resolvePackageByDir({ uri, packageInfo }: PackageDir): Promise<ImportResolution> {
    return await this.resolveURI(
      uriToImport(new URL(uri)),
      () => new Package$Resolution(this, uri, packageInfo),
    );
  }

}
