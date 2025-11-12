import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  RequestTimeoutException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Exception filter that handles RequestTimeoutException thrown by AborterInterceptor.
 * Returns a clean 408 Request Timeout response without logging stack traces.
 */
@Catch(RequestTimeoutException)
export class AborterFilter implements ExceptionFilter {
  catch(exception: RequestTimeoutException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(408).json({
      statusCode: 408,
      message: exception.message,
      error: 'Request Timeout',
    });
  }
}
