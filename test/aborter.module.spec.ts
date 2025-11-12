import { Test } from '@nestjs/testing';
import { AborterModule } from '../src/aborter.module';
import { ABORT_CONTROLLER_OPTIONS } from '../src/interceptors/aborter.interceptor';
import { AborterOptions } from '../src/interfaces/aborter.interface';
import { Module } from '@nestjs/common';

describe('AborterModule', () => {
  describe('forRoot', () => {
    it('should provide default options', async () => {
      const module = await Test.createTestingModule({
        imports: [AborterModule.forRoot()],
      }).compile();

      const options = module.get<AborterOptions>(ABORT_CONTROLLER_OPTIONS);
      expect(options).toEqual({});
    });

    it('should provide custom options', async () => {
      const customOptions: AborterOptions = {
        timeout: 5000,
        enableLogging: true,
      };

      const module = await Test.createTestingModule({
        imports: [AborterModule.forRoot(customOptions)],
      }).compile();

      const options = module.get<AborterOptions>(ABORT_CONTROLLER_OPTIONS);
      expect(options).toEqual(customOptions);
    });

    it('should provide all configuration options', async () => {
      const customOptions: AborterOptions = {
        timeout: 10000,
        reason: 'Custom abort',
        enableLogging: true,
        skipRoutes: ['^/health$', '^/metrics$'],
        skipMethods: ['OPTIONS', 'HEAD'],
      };

      const module = await Test.createTestingModule({
        imports: [AborterModule.forRoot(customOptions)],
      }).compile();

      const options = module.get<AborterOptions>(ABORT_CONTROLLER_OPTIONS);
      expect(options).toEqual(customOptions);
    });
  });

  describe('forRootAsync', () => {
    it('should provide options from factory', async () => {
      const customOptions: AborterOptions = {
        timeout: 3000,
        skipRoutes: ['/health'],
      };

      const module = await Test.createTestingModule({
        imports: [
          AborterModule.forRootAsync({
            useFactory: () => customOptions,
          }),
        ],
      }).compile();

      const options = module.get<AborterOptions>(ABORT_CONTROLLER_OPTIONS);
      expect(options).toEqual(customOptions);
    });

    it('should inject dependencies into factory', async () => {
      class ConfigService {
        getTimeout(): number {
          return 10000;
        }

        getSkipRoutes(): string[] {
          return ['^/health$', '^/metrics$'];
        }
      }

      // Create a config module that provides ConfigService
      @Module({
        providers: [ConfigService],
        exports: [ConfigService],
      })
      class ConfigModule {}

      const module = await Test.createTestingModule({
        imports: [
          ConfigModule,
          AborterModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
              timeout: config.getTimeout(),
              skipRoutes: config.getSkipRoutes(),
              enableLogging: true,
            }),
            inject: [ConfigService],
          }),
        ],
      }).compile();

      const options = module.get<AborterOptions>(ABORT_CONTROLLER_OPTIONS);
      expect(options).toEqual({
        timeout: 10000,
        skipRoutes: ['^/health$', '^/metrics$'],
        enableLogging: true,
      });
    });

    it('should support async factory functions', async () => {
      const customOptions: AborterOptions = {
        timeout: 5000,
        enableLogging: false,
      };

      const module = await Test.createTestingModule({
        imports: [
          AborterModule.forRootAsync({
            useFactory: async () => {
              // Simulate async config loading
              await new Promise((resolve) => setTimeout(resolve, 10));
              return customOptions;
            },
          }),
        ],
      }).compile();

      const options = module.get<AborterOptions>(ABORT_CONTROLLER_OPTIONS);
      expect(options).toEqual(customOptions);
    });
  });
});
