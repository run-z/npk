import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PackageInfo } from '../package/package-info.js';
import { PackageJson, isValidPackageJson } from '../package/package.json.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { PackageFS } from './package-fs.js';

/**
 * Node.js-specific implementation of package file system.
 */
export class NodePackageFS extends PackageFS {

  readonly #root: string;

  /**
   * Constructs file system with the given root.
   *
   * @param root - URL or path of the root directory. Defaults to current working directory.
   */
  constructor(root?: string) {
    super();

    if (!root) {
      this.#root = pathToFileURL(process.cwd()).href;
    } else if (root.startsWith('file://')) {
      this.#root = root;
    } else {
      this.#root = pathToFileURL(root).href;
    }
  }

  override get root(): string {
    return this.#root;
  }

  override recognizePackageURI(importSpec: Import.URI): string | undefined {
    return importSpec.scheme === 'file' ? importSpec.spec : undefined;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  override async resolveName(
    relativeTo: PackageResolution,
    name: string,
  ): Promise<string | undefined> {
    const requireModule = createRequire(
      relativeTo.resolutionBaseURI + 'index.js' /* in case of package directory */,
    );
    let modulePath: string;

    try {
      modulePath = requireModule.resolve(name);
    } catch (error) {
      return; // Ignore unresolved package.
    }

    return pathToFileURL(modulePath).href;
  }

  override async loadPackage(uri: string): Promise<PackageInfo | undefined> {
    const dir = fileURLToPath(uri);
    const filePath = path.join(dir, 'package.json');

    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) {
        return;
      }
    } catch {
      return;
    }

    const packageJson = JSON.parse(await fs.readFile(filePath, 'utf-8')) as PackageJson;

    return isValidPackageJson(packageJson) ? new PackageInfo(packageJson) : undefined;
  }

  override parentDir(uri: string): string | undefined {
    const dir = fileURLToPath(uri);
    const parentDir = path.dirname(dir);

    if (parentDir === dir) {
      return;
    }

    return pathToFileURL(parentDir).href;
  }

}
