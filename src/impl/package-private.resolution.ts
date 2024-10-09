import { Import } from '../resolution/import.js';
import { ImportResolver } from './import-resolver.js';
import { Package$Resolution } from './package.resolution.js';
import { SubPackage$Resolution } from './sub-package.resolution.js';

export class PackagePrivate$Resolution extends SubPackage$Resolution<Import.Private> {
  static uri(host: Package$Resolution, spec: Import.Private): string {
    const url = new URL(host.uri);

    url.searchParams.set('private', spec.spec.slice(1));

    return url.href;
  }

  readonly #host: Package$Resolution;

  constructor(
    resolver: ImportResolver,
    host: Package$Resolution,
    uri: string,
    spec: Import.Private,
  ) {
    super(resolver, uri, spec);

    this.#host = host;
  }

  override get host(): Package$Resolution {
    return this.#host;
  }

  override get subpath(): `#${string}` {
    return this.importSpec.spec;
  }
}
