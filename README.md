<div align="center">

<a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>

# nestjs-aborter

**Automatic request cancellation and timeout handling for NestJS**

[![npm version](https://img.shields.io/npm/v/nestjs-aborter.svg)](https://www.npmjs.com/package/nestjs-aborter)
[![npm downloads](https://img.shields.io/npm/dm/nestjs-aborter.svg)](https://www.npmjs.com/package/nestjs-aborter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/whytrchy/nestjs-aborter/release.yml?branch=main)](https://github.com/whytrchy/nestjs-aborter/actions)
[![Release](https://github.com/whytrchy/nestjs-aborter/actions/workflows/release.yml/badge.svg)](https://github.com/whytrchy/nestjs-aborter/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/whytrchy/nestjs-aborter/branch/main/graph/badge.svg)](https://codecov.io/gh/whytrchy/nestjs-aborter)
[![Maintainability](https://qlty.sh/gh/whytrchy/projects/nestjs-aborter/maintainability.svg)](https://qlty.sh/gh/whytrchy/projects/nestjs-aborter)
[![semantic-release: conventionalcommits](https://img.shields.io/badge/semantic--release-conventionalcommits-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![Known Vulnerabilities](https://snyk.io/test/github/whytrchy/nestjs-aborter/badge.svg)](https://snyk.io/test/github/whytrchy/nestjs-aborter)

Stop wasting resources on abandoned requests. Automatically cancel operations when clients disconnect or requests timeout.

</div>

---

## Why This Package?

When clients disconnect or requests timeout, your server continues processing—wasting CPU, memory, and database connections. This package automatically detects these scenarios and cancels ongoing operations, improving resource efficiency and performance under load.

**Key Features:**

- ✅ Automatic AbortController injection on every request
- ✅ Multi-level timeout control (global, per-endpoint, per-operation)
- ✅ Client disconnect detection
- ✅ Zero dependencies, full TypeScript support

## Installation

```bash
npm install nestjs-aborter
```

## Quick Start

### 1. Setup Module

Register the module globally and add the interceptor:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AborterModule, AborterInterceptor } from 'nestjs-aborter';

@Module({
  imports: [
    AborterModule.forRoot({
      timeout: 30000, // Global 30s timeout
      skipRoutes: ['/health'], // Optional: skip specific routes
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AborterInterceptor,
    },
  ],
})
export class AppModule {}
```

### 2. Use in Controllers

Inject the `AbortSignal` into your route handlers and pass it to operations:

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { AborterSignal, withAbort, RequestTimeout } from 'nestjs-aborter';

@Controller('users')
export class UserController {
  @Get()
  async findAll(@AborterSignal() signal: AbortSignal) {
    // Pass signal to external APIs
    const response = await fetch('https://api.example.com/users', { signal });
    return response.json();
  }

  @Post()
  @RequestTimeout(10000) // Override global timeout for this endpoint
  async create(
    @Body() dto: CreateUserDto,
    @AborterSignal() signal: AbortSignal,
  ) {
    // Wrap promises that don't natively support AbortSignal
    return withAbort(this.userService.create(dto), signal);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @AborterSignal() signal: AbortSignal) {
    // Set timeout for specific operations
    return withAbort(this.userService.findById(id), signal, { timeout: 5000 });
  }
}
```

## Configuration Options

```typescript
AborterModule.forRoot({
  timeout: 30000, // Global timeout in milliseconds (optional)
  reason: 'Request cancelled', // Custom abort reason
  enableLogging: true, // Log abort events for debugging
  skipRoutes: ['^/health$'], // Regex patterns for routes to skip
  skipMethods: ['OPTIONS'], // HTTP methods to skip
});
```

**Async configuration** with dependency injection:

```typescript
AborterModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    timeout: config.get('REQUEST_TIMEOUT'),
  }),
});
```

## Timeout Hierarchy

Timeouts are applied in priority order, with more specific timeouts overriding general ones:

```typescript
// 1. Global timeout (set in module config)
AborterModule.forRoot({ timeout: 30000 })

// 2. Endpoint timeout (overrides global)
@Get() @RequestTimeout(10000) handler() {}

// 3. Operation timeout (overrides both)
withAbort(promise, signal, { timeout: 5000 })
```

**Example combining all three levels:**

```typescript
@Get('dashboard')
@RequestTimeout(15000) // Max 15s for entire endpoint
async getDashboard(@AborterSignal() signal: AbortSignal) {
  // This operation has max 2s
  const quick = await withAbort(this.fastApi(), signal, { timeout: 2000 });

  // This operation has max 8s
  const slow = await withAbort(this.slowApi(), signal, { timeout: 8000 });

  return { quick, slow };
}
```

## API Reference

### Decorators

**`@AborterSignal()`** - Injects the `AbortSignal` for the current request

```typescript
async handler(@AborterSignal() signal: AbortSignal) { }
```

**`@RequestTimeout(milliseconds)`** - Overrides the global timeout for a specific endpoint

```typescript
@Get()
@RequestTimeout(5000) // 5 second timeout
async handler() { }

@Post('upload')
@RequestTimeout(null) // Disable timeout entirely
async upload() { }
```

**`@AborterReason()`** - Injects the abort reason if the request was aborted

```typescript
async handler(@AborterReason() reason?: string) { }
```

### Utilities

**`withAbort<T>(promise, signal?, options?)`** - Wraps any promise with abort capability

```typescript
// Basic usage
await withAbort(someOperation(), signal);

// With custom timeout
await withAbort(someOperation(), signal, { timeout: 3000 });
```

**`AbortError`** - Error thrown when operations are aborted

```typescript
try {
  await withAbort(operation(), signal);
} catch (error) {
  if (error instanceof AbortError) {
    console.log('Aborted:', error.message);
  }
}
```

### Guards & Filters

**`AborterGuard`** - Prevents execution if the request is already aborted

```typescript
@UseGuards(AborterGuard)
export class ApiController {}
```

**`AborterFilter`** - Handles timeout exceptions and returns proper HTTP status codes

```typescript
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AborterFilter },
  ],
})
```

Returns:

- **408 Request Timeout** when operation exceeds timeout
- **499 Client Closed Request** when client disconnects

## Common Patterns

### External API Calls

Pass the signal to any HTTP client that supports it:

```typescript
await fetch(url, { signal });
await axios.get(url, { signal });
```

### Database Operations

Wrap database queries to prevent wasted resources:

```typescript
async findById(id: string, signal: AbortSignal) {
  return withAbort(
    this.prisma.user.findUnique({ where: { id } }),
    signal,
    { timeout: 3000 }
  );
}
```

### Parallel Operations

All operations abort together when timeout is reached:

```typescript
@Get('dashboard')
async getDashboard(@AborterSignal() signal: AbortSignal) {
  return Promise.all([
    withAbort(this.userService.getUsers(), signal),
    withAbort(this.postService.getPosts(), signal),
  ]);
}
```

### Request-Scoped Services

Access the signal without manually passing it through service layers:

```typescript
@Injectable({ scope: Scope.REQUEST })
export class DataService {
  constructor(@Inject(REQUEST) private request: RequestWithAbortController) {}

  async process() {
    const signal = this.request.abortController.signal;
    return withAbort(this.heavyOperation(), signal);
  }
}
```

Useful when you have deep service chains and don't want to pass the signal manually.

## Testing

```typescript
it('should handle aborted requests', async () => {
  const controller = new AbortController();
  controller.abort();

  await expect(userController.findAll(controller.signal)).rejects.toThrow(
    AbortError,
  );
});
```

## Best Practices

- ✅ Always pass the signal to external API calls and long-running operations
- ✅ Use `withAbort()` for promises that don't natively support AbortSignal
- ✅ Set global timeout as a safety net, endpoint timeouts for specific routes, and operation timeouts for critical calls
- ✅ Skip health checks and monitoring endpoints in configuration to reduce overhead
- ✅ Use `AborterFilter` for consistent error handling

## License

MIT © [whytrchy](https://github.com/whytrchy)

---

[GitHub](https://github.com/whytrchy/nestjs-aborter) • [Issues](https://github.com/whytrchy/nestjs-aborter/issues) • [npm](https://www.npmjs.com/package/nestjs-aborter)
