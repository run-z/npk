import { beforeEach, describe, expect, it } from '@jest/globals';
import { PackageResolution, resolveRootPackage } from './package-resolution.js';
import { VirtualPackageFS } from './virtual-package-fs.js';

describe('PackageResolution', () => {
  let fs: VirtualPackageFS;
  let root: PackageResolution;

  beforeEach(() => {
    fs = new VirtualPackageFS();
    fs.addPackage(fs.root, { name: '@test-scope/root-package', version: '1.0.0' });

    root = resolveRootPackage(fs);
  });

  describe('packageInfo', () => {
    it('loads package.json contents', () => {
      expect(root.packageInfo.packageJson).toEqual({
        name: '@test-scope/root-package',
        version: '1.0.0',
      });
    });
    it('throws on missing package.json', () => {
      fs = new VirtualPackageFS();
      root = resolveRootPackage(fs);

      expect(() => root.packageInfo).toThrow(
        new ReferenceError(`No "package.json" file found at <package:root>`),
      );
    });
  });

  describe('importSpec', () => {
    it('is obtained from package.json', () => {
      expect(root.importSpec).toEqual({
        kind: 'package',
        spec: '@test-scope/root-package',
        name: '@test-scope/root-package',
        scope: '@test-scope',
        local: 'root-package',
      });
    });
  });

  describe('scope', () => {
    it('is obtained from package.json', () => {
      expect(root.packageInfo.scope).toBe('@test-scope');
    });
    it('is recognized with wrong name', () => {
      fs.addPackage(fs.root, { name: '@wrong-name', version: '1.0.0' });

      root = resolveRootPackage(fs);
      expect(root.packageInfo.scope).toBeUndefined();
    });
  });

  describe('name', () => {
    it('is obtained from package.json', () => {
      expect(root.packageInfo.name).toBe('@test-scope/root-package');
    });
    it('is recognized with wrong name', () => {
      fs.addPackage(fs.root, { name: '@wrong-name', version: '1.0.0' });

      root = resolveRootPackage(fs);
      expect(root.packageInfo.name).toBe('@wrong-name');
    });
  });

  describe('localName', () => {
    it('is obtained from package.json', () => {
      expect(root.packageInfo.localName).toBe('root-package');
    });
  });

  describe('version', () => {
    it('is obtained from package.json', () => {
      expect(root.packageInfo.version).toBe('1.0.0');
    });
  });

  describe('resolveImport', () => {
    it('resolves itself', () => {
      expect(root.resolveImport(root.packageInfo.name)).toBe(root);
    });
    it('resolves submodule', () => {
      const uri = root.uri + '/test/submodule';
      const submodule = root.resolveImport(uri);

      expect(submodule.uri).toBe(uri);
      expect(submodule.host).toBe(root);
    });
    it('resolves URI import', () => {
      const uri = 'http://localhost/pkg/target';
      const found = root.resolveImport(uri);

      expect(found.uri).toBe(uri);
      expect(found.importSpec).toEqual({
        kind: 'uri',
        spec: uri,
        scheme: 'http',
        path: '/pkg/target',
      });
    });
    it('resolves path import', () => {
      const path = '../pkg/target';
      const found = root.resolveImport(path);

      expect(found.uri).toBe('package:pkg/target');
      expect(found.importSpec).toEqual({
        kind: 'uri',
        spec: 'package:pkg/target',
        scheme: 'package',
        path: 'pkg/target',
      });
    });
    it('resolves package by URI', () => {
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      const found = root.resolveImport('package:dep/1.0.0');

      expect(found.uri).toBe('package:dep/1.0.0');
      expect(found.importSpec.kind).toBe('package');
      expect(found.asPackage()).toBe(found);
    });
    it('resolves package by path', () => {
      fs.addPackage('package:root/dep', { name: 'dependency', version: '1.0.0' });

      const found = root.resolveImport('./root/dep');

      expect(found.uri).toBe('package:root/dep');
      expect(found.importSpec.kind).toBe('package');
      expect(found.asPackage()).toBe(found);
    });
    it('resolves uninstalled peer dependency as unknown import', () => {
      fs.addPackage(fs.root, {
        name: 'root',
        version: '1.0.0',
        peerDependencies: { dep: '1.0.0' },
        devDependencies: { dep2: '1.0.0' },
      });
      root = resolveRootPackage(fs);

      expect(root.resolveImport('dep').uri).toBe('import:package:dep');
    });
    it('resolves dependency with wrong version range as unknown import', () => {
      fs.addPackage(fs.root, {
        name: 'root',
        version: '1.0.0',
        dependencies: { dep: '_' },
      });
      root = resolveRootPackage(fs);

      expect(root.resolveImport('dep').uri).toBe('import:package:dep');
    });
  });

  describe('resolveDependency', () => {
    it('resolves self-dependency', () => {
      expect(root.resolveDependency(root)).toEqual({ kind: 'self' });
    });
    it('resolves dependency on submodule', () => {
      expect(root.resolveDependency(root.resolveImport(root.uri + '/test/submodule'))).toEqual({
        kind: 'self',
      });
    });
    it('resolves submodule dependency on another package submodule', () => {
      fs.addPackage('package:test', {
        name: 'test',
        version: '1.0.0',
        dependencies: { dep: '^1.0.0' },
      });
      fs.addPackage('package:dep', {
        name: 'dep',
        version: '1.0.0',
      });

      const dependant = root.resolveImport('package:test/dist/test.js');
      const dependency = root.resolveImport('package:dep/dist/lib.js');

      expect(dependant.resolveDependency(dependency)).toEqual({
        kind: 'runtime',
      });
    });
    it('resolves runtime dependency', () => {
      fs.addPackage(fs.root, { name: 'root', version: '1.0.0', dependencies: { dep: '^1.0.0' } });
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      root = resolveRootPackage(fs);

      const dep = root.resolveImport('dep').asPackage()!;

      expect(root.resolveDependency(dep)).toEqual({
        kind: 'runtime',
      });
      expect(root.resolveDependency(dep)).toEqual({
        kind: 'runtime',
      });
    });
    it('resolves dev dependency', () => {
      fs.addPackage(fs.root, {
        name: 'root',
        version: '1.0.0',
        devDependencies: { dep: '^1.0.0' },
      });
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      root = resolveRootPackage(fs);

      const dep = root.resolveImport('dep').asPackage()!;

      expect(root.resolveDependency(dep)).toEqual({
        kind: 'dev',
      });
    });
    it('resolves peer dependency', () => {
      fs.addPackage(fs.root, {
        name: 'root',
        version: '1.0.0',
        peerDependencies: { dep: '1.0.0' },
        devDependencies: { dep: '1.0.0' },
      });
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      root = resolveRootPackage(fs);

      const dep = root.resolveImport('dep').asPackage()!;

      expect(root.resolveDependency(dep)).toEqual({
        kind: 'peer',
      });
    });
    it('does not resolve missing dependency', () => {
      const dep = root.resolveImport('test:missing');

      expect(root.resolveDependency(dep)).toBeNull();
      expect(root.resolveDependency(dep)).toBeNull();
    });
    it('does not resolve wrong dependency version', () => {
      fs.addPackage(fs.root, { name: 'root', version: '1.0.0', dependencies: { dep: '^1.0.0' } });
      fs.addPackage({ name: 'dep', version: '1.0.0' });
      fs.addPackage({ name: 'dep', version: '2.0.0' });

      root = resolveRootPackage(fs);

      const dep1 = root.resolveImport('package:dep/1.0.0').asPackage()!;
      const dep2 = root.resolveImport('package:dep/2.0.0').asPackage()!;

      expect(root.resolveDependency(dep2)).toBeNull();
      expect(root.resolveDependency(dep2)).toBeNull();
      expect(root.resolveDependency(dep1)).toEqual({
        kind: 'runtime',
      });
    });
    it('does not resolve among multiple dependency versions', () => {
      fs.addPackage(fs.root, {
        name: 'root',
        version: '1.0.0',
        devDependencies: { dep1: '^1.0.0' },
      });
      fs.addPackage({ name: 'dep1', version: '1.0.0' });

      root = resolveRootPackage(fs);

      fs.addPackage('package:dep2', { name: 'dep2', version: '1.0.0' }, true);

      const dep2v1 = root.resolveImport('package:dep2').asPackage()!;

      fs.addPackage('package:dep2@biz', { name: 'dep2', version: '1.0.0' }, true);

      const dep2v2 = root.resolveImport('package:dep2@biz').asPackage()!;

      expect(root.resolveDependency(dep2v2)).toBeNull();
      expect(root.resolveDependency(dep2v1)).toBeNull();
    });
    it('does not resolve uninstalled peer dependency', () => {
      fs.addPackage(fs.root, {
        name: 'root',
        version: '1.0.0',
        peerDependencies: { dep: '1.0.0' },
        devDependencies: { dep2: '1.0.0' },
      });
      fs.addPackage({ name: 'dep', version: '1.0.0' });
      root = resolveRootPackage(fs);

      const dep = root.resolveImport('dep');

      expect(root.resolveDependency(dep)).toBeNull();
    });
  });
});
