import { PackageEntryPoint } from './package-entry-point.js';
import { PackageJson } from './package.json.js';

/**
 * Targets exported by package entry.
 */
export abstract class PackageEntryTargets {
  /**
   * Exporting entry point of the package.
   */
  abstract get entryPoint(): PackageEntryPoint;

  /**
   * Searches for target path matching all provided conditions.
   *
   * Unlike the same method of {@link PackageEntryPoint#findConditional entry point}, this one evaluates target pattern
   * into path by substituting all `*`.
   *
   * @param conditions - Required export conditions. When missing, searches for `default` one.
   *
   * @returns Matching target path, or `undefined` when not found.
   */
  abstract findConditional(...conditions: string[]): PackageJson.LocalPath | undefined;

  /**
   * Searches for exported JavaScript file to import into another module matching all provided condition.
   *
   * Target selection depends on consumer's package `type`.
   *
   * @param type - Consumer package type.
   * @param conditions - Additional export conditions.
   *
   * @returns Matching JavaScript file path, or `undefined` when not found.
   */
  findJs(
    type: PackageJson['type'] | null,
    ...conditions: string[]
  ): PackageJson.LocalPath | undefined {
    return (
      this.findConditional(type === 'module' ? 'import' : 'require', ...conditions) ??
      this.findConditional(...conditions)
    );
  }
}
