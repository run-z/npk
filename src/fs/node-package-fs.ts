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

  /**
   * Creates new file system instance.
   *
   * @param root - URL or path of the root directory. Defaults to current working directory.
   */
  static async create(root?: string): Promise<NodePackageFS> {
    const { default: process } = await import('node:process');

    if (!root) {
      root = pathToFileURL(process.cwd()).href;
    } else if (!root.startsWith('file://')) {
      root = pathToFileURL(root).href;
    }

    return await new NodePackageFS(root).init();
  }

  readonly #root: string;
  #path!: typeof import('node:path');
  #fs!: typeof import('node:fs/promises');
  #nodeModule!: typeof import('node:module');

  /**
   * Constructs file system with the given root.
   *
   * The file system has to be {@link init initialized} after construction.
   *
   * Use static {@link NodePackageFS.create} method instead to create file system instances.
   *
   * @param root - URL of the root directory.
   */
  protected constructor(root: string) {
    super();

    this.#root = root;
  }

  /**
   * Initializes FS.
   *
   * This method has to be called prior to start using the FS.
   *
   * @returns Promise resolved to `this` instance.
   */
  async init(): Promise<this> {
    const [{ default: path }, { default: fs }, { default: nodeModule }] = await Promise.all([
      import('node:path'),
      import('node:fs/promises'),
      import('node:module'),
    ]);

    this.#path = path;
    this.#fs = fs;
    this.#nodeModule = nodeModule;

    return this;
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
    const requireModule = this.#nodeModule.createRequire(
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
    const filePath = this.#path.join(dir, 'package.json');

    try {
      const stats = await this.#fs.stat(filePath);

      if (!stats.isFile()) {
        return;
      }
    } catch {
      return;
    }

    const packageJson = JSON.parse(await this.#fs.readFile(filePath, 'utf-8')) as PackageJson;

    return isValidPackageJson(packageJson) ? new PackageInfo(packageJson) : undefined;
  }

  override parentDir(uri: string): string | undefined {
    const dir = fileURLToPath(uri);
    const parentDir = this.#path.dirname(dir);

    if (parentDir === dir) {
      return;
    }

    return pathToFileURL(parentDir).href;
  }

}
