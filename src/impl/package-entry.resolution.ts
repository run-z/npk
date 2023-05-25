import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class PackageEntry$Resolution extends SubPackage$Resolution<Import.Entry> {

  static uri(resolver: ImportResolver, host: PackageResolution, subpath: `/${string}`): string {
    return resolver.fs.resolvePath(host, subpath.slice(1));
  }

  readonly #host: PackageResolution;
  readonly #subpath: `/${string}`;

  constructor(
    resolver: ImportResolver,
    host: PackageResolution,
    uri: string,
    subpath: `/${string}`,
  ) {
    const { importSpec } = host;

    super(resolver, uri, {
      ...importSpec,
      kind: 'entry',
      spec: importSpec.spec + subpath,
      subpath,
    });

    this.#host = host;
    this.#subpath = subpath;
  }

  override get host(): PackageResolution {
    return this.#host;
  }

  override get subpath(): `/${string}` {
    return this.#subpath;
  }

}
