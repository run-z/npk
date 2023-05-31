import { PackageInfo } from '../package/package-info.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { recognizeImport } from '../resolution/recognize-import.js';
import { PackageDir } from './package-dir.js';

/**
 * Virtual file system to work with packages.
 *
 * File system deals with URIs rather with OS-dependent paths.
 *
 * By default, a {@link NodePackageFS Node.js-specific file system} implementation is used.
 */
export abstract class PackageFS {

  /**
   * URI of the root package.
   */
  abstract get root(): string;

  /**
   * Recognizes import specifier and parses it accordingly.
   *
   * In contrast to {@link recognizeImport}, this method may recognize imports specific to file system.
   *
   * By default, calls {@link recognizeImport} function.
   *
   * @param spec - Import specifier to recognize. May be recognized already.
   *
   * @returns Recognized import specifier.
   */
  recognizeImport(spec: string): Import {
    return recognizeImport(spec);
  }

  /**
   * Extracts package URI from compatible URI import specifier.
   *
   * @param importSpec - Absolute URI import specifier.
   *
   * @returns Either package URI, or `undefined` if the URI can not be used to access packages.
   */
  abstract recognizePackageURI(importSpec: Import.URI): string | undefined;

  /**
   * Tries to load package info from the given directory.
   *
   * By default, detects package info by the loaded `package.json` contents.
   *
   * @param uri - Source directory.
   *
   * @returns Promise resolved to either loaded package info contents, or `undefined` if directory does not contain
   * {@link isValidPackageJson valid} `package.json` file.
   */
  abstract loadPackage(uri: string): Promise<PackageInfo | undefined>;

  /**
   * Finds parent directory.
   *
   * @param uri - File or directory URI.
   *
   * @returns Either URI of the parent directory, or `undefined` if there is no one.
   */
  abstract parentDir(uri: string): string | undefined;

  /**
   * Resolves path relatively to package.
   *
   * By default, uses URI resolution.
   *
   * @param relativeTo - The base to resolve the `path` against.
   * @param path - Path or URI to resolve.
   *
   * @returns URI of the resolved path.
   */
  resolvePath(relativeTo: ImportResolution, path: string): string {
    const resolution = new URL(path, relativeTo.resolutionBaseURI);
    const { pathname } = resolution;

    if (pathname.endsWith('/') && pathname.length > 1 && !path.endsWith('/')) {
      // Remove trailing slash.
      resolution.pathname = pathname.slice(0, -1);
    }

    return resolution.href;
  }

  /**
   * Resolves a package by name against another one.
   *
   * Note that returned URI is not necessary the one of package directory. Call {@link findPackageDir} in order
   * to find one.
   *
   * @param relativeTo - Package to resolve another one against.
   * @param name - Package name to resolve.
   *
   * @returns Promise resolved to either module URI, or `undefined` if the name can not be resolved.
   */
  abstract resolveName(relativeTo: PackageResolution, name: string): Promise<string | undefined>;

  /**
   * Dereferences package entry.
   *
   * @param host - Host package which entry to resolve.
   * @param spec - Package or its entry import specifier.
   *
   * @returns Promise resolved to either module URI, or `undefined` if nothing to dereference.
   */
  abstract derefEntry(
    host: PackageResolution,
    spec: Import.Package | Import.Entry | Import.Private,
  ): Promise<string | undefined>;

  /**
   * Searches for package directory containing the given file or URI.
   *
   * @param uri - URI of the target file or directory.
   *
   * @returns Promise resolved to either enclosing package directory, or `undefined` if not found.
   */
  async findPackageDir(uri: string): Promise<PackageDir | undefined> {
    for (;;) {
      const packageInfo = await this.loadPackage(uri);

      if (packageInfo) {
        return {
          uri,
          packageInfo,
        };
      }

      // No valid package found in directory.
      // Try the parent directory.
      const parentURI = this.parentDir(uri);

      if (!parentURI) {
        // No parent directory.
        return;
      }

      uri = parentURI;
    }
  }

}
