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
 * @returns Promise resolved to package resolution.
 */

export async function resolveRootPackage(dirOrFS?: string | PackageFS): Promise<PackageResolution> {
  const fs =
    dirOrFS == null || typeof dirOrFS === 'string' ? await NodePackageFS.create(dirOrFS) : dirOrFS;
  const rootPackageInfo = await fs.loadPackage(fs.root);

  if (!rootPackageInfo) {
    throw new ReferenceError(`No "package.json" file found at <${fs.root}>`);
  }

  return new ImportResolver({
    createRoot: resolver => new Package$Resolution(resolver, fs.root, rootPackageInfo),
    fs,
  }).root.asPackage()!;
}
