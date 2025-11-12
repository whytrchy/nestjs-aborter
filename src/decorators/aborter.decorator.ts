import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithAbortController } from '../interceptors/aborter.interceptor';

/**
 * Factory function to extract AbortSignal from request
 */
export const aborterSignalFactory = (
  _data: unknown,
  ctx: ExecutionContext,
): globalThis.AbortSignal | undefined => {
  const request = ctx.switchToHttp().getRequest<RequestWithAbortController>();
  return request.abortController?.signal;
};

/**
 * Factory function to extract abort reason from request
 */
export const aborterReasonFactory = (
  _data: unknown,
  ctx: ExecutionContext,
): string | undefined => {
  const request = ctx.switchToHttp().getRequest<RequestWithAbortController>();
  return request.abortReason;
};

/**
 * Injects the AbortSignal from the current HTTP request.
 *
 * Use this to cancel operations when the client disconnects,
 * a timeout is reached, or an error occurs.
 */
export const AborterSignal = createParamDecorator(aborterSignalFactory);

/**
 * Injects the abort reason from the current HTTP request.
 *
 * Returns why the request was aborted (e.g., timeout, client disconnect, error).
 */
export const AborterReason = createParamDecorator(aborterReasonFactory);
