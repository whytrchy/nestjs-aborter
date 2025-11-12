declare global {
  interface AbortSignal {
    /**
     * @internal
     * Stores the effective request timeout for validation.
     * Set by AborterInterceptor, used by withAbort validation.
     */
    _requestTimeout?: number;
  }
}

export {};
