import { beforeEach, describe, expect, it } from '@jest/globals';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FS_ROOT } from '../impl/fs-root.js';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { recognizeImport } from '../resolution/recognize-import.js';
import { NodePackageFS } from './node-package-fs.js';
import { resolveRootPackage } from './resolve-root-package.js';

describe('NodePackageFS', () => {
  let fs: NodePackageFS;

  beforeEach(() => {
    fs = new NodePackageFS();
  });

  it('constructed by path', () => {
    expect(new NodePackageFS('.').root).toBe(pathToFileURL('.').href);
  });

  it('constructed by file URL', () => {
    const root = pathToFileURL('.').href;

    expect(new NodePackageFS(root).root).toBe(root);
  });

  describe('recognizePackageURI', () => {
    it('ignores non-file URLs', () => {
      expect(
        fs.recognizePackageURI(recognizeImport('http:///localhost/pkg') as Import.URI),
      ).toBeUndefined();
    });
  });

  describe('parentDir', () => {
    it('returns undefined for root dir', () => {
      expect(fs.parentDir(FS_ROOT.href)).toBeUndefined();
    });
  });

  describe('loadPackage', () => {
    it('ignores non-file package.json', () => {
      expect(fs.loadPackage(pathToFileURL(path.resolve('testing')).href)).toBeUndefined();
    });
    it('ignores incomplete package.json', () => {
      expect(
        fs.loadPackage(pathToFileURL(path.resolve('testing/wrong-package')).href),
      ).toBeUndefined();
    });
  });

  describe('resolution', () => {
    let root: PackageResolution;

    beforeEach(async () => {
      root = await resolveRootPackage(fs);
    });

    it('resolves package self-reference', () => {
      expect(root.resolveImport(root.packageInfo.name)).toBe(root);
      expect(root.resolveDependency(root)).toEqual({ kind: 'self', on: root });
    });
    it('resolves own directory dependency', () => {
      expect(root.resolveImport('.')).toBe(root);
    });
    it('resolves implied dependency', () => {
      const nodeImport = root.resolveImport('node:fs');

      expect(nodeImport.importSpec.kind).toBe('implied');
      expect(root.resolveDependency(nodeImport)).toEqual({
        kind: 'implied',
        on: nodeImport,
      });
    });
    it('resolves synthetic dependency', () => {
      const nodeImport = root.resolveImport('\0internal');

      expect(nodeImport.importSpec.kind).toBe('synthetic');
      expect(root.resolveDependency(nodeImport)).toEqual({
        kind: 'synthetic',
        on: nodeImport,
      });
    });
    it('resolves runtime dependency', () => {
      const depImport = root.resolveImport('semver');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({
        kind: 'runtime',
        on: depImport,
      });
    });
    it('resolves dev dependency', () => {
      const depImport = root.resolveImport('typescript');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({
        kind: 'dev',
        on: depImport,
      });
    });
    it('resolves package file by URI', () => {
      const req = createRequire(import.meta.url);
      const uri = pathToFileURL(req.resolve('typescript')).href;
      const path = './' + /\/node_modules\/typescript\/(.*)$/.exec(uri)![1];
      const fileImport = root.resolveImport(uri).asSubPackage()!;

      expect(fileImport.importSpec).toEqual({
        kind: 'path',
        spec: path,
        isRelative: true,
        path: path,
        uri: path,
      });
      expect(fileImport.subpath).toBe(path.slice(1));
      expect(root.resolveDependency(fileImport)).toEqual({
        kind: 'dev',
        on: fileImport,
      });

      const depImport = root.resolveImport('typescript');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({
        kind: 'dev',
        on: depImport,
      });
    });
    it('resolves package by URI', () => {
      const req = createRequire(import.meta.url);
      const uri = pathToFileURL(req.resolve('typescript')).href;
      const dir = /(.*\/node_modules\/typescript\/).*$/.exec(uri)![1];
      const packageImport = root.resolveImport(dir).asPackage()!;

      expect(packageImport.importSpec).toEqual({
        kind: 'package',
        spec: 'typescript',
        name: 'typescript',
        local: 'typescript',
      });
      expect(packageImport.subpath).toBe('');
      expect(packageImport.uri).toBe(dir);
      expect(root.resolveDependency(packageImport)).toEqual({
        kind: 'dev',
        on: packageImport,
      });
    });
    it('does not resolve non-file URL', () => {
      const urlImport = root.resolveImport('http://localhost/pkg/test');

      expect(urlImport.importSpec.kind).toBe('uri');
      expect(root.resolveDependency(urlImport)).toBeNull();
    });
    it('does not resolve missing dependency', () => {
      const wrongImport = root.resolveImport('@run-z/wrong/subpath');

      expect(wrongImport.importSpec.kind).toBe('entry');
      expect(root.resolveDependency(wrongImport)).toBeNull();
    });
    it('resolves sub-directory dependency', () => {
      const dirImport = root.resolveImport('./src').asSubPackage()!;

      expect(dirImport.importSpec).toEqual({
        kind: 'path',
        spec: './src',
        isRelative: true,
        path: './src',
        uri: './src',
      });
      expect(dirImport.subpath).toBe('/src');
      expect(root.resolveDependency(dirImport)).toEqual({
        kind: 'self',
        on: dirImport,
      });
      expect(dirImport.host).toBe(root);
    });
    it('resolves sub-directory dependency with trailing slash', () => {
      const dirImport = root.resolveImport('./src/').asSubPackage()!;

      expect(dirImport.importSpec).toEqual({
        kind: 'path',
        spec: './src/',
        isRelative: true,
        path: './src/',
        uri: './src/',
      });
      expect(dirImport.subpath).toBe('/src/');
      expect(root.resolveDependency(dirImport)).toEqual({
        kind: 'self',
        on: dirImport,
      });
      expect(dirImport.host).toBe(root);
    });
  });

  describe('unknown resolution', () => {
    let resolution: ImportResolution;

    beforeEach(async () => {
      const root = await resolveRootPackage(fs);

      resolution = root.resolveImport('\0synthetic');
    });

    it('resolves package', () => {
      const pkgImport = resolution.resolveImport('typescript');

      expect(pkgImport.importSpec.kind).toBe('package');
    });
    it('resolves file URL', () => {
      const req = createRequire(import.meta.url);
      const url = pathToFileURL(req.resolve('typescript')).href;
      const urlImport = resolution.resolveImport(url);

      expect(urlImport.importSpec.kind).toBe('uri');
    });
  });
});
