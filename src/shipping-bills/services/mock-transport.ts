/**
 * Simulated network transport for the mock services.
 *
 * Every mock service in this folder goes through `mockRequest`, so the UI
 * only ever sees asynchronous, Promise-based calls with realistic latency
 * and HTTP-style failures (`MockApiError` with a `status`). Replacing the
 * mocks with real HTTP is a matter of swapping the producer inside each
 * service method for a `fetch` call — the signatures stay the same.
 *
 * Failure simulation: add `?mockFail=options,parties,bills,submit,marks` to
 * the page URL to make the matching service calls reject, e.g. to exercise
 * the error/retry states. Unknown records reject with a 404 error, and
 * invalid submissions with a 422 error, just like a real API.
 */

export class MockApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status = 503, code = 'MOCK_FAILURE') {
    super(message)
    this.name = 'MockApiError'
    this.status = status
    this.code = code
  }
}

export function mockNotFound(resource: string, id: string | number): MockApiError {
  return new MockApiError(`${resource} ${id} was not found`, 404, 'NOT_FOUND')
}

const DEFAULT_DELAY_MS = 250

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function simulatedFailureTag(tag: string): boolean {
  if (typeof window === 'undefined') return false
  const requested = new URLSearchParams(window.location.search).get('mockFail')
  if (!requested) return false
  return requested
    .split(',')
    .map((part) => part.trim())
    .includes(tag)
}

export async function mockRequest<T>(
  tag: string,
  produce: () => T | Promise<T>,
  delayMs = DEFAULT_DELAY_MS
): Promise<T> {
  await wait(delayMs)
  if (simulatedFailureTag(tag)) {
    throw new MockApiError(
      `Simulated mock failure for "${tag}" (remove ?mockFail=${tag} from the URL to recover)`,
      503,
      'SIMULATED_FAILURE'
    )
  }
  return produce()
}
