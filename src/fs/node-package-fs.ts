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
    return await new NodePackageFS().init(root);
  }

  #root!: string;

  #fs!: typeof import('node:fs/promises');
  #fsRoot!: URL;
  #path!: typeof import('node:path');
  #nodeModule!: typeof import('node:module');
  #nodeBuiltins!: Set<string>;
  #url!: typeof import('node:url');
  #win32!: typeof import('node:path/win32');

  /**
   * Constructs file system with the given root.
   *
   * The file system has to be {@link init initialized} after construction.
   *
   * Use static {@link NodePackageFS.create} method instead to create file system instances.
   */
  protected constructor() {
    super();
  }

  /**
   * Initializes FS.
   *
   * This method has to be called prior to start using the FS.
   *
   * @param root - URL or path of the root directory. Defaults to current working directory.
   *
   * @returns Promise resolved to `this` instance.
   */
  async init(root?: string): Promise<this> {
    const [
      { default: fs },
      { default: nodeModule },
      { default: path },
      { default: win32 },
      { default: process },
      { default: url },
    ] = await Promise.all([
      import('node:fs/promises'),
      import('node:module'),
      import('node:path'),
      import('node:path/win32'),
      import('node:process'),
      import('node:url'),
    ]);

    if (!root) {
      this.#root = url.pathToFileURL(process.cwd()).href;
    } else if (root.startsWith('file://')) {
      this.#root = root;
    } else {
      this.#root = url.pathToFileURL(root).href;
    }

    this.#path = path;
    this.#fs = fs;
    this.#fsRoot = url.pathToFileURL(path.parse(process.cwd()).root);
    this.#nodeModule = nodeModule;
    this.#nodeBuiltins = new Set(nodeModule.builtinModules);
    this.#url = url;
    this.#win32 = win32;

    return this;
  }

  override get root(): string {
    return this.#root;
  }

  /**
   * File system root URL.
   */
  get fsRoot(): string {
    return this.#fsRoot.href;
  }

  /**
   * Recognizes Node.js import specifier and parses it accordingly.
   *
   * In addition to imports recognized by {@link recognizeImport}, this method recognizes Node.js built-ins and
   * Windows/Unix paths.
   *
   * @param spec - Import specifier to recognize. May be recognized already.
   *
   * @returns Recognized import specifier.
   */
  override recognizeImport(spec: string): Import {
    return this.#recognizeNodeImport(spec) ?? super.recognizeImport(spec);
  }

  #recognizeNodeImport(spec: string): Import | void {
    switch (spec[0]) {
      case '/':
        return this.#recognizeAbsoluteUnixImport(spec);
      case '.':
        return this.#recognizeRelativeImport(spec);
      case '\\':
        return this.#recognizeUNCWindowsImport(spec);
      default:
        return this.#recognizeNodeBuiltin(spec) ?? this.#recognizeAbsoluteWindowsImport(spec);
    }
  }

  #recognizeNodeBuiltin(spec: string): Import.Implied | undefined {
    if (this.#nodeBuiltins.has(spec.startsWith('node:') ? spec.slice(5) : spec)) {
      return {
        kind: 'implied',
        spec,
        from: 'node',
      };
    }

    return;
  }

  #recognizeAbsoluteUnixImport(spec: string): Import.Absolute {
    const url = new URL(spec, this.#fsRoot);
    const path: `/${string}` = `/${
      url.pathname.slice(this.#fsRoot.pathname.length) + url.search + url.hash
    }`;

    return {
      kind: 'path',
      spec,
      isRelative: false,
      path,
      uri: path,
    };
  }

  #recognizeRelativeImport(spec: string): Import.Relative | void {
    if (spec === '.' || spec === '..') {
      return {
        kind: 'path',
        spec,
        isRelative: true,
        path: spec,
        uri: spec,
      };
    }

    if (spec.startsWith('./') || spec.startsWith('../')) {
      // Unix path.
      const path = this.#relativeURIPath(spec);

      return {
        kind: 'path',
        spec,
        isRelative: true,
        path,
        uri: path,
      };
    }

    if (spec.startsWith('.\\') || spec.startsWith('..\\')) {
      // Windows path.
      const path = this.#windowsURIPath(spec) as `./${string}` | `../${string}`;

      return {
        kind: 'path',
        spec,
        isRelative: true,
        path,
        uri: path,
      };
    }
  }

  #recognizeUNCWindowsImport(spec: string): Import.Absolute | undefined {
    if (WINDOWS_DRIVE_PATH_PATTERN.test(spec)) {
      return this.#createAbsoluteWindowsImport(spec);
    }

    const path = this.#windowsURIPath(this.#win32.toNamespacedPath(spec)) as `/${string}`;

    return {
      kind: 'path',
      spec,
      isRelative: false,
      path,
      uri: `file://${path}`,
    };
  }

  #recognizeAbsoluteWindowsImport(spec: string): Import.Absolute | void {
    if (this.#win32.isAbsolute(spec)) {
      return this.#createAbsoluteWindowsImport(spec);
    }
  }

  #createAbsoluteWindowsImport(spec: string): Import.Absolute {
    const path = this.#windowsURIPath(spec.startsWith('\\') ? spec : '\\' + spec) as `/${string}`;

    return {
      kind: 'path',
      spec,
      isRelative: false,
      path,
      uri: `file://${path}`,
    };
  }

  #relativeURIPath(path: string): `./${string}` | `../${string}` {
    const pathStart = path.indexOf('/');
    const url = new URL(path.slice(pathStart), this.#fsRoot);

    return (path.slice(0, pathStart + 1)
      + url.pathname.slice(this.#fsRoot.pathname.length)
      + url.search
      + url.hash) as `./${string}` | `../${string}`;
  }

  #windowsURIPath(path: string): string {
    const unixPath = path.replaceAll('\\', '/');

    return encodeURI(`${unixPath}`).replace(/[?#]/g, encodeURIComponent) as `/${string}`;
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

    return this.#url.pathToFileURL(modulePath).href;
  }

  override async loadPackage(uri: string): Promise<PackageInfo | undefined> {
    const dir = this.#url.fileURLToPath(uri);
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
    const dir = this.#url.fileURLToPath(uri);
    const parentDir = this.#path.dirname(dir);

    if (parentDir === dir) {
      return;
    }

    return this.#url.pathToFileURL(parentDir).href;
  }

}

const WINDOWS_DRIVE_PATH_PATTERN = /^\\?[a-z0-9]+:\\/i;
