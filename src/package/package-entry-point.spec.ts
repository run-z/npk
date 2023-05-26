import { describe, expect, it } from '@jest/globals';
import { PackageEntryPoint } from './package-entry-point.js';
import { PackageInfo } from './package-info.js';
import { PackageJson } from './package.json.js';

describe('PackageEntryPoint', () => {
  describe('packageInfo', () => {
    it('refers to host package', () => {
      const pkg = new PackageInfo({ main: './index.js' });
      const entry = pkg.mainEntryPoint;

      expect(entry?.packageInfo).toBe(pkg);
    });
  });

  describe('entryPoint', () => {
    it('refers to itself', () => {
      const entry = createEntry({ exports: { '.': './main.js' } });

      expect(entry.entryPoint).toBe(entry);
    });
  });

  describe('findTargets', () => {
    it('returns the matching entry itself', () => {
      const entry = createEntry({ exports: { '.': './main.js' } });

      expect(entry.findTargets('.')).toBe(entry);
    });
    it('returns targets for matching pattern', () => {
      const entry = createEntry({ exports: { './*.js': './dist/*.js' } });
      const targets = entry.findTargets('./index.js');

      expect(targets?.entryPoint).toBe(entry);
      expect(targets?.findConditional()).toBe('./dist/index.js');
    });
    it('returns nothing for non-matching path', () => {
      const entry = createEntry({ exports: { '.': './main.js' } });

      expect(entry.findTargets('./some.js')).toBeUndefined();
    });
  });

  describe('findConditional', () => {
    it('handles path conditions', () => {
      const entry = createEntry({
        exports: {
          node: {
            default: {
              './other': './other.js',
            },
          },
        },
      });

      expect(entry.path).toBe('./other');
      expect(entry.findConditional()).toBe('./other.js');
      expect(entry.findConditional('node')).toBe('./other.js');
      expect(entry.findConditional('node', 'default')).toBe('./other.js');
      expect(entry.findConditional('default', 'node')).toBe('./other.js');
      expect(entry.findConditional('import')).toBeUndefined();
      expect(entry.findConditional('node', 'import')).toBeUndefined();
    });
    it('returns none for non-matching conditions', () => {
      const entry = createEntry({
        exports: {
          node: './node.js',
        },
      });

      expect(entry.findConditional()).toBeUndefined();
      expect(entry.findConditional('browser')).toBeUndefined();
    });
    it('selects the best match', () => {
      const entry = createEntry({
        exports: {
          import: {
            '.': './default.js',
            browser: {
              '.': './browser.js',
            },
            node: {
              '.': './node.js',
            },
          },
        },
      });

      expect(entry.findConditional('import')).toBe('./default.js');
      expect(entry.findConditional('import', 'browser')).toBe('./browser.js');
      expect(entry.findConditional('browser', 'import')).toBe('./browser.js');
      expect(entry.findConditional('browser', 'node')).toBeUndefined();
    });
  });

  describe('findJs', () => {
    it('prefers module-specific imports', () => {
      const entry = createEntry({
        type: 'module',
        exports: {
          '.': { import: './default.mjs', require: './default.cjs', default: './default.js' },
        },
      });

      expect(entry.findJs('module')).toBe('./default.mjs');
      expect(entry.findJs('commonjs')).toBe('./default.cjs');
      expect(entry.findJs(null)).toBe('./default.cjs');
    });
    it('falls back to default import', () => {
      const entry = createEntry({
        type: 'module',
        exports: './default.js',
      });

      expect(entry.findJs('module')).toBe('./default.js');
      expect(entry.findJs('commonjs')).toBe('./default.js');
      expect(entry.findJs(null)).toBe('./default.js');
    });
  });

  function createEntry(packageJson: PackageJson): PackageEntryPoint {
    return [...new PackageInfo(packageJson).entryPoints()][0][1];
  }
});
