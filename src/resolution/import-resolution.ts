import { DependencyResolution } from './dependency-resolution.js';
import { Import } from './import.js';
import { PackageResolution } from './package-resolution.js';

/**
 * Imported module resolution.
 *
 * May represent imported package, virtual Rollup module, some import URI, or anything else.
 */
export interface ImportResolution {
  /**
   * Root module resolution.
   *
   * This is typically a package resolution created by {@link resolveRootPackage} function.
   */
  get root(): ImportResolution;

  /**
   * Host package resolution.
   *
   * Set e.g. for package sub-module resolutions.
   */
  get host(): PackageResolution | undefined;

  /**
   * Resolved import specifier.
   */
  get importSpec(): Import;

  /**
   * Unique URI of imported module.
   */
  get uri(): string;

  /**
   * Resolves another module imported by this one.
   *
   * @param spec - Imported module specifier, either {@link recognizeImport recognized} or not.
   *
   * @returns Imported module resolution.
   */
  resolveImport(spec: Import | string): ImportResolution;

  /**
   * Resolves direct dependency of the module on `another` one.
   *
   * @param another - The package to check.
   *
   * @returns Either dependency descriptor, or `null` if the module does not depend on `another` one.
   */
  resolveDependency(another: ImportResolution): DependencyResolution | null;

  /**
   * Represents this module resolution as package resolution, if possible.
   *
   * @returns `this` instance for package resolution, or `undefined` otherwise.
   */
  asPackage(): PackageResolution | undefined;
}
