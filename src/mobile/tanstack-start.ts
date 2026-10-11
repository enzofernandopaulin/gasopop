type AnyFn = (...args: any[]) => any;

export function useServerFn<T extends AnyFn>(fn: T): T {
  return fn;
}

export function createServerFn() {
  const definition: any = {
    middleware() {
      return definition;
    },
    inputValidator() {
      return definition;
    },
    handler(fn: AnyFn) {
      return fn;
    },
  };
  return definition;
}

export function createMiddleware() {
  return {
    server(fn: AnyFn) {
      return fn;
    },
  };
}

export function createStart() {
  return {};
}

export function createCsrfMiddleware() {
  return () => undefined;
}
