import { ImportResolver } from '../impl/import-resolver.js';
import { Package$Resolution } from '../impl/package.resolution.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { NodePackageFS } from './node-package-fs.js';
import { PackageFS } from './package-fs.js';

/**
 * Resolves root NodeJS package.
 *
 * Creates new resolution root. Further resolutions should be made against it.
 *
 * @param dirOrFS - Either path to package directory, or {@link PackageFS package file system} instance. Defaults
 * to current working directory.
 *
 * @returns Package resolution.
 */

export function resolveRootPackage(dirOrFS?: string | PackageFS): PackageResolution {
  const fs = dirOrFS == null || typeof dirOrFS === 'string' ? new NodePackageFS(dirOrFS) : dirOrFS;

  return new ImportResolver({
    createRoot: resolver => new Package$Resolution(resolver, fs.root),
    fs,
  }).root.asPackage()!;
}
