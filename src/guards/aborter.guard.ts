import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { RequestWithAbortController } from '../interceptors/aborter.interceptor';

/**
 * Guard that prevents route execution if the request has already been aborted.
 *
 * Use this to avoid unnecessary processing when the client has disconnected
 * or the request has timed out.
 */
@Injectable()
export class AborterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAbortController>();

    // Don't proceed if request is already aborted
    if (request.abortController?.signal.aborted) {
      return false;
    }

    return true;
  }
}
