import { builtinModules } from 'node:module';
import win32 from 'node:path/win32';
import { FS_ROOT } from '../impl/fs-root.js';

/**
 * Import statement specifier.
 *
 * Several kinds of specifiers recognized by {@link recognizeImport} function.
 */
export type Import =
  | Import.Package
  | Import.Implied
  | Import.URI
  | Import.Path
  | Import.Subpath
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

    /**
     * Imported subpath following package {@link name}, if any.
     *
     * Includes leading slash.
     */
    readonly subpath: `/${string}` | undefined;
  }

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
   * [Subpath import](https://nodejs.org/dist/latest/docs/api/packages.html#subpath-imports) specifier.
   */
  export interface Subpath {
    readonly kind: 'subpath';

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

/**
 * Recognizes import specifier.
 *
 * @typeParam TImport - Type of recognized import specifier.
 * @param spec - Already recognized import specifier.
 *
 * @returns The unchanged specifier.
 */
export function recognizeImport<TImport extends Import>(spec: TImport): TImport;

/**
 * Recognizes import specifier and parses it accordingly.
 *
 * @param spec - Import specifier to recognize. May be recognized already.
 *
 * @returns Recognized import specifier.
 */
export function recognizeImport(spec: Import | string): Import;

export function recognizeImport(spec: Import | string): Import {
  if (typeof spec !== 'string') {
    return spec;
  }

  return (
    IMPORT_SPEC_PARSERS[spec[0]]?.(spec)
    ?? recognizeNodeImport(spec)
    ?? recognizeAbsoluteWindowsImport(spec)
    ?? recognizeImportURI(spec)
    ?? recognizePackageImport(spec)
  );
}

const IMPORT_SPEC_PARSERS: {
  readonly [prefix: string]: ((spec: string) => Import | undefined) | undefined;
} = {
  '\0': spec => ({
    kind: 'synthetic',
    spec: spec as `\0${string}`,
  }),
  '#': spec => ({
    kind: 'subpath',
    spec: spec as `#${string}`,
  }),
  '.': spec => recognizeRelativeImport(spec) ?? {
      // Unscoped package name can not start with dot.
      kind: 'unknown',
      spec,
    },
  '/': recognizeAbsoluteUnixImport,
  '\\': recognizeUNCWindowsImport,
  '@': recognizeScopedPackageImport,
  _: spec => ({
    // Unscoped package name can not start with underscore
    kind: 'unknown',
    spec,
  }),
};

function recognizeNodeImport(spec: string): Import.Implied | undefined {
  if (getNodeJSBuiltins().has(spec.startsWith('node:') ? spec.slice(5) : spec)) {
    return {
      kind: 'implied',
      spec,
      from: 'node',
    };
  }

  return;
}

function getNodeJSBuiltins(): ReadonlySet<string> {
  return (nodeJSBuiltins ??= new Set(builtinModules));
}

let nodeJSBuiltins: Set<string> | undefined;

function recognizeRelativeImport(spec: string): Import.Relative | undefined {
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
    const path = relativeURIPath(spec);

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
    const path = windowsURIPath(spec) as `./${string}` | `../${string}`;

    return {
      kind: 'path',
      spec,
      isRelative: true,
      path,
      uri: path,
    };
  }

  return;
}

function recognizeAbsoluteUnixImport(spec: string): Import.Absolute {
  const url = new URL(spec, FS_ROOT);
  const path: `/${string}` = `/${
    url.pathname.slice(FS_ROOT.pathname.length) + url.search + url.hash
  }`;

  return {
    kind: 'path',
    spec,
    isRelative: false,
    path,
    uri: path,
  };
}

function recognizeUNCWindowsImport(spec: string): Import.Absolute | undefined {
  if (WINDOWS_DRIVE_PATH_PATTERN.test(spec)) {
    return createAbsoluteWindowsImport(spec);
  }

  const path = windowsURIPath(win32.toNamespacedPath(spec)) as `/${string}`;

  return {
    kind: 'path',
    spec,
    isRelative: false,
    path,
    uri: `file://${path}`,
  };
}

function recognizeAbsoluteWindowsImport(spec: string): Import.Absolute | undefined {
  return win32.isAbsolute(spec) ? createAbsoluteWindowsImport(spec) : undefined;
}

function createAbsoluteWindowsImport(spec: string): Import.Absolute | undefined {
  const path = windowsURIPath(spec.startsWith('\\') ? spec : '\\' + spec) as `/${string}`;

  return {
    kind: 'path',
    spec,
    isRelative: false,
    path,
    uri: `file://${path}`,
  };
}

const WINDOWS_DRIVE_PATH_PATTERN = /^\\?[a-z0-9]+:\\/i;

function relativeURIPath(path: string): `./${string}` | `../${string}` {
  const pathStart = path.indexOf('/');
  const url = new URL(path.slice(pathStart), FS_ROOT);

  return (path.slice(0, pathStart + 1)
    + url.pathname.slice(FS_ROOT.pathname.length)
    + url.search
    + url.hash) as `./${string}` | `../${string}`;
}

function windowsURIPath(path: string): string {
  const unixPath = path.replaceAll('\\', '/');

  return encodeURI(`${unixPath}`).replace(/[?#]/g, encodeURIComponent) as `/${string}`;
}

const URI_PATTERN = /^(?:([^:/?#]+):)(?:\/\/(?:[^/?#]*))?([^?#]*)(?:\?(?:[^#]*))?(?:#(?:.*))?/;

function recognizeImportURI(spec: string): Import.URI | undefined {
  const match = URI_PATTERN.exec(spec);

  if (!match) {
    return;
  }

  return {
    kind: 'uri',
    spec,
    scheme: match[1],
    path: match[2],
  };
}

function recognizeScopedPackageImport(spec: string): Import {
  const scopeEnd = spec.indexOf('/', 1);

  if (scopeEnd > 0) {
    return recognizePackageImport(spec, spec.slice(0, scopeEnd) as `@${string}`, scopeEnd + 1);
  }

  // Unscoped package name can not start with `@`.
  return {
    kind: 'unknown',
    spec,
  };
}

function recognizePackageImport(spec: string, scope?: `@${string}`, localOffset = 0): Import {
  let local: string;
  let subpath: `/${string}` | undefined;

  const nameEnd = spec.indexOf('/', localOffset);
  let name: string;

  if (nameEnd < 0) {
    local = spec.slice(localOffset);
    name = spec;
  } else {
    local = spec.slice(localOffset, nameEnd);
    name = spec.slice(0, nameEnd);
    subpath = spec.slice(nameEnd) as `/${string}`;
  }

  return {
    kind: 'package',
    spec,
    name,
    scope,
    local,
    subpath,
  };
}
