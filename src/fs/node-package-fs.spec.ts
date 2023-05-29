import { beforeEach, describe, expect, it } from '@jest/globals';
import { createRequire } from 'node:module';
import path from 'node:path';
import win32 from 'node:path/win32';
import { pathToFileURL } from 'node:url';
import { ImportResolution } from '../resolution/import-resolution.js';
import { Import } from '../resolution/import.js';
import { PackageResolution } from '../resolution/package-resolution.js';
import { recognizeImport } from '../resolution/recognize-import.js';
import { NodePackageFS } from './node-package-fs.js';
import { resolveRootPackage } from './resolve-root-package.js';

describe('NodePackageFS', () => {
  let fs: NodePackageFS;

  beforeEach(async () => {
    fs = await NodePackageFS.create();
  });

  describe('create', () => {
    it('create fs by path', async () => {
      const fs = await NodePackageFS.create('.');

      expect(fs.root).toBe(pathToFileURL('.').href);
    });
    it('creates fs by file URL', async () => {
      const root = pathToFileURL('.').href;
      const fs = await NodePackageFS.create(root);

      expect(fs.root).toBe(root);
    });
  });

  describe('recognizeImport', () => {
    describe('node builtins', () => {
      it('recognized with "node:" prefix', () => {
        expect(fs.recognizeImport('node:fs')).toEqual({
          kind: 'implied',
          spec: 'node:fs',
          from: 'node',
        });
      });
      it('recognizes built-in module name', () => {
        expect(fs.recognizeImport('fs')).toEqual({
          kind: 'implied',
          spec: 'fs',
          from: 'node',
        });
        expect(fs.recognizeImport('path')).toEqual({
          kind: 'implied',
          spec: 'path',
          from: 'node',
        });
      });
      it('recognizes sub-export of built-in module', () => {
        expect(fs.recognizeImport('fs/promises')).toEqual({
          kind: 'implied',
          spec: 'fs/promises',
          from: 'node',
        });
        expect(fs.recognizeImport('stream/web')).toEqual({
          kind: 'implied',
          spec: 'stream/web',
          from: 'node',
        });
      });
      it('does not recognize wrong node built-in with "node:" prefix', () => {
        expect(fs.recognizeImport('node:wrong-module')).toEqual({
          kind: 'uri',
          spec: 'node:wrong-module',
          scheme: 'node',
          path: 'wrong-module',
        });
        expect(fs.recognizeImport('node:fs/wrong-sub-module')).toEqual({
          kind: 'uri',
          spec: 'node:fs/wrong-sub-module',
          scheme: 'node',
          path: 'fs/wrong-sub-module',
        });
      });
    });

    describe('import paths', () => {
      it('recognizes directory path', () => {
        expect(fs.recognizeImport('.')).toEqual({
          kind: 'path',
          spec: '.',
          isRelative: true,
          path: '.',
          uri: '.',
        });
      });
      it('recognizes parent directory path', () => {
        expect(fs.recognizeImport('..')).toEqual({
          kind: 'path',
          spec: '..',
          isRelative: true,
          path: '..',
          uri: '..',
        });
      });
      it('recognizes absolute unix path', () => {
        const spec = '/test path';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: false,
          path: '/test%20path',
          uri: '/test%20path',
        });
      });
      it('recognizes windows path with drive letter', () => {
        const spec = 'c:\\dir\\test path';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: false,
          path: `/c:/dir/test%20path`,
          uri: `file:///c:/dir/test%20path`,
        });
      });
      it('recognizes absolute windows path with drive letter', () => {
        const spec = '\\c:\\dir\\test path';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: false,
          path: `/c:/dir/test%20path`,
          uri: `file:///c:/dir/test%20path`,
        });
      });
      it('recognizes absolute windows path', () => {
        const spec = '\\\\server\\test path';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: false,
          path: `//%3F/UNC/server/test%20path/`,
          uri: `file:////%3F/UNC/server/test%20path/`,
        });
      });
      it('recognizes UNC windows path', () => {
        const spec = win32.toNamespacedPath('\\\\server\\test path');

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: false,
          path: `//%3F/UNC/server/test%20path/`,
          uri: `file:////%3F/UNC/server/test%20path/`,
        });
      });
      it('recognizes relative unix path', () => {
        const spec = './test path?q=a';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: true,
          path: './test%20path?q=a',
          uri: './test%20path?q=a',
        });
      });
      it('recognizes relative windows path', () => {
        const spec = '.\\test path';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: true,
          path: './test%20path',
          uri: './test%20path',
        });
      });
      it('recognizes unix path relative to parent directory', () => {
        const spec = '../test path#q=a';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: true,
          path: '../test%20path#q=a',
          uri: '../test%20path#q=a',
        });
      });
      it('recognizes windows path relative to parent directory', () => {
        const spec = '..\\test path';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'path',
          spec,
          isRelative: true,
          path: '../test%20path',
          uri: '../test%20path',
        });
      });
      it('does not recognizes invalid path', () => {
        const spec = '...';

        expect(fs.recognizeImport(spec)).toEqual({
          kind: 'unknown',
          spec,
        });
      });
    });
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
      expect(fs.parentDir(fs.fsRoot)).toBeUndefined();
    });
  });

  describe('loadPackage', () => {
    it('ignores non-file package.json', async () => {
      await expect(
        fs.loadPackage(pathToFileURL(path.resolve('testing')).href),
      ).resolves.toBeUndefined();
    });
    it('ignores incomplete package.json', async () => {
      await expect(
        fs.loadPackage(pathToFileURL(path.resolve('testing/wrong-package')).href),
      ).resolves.toBeUndefined();
    });
  });

  describe('resolution', () => {
    let root: PackageResolution;

    beforeEach(async () => {
      root = await resolveRootPackage(fs);
    });

    it('resolves package self-reference', async () => {
      await expect(root.resolveImport(root.packageInfo.name)).resolves.toBe(root);
      expect(root.resolveDependency(root)).toEqual({ kind: 'self', on: root });
    });
    it('resolves own directory dependency', async () => {
      await expect(root.resolveImport('.')).resolves.toBe(root);
    });
    it('resolves implied dependency', async () => {
      const nodeImport = await root.resolveImport('node:fs');

      expect(nodeImport.importSpec.kind).toBe('implied');
      expect(root.resolveDependency(nodeImport)).toEqual({
        kind: 'implied',
        on: nodeImport,
      });
    });
    it('resolves synthetic dependency', async () => {
      const nodeImport = await root.resolveImport('\0internal');

      expect(nodeImport.importSpec.kind).toBe('synthetic');
      expect(root.resolveDependency(nodeImport)).toEqual({
        kind: 'synthetic',
        on: nodeImport,
      });
    });
    it('resolves runtime dependency', async () => {
      const depImport = await root.resolveImport('semver');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({
        kind: 'runtime',
        on: depImport,
      });
    });
    it('resolves dev dependency', async () => {
      const depImport = await root.resolveImport('typescript');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({
        kind: 'dev',
        on: depImport,
      });
    });
    it('resolves package file by URI', async () => {
      const req = createRequire(import.meta.url);
      const uri = pathToFileURL(req.resolve('typescript')).href;
      const path = './' + /\/node_modules\/typescript\/(.*)$/.exec(uri)![1];
      const fileImport = (await root.resolveImport(uri)).asSubPackage()!;

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

      const depImport = await root.resolveImport('typescript');

      expect(depImport.importSpec.kind).toBe('package');
      expect(root.resolveDependency(depImport)).toEqual({
        kind: 'dev',
        on: depImport,
      });
    });
    it('resolves package by URI', async () => {
      const req = createRequire(import.meta.url);
      const uri = pathToFileURL(req.resolve('typescript')).href;
      const dir = /(.*\/node_modules\/typescript\/).*$/.exec(uri)![1];
      const packageImport = (await root.resolveImport(dir)).asPackage()!;

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
    it('does not resolve non-file URL', async () => {
      const urlImport = await root.resolveImport('http://localhost/pkg/test');

      expect(urlImport.importSpec.kind).toBe('uri');
      expect(root.resolveDependency(urlImport)).toBeNull();
    });
    it('does not resolve missing dependency', async () => {
      const wrongImport = await root.resolveImport('@run-z/wrong/subpath');

      expect(wrongImport.importSpec.kind).toBe('entry');
      expect(root.resolveDependency(wrongImport)).toBeNull();
    });
    it('resolves sub-directory dependency', async () => {
      const dirImport = (await root.resolveImport('./src')).asSubPackage()!;

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
    it('resolves sub-directory dependency with trailing slash', async () => {
      const dirImport = (await root.resolveImport('./src/')).asSubPackage()!;

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

      resolution = await root.resolveImport('\0synthetic');
    });

    it('resolves package', async () => {
      const pkgImport = await resolution.resolveImport('typescript');

      expect(pkgImport.importSpec.kind).toBe('package');
    });
    it('resolves file URL', async () => {
      const req = createRequire(import.meta.url);
      const url = pathToFileURL(req.resolve('typescript')).href;
      const urlImport = await resolution.resolveImport(url);

      expect(urlImport.importSpec.kind).toBe('uri');
    });
  });
});
