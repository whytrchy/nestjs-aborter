import { ExecutionContext } from '@nestjs/common';
import {
  aborterSignalFactory,
  aborterReasonFactory,
} from '../../src/decorators/aborter.decorator';
import { RequestWithAbortController } from '../../src/interceptors/aborter.interceptor';

describe('Aborter Decorators', () => {
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

  describe('aborterSignalFactory', () => {
    it('should extract abort signal from request', () => {
      const abortController = new AbortController();
      const mockRequest: Partial<RequestWithAbortController> = {
        abortController,
      };
      const mockContext = createMockContext(mockRequest);

      const signal = aborterSignalFactory(undefined, mockContext);

      expect(signal).toBe(abortController.signal);
    });

    it('should return undefined when abort controller is not present', () => {
      const mockRequest: Partial<RequestWithAbortController> = {};
      const mockContext = createMockContext(mockRequest);

      const signal = aborterSignalFactory(undefined, mockContext);

      expect(signal).toBeUndefined();
    });

    it('should return undefined when abortController is undefined', () => {
      const mockRequest: Partial<RequestWithAbortController> = {
        abortController: undefined,
      };
      const mockContext = createMockContext(mockRequest);

      const signal = aborterSignalFactory(undefined, mockContext);

      expect(signal).toBeUndefined();
    });

    it('should return signal that can be aborted', () => {
      const abortController = new AbortController();
      const mockRequest: Partial<RequestWithAbortController> = {
        abortController,
      };
      const mockContext = createMockContext(mockRequest);

      const signal = aborterSignalFactory(undefined, mockContext);

      expect(signal?.aborted).toBe(false);

      abortController.abort();

      expect(signal?.aborted).toBe(true);
    });
  });

  describe('aborterReasonFactory', () => {
    it('should extract abort reason from request', () => {
      const mockRequest: Partial<RequestWithAbortController> = {
        abortReason: 'Request timeout after 5000ms',
      };
      const mockContext = createMockContext(mockRequest);

      const reason = aborterReasonFactory(undefined, mockContext);

      expect(reason).toBe('Request timeout after 5000ms');
    });

    it('should return undefined when abort reason is not present', () => {
      const mockRequest: Partial<RequestWithAbortController> = {};
      const mockContext = createMockContext(mockRequest);

      const reason = aborterReasonFactory(undefined, mockContext);

      expect(reason).toBeUndefined();
    });

    it('should return correct reason for client disconnect', () => {
      const mockRequest: Partial<RequestWithAbortController> = {
        abortReason: 'Client disconnected',
      };
      const mockContext = createMockContext(mockRequest);

      const reason = aborterReasonFactory(undefined, mockContext);

      expect(reason).toBe('Client disconnected');
    });

    it('should return correct reason for request error', () => {
      const mockRequest: Partial<RequestWithAbortController> = {
        abortReason: 'Request error: Network failure',
      };
      const mockContext = createMockContext(mockRequest);

      const reason = aborterReasonFactory(undefined, mockContext);

      expect(reason).toBe('Request error: Network failure');
    });
  });

  describe('Integration scenarios', () => {
    it('should work together when request is aborted', () => {
      const abortController = new AbortController();
      abortController.abort('User cancelled request');

      const mockRequest: Partial<RequestWithAbortController> = {
        abortController,
        abortReason: 'User cancelled request',
      };
      const mockContext = createMockContext(mockRequest);

      const signal = aborterSignalFactory(undefined, mockContext);
      const reason = aborterReasonFactory(undefined, mockContext);

      expect(signal?.aborted).toBe(true);
      expect(reason).toBe('User cancelled request');
    });

    it('should work together when request is not aborted', () => {
      const abortController = new AbortController();

      const mockRequest: Partial<RequestWithAbortController> = {
        abortController,
      };
      const mockContext = createMockContext(mockRequest);

      const signal = aborterSignalFactory(undefined, mockContext);
      const reason = aborterReasonFactory(undefined, mockContext);

      expect(signal?.aborted).toBe(false);
      expect(reason).toBeUndefined();
    });
  });
});
