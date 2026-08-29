export const CONTENT_SCHEMA_VERSION = '0.1';
export const CANON_STATUSES = ['CANON', 'EXPERIMENTAL', 'COMMUNITY', 'VARIANT', 'TOTAL_CONVERSION'];

export function isCompatibleSchemaVersion(version) {
  return typeof version === 'string' && version.startsWith('0.');
}

export function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
