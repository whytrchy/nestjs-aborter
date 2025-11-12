import { Test, TestingModule } from '@nestjs/testing';
import { RequestTimeoutException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { AborterFilter } from '../../src/filters/aborter.filter';

describe('AborterFilter', () => {
  let filter: AborterFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AborterFilter],
    }).compile();

    filter = module.get<AborterFilter>(AborterFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;
    let mockGetResponse: jest.Mock;
    let mockGetRequest: jest.Mock;
    let mockSwitchToHttp: jest.Mock;
    let mockArgumentsHost: ArgumentsHost;

    beforeEach(() => {
      mockJson = jest.fn();
      mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      mockGetResponse = jest.fn().mockReturnValue({
        status: mockStatus,
      });
      mockGetRequest = jest.fn().mockReturnValue({});
      mockSwitchToHttp = jest.fn().mockReturnValue({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      });

      mockArgumentsHost = {
        switchToHttp: mockSwitchToHttp,
        getArgByIndex: jest.fn(),
        getArgs: jest.fn(),
        getType: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      } as ArgumentsHost;
    });

    it('should return 408 status code', () => {
      const exception = new RequestTimeoutException(
        'Request timeout after 5000ms',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(408);
    });

    it('should return correct error response structure', () => {
      const exception = new RequestTimeoutException(
        'Request timeout after 5000ms',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 408,
        message: 'Request timeout after 5000ms',
        error: 'Request Timeout',
      });
    });

    it('should handle exception with custom message', () => {
      const customMessage = 'Custom timeout message';
      const exception = new RequestTimeoutException(customMessage);

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 408,
        message: customMessage,
        error: 'Request Timeout',
      });
    });

    it('should call switchToHttp on ArgumentsHost', () => {
      const exception = new RequestTimeoutException('Request timeout');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSwitchToHttp).toHaveBeenCalled();
    });

    it('should get response from HTTP context', () => {
      const exception = new RequestTimeoutException('Request timeout');

      filter.catch(exception, mockArgumentsHost);

      expect(mockGetResponse).toHaveBeenCalled();
    });

    it('should handle multiple calls correctly', () => {
      const exception1 = new RequestTimeoutException('First timeout');
      const exception2 = new RequestTimeoutException('Second timeout');

      filter.catch(exception1, mockArgumentsHost);
      filter.catch(exception2, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledTimes(2);
      expect(mockJson).toHaveBeenCalledTimes(2);
      expect(mockJson).toHaveBeenNthCalledWith(1, {
        statusCode: 408,
        message: 'First timeout',
        error: 'Request Timeout',
      });
      expect(mockJson).toHaveBeenNthCalledWith(2, {
        statusCode: 408,
        message: 'Second timeout',
        error: 'Request Timeout',
      });
    });

    it('should return consistent error field', () => {
      const exception = new RequestTimeoutException('Any message');

      filter.catch(exception, mockArgumentsHost);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Request Timeout',
        }),
      );
    });

    it('should preserve exception message exactly', () => {
      const messages = [
        'Request timeout after 1000ms',
        'Request timeout after 30000ms',
        'Client disconnected',
        'Custom abort reason',
      ];

      messages.forEach((message) => {
        mockJson.mockClear();
        const exception = new RequestTimeoutException(message);

        filter.catch(exception, mockArgumentsHost);

        expect(mockJson).toHaveBeenCalledWith(
          expect.objectContaining({
            message: message,
          }),
        );
      });
    });
  });

  describe('integration', () => {
    it('should work with real RequestTimeoutException', () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockGetResponse = jest.fn().mockReturnValue({
        status: mockStatus,
      });
      const mockGetRequest = jest.fn().mockReturnValue({});
      const mockSwitchToHttp = jest.fn().mockReturnValue({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      });

      const mockArgumentsHost: ArgumentsHost = {
        switchToHttp: mockSwitchToHttp,
        getArgByIndex: jest.fn(),
        getArgs: jest.fn(),
        getType: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      };

      const exception = new RequestTimeoutException();

      filter.catch(exception, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(408);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 408,
          error: 'Request Timeout',
        }),
      );
    });
  });
});
