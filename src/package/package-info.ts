import { PackageEntryPoint } from './package-entry-point.js';
import { PackageEntryTargets } from './package-entry-targets.js';
import { PackageJson, PackagePath } from './package.json.js';

/**
 * Information collected for package from its `package.json`.
 */
export class PackageInfo {
  /**
   * Extracts package information from `package.json` contents, unless package info constructed already.
   *
   * @param packageJson - Either `package.json` contents, or package info instance.
   *
   * @returns Package info instance.
   */
  static from(packageJson: PackageJson | PackageInfo): PackageInfo {
    return packageJson instanceof PackageInfo ? packageJson : new PackageInfo(packageJson);
  }

  /**
   * Loads package info from `package,json` file at the given `path`.
   *
   * @param path - Path to `package.json` file. `package.json` by default.
   *
   * @returns Promise resolved to the loaded package info.
   */
  static async load(path = 'package.json'): Promise<PackageInfo> {
    const { default: fs } = await import('node:fs/promises');

    return new PackageInfo(JSON.parse(await fs.readFile(path, 'utf-8')) as PackageJson);
  }

  readonly #packageJson: PackageJson.Valid;
  #nameParts?: [localName: string, scope?: `@${string}`];
  #entryPoints?: PackageInfo$EntryPoints;
  #mainEntryPoint?: PackageEntryPoint;

  /**
   * Constructs package info.
   *
   * @param packageJson - Raw `package.json` contents.
   */
  constructor(packageJson: PackageJson) {
    const { name = '-', version = '0.0.0' } = packageJson;

    this.#packageJson = {
      ...packageJson,
      name,
      version,
    };
  }

  /**
   * Full package name as specified in `package.json`.
   *
   * When missing, defaults to `-`.
   */
  get name(): string {
    return this.packageJson.name;
  }

  /**
   * Resolved package scope. I.e. the part of the {@link name} after `@` prefix, if any.
   */
  get scope(): `@${string}` | undefined {
    return this.#getNameParts()[1];
  }

  /**
   * Local name within package {@link scope}.
   *
   * Part of the name after the the slash `/` for scoped package, or the name itself for unscoped one.
   */
  get localName(): string {
    return this.#getNameParts()[0];
  }

  #getNameParts(): [localName: string, scope?: `@${string}`] {
    if (this.#nameParts) {
      return this.#nameParts;
    }

    const { name } = this;

    if (!name.startsWith('@')) {
      return (this.#nameParts = [name]);
    }

    const scopeEnd = name.indexOf('/', 1);

    if (scopeEnd < 0) {
      // Invalid name.
      return [name];
    }

    return [name.slice(scopeEnd + 1), name.slice(0, scopeEnd) as `@${string}`];
  }

  /**
   * Package version specified in {@link packageJson `package.json`}.
   *
   * Defaults to `0.0.0` when missing.
   */
  get version(): string {
    return this.packageJson.version;
  }

  /**
   * Raw `package.json` contents.
   */
  get packageJson(): PackageJson.Valid {
    return this.#packageJson;
  }

  /**
   * The type of the package.
   *
   * This is `module` only if {@link PackageJson#type package type} set to `module`. Otherwise, it's a `commonjs`.
   */
  get type(): 'module' | 'commonjs' {
    return this.packageJson.type === 'module' ? 'module' : 'commonjs';
  }

  /**
   * Main entry point of the package.
   *
   * Collected either from default entry of [exports] field, or from [main] field of {@link packageJson `package.json`}.
   * May be `undefined` when neither present.
   *
   * [exports]: https://nodejs.org/dist/latest-v18.x/docs/api/packages.html#exports
   * [main]: https://nodejs.org/dist/latest-v18.x/docs/api/packages.html#main
   */
  get mainEntryPoint(): PackageEntryPoint | undefined {
    return (this.#mainEntryPoint ??= this.findEntryPoint('.')?.entryPoint);
  }

  /**
   * Searches for package {@link PackageEntryPoint} corresponding to the given export path.
   *
   * @param path - Export path.
   *
   * @returns Either found entry point, or `undefined` if nothing found.
   */
  findEntryPoint(path: PackagePath): PackageEntryTargets | undefined {
    const { byPath, patterns } = this.#getEntryPoints();
    const entryPoint = byPath.get(path);

    if (entryPoint) {
      // Exact match.
      return entryPoint;
    }

    for (const pattern of patterns) {
      const match = pattern.findTargets(path);

      return match; // First pattern match.
    }

    return;
  }

  /**
   * Iterates over package entry points.
   *
   * @returns Iterable iterator of path/entry point tuples.
   */
  entryPoints(): IterableIterator<[PackagePath, PackageEntryPoint]> {
    return this.#getEntryPoints().byPath.entries();
  }

  #getEntryPoints(): PackageInfo$EntryPoints {
    return (this.#entryPoints ??= this.#buildEntryPoints());
  }

  #buildEntryPoints(): PackageInfo$EntryPoints {
    const items = new Map<PackagePath, PackageInfo$EntryItem[]>();

    for (const item of this.#listEntryItems()) {
      const found = items.get(item.path);

      if (found) {
        found.push(item);
      } else {
        items.set(item.path, [item]);
      }
    }

    const patterns: PackageEntryPoint[] = [];

    return {
      byPath: new Map(
        [...items].map(([path, items]) => {
          const entryPoint = new PackageEntryPoint(this, path, items);

          if (entryPoint.isPattern()) {
            patterns.push(entryPoint);
          }

          return [path, entryPoint];
        }),
      ),
      patterns,
    };
  }

  *#listEntryItems(): IterableIterator<PackageInfo$EntryItem> {
    const { exports, main } = this.packageJson;

    if (exports) {
      yield* this.#condExports([], exports);

      return; // Ignore `main` field.
    }

    if (main) {
      yield {
        path: '.',
        conditions: [],
        target: main.startsWith('./') ? (main as `./${string}`) : `./${main}`,
      };
    }

    // Export everything even regardless `main` field presence.
    yield {
      path: './*',
      conditions: [],
      target: './*',
    };
  }

  *#condExports(
    conditions: readonly string[],
    exports: PackageJson.TopConditionalExports | PackageJson.PathExports | `./${string}`,
  ): IterableIterator<PackageInfo$EntryItem> {
    if (typeof exports === 'string') {
      yield { path: '.', conditions, target: exports };

      return;
    }

    for (const [key, entry] of Object.entries(exports)) {
      if (isPathEntry(key)) {
        yield* this.#pathExports(key, conditions, entry);
      } else {
        yield* this.#condExports([...conditions, key], entry);
      }
    }
  }

  *#pathExports(
    path: PackagePath,
    conditions: readonly string[],
    exports: PackageJson.ConditionalExports | `./${string}`,
  ): IterableIterator<PackageInfo$EntryItem> {
    if (typeof exports === 'string') {
      yield { path, conditions, target: exports };

      return;
    }

    for (const [key, entry] of Object.entries(exports)) {
      yield* this.#pathExports(path, [...conditions, key], entry);
    }
  }
}

function isPathEntry(key: string): key is '.' | './${string' {
  return key.startsWith('.');
}

interface PackageInfo$EntryItem extends PackageEntryPoint.Target {
  readonly path: PackagePath;
}

interface PackageInfo$EntryPoints {
  byPath: ReadonlyMap<PackagePath, PackageEntryPoint>;
  patterns: readonly PackageEntryPoint[];
}
