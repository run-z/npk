import { Import } from '../resolution/import.js';
import { ImportResolver } from './import-resolver.js';
import { Package$Resolution } from './package.resolution.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class PackageEntry$Resolution extends SubPackage$Resolution<Import.Entry> {

  static uri(resolver: ImportResolver, host: Package$Resolution, subpath: `/${string}`): string {
    return resolver.fs.resolvePath(host, subpath.slice(1));
  }

  readonly #host: Package$Resolution;
  readonly #subpath: `/${string}`;

  constructor(
    resolver: ImportResolver,
    host: Package$Resolution,
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

  override get host(): Package$Resolution {
    return this.#host;
  }

  override get subpath(): `/${string}` {
    return this.#subpath;
  }

}
