// Test helper functions

export function createMockFetch(responseData, status = 200) {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseData),
      text: () => Promise.resolve(JSON.stringify(responseData)),
    })
  );
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function assertValidSummary(summary) {
  expect(summary).toBeDefined();
  expect(summary.executiveSummary).toBeDefined();
  expect(summary.executiveSummary.length).toBeGreaterThan(0);
  expect(summary.keyContributions).toBeDefined();
  expect(Array.isArray(summary.keyContributions)).toBe(true);
  expect(summary.limitations).toBeDefined();
  expect(Array.isArray(summary.limitations)).toBe(true);
}
