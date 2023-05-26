import { PackageInfo } from '../package-info.js';

/**
 * Package directory representation.
 *
 * Such directory contains valid `package.json` file.
 */

export interface PackageDir {
  /**
   * Directory URI.
   */
  readonly uri: string;

  /**
   * Information on package the directory contains.
   */
  readonly packageInfo: PackageInfo;
}
