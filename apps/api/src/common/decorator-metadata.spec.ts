import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

// Canary for the SWC transform: Nest DI relies on `emitDecoratorMetadata`, which
// Vitest's default esbuild transform strips. If this fails, decorator metadata
// is not being emitted and DI would silently break at runtime.
@Injectable()
class Sample {
  constructor(readonly clock: Date) {}
}

describe('swc decorator metadata', () => {
  it('emits design:paramtypes for decorated classes', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', Sample) as unknown[] | undefined;
    expect(paramTypes).toBeDefined();
    expect(paramTypes?.[0]).toBe(Date);
  });
});
