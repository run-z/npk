import semver from 'semver';

/**
 * Subset of [package.json](https://docs.npmjs.com/cli/v6/configuring-npm/package-json) properties.
 */
export interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly type?: 'module' | 'commonjs';
  readonly exports?: PackageJson.Exports;
  readonly main?: string;
  readonly dependencies?: PackageJson.Dependencies;
  readonly devDependencies?: PackageJson.Dependencies;
  readonly peerDependencies?: PackageJson.Dependencies;
  readonly optionalDependencies?: PackageJson.Dependencies;
  readonly [key: string]: unknown;
}

export namespace PackageJson {
  export interface Valid extends PackageJson {
    readonly name: string;
    readonly version: string;
  }

  export type LocalPath = `./${string}`;

  export type Dependencies = {
    readonly [name in string]: string;
  };

  export type Exports = PathExports | TopConditionalExports | LocalPath;

  export type PathExports = {
    readonly [key in PackagePath]: ConditionalExports | LocalPath;
  };

  export type ConditionalExports = {
    readonly [key in string]: ConditionalExports | LocalPath;
  };

  export type TopConditionalExports = {
    readonly [key in string]: TopConditionalExports | PathExports | LocalPath;
  };
}

/**
 * URL path within package.
 */
export type PackagePath = '.' | `./${string}`;

/**
 * Checks whether the `package,json` contents are valid.
 *
 * @param packageJson - `package.json` contents to check.
 *
 * @returns `true` if package {@link PackageJson#name name} and value {@link PackageJson#version version} present,
 * or `false` otherwise.
 */
export function isValidPackageJson(packageJson: PackageJson): packageJson is PackageJson.Valid {
  return !!packageJson.name && !!semver.valid(packageJson.version);
}
