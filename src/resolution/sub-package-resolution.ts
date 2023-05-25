import { ImportResolution } from './import-resolution.js';
import { Import } from './import.js';
import { PackageResolution } from './package-resolution.js';

/**
 * Resolution of {@link PackageResolution package} or its sub-package.
 *
 * Sub-package represents one of:
 *
 * - package [entry point],
 * - private [subpath import], or
 * - packaged file.
 *
 * @typeParam TImport - Type of sub-package import specifier.
 *
 * [entry point]: https://nodejs.org/dist/latest/docs/api/packages.html#subpath-exports
 * [subpath import]: https://nodejs.org/dist/latest/docs/api/packages.html#subpath-imports
 */
export interface SubPackageResolution<out TImport extends Import.SubPackage = Import.SubPackage>
  extends ImportResolution<TImport> {
  /**
   * Host package resolution.
   */
  get host(): PackageResolution;

  /**
   * Subpath to add to package name to receive the import specifier.
   *
   * - Empty for the package itself.
   * - Starts with `/` symbol for package [entry point] and package file.
   * - Starts with `#` for [subpath import].
   *
   * [subpath import]: https://nodejs.org/dist/latest/docs/api/packages.html#subpath-imports
   */
  get subpath(): '' | `/${string}` | `#${string}`;

  /**
   * Always returns itself.
   */
  asSubPackage(): this;
}
