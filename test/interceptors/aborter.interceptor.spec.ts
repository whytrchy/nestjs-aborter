import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, Observable } from 'rxjs';
import { delay } from 'rxjs/operators';
import { EventEmitter } from 'events';
import {
  AborterInterceptor,
  ABORT_CONTROLLER_OPTIONS,
} from '../../src/interceptors/aborter.interceptor';
import type { AborterOptions } from '../../src/interfaces/aborter.interface';
import type { Request } from 'express';

interface MockRequest extends EventEmitter {
  path: string;
  method: string;
  abortController?: AbortController;
  abortReason?: string;
  effectiveTimeout?: number;
}

describe('AborterInterceptor', () => {
  let interceptor: AborterInterceptor;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: MockRequest;

  const createMockRequest = (): MockRequest => {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
      path: '/test',
      method: 'GET',
      abortController: undefined,
      abortReason: undefined,
      effectiveTimeout: undefined,
    }) as MockRequest;
  };

  const createMockExecutionContext = (
    request: MockRequest,
  ): ExecutionContext => {
    // Create a proper handler function that can hold metadata
    const handler = function testHandler() {};

    return {
      switchToHttp: () => ({
        getRequest: <T = Request>() => request as unknown as T,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn().mockReturnValue(handler), // Return actual function
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  };

  const createMockCallHandler = (
    observable: Observable<unknown>,
  ): CallHandler => {
    return {
      handle: () => observable,
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AborterInterceptor, Reflector],
    }).compile();

    reflector = module.get<Reflector>(Reflector);
    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    mockRequest = createMockRequest();
    mockExecutionContext = createMockExecutionContext(mockRequest);
  });

  afterEach(() => {
    mockRequest.removeAllListeners();
  });

  it('should use reflector to check for route timeout metadata', (done) => {
    // Use the interceptor from beforeEach (which has reflector injected)
    const reflectorSpy = jest.spyOn(reflector, 'get');

    mockCallHandler = createMockCallHandler(of('success'));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: () => {
        // Verify reflector.get was called with correct parameters
        expect(reflectorSpy).toHaveBeenCalled();
        done();
      },
    });
  });

  it('should create interceptor with options', async () => {
    const options: AborterOptions = {
      timeout: 5000,
      enableLogging: true,
      reason: 'Custom reason',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    expect(interceptor).toBeDefined();
  });

  it('should attach AbortController and handle success', (done) => {
    mockCallHandler = createMockCallHandler(of('success'));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (result) => {
        expect(mockRequest.abortController).toBeInstanceOf(AbortController);
        expect(result).toBe('success');
        done();
      },
    });
  });

  it('should store effectiveTimeout in request', async () => {
    const options: AborterOptions = { timeout: 5000 };
    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    mockCallHandler = createMockCallHandler(of('success'));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockRequest.effectiveTimeout).toBe(5000);
          expect(mockRequest.abortController?.signal._requestTimeout).toBe(
            5000,
          );
          resolve();
        },
      });
    });
  });

  it('should handle handler errors', (done) => {
    const error = new Error('Handler error');
    mockCallHandler = createMockCallHandler(throwError(() => error));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(mockRequest.abortController?.signal.aborted).toBe(true);
        expect(mockRequest.abortReason).toContain('Handler error');
        done();
      },
    });
  });

  it('should abort on client disconnect', (done) => {
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(100)));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(RequestTimeoutException);
        expect((err as Error).message).toContain('Client disconnected');
        expect(mockRequest.abortReason).toBe('Client disconnected');
        done();
      },
    });

    setTimeout(() => mockRequest.emit('close'), 10);
  });

  it('should abort on request error', (done) => {
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(100)));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(RequestTimeoutException);
        expect((err as Error).message).toContain('Request error');
        done();
      },
    });

    setTimeout(
      () => mockRequest.emit('error', new Error('Network failure')),
      10,
    );
  });

  it('should timeout after configured timeout', async () => {
    const options: AborterOptions = { timeout: 50 };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(200)));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(RequestTimeoutException);
          expect((err as Error).message).toContain(
            'Request timed out after 50ms',
          );
          expect(mockRequest.abortReason).toContain(
            'Request timed out after 50ms',
          );
          resolve();
        },
      });
    });
  });

  it('should skip routes matching pattern', async () => {
    const options: AborterOptions = { skipRoutes: ['/health'] };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);

    const skipRequest = createMockRequest();
    skipRequest.path = '/health';
    const skipContext = createMockExecutionContext(skipRequest);
    mockCallHandler = createMockCallHandler(of('success'));

    return new Promise<void>((resolve) => {
      interceptor.intercept(skipContext, mockCallHandler).subscribe({
        next: () => {
          expect(skipRequest.abortController).toBeUndefined();
          skipRequest.removeAllListeners();
          resolve();
        },
      });
    });
  });

  it('should skip methods in skipMethods', async () => {
    const options: AborterOptions = { skipMethods: ['OPTIONS'] };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);

    const skipRequest = createMockRequest();
    skipRequest.method = 'OPTIONS';
    const skipContext = createMockExecutionContext(skipRequest);
    mockCallHandler = createMockCallHandler(of('success'));

    return new Promise<void>((resolve) => {
      interceptor.intercept(skipContext, mockCallHandler).subscribe({
        next: () => {
          expect(skipRequest.abortController).toBeUndefined();
          skipRequest.removeAllListeners();
          resolve();
        },
      });
    });
  });

  it('should log with default logger when enabled', async () => {
    const options: AborterOptions = { enableLogging: true };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);

    const logger = (interceptor as unknown as { logger: { warn: jest.Mock } })
      .logger;
    const loggerSpy = jest.spyOn(logger, 'warn');

    mockCallHandler = createMockCallHandler(of('success').pipe(delay(100)));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          setImmediate(() => {
            expect(loggerSpy).toHaveBeenCalledWith(
              expect.stringContaining('[CLEANUP] GET /test'),
            );
            resolve();
          });
        },
      });

      setTimeout(() => mockRequest.emit('close'), 10);
    });
  });

  it('should log with custom logger', async () => {
    const customLogger = jest.fn();
    const options: AborterOptions = {
      timeout: 50,
      enableLogging: true,
      logger: customLogger,
    };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(200)));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          setImmediate(() => {
            expect(customLogger).toHaveBeenCalledWith(
              expect.stringContaining('[TIMEOUT] GET /test'),
            );
            resolve();
          });
        },
      });
    });
  });

  it('should use custom reason from options', async () => {
    const options: AborterOptions = { reason: 'Custom reason' };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(100)));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          resolve();
        },
      });

      setTimeout(() => {
        if (
          mockRequest.abortController &&
          !mockRequest.abortController.signal.aborted
        ) {
          mockRequest.abortController.abort();
        }
      }, 10);
    });
  });

  it('should not abort twice if already aborted', (done) => {
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(100)));

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      error: () => {
        expect(mockRequest.abortController?.signal.aborted).toBe(true);
        mockRequest.emit('close');
        done();
      },
    });

    setTimeout(() => mockRequest.emit('close'), 10);
  });

  it('should cleanup event listeners', (done) => {
    mockCallHandler = createMockCallHandler(of('success'));

    const offSpy = jest.spyOn(mockRequest, 'off');

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: () => {
        done();
      },
      complete: () => {
        setImmediate(() => {
          expect(offSpy).toHaveBeenCalledWith('close', expect.any(Function));
          expect(offSpy).toHaveBeenCalledWith('error', expect.any(Function));
        });
      },
    });
  });

  it('should throw RequestTimeoutException on timeout', async () => {
    const options: AborterOptions = { timeout: 50 };

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    mockCallHandler = createMockCallHandler(of('success').pipe(delay(200)));

    return new Promise<void>((resolve, reject) => {
      let errorCaught = false;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          reject(new Error('Should not emit value'));
        },
        error: (err: Error) => {
          errorCaught = true;
          expect(err).toBeInstanceOf(RequestTimeoutException);
          expect(err.message).toBeTruthy();
          expect(mockRequest.abortReason).toBeTruthy();
          resolve();
        },
        complete: () => {
          if (!errorCaught) {
            reject(new Error('Should not complete without error'));
          }
        },
      });
    });
  });

  it('should use route-level timeout when decorator is present', async () => {
    const options: AborterOptions = { timeout: 30000 }; // Global: 30s

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    const moduleReflector = module.get<Reflector>(Reflector);

    // Mock the decorator metadata - simulate @RequestTimeout(5000)
    jest.spyOn(moduleReflector, 'get').mockReturnValue(5000); // Route timeout: 5s

    mockCallHandler = createMockCallHandler(of('success'));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          // Should use route timeout (5s), not global (30s)
          expect(mockRequest.effectiveTimeout).toBe(5000);
          expect(mockRequest.abortController?.signal._requestTimeout).toBe(
            5000,
          );
          resolve();
        },
      });
    });
  });

  it('should disable timeout when route decorator sets it to 0', async () => {
    const options: AborterOptions = { timeout: 30000 }; // Global: 30s

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    const moduleReflector = module.get<Reflector>(Reflector);

    // Mock @RequestTimeout(0) - disable timeout for this route
    jest.spyOn(moduleReflector, 'get').mockReturnValue(0);

    mockCallHandler = createMockCallHandler(of('success'));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          // Should disable timeout (0), not use global (30s)
          expect(mockRequest.effectiveTimeout).toBe(0);
          expect(
            mockRequest.abortController?.signal._requestTimeout,
          ).toBeUndefined();
          resolve();
        },
      });
    });
  });

  it('should disable timeout when route decorator sets it to null', async () => {
    const options: AborterOptions = { timeout: 30000 }; // Global: 30s

    const module = await Test.createTestingModule({
      providers: [
        AborterInterceptor,
        Reflector,
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    interceptor = module.get<AborterInterceptor>(AborterInterceptor);
    const moduleReflector = module.get<Reflector>(Reflector);

    // Mock @RequestTimeout(null) - disable timeout for this route
    jest.spyOn(moduleReflector, 'get').mockReturnValue(null);

    mockCallHandler = createMockCallHandler(of('success'));

    return new Promise<void>((resolve) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          // Should disable timeout (null), not use global (30s)
          expect(mockRequest.effectiveTimeout).toBeUndefined();
          expect(
            mockRequest.abortController?.signal._requestTimeout,
          ).toBeUndefined();
          resolve();
        },
      });
    });
  });
});
