import { builtinModules } from 'node:module';
import { win32 } from 'node:path/win32';
import { FS_ROOT } from '../impl/fs-root.js';
import { Import } from './import.js';

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
    ?? recognizeSubPackageImport(spec)
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
    kind: 'private',
    spec: spec as `#${string}`,
  }),
  '.': spec => recognizeRelativeImport(spec) ?? {
      // Unscoped package name can not start with dot.
      kind: 'unknown',
      spec,
    },
  '/': recognizeAbsoluteUnixImport,
  '\\': recognizeUNCWindowsImport,
  '@': recognizeScopedSubPackageImport,
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

function recognizeScopedSubPackageImport(spec: string): Import {
  const scopeEnd = spec.indexOf('/', 1);

  if (scopeEnd > 0) {
    return recognizeSubPackageImport(spec, spec.slice(0, scopeEnd) as `@${string}`, scopeEnd + 1);
  }

  // Unscoped package name can not start with `@`.
  return {
    kind: 'unknown',
    spec,
  };
}

function recognizeSubPackageImport(
  spec: string,
  scope?: `@${string}`,
  localOffset = 0,
): Import.Package | Import.Entry {
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
    if (subpath.length === 1) {
      subpath = undefined;
      spec = spec.slice(0, -1);
    }
  }

  if (subpath) {
    return {
      kind: 'entry',
      spec,
      name,
      scope,
      local,
      subpath,
    };
  }

  return {
    kind: 'package',
    spec,
    name,
    scope,
    local,
  };
}
