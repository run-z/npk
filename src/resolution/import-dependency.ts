import { ImportResolution } from './import-resolution.js';
import { Import } from './import.js';
import { SubPackageResolution } from './sub-package-resolution.js';

/**
 * Dependency of imported module on {@link ImportResolution#resolveDependency another one}.
 */
export type ImportDependency = SelfDependency | SubPackageDependency | AmbientDependency;

/**
 * Dependency of imported module on itself or another {@link SubPackageResolution sub-package} of the same
 * {@link PackageResolution package}.
 */
export interface SelfDependency {
  readonly kind: 'self';
  readonly on: ImportResolution;
}

/**
 * Dependency on {@link PackageResolution package} or one of its {@link SubPackageResolution sub-packages}.
 */
export interface SubPackageDependency {
  /**
   * Dependency kind.
   *
   * One of:
   *
   * - `runtime` for runtime (production) dependency.
   * - `dev` for development dependency.
   * - `peer` for peer dependency.
   */
  readonly kind: 'runtime' | 'dev' | 'peer';

  /**
   * Target sub-package resolution the source one depends on.
   */
  readonly on: SubPackageResolution;
}

/**
 * Dependency of imported module on {@link Import.Ambient ambient} module.
 *
 * @typeParam TImport - Type of ambient module import specifier.
 */
export interface AmbientDependency<out TImport extends Import.Ambient = Import.Ambient> {
  readonly kind: TImport['kind'];
  readonly on: ImportResolution<TImport>;
}
