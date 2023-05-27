import { beforeEach, describe, expect, it } from '@jest/globals';
import { resolveRootPackage } from '../fs/resolve-root-package.js';
import { VirtualPackageFS } from '../fs/virtual-package-fs.js';
import { PackageInfo } from '../package/package-info.js';
import { PackageResolution } from './package-resolution.js';

describe('PackageResolution', () => {
  let fs: VirtualPackageFS;
  let root: PackageResolution;

  beforeEach(async () => {
    fs = new VirtualPackageFS().addRoot({ name: '@test-scope/root-package', version: '1.0.0' });

    root = await resolveRootPackage(fs);
  });

  describe('resolutionBaseURI', () => {
    it('ends with slash', () => {
      expect(root.resolutionBaseURI).toBe(`${root.uri}/`);
    });
  });

  describe('packageInfo', () => {
    it('loads package.json contents', () => {
      expect(root.packageInfo.packageJson).toEqual({
        name: '@test-scope/root-package',
        version: '1.0.0',
      });
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
    it('is constructed for invalid package', async () => {
      fs = new VirtualPackageFS().addRoot({ name: '@wrong-package', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      expect(root.importSpec).toEqual({
        kind: 'package',
        spec: '@wrong-package',
        name: '@wrong-package',
        local: '@wrong-package',
      });
    });
  });

  describe('scope', () => {
    it('is obtained from package.json', () => {
      expect(root.packageInfo.scope).toBe('@test-scope');
    });
    it('is recognized with wrong name', async () => {
      fs.addRoot({ name: '@wrong-name', version: '1.0.0' });

      root = await resolveRootPackage(fs);
      expect(root.packageInfo.scope).toBeUndefined();
    });
  });

  describe('name', () => {
    it('is obtained from package.json', () => {
      expect(root.packageInfo.name).toBe('@test-scope/root-package');
    });
    it('is recognized with wrong name', async () => {
      fs.addRoot({ name: '@wrong-name', version: '1.0.0' });

      root = await resolveRootPackage(fs);
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
    it('resolves itself by URI', () => {
      expect(root.resolveImport(root.uri)).toBe(root);
    });
    it('resolves itself by directory URI', () => {
      expect(root.resolveImport(root.resolutionBaseURI)).toBe(root);
    });
    it('resolves package file', () => {
      const uri = root.uri + '/test/submodule';
      const entry = root.resolveImport(uri).asSubPackage()!;

      expect(entry.importSpec).toEqual({
        kind: 'path',
        spec: './test/submodule',
        isRelative: true,
        path: './test/submodule',
        uri: './test/submodule',
      });
      expect(entry.subpath).toBe('/test/submodule');
      expect(entry.uri).toBe(uri);
      expect(entry.host).toBe(root);
    });
    it('resolves private import', () => {
      const spec = '#private/path';
      const entry = root.resolveImport(spec).asSubPackage()!;

      expect(entry.importSpec).toEqual({
        kind: 'private',
        spec,
      });
      expect(entry.uri).toBe(root.uri + `?private=${encodeURIComponent(spec.slice(1))}`);
      expect(entry.subpath).toBe(spec);
      expect(entry.host).toBe(root);
    });
    it('resolves package entry', async () => {
      fs.addRoot({ name: 'root', version: '1.0.0', dependencies: { dep: '^1.0.0' } });
      fs.addPackage('package:dep', { name: 'dep', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      const spec = 'dep/submodule';
      const entry = root.resolveImport(spec).asSubPackage()!;

      expect(entry.importSpec).toEqual({
        kind: 'entry',
        spec,
        name: 'dep',
        local: 'dep',
        subpath: '/submodule',
      });
      expect(entry.subpath).toBe('/submodule');
      expect(entry.uri).toBe('package:dep/submodule');

      const { host } = entry;

      expect(host).toBe(root.resolveImport('dep'));
      expect(host.importSpec).toEqual({
        kind: 'package',
        spec: 'dep',
        name: 'dep',
        local: 'dep',
      });
      expect(host.uri).toBe('package:dep');
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
      expect(found.host).toBeUndefined();
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

      const found = root.resolveImport('./dep');

      expect(found.uri).toBe('package:root/dep');
      expect(found.importSpec.kind).toBe('package');
      expect(found.asPackage()).toBe(found);
    });
    it('resolves uninstalled peer dependency as unknown import', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        peerDependencies: { dep: '1.0.0' },
        devDependencies: { dep2: '1.0.0' },
      });
      root = await resolveRootPackage(fs);

      expect(root.resolveImport('dep').uri).toBe('import:package:dep');
    });
    it('resolves dependency with wrong version range as unknown import', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        dependencies: { dep: '_' },
      });
      root = await resolveRootPackage(fs);

      expect(root.resolveImport('dep').uri).toBe('import:package:dep');
    });
  });

  describe('resolveDependency', () => {
    it('resolves self-dependency', () => {
      expect(root.resolveDependency(root)).toEqual({ kind: 'self', on: root });
    });
    it('resolves dependency on package entry', () => {
      const on = root.resolveImport(root.uri + '/test/submodule');

      expect(root.resolveDependency(on)).toEqual({
        kind: 'self',
        on,
      });
    });
    it('resolves package entry dependency on another package entry', () => {
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
        on: dependency,
      });
    });
    it('resolves runtime dependency', async () => {
      fs.addRoot({ name: 'root', version: '1.0.0', dependencies: { dep: '^1.0.0' } });
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      root = await resolveRootPackage(fs);

      const dep = root.resolveImport('dep').asPackage()!;

      expect(root.resolveDependency(dep)).toEqual({
        kind: 'runtime',
        on: dep,
      });
      expect(root.resolveDependency(dep)).toEqual({
        kind: 'runtime',
        on: dep,
      });
    });
    it('resolves dev dependency', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        devDependencies: { dep: '^1.0.0' },
      });
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      root = await resolveRootPackage(fs);

      const dep = root.resolveImport('dep').asPackage()!;

      expect(root.resolveDependency(dep)).toEqual({
        kind: 'dev',
        on: dep,
      });
    });
    it('resolves peer dependency', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        peerDependencies: { dep: '1.0.0' },
        devDependencies: { dep: '1.0.0' },
      });
      fs.addPackage({ name: 'dep', version: '1.0.0' });

      root = await resolveRootPackage(fs);

      const dep = root.resolveImport('dep').asPackage()!;

      expect(root.resolveDependency(dep)).toEqual({
        kind: 'peer',
        on: dep,
      });
    });
    it('does not resolve missing dependency', () => {
      const dep = root.resolveImport('test:missing');

      expect(root.resolveDependency(dep)).toBeNull();
      expect(root.resolveDependency(dep)).toBeNull();
    });
    it('does not resolve wrong dependency version', async () => {
      fs.addRoot({ name: 'root', version: '1.0.0', dependencies: { dep: '^1.0.0' } });
      fs.addPackage({ name: 'dep', version: '1.0.0' });
      fs.addPackage({ name: 'dep', version: '2.0.0' });

      root = await resolveRootPackage(fs);

      const dep1 = root.resolveImport('package:dep/1.0.0').asPackage()!;
      const dep2 = root.resolveImport('package:dep/2.0.0').asPackage()!;

      expect(root.resolveDependency(dep2)).toBeNull();
      expect(root.resolveDependency(dep2)).toBeNull();
      expect(root.resolveDependency(dep1)).toEqual({
        kind: 'runtime',
        on: dep1,
      });
    });
    it('does not resolve among multiple dependency versions', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        devDependencies: { dep1: '^1.0.0' },
      });
      fs.addPackage({ name: 'dep1', version: '1.0.0' });

      root = await resolveRootPackage(fs);

      fs.addPackage('package:dep2', { name: 'dep2', version: '1.0.0' }, true);

      const dep2v1 = root.resolveImport('package:dep2').asPackage()!;

      fs.addPackage('package:dep2@biz', { name: 'dep2', version: '1.0.0' }, true);

      const dep2v2 = root.resolveImport('package:dep2@biz').asPackage()!;

      expect(root.resolveDependency(dep2v2)).toBeNull();
      expect(root.resolveDependency(dep2v1)).toBeNull();
    });
    it('does not resolve uninstalled peer dependency', async () => {
      fs.addRoot({
        name: 'root',
        version: '1.0.0',
        peerDependencies: { dep: '1.0.0' },
        devDependencies: { dep2: '1.0.0' },
      });
      fs.addPackage({ name: 'dep', version: '1.0.0' });
      root = await resolveRootPackage(fs);

      const dep = root.resolveImport('dep');

      expect(root.resolveDependency(dep)).toBeNull();
    });
  });
});

describe('resolveRootPackage', () => {
  it('obtains current package by default', async () => {
    const root = await resolveRootPackage();

    expect(root.packageInfo.name).toBe(PackageInfo.loadSync().name);
  });
});
