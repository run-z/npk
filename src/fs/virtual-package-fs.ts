import { parseRange } from '../impl/parse-range.js';
import { PackageInfo } from '../package-info.js';
import { PackageJson } from '../package.json.js';
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
  readonly #byURI = new Map<string, PackageDir>();
  readonly #byName = new Map<string, Map<string, PackageDir>>();

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
   * @param allowDuplicate - Permit package with the same name. `false` by default.
   *
   * @returns `this` instance.
   */
  addRoot(packageJson: PackageJson | PackageInfo, allowDuplicate?: boolean): this {
    return this.addPackage(this.root, packageJson, allowDuplicate);
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
   * @param allowDuplicate - Permit package with the same name. `false` by default.
   *
   * @returns `this` instance.
   */
  addPackage(packageJson: PackageJson.Valid, allowDuplicate?: boolean): this;

  /**
   * Registers virtual package at the given URI.
   *
   * Replaces package under the same URI.
   *
   * Replaces package with the same name and version, unless `allowDuplicate` parameter is set.
   *
   * @param uri - Package URI.
   * @param packageJson - `package.json` contents.
   * @param allowDuplicate - Permit package with the same name. `false` by default.
   *
   * @returns `this` instance.
   */
  addPackage(uri: string, packageJson: PackageJson | PackageInfo, allowDuplicate?: boolean): this;

  addPackage(
    uriOrPackageJson: string | PackageJson | PackageInfo,
    packageJsonOrAllowDuplicate?: PackageJson | PackageInfo | boolean,
    allowDuplicate?: boolean,
  ): this {
    let uri: string;
    let packageInfo: PackageInfo;

    if (typeof uriOrPackageJson === 'string') {
      uri = this.#toPackageURI(uriOrPackageJson);
      packageInfo = PackageInfo.from(packageJsonOrAllowDuplicate as PackageJson | PackageInfo);
    } else {
      packageInfo = PackageInfo.from(uriOrPackageJson);
      uri = `package:${packageInfo.name}/${packageInfo.version}`;
    }

    if (!allowDuplicate) {
      const existing = this.#byURI.get(uri);

      if (existing) {
        this.#removeNamedPackage(existing.packageInfo);
      }
    }

    this.#addPackage({ uri, packageInfo });

    return this;
  }

  #addPackage(packageDir: PackageDir): void {
    const { uri, packageInfo: packageInfo } = packageDir;
    const { name, version } = packageInfo;
    let byVersion = this.#byName.get(name);

    if (!byVersion) {
      byVersion = new Map();
      this.#byName.set(name, byVersion);
    }

    const existing = byVersion.get(version);

    if (existing) {
      byVersion.delete(version);
      this.#byURI.delete(existing.uri);
    }

    byVersion.set(version, packageDir);
    this.#byURI.set(uri, packageDir);
  }

  #removeNamedPackage({ name, version }: PackageInfo): void {
    const byVersion = this.#byName.get(name)!; // Won't be called for non-existing package.
    const existing = byVersion.get(version)!; // Won't be called for non-existing package version.

    byVersion.delete(version);
    if (!byVersion.size) {
      this.#byName.delete(name);
    }

    this.#byURI.delete(existing.uri);
  }

  override recognizePackageURI(importSpec: Import.URI): string | undefined {
    return importSpec.scheme === 'package' ? importSpec.spec : undefined;
  }

  override loadPackage(uri: string): PackageInfo | undefined {
    return this.#byURI.get(uri)?.packageInfo;
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

  override resolveName(relativeTo: PackageResolution, name: string): string | undefined {
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
      for (const [version, { uri }] of byVersion) {
        if (range.test(version)) {
          return uri;
        }
      }
    }

    return;
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

}
