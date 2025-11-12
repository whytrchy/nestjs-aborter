export interface AborterOptions {
  /**
   * Global timeout in milliseconds for all requests.
   * If not set, requests will not timeout automatically.
   */
  timeout?: number;

  /**
   * Default reason message when a request is aborted.
   * @default 'Request terminated'
   */
  reason?: string;

  /**
   * Enable logging of abort events.
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Custom logger function for abort events.
   * Receives a single formatted message string.
   */
  logger?: (message: string) => void;

  /**
   * Array of route patterns (regex) to skip.
   * Routes matching these patterns will not have abort controllers attached.
   * @example ['^/health$', '^/metrics$']
   */
  skipRoutes?: string[];

  /**
   * Array of HTTP methods to skip.
   * @example ['OPTIONS', 'HEAD']
   */
  skipMethods?: string[];
}
