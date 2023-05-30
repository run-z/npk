import { PackageFS } from '../fs/package-fs.js';
import { Import } from '../resolution/import.js';
import { Generic$Resolution } from './generic.resolution.js';
import { Import$Resolution } from './import.resolution.js';
import { PackageEntry$Resolution } from './package-entry.resolution.js';
import { PackageFile$Resolution } from './package-file.resolution.js';
import { PackagePrivate$Resolution } from './package-private.resolution.js';
import { Package$Resolution } from './package.resolution.js';
import { uriToImport } from './uri-to-import.js';
import { URI$Resolution } from './uri.resolution.js';

export class ImportResolver {

  readonly #root: Import$Resolution;
  readonly #fs: PackageFS;
  readonly #byURI = new Map<string, Import$Resolution>();
  #initialized = false;

  constructor({
    createRoot,
    fs,
  }: {
    readonly createRoot: (resolver: ImportResolver) => Import$Resolution;
    readonly fs: PackageFS;
  }) {
    this.#fs = fs;
    this.#root = createRoot(this);
  }

  #init(): void {
    if (!this.#initialized) {
      this.#initialized = true;
      this.#addResolution(this.#root.uri, this.#root).catch(null);
    }
  }

  get root(): Import$Resolution {
    return this.#root;
  }

  get fs(): PackageFS {
    return this.#fs;
  }

  recognizeImport<TImport extends Import>(spec: TImport): TImport;

  recognizeImport(spec: Import | string): Import;

  recognizeImport(spec: Import | string): Import {
    return typeof spec === 'string' ? this.fs.recognizeImport(spec) : spec;
  }

  async resolve(spec: Import): Promise<Import$Resolution> {
    if (spec.kind === 'uri') {
      return await this.resolveURI(spec);
    }

    this.#init();

    const uri = this.#genericResolutionURI(spec);

    return await this.#addResolution(uri, new Generic$Resolution(this, uri, spec));
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

  async resolveURI(
    spec: Import.URI,
    createResolution?: (uri: string) => Import$Resolution | undefined,
  ): Promise<Import$Resolution> {
    this.#init();

    const { spec: uri } = spec;

    return (
      this.#findByURI(uri)
      ?? (await this.#addResolution(uri, createResolution?.(uri) ?? new URI$Resolution(this, spec)))
    );
  }

  async #addResolution<TResolution extends Import$Resolution>(
    uri: string,
    resolution: TResolution,
  ): Promise<TResolution> {
    this.#byURI.set(uri, resolution);

    await resolution.init();

    return resolution;
  }

  #findByURI(uri: string): Import$Resolution | undefined {
    this.#init();

    return this.#byURI.get(uri);
  }

  async resolvePrivate(host: Package$Resolution, spec: Import.Private): Promise<Import$Resolution> {
    return await this.resolveURI(
      uriToImport(PackagePrivate$Resolution.uri(host, spec)),
      uri => new PackagePrivate$Resolution(this, host, uri, spec),
    );
  }

  async resolveEntry(
    relativeTo: Package$Resolution,
    spec: Import.Package | Import.Entry,
  ): Promise<Import$Resolution | undefined> {
    const { name, subpath } = spec;
    const dep = await this.#resolveDepOf(relativeTo, name);

    if (!dep || !subpath) {
      return dep;
    }

    return await this.resolveURI(
      uriToImport(PackageEntry$Resolution.uri(this, dep, subpath)),
      uri => new PackageEntry$Resolution(this, dep, uri, subpath),
    );
  }

  async #resolveDepOf(
    host: Package$Resolution,
    depName: string,
  ): Promise<Package$Resolution | undefined> {
    if (depName === host.packageInfo.name) {
      return host; // Resolve to host package.
    }

    const entryPointURI = await this.#fs.resolveName(host, depName);

    if (entryPointURI == null) {
      return undefined;
    }

    const subPackage = await this.resolvePackageOrFile(uriToImport(entryPointURI));

    return subPackage?.host;
  }

  async resolvePackageOrFile(spec: Import.URI): Promise<Import$Resolution> {
    const { spec: uri } = spec;
    const packageDir = await this.#fs.findPackageDir(uri);

    if (!packageDir) {
      // No package directory.
      // Use generic resolution.
      return await this.resolveURI(spec);
    }

    const { uri: dirURI, packageInfo } = packageDir;

    // Resolve the host first.
    const { host } = await this.resolveURI(
      uriToImport(dirURI),
      () => new Package$Resolution(this, dirURI, packageInfo),
    );

    if (host?.uri === uri) {
      // Package imported directly rather its subpath.
      // Avoid recurrent call.
      return host;
    }

    return this.resolveURI(
      spec,
      () => host
        && new PackageFile$Resolution(this, host, `./${uri.slice(host.resolutionBaseURI.length)}`),
    );
  }

}
