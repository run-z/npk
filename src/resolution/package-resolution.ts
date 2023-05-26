import { PackageInfo } from '../package-info.js';
import { ImportResolution } from './import-resolution.js';
import { Import } from './import.js';
import { SubPackageResolution } from './sub-package-resolution.js';

/**
 * Imported NodeJS package {@link ImportResolution resolution}.
 *
 * The package is a directory with `package.json` file.
 */
export interface PackageResolution extends SubPackageResolution<Import.Package> {
  /**
   * The package is always a host of itself.
   */
  get host(): this;

  /**
   * URI of package directory.
   */
  get uri(): string;

  /**
   * Information on resolved package.
   */
  get packageInfo(): PackageInfo;

  /**
   * Always empty path.
   */
  get subpath(): '';

  /**
   * Always returns itself.
   */
  asPackage(): this;
}
