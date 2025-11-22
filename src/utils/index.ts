/**
 * Custom error thrown when an operation is aborted.
 */
export class AbortError extends Error {
  constructor(reason?: string) {
    super(reason || 'Operation aborted');
    this.name = 'AbortError';
    Error.captureStackTrace?.(this, AbortError);
  }
}

export interface WithAbortOptions {
  timeout?: number;
  timeoutMessage?: string;
}

/**
 * Wraps a promise with abort signal and optional timeout support.
 *
 * @param promise - The promise to wrap
 * @param signal - Optional AbortSignal to cancel the operation
 * @param options - Optional timeout configuration
 * @returns Promise that rejects with AbortError if aborted or timed out
 * @throws Error if operation timeout exceeds request timeout
 */
export function withAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  options?: WithAbortOptions,
): Promise<T> {
  // Early returns for simple cases
  if (!signal && !options?.timeout) return promise;
  if (signal?.aborted) {
    return Promise.reject(
      new AbortError(signal.reason ? String(signal.reason) : undefined),
    );
  }

  validateTimeouts(signal, options);

  const promises: Promise<T>[] = [promise];

  if (signal) {
    promises.push(createAbortPromise<T>(signal));
  }

  if (options?.timeout) {
    promises.push(createTimeoutPromise<T>(options));
  }

  return Promise.race(promises);
}

/**
 * Validates that operation timeout doesn't exceed request timeout
 */
function validateTimeouts(
  signal: AbortSignal | undefined,
  options: WithAbortOptions | undefined,
): void {
  if (!options?.timeout || !signal?._requestTimeout) {
    return;
  }

  const { timeout } = options;
  const requestTimeout = signal._requestTimeout;

  if (timeout > requestTimeout) {
    throw new Error(
      `Operation timeout (${timeout}ms) cannot exceed request timeout (${requestTimeout}ms). ` +
        `Use @RequestTimeout(${timeout}) decorator to increase the request timeout.`,
    );
  }
}

/**
 * Creates a promise that rejects when the signal is aborted
 */
function createAbortPromise<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_, reject) => {
    signal.addEventListener(
      'abort',
      () =>
        reject(
          new AbortError(signal.reason ? String(signal.reason) : undefined),
        ),
      { once: true },
    );
  });
}

/**
 * Creates a promise that rejects after a timeout
 */
function createTimeoutPromise<T>(options: WithAbortOptions): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      const message =
        options.timeoutMessage ||
        `Operation timed out after ${options.timeout}ms`;
      reject(new AbortError(message));
    }, options.timeout);
  });
}
