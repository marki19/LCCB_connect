import { router, useSegments, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ErrorUtils } from 'react-native';

export type CapturedError = {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  route: string;
  errorType: 'navigation' | 'api' | 'runtime' | 'async';
  context?: Record<string, any>;
};

const MAX_ERRORS = 100;
let errorListeners: Set<(error: CapturedError) => void> = new Set();
let errorQueue: CapturedError[] = [];

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function captureError(error: CapturedError): void {
  const fullError = { 
    ...error, 
    id: generateId(), 
    timestamp: Date.now(),
    stack: error.stack || 'No stack trace available'
  };
  errorQueue.unshift(fullError);
  if (errorQueue.length > MAX_ERRORS) {
    errorQueue.shift();
  }
  errorListeners.forEach(listener => listener(fullError));
  if (__DEV__) {
    console.log('[Error captured]', fullError);
  }
}

export function useErrorCapture() {
  const pathname = usePathname();
  const segments = useSegments();
  
  useEffect(() => {
    const originalErrorHandler = ErrorUtils.getGlobalHandler?.();
    
    ErrorUtils.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      captureError({
        id: generateId(),
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack,
        route: pathname,
        errorType: 'runtime',
        context: { isFatal, segments: segments.join('/') }
      });
      
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });
    
    // Handle unhandled promise rejections
    const rejectionHandler = (event: any) => {
      const reason = event.reason;
      captureError({
        id: generateId(),
        timestamp: Date.now(),
        message: String(reason),
        stack: typeof reason === 'object' && reason !== null && 'stack' in reason 
          ? (reason as any).stack 
          : undefined,
        route: pathname,
        errorType: 'async',
        context: { segments: segments.join('/') }
      });
    };
    
    // Add listener for unhandledrejection
    const hasAddEventListener = typeof (globalThis as any).addEventListener === 'function';
    if (hasAddEventListener) {
      (globalThis as any).addEventListener('unhandledrejection', rejectionHandler);
    }
    
    return () => {
      if (originalErrorHandler) {
        ErrorUtils.setGlobalHandler?.(originalErrorHandler);
      }
      if (hasAddEventListener) {
        (globalThis as any).removeEventListener('unhandledrejection', rejectionHandler);
      }
    };
  }, [pathname, segments]);
  
  return {
    capture: (error: Error | string, context?: Record<string, any>, type: 'navigation' | 'api' | 'runtime' = 'runtime') => {
      const message = typeof error === 'string' ? error : error.message;
      const stack = typeof error === 'string' ? undefined : (error as Error).stack;
      
      captureError({
        id: generateId(),
        timestamp: Date.now(),
        message,
        stack,
        route: pathname,
        errorType: type,
        context
      });
    }
  };
}

export function subscribeToErrors(listener: (error: CapturedError) => void): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

export function getCapturedErrors(): CapturedError[] {
  return [...errorQueue];
}

export function clearCapturedErrors(): void {
  errorQueue = [];
}

export function withCapture<T extends (...args: any[]) => any>(
  fn: T,
  context?: Record<string, any>
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error: Error | any) => {
          captureError({
            id: generateId(),
            timestamp: Date.now(),
            message: error.message || String(error),
            stack: error.stack,
            route: (router as any).pathname || 'unknown',
            errorType: 'navigation',
            context: { ...context, args: JSON.stringify(args) }
          });
          throw error;
        }) as ReturnType<T>;
      }
      return result;
    } catch (error) {
      captureError({
        id: generateId(),
        timestamp: Date.now(),
        message: (error as Error).message || String(error),
        stack: (error as Error).stack,
        route: (router as any).pathname || 'unknown',
        errorType: 'navigation',
        context
      });
      throw error;
    }
  }) as T;
}

export const safeNav = {
  push: withCapture((href: string) => {
    router.push(href as any);
  }),
  
  replace: withCapture((href: string) => {
    router.replace(href as any);
  }),
  
  back: withCapture(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }),
  
  safeBack: (fallback: string = '/') => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(fallback as any);
      }
    } catch {
      router.replace(fallback as any);
    }
  }
};
