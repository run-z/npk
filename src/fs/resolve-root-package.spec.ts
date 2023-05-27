import { describe, expect, it } from '@jest/globals';
import { PackageInfo } from '../package/package-info.js';
import { resolveRootPackage } from './resolve-root-package.js';
import { VirtualPackageFS } from './virtual-package-fs.js';

describe('resolveRootPackage', () => {
  it('fails on missing package.json', async () => {
    const fs = new VirtualPackageFS();

    await expect(resolveRootPackage(fs)).rejects.toThrow(
      new ReferenceError(`No "package.json" file found at <package:root>`),
    );
  });
  it('obtains current package by default', async () => {
    const root = await resolveRootPackage();

    expect(root.packageInfo.name).toBe(PackageInfo.loadSync().name);
  });
});
