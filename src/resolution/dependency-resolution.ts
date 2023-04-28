/**
 * Dependency resolution indicates how an imported module {@link ImportResolution#resolveDependency depends}
 * on another one.
 */
export interface DependencyResolution {
  /**
   * Dependency kind.
   *
   * One of:
   *
   * - `self` for module dependency on itself or some of its sub-modules.
   * - `implied` for implied dependency, such as Node.js built-in.
   * - `synthetic` for synthetic dependency.
   * - `runtime` for runtime (production) dependency.
   * - `dev` for development dependency.
   * - `peer` for peer dependency.
   */
  readonly kind: 'self' | 'implied' | 'synthetic' | 'runtime' | 'dev' | 'peer';
}
