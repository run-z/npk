import { type PackageInfo } from '../package/package-info.js';
import { type PackageJson } from '../package/package.json.js';
import { ImportDependency, SubPackageDependency } from '../resolution/import-dependency.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { dirURI } from './dir-uri.js';
import { ImportResolver } from './import-resolver.js';
import { parseRange } from './parse-range.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class Package$Resolution
  extends SubPackage$Resolution<Import.Package>
  implements PackageResolution {

  readonly #resolutionBaseURI: string;
  readonly #packageInfo: PackageInfo;
  readonly #dependencies = new Map<string, PackageDep | false>();

  constructor(
    resolver: ImportResolver,
    uri: string,
    packageInfo: PackageInfo,
    importSpec: Import.Package = packageImportSpec(resolver, packageInfo),
  ) {
    super(resolver, uri, importSpec);

    this.#packageInfo = packageInfo;
    this.#resolutionBaseURI = dirURI(uri);
  }

  override get host(): this {
    return this;
  }

  override get subpath(): '' {
    return '';
  }

  override get resolutionBaseURI(): string {
    return this.#resolutionBaseURI;
  }

  get packageInfo(): PackageInfo {
    return this.#packageInfo;
  }

  override resolveDependency(another: ImportResolution): ImportDependency | null {
    const importDependency = super.resolveDependency(another);

    if (importDependency) {
      return importDependency;
    }

    // Find dependency on host package.
    const on = another.asSubPackage();

    if (!on) {
      return null;
    }

    const { host } = on;
    const knownDep = this.#dependencies.get(host.uri);

    if (knownDep != null) {
      return knownDep ? { kind: knownDep.kind, on } : null;
    }

    const {
      peerDependencies,
      packageJson: { dependencies, devDependencies },
    } = this.packageInfo;

    const dep =
      this.#findDep(host, dependencies, 'runtime')
      || this.#findDep(host, peerDependencies, 'peer')
      || this.#findDep(host, devDependencies, 'dev');

    this.#dependencies.set(host.uri, dep ? dep : false);

    return dep && { kind: dep.kind, on };
  }

  #findDep(
    pkg: PackageResolution,
    dependencies: PackageJson.Dependencies | undefined,
    kind: SubPackageDependency['kind'],
  ): PackageDep | null {
    if (!dependencies) {
      return null;
    }

    const { name, version } = pkg.packageInfo;
    const range = parseRange(dependencies[name]);

    if (!range?.test(version)) {
      return null;
    }

    return { kind, on: pkg };
  }

  override asPackage(): this {
    return this;
  }

}

function packageImportSpec(
  resolver: ImportResolver,
  { name, scope, localName }: PackageInfo,
): Import.Package {
  const spec = resolver.recognizeImport(name);

  if (spec.kind === 'package') {
    return spec;
  }

  // Invalid package specifier.
  // Reconstruct import specifier from package info.
  return {
    kind: 'package',
    spec: name,
    name,
    scope,
    local: localName,
    subpath: undefined,
  };
}

export interface Package$Resolution extends PackageResolution {
  asImpliedResolution(): undefined;
}

interface PackageDep {
  readonly kind: SubPackageDependency['kind'];
  readonly on: PackageResolution;
}
