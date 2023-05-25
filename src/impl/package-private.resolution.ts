import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class PackagePrivate$Resolution extends SubPackage$Resolution<Import.Private> {

  static uri(host: PackageResolution, spec: Import.Private): string {
    const url = new URL(host.uri);

    url.searchParams.set('private', spec.spec.slice(1));

    return url.href;
  }

  readonly #host: PackageResolution;

  constructor(
    resolver: ImportResolver,
    host: PackageResolution,
    uri: string,
    spec: Import.Private,
  ) {
    super(resolver, uri, spec);

    this.#host = host;
  }

  override get host(): PackageResolution {
    return this.#host;
  }

  override get subpath(): `#${string}` {
    return this.importSpec.spec;
  }

}
