/**
 * Import statement specifier.
 *
 * Several kinds of specifiers recognized by {@link recognizeImport} function.
 */
export type Import =
  | Import.Package
  | Import.Entry
  | Import.Implied
  | Import.URI
  | Import.Path
  | Import.Private
  | Import.Synthetic
  | Import.Unknown;

export namespace Import {
  /**
   * Package import specifier.
   *
   * May be scoped or unscoped package, and may include import sub-path.
   */
  export interface Package {
    readonly kind: 'package';

    /**
     * Original import specifier.
     */
    readonly spec: string;

    /**
     * Imported package name, excluding {@link subpath}.
     */
    readonly name: string;

    /**
     * Resolved package scope. I.e. the part of the {@link name} with `@` prefix, if any.
     */
    readonly scope: `@${string}` | undefined;

    /**
     * Local name within imported package {@link scope}.
     *
     * Part of the {@link name} after the the slash (`/`) for scoped package, or the {@link name} itself for
     * unscoped one.
     */
    readonly local: string;

    readonly subpath?: undefined;
  }

  /**
   * Package [entry point] or file import specifier.
   *
   * [entry point]: https://nodejs.org/dist/latest/docs/api/packages.html#subpath-exports
   */
  export interface Entry extends Omit<Package, 'kind' | 'subpath'> {
    readonly kind: 'entry';

    /**
     * Imported subpath following package {@link name} including leading slash.
     */
    readonly subpath: `/${string}`;
  }

  /**
   * {@link SubPackageResolution Sub-package} import specified.
   */
  export type SubPackage = Package | Entry | Relative | Private;

  /**
   * Implied module import specifier, such as execution environment.
   */
  export interface Implied {
    readonly kind: 'implied';

    /**
     * Original import specifier.
     */
    readonly spec: string;

    /**
     * The source of implied dependency.
     *
     * Can be anything, e.g. `node` or `browser`.
     *
     * Only `node` built-in imports {@link recognizeImport recognized} currently.
     */
    readonly from: string;
  }

  /**
   * Absolute URI import specifier.
   */
  export interface URI {
    readonly kind: 'uri';

    /**
     * Original import URI.
     */
    readonly spec: string;

    /**
     * URI scheme.
     */
    readonly scheme: string;

    /**
     * URI path.
     */
    readonly path: string;
  }

  /**
   * Absolute or relative import path specifier.
   */
  export type Path = Absolute | Relative;

  /**
   * Absolute import path specifier.
   */
  export interface Absolute {
    readonly kind: 'path';

    /**
     * Original, system-dependent import path.
     */
    readonly spec: string;

    /**
     * Never relative.
     */
    readonly isRelative: false;

    /**
     * Absolute URI path to imported module.
     *
     *  URI-encoded. Always starts with `/`. Uses `/` path separator.
     */
    readonly path: `/${string}`;

    /**
     * Absolute URI to imported module.
     *
     * May contain `file:///` scheme e.g. for Windows paths. Otherwise, the same as {@link path}.
     */
    readonly uri: string;
  }

  /**
   * Relative import path specifier.
   */
  export interface Relative {
    readonly kind: 'path';

    /**
     * Original, system-dependent import path.
     */
    readonly spec: string;

    /**
     * Always relative.
     */
    readonly isRelative: true;

    /**
     * Relative URI path to imported module.
     *
     * URI-encoded. Always starts with `.`. Uses `/` path separator.
     */
    readonly path: '.' | '..' | `./${string}` | `../${string}`;

    /**
     * Relative URI of imported module.
     *
     * The same as {@link path}.
     */
    readonly uri: '.' | '..' | `./${string}` | `../${string}`;
  }

  /**
   * Private [subpath import] specifier.
   *
   * [subpath import]: https://nodejs.org/dist/latest/docs/api/packages.html#subpath-imports
   */
  export interface Private {
    readonly kind: 'private';

    /**
     * Original import specifier. Always starts with `#`.
     */
    readonly spec: `#${string}`;
  }

  /**
   * Synthetic module import specifier.
   *
   * The module ID starting with _zero char_ (`U+0000`). Such IDs generated e.g. by Rollup plugins.
   */
  export interface Synthetic {
    readonly kind: 'synthetic';

    /**
     * Original import specifier. Always starts with zero char (`U+0000`).
     */
    readonly spec: `\0${string}`;
  }

  /**
   * Unknown import specifier not recognized as any of the other kinds of imports.
   */
  export interface Unknown {
    readonly kind: 'unknown';

    /**
     * Original import specifier.
     */
    readonly spec: string;
  }
}
