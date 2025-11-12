import {
  RequestTimeout,
  REQUEST_TIMEOUT_KEY,
} from '../../src/decorators/timeout.decorator';
import { Reflector } from '@nestjs/core';
import 'reflect-metadata';

describe('RequestTimeout Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  const getMethodMetadata = <T>(
    prototype: object,
    methodName: string,
  ): T | null => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
    return reflector.get<T | null>(
      REQUEST_TIMEOUT_KEY,
      descriptor?.value as () => string,
    );
  };

  it('should set timeout metadata on method', () => {
    class TestController {
      @RequestTimeout(5000)
      testMethod(): string {
        return 'test';
      }
    }

    const metadata = getMethodMetadata<number>(
      TestController.prototype,
      'testMethod',
    );

    expect(metadata).toBe(5000);
  });

  it('should set timeout to 0 when specified', () => {
    class TestController {
      @RequestTimeout(0)
      testMethod(): string {
        return 'test';
      }
    }

    const metadata = getMethodMetadata<number>(
      TestController.prototype,
      'testMethod',
    );

    expect(metadata).toBe(0);
  });

  it('should set timeout to null when specified', () => {
    class TestController {
      @RequestTimeout(null)
      testMethod(): string {
        return 'test';
      }
    }

    const metadata = getMethodMetadata<number>(
      TestController.prototype,
      'testMethod',
    );

    expect(metadata).toBeNull();
  });

  it('should set different timeouts on different methods', () => {
    class TestController {
      @RequestTimeout(5000)
      fastMethod(): string {
        return 'fast';
      }

      @RequestTimeout(30000)
      slowMethod(): string {
        return 'slow';
      }

      @RequestTimeout(0)
      noTimeoutMethod(): string {
        return 'no timeout';
      }
    }

    expect(
      getMethodMetadata<number>(TestController.prototype, 'fastMethod'),
    ).toBe(5000);
    expect(
      getMethodMetadata<number>(TestController.prototype, 'slowMethod'),
    ).toBe(30000);
    expect(
      getMethodMetadata<number>(TestController.prototype, 'noTimeoutMethod'),
    ).toBe(0);
  });

  it('should export REQUEST_TIMEOUT_KEY constant', () => {
    expect(REQUEST_TIMEOUT_KEY).toBe('aborter:request-timeout');
  });

  it('should work with large timeout values', () => {
    class TestController {
      @RequestTimeout(300000) // 5 minutes
      longRunningMethod(): string {
        return 'long';
      }
    }

    const metadata = getMethodMetadata<number>(
      TestController.prototype,
      'longRunningMethod',
    );

    expect(metadata).toBe(300000);
  });
});
