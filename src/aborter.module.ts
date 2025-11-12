import {
  DynamicModule,
  Module,
  Global,
  Type,
  ForwardReference,
} from '@nestjs/common';
import type { AborterOptions } from './interfaces/aborter.interface';
import { ABORT_CONTROLLER_OPTIONS } from './interceptors/aborter.interceptor';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';

/**
 * Global module for configuring the Aborter interceptor.
 *
 * Import this module in your root AppModule to enable
 * automatic request cancellation and timeout handling.
 */
@Global()
@Module({})
export class AborterModule {
  /**
   * Configure the module with static options.
   *
   * @param options - Configuration options for the Aborter interceptor
   * @returns Dynamic module configuration
   */
  static forRoot(options: AborterOptions = {}): DynamicModule {
    return {
      module: AborterModule,
      providers: [
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useValue: options,
        },
      ],
      exports: [ABORT_CONTROLLER_OPTIONS],
    };
  }

  /**
   * Configure the module asynchronously with a factory function.
   * Useful for loading configuration from ConfigService or other providers.
   *
   * @param options - Async configuration options
   * @returns Dynamic module configuration
   */
  static forRootAsync(options: {
    useFactory: (
      ...args: unknown[]
    ) => Promise<AborterOptions> | AborterOptions;
    inject?: Array<InjectionToken | OptionalFactoryDependency>;
    imports?: Array<
      Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference
    >;
  }): DynamicModule {
    return {
      module: AborterModule,
      imports: options.imports || [],
      providers: [
        {
          provide: ABORT_CONTROLLER_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [ABORT_CONTROLLER_OPTIONS],
    };
  }
}
