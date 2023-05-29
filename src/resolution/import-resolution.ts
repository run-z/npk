import { PackageFS } from '../fs/package-fs.js';
import { ImportDependency } from './import-dependency.js';
import { Import } from './import.js';
import { PackageResolution } from './package-resolution.js';
import { SubPackageResolution } from './sub-package-resolution.js';

/**
 * Imported module resolution.
 *
 * May represent imported package, virtual Rollup module, some import URI, or anything else.
 *
 * @typeParam TImport - Type of import specifier.
 */
export interface ImportResolution<out TImport extends Import = Import> {
  /**
   * Package file system.
   */
  get fs(): PackageFS;

  /**
   * Root module resolution.
   *
   * This is typically a package resolution created by {@link resolveRootPackage} function.
   */
  get root(): ImportResolution;

  /**
   * Host package resolution.
   *
   * Only defined for {@link PackageResolution packages} and {@link SubPackageResolution sub-packages}.
   */
  get host(): PackageResolution | undefined;

  /**
   * Resolved import specifier.
   */
  get importSpec(): TImport;

  /**
   * Unique URI of imported module.
   */
  get uri(): string;

  /**
   * URI used as {@link PackageFS#resolvePath path resolution} base.
   *
   * Defaults to {@link uri}. But may be a directory URI instead.
   */
  get resolutionBaseURI(): string;

  /**
   * Resolves another module imported by this one.
   *
   * @param spec - Imported module specifier, either {@link recognizeImport recognized} or not.
   *
   * @returns Promise resolved to imported module resolution.
   */
  resolveImport(spec: Import | string): Promise<ImportResolution>;

  /**
   * Resolves direct dependency of the module on another one.
   *
   * @param on - The package to resolve dependency on.
   * @param request - Optional dependency resolution request.
   *
   * @returns Either dependency descriptor, or `null` if the module does not depend on another one.
   */
  resolveDependency(
    on: ImportResolution,
    request?: ImportDependencyRequest,
  ): ImportDependency | null;

  /**
   * Represents this module resolution as package resolution, if possible.
   *
   * @returns `this` instance for package resolution, or `undefined` otherwise.
   */
  asPackage(): PackageResolution | undefined;

  /**
   * Represents this module resolution as sub-package resolution, if possible.
   *
   * @returns `this` instance for sub-package or package resolution, or `undefined` otherwise.
   */
  asSubPackage(): SubPackageResolution | undefined;
}

/**
 * {@link ImportResolution#resolveDependency Dependency resolution} request.
 */
export interface ImportDependencyRequest {
  /**
   * Intermediate module resolution for transitive dependency check.
   *
   * If target dependency is not found among direct dependencies, it can be search as a dependency of intermediate
   * one. Then, the result would be base on how this module resolution depends on intermediate one.
   */
  readonly via?: ImportResolution | undefined;
}
