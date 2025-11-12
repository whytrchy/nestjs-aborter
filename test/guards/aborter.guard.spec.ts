import { ExecutionContext } from '@nestjs/common';
import { AborterGuard } from '../../src/guards/aborter.guard';
import { RequestWithAbortController } from '../../src/interceptors/aborter.interceptor';

describe('AborterGuard', () => {
  let guard: AborterGuard;

  const createMockContext = (
    request: Partial<RequestWithAbortController>,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    }) as ExecutionContext;

  beforeEach(() => {
    guard = new AborterGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow activation when request is not aborted', () => {
    const abortController = new AbortController();
    const mockRequest: Partial<RequestWithAbortController> = {
      abortController,
    };
    const mockContext = createMockContext(mockRequest);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it('should prevent activation when request is aborted', () => {
    const abortController = new AbortController();
    abortController.abort('Request cancelled');
    const mockRequest: Partial<RequestWithAbortController> = {
      abortController,
    };
    const mockContext = createMockContext(mockRequest);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  it('should allow activation when abort controller is not present', () => {
    const mockRequest: Partial<RequestWithAbortController> = {};
    const mockContext = createMockContext(mockRequest);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it('should allow activation when abort controller is undefined', () => {
    const mockRequest: Partial<RequestWithAbortController> = {
      abortController: undefined,
    };
    const mockContext = createMockContext(mockRequest);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it('should check abort status at execution time', () => {
    const abortController = new AbortController();
    const mockRequest: Partial<RequestWithAbortController> = {
      abortController,
    };
    const mockContext = createMockContext(mockRequest);

    // First check - not aborted
    expect(guard.canActivate(mockContext)).toBe(true);

    // Abort the request
    abortController.abort('Test abort');

    // Second check - now aborted
    expect(guard.canActivate(mockContext)).toBe(false);
  });
});
