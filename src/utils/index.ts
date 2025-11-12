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
  if (options?.timeout && signal?._requestTimeout) {
    if (options.timeout > signal._requestTimeout) {
      throw new Error(
        `Operation timeout (${options.timeout}ms) cannot exceed request timeout (${signal._requestTimeout}ms). ` +
          `Use @RequestTimeout(${options.timeout}) decorator to increase the request timeout.`,
      );
    }
  }

  if (!signal && !options?.timeout) {
    return promise;
  }

  if (signal?.aborted) {
    return Promise.reject(
      new AbortError(signal.reason ? String(signal.reason) : undefined),
    );
  }

  return new Promise<T>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let abortController: AbortController | undefined;

    const cleanup = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (abortController) {
        abortController.abort();
        abortController = undefined;
      }
    };

    if (signal || options?.timeout) {
      abortController = new AbortController();
      const internalSignal = abortController.signal;

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            cleanup();
            reject(
              new AbortError(signal.reason ? String(signal.reason) : undefined),
            );
          },
          { once: true, signal: internalSignal },
        );
      }

      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          cleanup();
          const message =
            options.timeoutMessage ||
            `Operation timed out after ${options.timeout}ms`;
          reject(new AbortError(message));
        }, options.timeout);
      }
    }

    promise
      .then((result) => {
        cleanup();
        resolve(result);
      })
      .catch((error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}
