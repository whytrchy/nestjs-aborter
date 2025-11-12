import { SetMetadata } from '@nestjs/common';

export const REQUEST_TIMEOUT_KEY = 'aborter:request-timeout';

export const RequestTimeout = (timeoutMs: number | null) => {
  return SetMetadata(REQUEST_TIMEOUT_KEY, timeoutMs);
};
