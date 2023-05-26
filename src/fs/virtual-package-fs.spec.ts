import { beforeEach, describe, expect, it } from '@jest/globals';
import { PackageResolution } from '../resolution/package-resolution.js';
import { resolveRootPackage } from './resolve-root-package.js';
import { VirtualPackageFS } from './virtual-package-fs.js';

describe('VirtualPackageFS', () => {
  let fs: VirtualPackageFS;
  let root: PackageResolution;

  beforeEach(async () => {
    fs = new VirtualPackageFS().addRoot({ name: 'root', version: '1.0.0' });
    root = await resolveRootPackage(fs);
  });

  describe('addPackage', () => {
    it('replaces named package with the same version', async () => {
      fs.addRoot({ name: 'root', version: '1.0.0', dependencies: { test: '1.0.0' } });
      fs.addPackage('package:test', { name: 'test', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      expect(fs.resolveName(root, 'test')).toBe('package:test');

      fs.addPackage('package:test@biz', { name: 'test', version: '1.0.0' });

      expect(fs.resolveName(root, 'test')).toBe('package:test@biz');
    });
    it('replaces package at the same URI', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        dependencies: { test: '1.0.0', test2: '1.0.0' },
      });
      fs.addPackage('package:test', { name: 'test', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      expect(fs.resolveName(root, 'test')).toBe('package:test');

      fs.addPackage('package:test', { name: 'test2', version: '1.0.0' });

      expect(fs.resolveName(root, 'test2')).toBe('package:test');
      expect(fs.resolveName(root, 'test')).toBeUndefined();
    });
  });

  describe('resolveName', () => {
    it('does not resolve missing dependency', () => {
      fs.addPackage(root.uri, { name: 'root', version: '1.0.0', dependencies: { test: '1.0.0' } });

      expect(fs.resolveName(root, 'test2')).toBeUndefined();
    });
  });

  describe('parentDir', () => {
    it('handles leading slash in URI', () => {
      expect(fs.parentDir('package:/some/path')).toBe('package:some');
    });
  });
});
