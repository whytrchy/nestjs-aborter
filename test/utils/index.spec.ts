import { withAbort, AbortError } from '../../src/utils';

describe('Aborter Utils', () => {
  describe('AbortError', () => {
    it('should create error with default message', () => {
      const error = new AbortError();
      expect(error.message).toBe('Operation aborted');
      expect(error.name).toBe('AbortError');
    });

    it('should create error with custom message', () => {
      const error = new AbortError('Custom abort reason');
      expect(error.message).toBe('Custom abort reason');
      expect(error.name).toBe('AbortError');
    });

    it('should be an instance of Error', () => {
      const error = new AbortError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AbortError);
    });
  });

  describe('withAbort', () => {
    it('should resolve promise normally without signal', async () => {
      const promise = Promise.resolve('success');
      const result = await withAbort(promise);
      expect(result).toBe('success');
    });

    it('should reject immediately if signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort('Already aborted');
      const promise = Promise.resolve('success');

      await expect(withAbort(promise, abortController.signal)).rejects.toThrow(
        AbortError,
      );
    });

    it('should abort promise when signal is aborted', async () => {
      const abortController = new AbortController();
      const promise = new Promise((resolve) => setTimeout(resolve, 1000));

      setTimeout(() => abortController.abort('Abort requested'), 50);

      await expect(withAbort(promise, abortController.signal)).rejects.toThrow(
        'Abort requested',
      );
    });

    it('should timeout promise when timeout option is provided', async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 1000));

      await expect(
        withAbort(promise, undefined, { timeout: 50 }),
      ).rejects.toThrow('Operation timed out after 50ms');
    });

    it('should resolve before timeout', async () => {
      const promise = Promise.resolve('quick success');

      const result = await withAbort(promise, undefined, { timeout: 1000 });
      expect(result).toBe('quick success');
    });

    it('should handle promise rejection', async () => {
      const promise = Promise.reject(new Error('Promise error'));

      await expect(withAbort(promise)).rejects.toThrow('Promise error');
    });

    it('should cleanup timeout on abort', async () => {
      const abortController = new AbortController();
      const promise = new Promise((resolve) => setTimeout(resolve, 1000));

      const abortPromise = withAbort(promise, abortController.signal, {
        timeout: 2000,
      });

      setTimeout(() => abortController.abort(), 50);

      await expect(abortPromise).rejects.toThrow(AbortError);
    });

    it('should not settle multiple times', async () => {
      const abortController = new AbortController();
      const promise = new Promise((resolve) =>
        setTimeout(() => resolve('done'), 200),
      );

      const abortPromise = withAbort(promise, abortController.signal, {
        timeout: 50,
      });

      await expect(abortPromise).rejects.toThrow(
        'Operation timed out after 50ms',
      );
    });

    it('should work with both signal and timeout', async () => {
      const abortController = new AbortController();
      const promise = new Promise((resolve) => setTimeout(resolve, 1000));

      const abortPromise = withAbort(promise, abortController.signal, {
        timeout: 50,
      });

      await expect(abortPromise).rejects.toThrow(
        'Operation timed out after 50ms',
      );
    });
  });
});
