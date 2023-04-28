import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { ImportResolver } from './import-resolver.js';
import { Module$Resolution } from './module.resolution.js';

export class Submodule$Resolution extends Module$Resolution<Import.URI> {

  readonly #host: PackageResolution;

  constructor(resolver: ImportResolver, importSpec: Import.URI, host: PackageResolution) {
    super(resolver, importSpec.spec, importSpec);

    this.#host = host;
  }

  override get host(): PackageResolution {
    return this.#host;
  }

}
