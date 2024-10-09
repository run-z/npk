import { Import } from '../resolution/import.js';
import { ImportResolver } from './import-resolver.js';
import { Package$Resolution } from './package.resolution.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class PackageFile$Resolution extends SubPackage$Resolution<Import.Relative> {
  readonly #host: Package$Resolution;
  readonly #subpath: `/${string}`;

  constructor(resolver: ImportResolver, host: Package$Resolution, path: `./${string}`) {
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

  override get host(): Package$Resolution {
    return this.#host;
  }

  override get subpath(): `/${string}` {
    return this.#subpath;
  }
}
