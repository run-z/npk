import semver, { type Range } from 'semver';

export function parseRange(range: string | undefined): Range | undefined {
  if (range == null) {
    return;
  }

  try {
    return new semver.Range(range.replace(RANGE_PROTOCOL_PATTERN, ''));
  } catch {
    return;
  }
}

const RANGE_PROTOCOL_PATTERN = /^[a-z]+:/;
