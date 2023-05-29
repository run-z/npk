import { describe, expect, it } from '@jest/globals';
import { PackageInfo } from './package-info.js';

describe('PackageInfo', () => {
  describe('from', () => {
    it('returns package info itself', () => {
      const packageInfo = new PackageInfo({ name: 'test' });

      expect(PackageInfo.from(packageInfo)).toBe(packageInfo);
    });
    it('constructs package info from package.json contents', () => {
      expect(PackageInfo.from({ name: 'test' }).name).toBe('test');
    });
  });

  describe('load', () => {
    it('loads package info asynchronously', async () => {
      const info = await PackageInfo.load();

      expect(info.packageJson.name).toBe('@run-z/npk');
    });
  });

  describe('name', () => {
    it('defaults to -', () => {
      expect(new PackageInfo({}).name).toBe('-');
    });
    it('reflects package.json contents', () => {
      expect(new PackageInfo({ name: 'test' }).name).toBe('test');
    });
  });

  describe('version', () => {
    it('defaults to 0.0.0', () => {
      expect(new PackageInfo({}).version).toBe('0.0.0');
    });
    it('reflects package.json contents', () => {
      expect(new PackageInfo({ version: '1.0.0-pre.1' }).version).toBe('1.0.0-pre.1');
    });
  });

  describe('scope', () => {
    it('is undefined when missing', () => {
      expect(new PackageInfo({ name: 'test' }).scope).toBeUndefined();
    });
    it('is undefined for invalid name', () => {
      expect(new PackageInfo({ name: '@test' }).scope).toBeUndefined();
    });
    it('equals to package scope name', () => {
      expect(new PackageInfo({ name: '@test/package' }).scope).toBe('@test');
    });
  });

  describe('localName', () => {
    it('equals to name when scope unspecified', () => {
      const packageInfo = new PackageInfo({ name: 'test' });

      expect(packageInfo.localName).toBe('test');
      expect(packageInfo.localName).toBe('test');
    });
    it('equals to name for invalid name', () => {
      expect(new PackageInfo({ name: '@test' }).localName).toBe('@test');
    });
    it('equals to package local name', () => {
      expect(new PackageInfo({ name: '@test/package' }).localName).toBe('package');
    });
  });

  describe('type', () => {
    it('is commonjs by default', () => {
      expect(new PackageInfo({}).type).toBe('commonjs');
      expect(new PackageInfo({ type: 'wrong' as unknown as 'commonjs' }).type).toBe('commonjs');
    });
    it('is module when explicitly set', () => {
      expect(new PackageInfo({ type: 'module' }).type).toBe('module');
    });
  });

  describe('with exports', () => {
    describe('mainEntryPoint', () => {
      it('ignores main', () => {
        const pkg = new PackageInfo({
          main: 'main.js',
          exports: './index.js',
        });

        expect(pkg.mainEntryPoint?.findConditional()).toBe('./index.js');
      });
    });

    describe('entryPoints', () => {
      it('list all entry points', () => {
        const pkg = new PackageInfo({
          main: 'main.js',
          exports: {
            '.': './index.js',
            './custom': { require: './custom.cjs', default: './custom.js' },
          },
        });

        const entries = [...pkg.entryPoints()];

        expect(entries).toHaveLength(2);

        expect(entries[0][0]).toBe('.');
        expect(entries[0][1].path).toBe('.');
        expect(entries[0][1].findConditional()).toBe('./index.js');
        expect(entries[0][1].findConditional('import')).toBeUndefined();

        expect(entries[1][0]).toBe('./custom');
        expect(entries[1][1].path).toBe('./custom');
        expect(entries[1][1].findConditional()).toBe('./custom.js');
        expect(entries[1][1].findConditional('require')).toBe('./custom.cjs');
        expect(entries[1][1].findConditional('import')).toBeUndefined();
      });
    });

    describe('findEntryPoint', () => {
      it('exports only listed exports', () => {
        const pkg = new PackageInfo({
          exports: { './index': './index.js', './index2': './index2.js' },
        });

        expect(pkg.findEntryPoint('./index')?.findConditional()).toBe('./index.js');
        expect(pkg.findEntryPoint('./index2')?.findConditional()).toBe('./index2.js');
        expect(pkg.findEntryPoint('./index3')).toBeUndefined();
      });
      it('exports matching pattern', () => {
        const pkg = new PackageInfo({
          exports: { './*.js': './dist/*.js' },
        });

        expect(pkg.findEntryPoint('./index.js')?.findConditional()).toBe('./dist/index.js');
        expect(pkg.findEntryPoint('./index')).toBeUndefined();
      });
      it('prefers exact match', () => {
        const pkg = new PackageInfo({
          exports: { './*.js': './dist/*.js', './main.js': './main.js' },
        });

        expect(pkg.findEntryPoint('./main.js')?.findConditional()).toBe('./main.js');
        expect(pkg.findEntryPoint('./index.js')?.findConditional()).toBe('./dist/index.js');
      });
      it('prefers first match', () => {
        const pkg = new PackageInfo({
          exports: { './*': './dist/*', './*.js': './js/*.js' },
        });

        expect(pkg.findEntryPoint('./main.js')?.findConditional()).toBe('./dist/main.js');
      });
    });
  });

  describe('without exports', () => {
    describe('mainEntryPoint', () => {
      it('is undefined by default', () => {
        expect(new PackageInfo({}).mainEntryPoint).toBeUndefined();
      });
      it('is detected by main entry', () => {
        const main = new PackageInfo({ main: './main.js' }).mainEntryPoint;

        expect(main?.findConditional()).toBe('./main.js');
        expect(main?.path).toBe('.');
      });
      it('corrects main entry target', () => {
        expect(new PackageInfo({ main: 'main.js' }).mainEntryPoint?.findConditional()).toBe(
          './main.js',
        );
      });
    });

    describe('findEntryPoint', () => {
      it('exports any path with main field', () => {
        const pkg = new PackageInfo({ main: './main.js' });

        expect(pkg.findEntryPoint('./some/path.js')?.findConditional()).toBe('./some/path.js');
      });
      it('exports any path without main field', () => {
        const pkg = new PackageInfo({});

        expect(pkg.findEntryPoint('./some/path.js')?.findConditional()).toBe('./some/path.js');
      });
    });
  });
});
