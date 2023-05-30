import { parseRange } from '../impl/parse-range.js';
import { PackageInfo } from '../package/package-info.js';
import { PackageJson } from '../package/package.json.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { PackageDir } from './package-dir.js';
import { PackageFS } from './package-fs.js';

/**
 * Virtual package file system.
 *
 * Serves packages registered with {@link VirtualPackageFS#addPackage addPackage} method.
 *
 * Package URIs has to have `package:` scheme.
 *
 * Can be used e.g. for testing.
 */
export class VirtualPackageFS extends PackageFS {

  readonly #root: string;
  readonly #byURI = new Map<string, VirtualPackage>();
  readonly #byName = new Map<string, Map<string, VirtualPackage>>();

  /**
   * Constructs virtual package file system.
   *
   * @param root - Root package URI. `package:root` by default.
   */
  constructor(root = 'package:root') {
    super();
    this.#root = root;
  }

  override get root(): string {
    return this.#root;
  }

  /**
   * Registers root virtual package.
   *
   * Replaces existing root package.
   *
   * Replaces package with the same name and version, unless `allowDuplicate` parameter is set.
   *
   * @param uri - Package URI.
   * @param packageJson - `package.json` contents.
   * @param options - Added package options.
   *
   * @returns `this` instance.
   */
  addRoot(packageJson: PackageJson | PackageInfo, options?: VirtualPackageOptions): this {
    return this.addPackage(this.root, packageJson, options);
  }

  /**
   * Registers virtual package with automatically generated URI.
   *
   * Replaces package under the same URI.
   *
   * Replaces package with the same name and version, unless `allowDuplicate` parameter is set.
   *
   * @param uri - Package URI.
   * @param packageJson - `package.json` contents.
   * @param options - Added package options.
   *
   * @returns `this` instance.
   */
  addPackage(packageJson: PackageJson.Valid, options?: VirtualPackageOptions): this;

  /**
   * Registers virtual package at the given URI.
   *
   * Replaces package under the same URI.
   *
   * Replaces package with the same name and version, unless `allowDuplicate` parameter is set.
   *
   * @param uri - Package URI.
   * @param packageJson - `package.json` contents.
   * @param options - Added package options.
   *
   * @returns `this` instance.
   */
  addPackage(
    uri: string,
    packageJson: PackageJson | PackageInfo,
    options?: VirtualPackageOptions,
  ): this;

  addPackage(
    uriOrPackageJson: string | PackageJson | PackageInfo,
    packageJsonOrOptions?: PackageJson | PackageInfo | VirtualPackageOptions,
    options: VirtualPackageOptions = {},
  ): this {
    let uri: string;
    let packageInfo: PackageInfo;

    if (typeof uriOrPackageJson === 'string') {
      uri = this.#toPackageURI(uriOrPackageJson);
      packageInfo = PackageInfo.from(packageJsonOrOptions as PackageJson | PackageInfo);
    } else {
      packageInfo = PackageInfo.from(uriOrPackageJson);
      uri = `package:${packageInfo.name}/${packageInfo.version}`;
      options = (packageJsonOrOptions as VirtualPackageOptions) ?? {};
    }

    const { allowDuplicate = false, deref = {} } = options;

    if (!allowDuplicate) {
      const existing = this.#byURI.get(uri);

      if (existing) {
        this.#removeNamedPackage(existing.dir.packageInfo);
      }
    }

    this.#addPackage({ dir: { uri, packageInfo }, deref });

    return this;
  }

  #addPackage(virtualPackage: VirtualPackage): void {
    const {
      dir: { uri, packageInfo },
    } = virtualPackage;
    const { name, version } = packageInfo;
    let byVersion = this.#byName.get(name);

    if (!byVersion) {
      byVersion = new Map();
      this.#byName.set(name, byVersion);
    }

    const existing = byVersion.get(version);

    if (existing) {
      byVersion.delete(version);
      this.#byURI.delete(existing.dir.uri);
    }

    byVersion.set(version, virtualPackage);
    this.#byURI.set(uri, virtualPackage);
  }

  #removeNamedPackage({ name, version }: PackageInfo): void {
    const byVersion = this.#byName.get(name)!; // Won't be called for non-existing package.
    const existing = byVersion.get(version)!; // Won't be called for non-existing package version.

    byVersion.delete(version);
    if (!byVersion.size) {
      this.#byName.delete(name);
    }

    this.#byURI.delete(existing.dir.uri);
  }

  override recognizePackageURI(importSpec: Import.URI): string | undefined {
    return importSpec.scheme === 'package' ? importSpec.spec : undefined;
  }

  override loadPackage(uri: string): Promise<PackageInfo | undefined> {
    return Promise.resolve(this.#byURI.get(uri)?.dir.packageInfo);
  }

  override parentDir(uri: string): string | undefined {
    const httpURL = this.#toHttpURL(uri);
    const path = httpURL.pathname;

    if (!path.endsWith('/')) {
      httpURL.pathname = path + '/';
    }

    const parentURL = new URL('..', httpURL);

    if (parentURL.pathname === httpURL.pathname) {
      return;
    }

    return this.#toPackageURI(parentURL);
  }

  override resolvePath(relativeTo: PackageResolution, path: string): string {
    return this.#toPackageURI(new URL(path, this.#toHttpURL(relativeTo.resolutionBaseURI)));
  }

  #toPackageURI(uri: string | URL): string {
    let pathname = (typeof uri === 'string' ? new URL(uri) : uri).pathname;

    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    return 'package:' + (pathname.startsWith('/') ? pathname.slice(1) : pathname);
  }

  #toHttpURL(uri: string): URL {
    const pathname = new URL(uri).pathname;

    return new URL(pathname.startsWith('/') ? pathname : `/${pathname}`, 'http://localhost/');
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async resolveName(
    relativeTo: PackageResolution,
    name: string,
  ): Promise<string | undefined> {
    const {
      packageInfo: { packageJson },
    } = relativeTo;
    const { dependencies, peerDependencies, devDependencies } = packageJson;

    return (
      this.#resolveDep(name, dependencies)
      ?? this.#resolveDep(name, peerDependencies)
      ?? this.#resolveDep(name, devDependencies)
    );
  }

  #resolveDep(name: string, dependencies?: PackageJson.Dependencies): string | undefined {
    if (!dependencies) {
      return;
    }

    const range = parseRange(dependencies[name]);

    if (!range) {
      return;
    }

    const byVersion = this.#byName.get(name);

    if (byVersion) {
      for (const [
        version,
        {
          dir: { uri },
        },
      ] of byVersion) {
        if (range.test(version)) {
          return uri;
        }
      }
    }

    return;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async derefEntry(
    host: PackageResolution,
    spec: Import.Package | Import.Entry | Import.Private,
  ): Promise<string | undefined> {
    const key = spec.kind === 'package' ? '' : spec.kind === 'entry' ? spec.subpath : spec.spec;
    const path = this.#byURI.get(host.uri)?.deref[key];

    return path && this.resolvePath(host, path);
  }

}

interface VirtualPackage {
  readonly dir: PackageDir;
  readonly deref: Exclude<VirtualPackageOptions['deref'], undefined>;
}

/**
 * Options for {@link VirtualPackageFS#addPackage added virtual package}.
 */
export interface VirtualPackageOptions {
  /**
   * Permit package with the same name.
   *
   * @defaultValue `false`.
   */
  readonly allowDuplicate?: boolean | undefined;

  /**
   * Per-entry dereference mappings.
   */
  readonly deref?:
    | {
        readonly [subpath in '' | `/${string}` | `#${string}`]?: `./${string}` | undefined;
      }
    | undefined;
}
