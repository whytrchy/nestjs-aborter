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

    it('should handle promise rejection', async () => {
      const promise = Promise.reject(new Error('Promise error'));

      await expect(withAbort(promise)).rejects.toThrow('Promise error');
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
  });
});
