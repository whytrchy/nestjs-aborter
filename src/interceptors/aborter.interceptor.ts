import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
  Optional,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, race, timer } from 'rxjs';
import { catchError, finalize, mergeMap } from 'rxjs/operators';
import { Request } from 'express';
import type { AborterOptions } from '../interfaces/aborter.interface';
import { Reflector } from '@nestjs/core';
import { REQUEST_TIMEOUT_KEY } from '../decorators/timeout.decorator';

export const ABORT_CONTROLLER_KEY = 'abortController';
export const ABORT_CONTROLLER_OPTIONS = 'ABORT_CONTROLLER_OPTIONS';

/**
 * Extended Request interface with AbortController support.
 */
export interface RequestWithAbortController extends Request {
  abortController: AbortController;
  abortReason?: string;
  effectiveTimeout?: number;
}

/**
 * Interceptor that automatically attaches an AbortController to every HTTP request.
 *
 * This enables automatic cancellation of ongoing operations when:
 * - The client disconnects
 * - A configured timeout is reached
 * - An error occurs during request processing
 */
@Injectable()
export class AborterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AborterInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(ABORT_CONTROLLER_OPTIONS)
    private readonly options: AborterOptions = {},
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithAbortController>();

    if (this.shouldSkipRoute(request)) {
      return next.handle();
    }

    const abortController = this.attachAbortController(request);

    const effectiveTimeout = this.getEffectiveTimeout(context);
    request.effectiveTimeout = effectiveTimeout ?? undefined;

    if (effectiveTimeout) {
      abortController.signal._requestTimeout = effectiveTimeout;
    }

    const cleanup = this.setupRequestCleanup(request, abortController);

    return race(
      next.handle(),
      this.createAbortObservable(request, abortController),
      this.createTimeoutObservable(request, abortController, effectiveTimeout),
    ).pipe(
      catchError((error: Error) => {
        cleanup(`Handler error: ${error.message}`);
        return throwError(() => error);
      }),
      finalize(cleanup),
    );
  }

  private getEffectiveTimeout(context: ExecutionContext): number | null {
    const routeTimeout = this.reflector.get<number | null>(
      REQUEST_TIMEOUT_KEY,
      context.getHandler(),
    );

    // Route timeout takes precedence (even if 0/null)
    if (routeTimeout !== undefined) {
      return routeTimeout;
    }

    // Fall back to global timeout
    return this.options.timeout ?? null;
  }

  private attachAbortController(
    request: RequestWithAbortController,
  ): AbortController {
    const abortController = new AbortController();
    request.abortController = abortController;
    return abortController;
  }

  private setupRequestCleanup(
    request: RequestWithAbortController,
    abortController: AbortController,
  ): (reason?: string) => void {
    const abort = (reason?: string) => {
      if (abortController.signal.aborted) return;

      const abortReason: string =
        reason || this.options.reason || 'Request terminated';

      request.abortReason = abortReason;
      abortController.abort(abortReason);
      this.logAbort('cleanup', request, abortReason);
    };

    const closeHandler = () => abort('Client disconnected');
    const errorHandler = (error: Error) =>
      abort(`Request error: ${error.message}`);

    request.on('close', closeHandler);
    request.on('error', errorHandler);

    return (reason?: string) => {
      abort(reason || '');
      request.off('close', closeHandler);
      request.off('error', errorHandler);
    };
  }

  private createAbortObservable(
    request: RequestWithAbortController,
    abortController: AbortController,
  ): Observable<never> {
    return new Observable<never>((subscriber) => {
      const handler = () => {
        const reason = request.abortReason || 'Request aborted';
        subscriber.error(new RequestTimeoutException(reason));
      };

      abortController.signal.addEventListener('abort', handler);
      return () => abortController.signal.removeEventListener('abort', handler);
    });
  }

  private createTimeoutObservable(
    request: RequestWithAbortController,
    abortController: AbortController,
    effectiveTimeout: number | null,
  ): Observable<never> {
    if (!effectiveTimeout || effectiveTimeout <= 0) {
      return new Observable<never>();
    }

    return timer(effectiveTimeout).pipe(
      mergeMap(() => {
        const reason = `Request timed out after ${effectiveTimeout}ms`;
        request.abortReason = reason;
        abortController.abort(reason);
        this.logAbort('timeout', request, reason);
        return throwError(() => new RequestTimeoutException(reason));
      }),
    );
  }

  private shouldSkipRoute(request: Request): boolean {
    const { skipRoutes = [], skipMethods = [] } = this.options;

    if (skipRoutes.some((route) => request.path.match(new RegExp(route)))) {
      return true;
    }

    if (skipMethods.includes(request.method.toUpperCase())) {
      return true;
    }

    return false;
  }

  private logAbort(type: string, request: Request, reason: string): void {
    if (!this.options.enableLogging) return;

    const message = `[${type.toUpperCase()}] ${request.method} ${request.path} - ${reason}`;

    if (this.options.logger) {
      this.options.logger(message);
    } else {
      this.logger.warn(message);
    }
  }
}
