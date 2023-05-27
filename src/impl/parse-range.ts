import semver, { type Range } from 'semver';

export function parseRange(range: string | undefined): Range | undefined {
  if (range == null) {
    return;
  }

  try {
    return new semver.Range(range);
  } catch {
    return;
  }
}
