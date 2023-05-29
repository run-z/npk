import { type PackageInfo } from '../package/package-info.js';
import { type PackageJson } from '../package/package.json.js';
import { ImportDependency, SubPackageDependency } from '../resolution/import-dependency.js';
import { ImportDependencyRequest, ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { SubPackageResolution } from '../resolution/sub-package-resolution.js';
import { dirURI } from './dir-uri.js';
import { ImportResolver } from './import-resolver.js';
import { parseRange } from './parse-range.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class Package$Resolution
  extends SubPackage$Resolution<Import.Package>
  implements PackageResolution {

  readonly #resolutionBaseURI: string;
  readonly #packageInfo: PackageInfo;
  readonly #dependencies = new Map<string, SubPackageDependency | false>();

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

  override resolveDependency(
    on: ImportResolution,
    request?: ImportDependencyRequest,
  ): ImportDependency | null {
    const importDependency = super.resolveDependency(on, request);

    if (importDependency) {
      return importDependency;
    }

    // Find dependency on host package.
    const subPackage = on.asSubPackage();

    if (!subPackage) {
      return null;
    }

    return this.#resolveSubPackageDep(subPackage, request);
  }

  #resolveSubPackageDep(
    on: SubPackageResolution,
    request?: ImportDependencyRequest,
  ): ImportDependency | null {
    const { host } = on;
    const knownDep = this.#dependencies.get(host.uri);

    if (knownDep != null) {
      return knownDep || null;
    }

    const {
      peerDependencies,
      packageJson: { dependencies, devDependencies },
    } = this.packageInfo;

    const dep =
      this.#findDep(host, dependencies, 'runtime')
      || this.#findDep(host, peerDependencies, 'peer')
      || this.#findDep(host, devDependencies, 'dev');

    if (request?.via && request.via !== this) {
      if (!dep) {
        const transientDep = this.#findTransientDep(on, host, request?.via);

        return transientDep;
      }
    } else {
      this.#dependencies.set(host.uri, dep ?? false);
    }

    return dep && { kind: dep.kind, on };
  }

  #findDep(
    on: PackageResolution,
    dependencies: PackageJson.Dependencies | undefined,
    kind: SubPackageDependency['kind'],
  ): SubPackageDependency | null {
    if (!dependencies) {
      return null;
    }

    const { name, version } = on.packageInfo;
    const range = parseRange(dependencies[name]);

    if (!range?.test(version)) {
      return null;
    }

    return { kind, on };
  }

  #findTransientDep(
    on: SubPackageResolution,
    host: PackageResolution,
    via: ImportResolution,
  ): ImportDependency | null {
    const interimDep = this.resolveDependency(via);

    if (!interimDep) {
      return null;
    }

    const { kind, on: interim } = interimDep;
    const dep = interim.resolveDependency(host);

    if (dep) {
      switch (kind) {
        case 'dev':
        case 'runtime':
        case 'peer':
          return { kind, on };
        // istanbul ignore next
        default:
          // istanbul ignore next
          return null;
      }
    }

    return dep;
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
