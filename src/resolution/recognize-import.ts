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
    IMPORT_SPEC_PARSERS[spec[0]]?.(spec) ??
    recognizeImportURI(spec) ??
    recognizeSubPackageImport(spec)
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
  '.': spec =>
    recognizeRelativeImport(spec) ?? {
      // Unscoped package name can not start with dot.
      kind: 'unknown',
      spec,
    },
  '/': recognizeAbsoluteImport,
  '@': recognizeScopedSubPackageImport,
  _: spec => ({
    // Unscoped package name can not start with underscore
    kind: 'unknown',
    spec,
  }),
};

const URI_PATTERN = /^(?:([^:/?#]+):)(?:\/\/(?:[^/?#]*))?([^?#]*)(?:\?(?:[^#]*))?(?:#(?:.*))?/;

function recognizeImportURI(spec: string): Import.URI | void {
  const match = URI_PATTERN.exec(spec);

  if (match) {
    return {
      kind: 'uri',
      spec,
      scheme: match[1],
      path: match[2],
    };
  }
}

function recognizeRelativeImport(spec: string): Import.Relative | void {
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    const path = spec as Import.Relative['path'];

    return {
      kind: 'path',
      spec,
      isRelative: true,
      path,
      uri: path,
    };
  }
}

function recognizeAbsoluteImport(spec: string): Import.Absolute {
  const path = spec as `/${string}`;

  return {
    kind: 'path',
    spec,
    isRelative: false,
    path,
    uri: path,
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
