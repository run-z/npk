import { PackageEntryTargets } from './package-entry-targets.js';
import { PackageInfo } from './package-info.js';
import { PackageJson, PackagePath } from './package.json.js';

/**
 * Information on package [entry point].
 *
 * [entry point]: https://nodejs.org/dist/latest-v18.x/docs/api/packages.html#package-entry-points
 */
export class PackageEntryPoint extends PackageEntryTargets {
  readonly #packageInfo: PackageInfo;
  readonly #path: PackagePath;
  #isPattern?: boolean;
  #pattern?: RegExp;
  readonly #targetsByCondition = new Map<string, Set<PackageJson.LocalPath>>();

  /**
   * Constructs entry point.
   *
   * @param packageInfo - Host package info.
   * @param path - Exported path.
   * @param targets - Array of exported targets. May contain different targets for different conditions.
   */
  constructor(
    packageInfo: PackageInfo,
    path: PackagePath,
    targets: readonly PackageEntryPoint.Target[],
  ) {
    super();

    this.#packageInfo = packageInfo;
    this.#path = path;

    for (const { conditions, target } of targets) {
      for (const condition of conditions.length ? conditions : ['default']) {
        let targets = this.#targetsByCondition.get(condition);

        if (!targets) {
          targets = new Set();
          this.#targetsByCondition.set(condition, targets);
        }

        targets.add(target);
      }
    }
  }

  /**
   * Host package info.
   */
  get packageInfo(): PackageInfo {
    return this.#packageInfo;
  }

  /**
   * The entry point itself.
   */
  override get entryPoint(): this {
    return this;
  }

  /**
   * Exported path or pattern.
   */
  get path(): PackagePath {
    return this.#path;
  }

  /**
   * Checks whether this is a [subpath pattern] matching multiple entry points.
   *
   * [subpath pattern]: https://nodejs.org/dist/latest-v18.x/docs/api/packages.html#subpath-patterns
   *
   * @returns `true` if {@link path} contains `*`, or `false` otherwise.
   */
  isPattern(): boolean {
    return (this.#isPattern ??= this.#path.includes('*'));
  }

  /**
   * Searches for targets exported by this entry point for the given `path`.
   *
   * @param path - Export path to check.
   *
   * @returns Either exported targets, or `undefined` if the `path` is not exported.
   */
  findTargets(path: PackagePath): PackageEntryTargets | undefined {
    const substitution = this.#findSubstitution(path);

    return substitution
      ? new PackageEntryPoint$Match(this, substitution)
      : substitution != null
        ? this
        : undefined;
  }

  #findSubstitution(path: PackagePath): string | undefined {
    if (this.isPattern()) {
      this.#pattern ??= new RegExp(
        '^' +
          this.path
            .replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&')
            .replaceAll('-', '\\x2d')
            .replaceAll('*', '(.*)') +
          '$',
      );

      const match = this.#pattern.exec(path);

      if (!match) {
        return;
      }

      return match[1];
    }

    return this.#path === path ? '' : undefined;
  }

  /**
   * Searches for path or pattern matching all provided conditions.
   *
   * @param conditions - Required export conditions. When missing, searches for `default` one.
   *
   * @returns Matching path or pattern, or `undefined` when not found.
   */
  override findConditional(...conditions: string[]): PackageJson.LocalPath | undefined {
    let candidates: Set<PackageJson.LocalPath> | undefined;

    for (const condition of conditions.length ? conditions : ['default']) {
      const matching = this.#targetsByCondition.get(condition);

      if (!matching) {
        return;
      }

      if (!candidates) {
        candidates = new Set(matching);
      } else {
        for (const match of matching) {
          if (!candidates.has(match)) {
            candidates.delete(match);
          }
        }
        for (const candidate of candidates) {
          if (!matching.has(candidate)) {
            candidates.delete(candidate);
          }
        }

        if (!candidates.size) {
          return;
        }
      }
    }

    return candidates!.values().next().value;
  }
}

export namespace PackageEntryPoint {
  /**
   * Package entry target declaring exported path or pattern. Possibly conditional.
   */
  export interface Target {
    /**
     * Array of export conditions.
     *
     * When empty, a `['default']` is used instead.
     */
    readonly conditions: readonly string[];

    /**
     * Exported path or pattern.
     */
    readonly target: PackageJson.LocalPath;
  }
}

class PackageEntryPoint$Match extends PackageEntryTargets {
  readonly #entryPoint: PackageEntryPoint;
  readonly #substitution: string;

  constructor(entryPoint: PackageEntryPoint, substitution: string) {
    super();

    this.#entryPoint = entryPoint;
    this.#substitution = substitution;
  }

  override get entryPoint(): PackageEntryPoint {
    return this.#entryPoint;
  }

  override findConditional(...conditions: string[]): PackageJson.LocalPath | undefined {
    const localPath = this.#entryPoint.findConditional(...conditions);

    return localPath?.replaceAll('*', this.#substitution) as PackageJson.LocalPath;
  }
}
