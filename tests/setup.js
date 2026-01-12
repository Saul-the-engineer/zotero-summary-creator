// Test setup and configuration

import { beforeEach, afterEach, vi } from 'vitest';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});
