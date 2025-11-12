// Core module and interceptor
export { AborterModule } from './aborter.module';
export { AborterInterceptor } from './interceptors/aborter.interceptor';

// Filters
export { AborterFilter } from './filters/aborter.filter';

// Decorators
export { AborterSignal, AborterReason } from './decorators/aborter.decorator';

// Guards
export { AborterGuard } from './guards/aborter.guard';

// Utilities
export { withAbort, AbortError } from './utils';

// Types
export type { RequestWithAbortController } from './interceptors/aborter.interceptor';
export type { AborterOptions } from './interfaces/aborter.interface';
