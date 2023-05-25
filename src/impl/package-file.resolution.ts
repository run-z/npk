import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class PackageFile$Resolution extends SubPackage$Resolution<Import.Relative> {

  readonly #host: PackageResolution;
  readonly #subpath: `/${string}`;

  constructor(resolver: ImportResolver, host: PackageResolution, path: `./${string}`) {
    super(resolver, resolver.fs.resolvePath(host, path), {
      kind: 'path',
      spec: path,
      isRelative: true,
      path,
      uri: path,
    });

    this.#host = host;
    this.#subpath = path.slice(1) as `/${string}`;
  }

  override get host(): PackageResolution {
    return this.#host;
  }

  override get subpath(): `/${string}` {
    return this.#subpath;
  }

}
