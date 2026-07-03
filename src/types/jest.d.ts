/**
 * Restore jest globals removed in @types/jest v30.
 *
 * @types/jest v30 removed the global `jest` value (jest.fn, jest.mock, etc.)
 * and only kept the `jest` namespace for types. This declaration bridges the
 * gap until tests are migrated to explicit @jest/globals imports.
 */

import type { Jest } from '@jest/environment';

declare global {
	var jest: Jest;
}
