/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services (Tatum, Binance) are down
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

import { cronLogger } from "./loggers";

interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes to close circuit from half-open
  timeout: number;               // Timeout for requests (ms)
  resetTimeout: number;          // Time to wait before trying half-open (ms)
  name?: string;                 // Circuit breaker name for logging
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private totalRequests: number = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private readonly options: CircuitBreakerOptions;
  
  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 3000,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      name: options.name || 'CircuitBreaker'
    };
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    // If circuit is OPEN, fail fast
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        throw new Error(
          `${this.options.name}: Circuit breaker is OPEN. ` +
          `Service unavailable. Retry after ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`
        );
      } else {
        // Transition to HALF_OPEN to test service
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        cronLogger.info(`${this.options.name}: Circuit breaker transitioning to HALF_OPEN`);
      }
    }
    
    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn, this.options.timeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`${this.options.name}: Request timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }
  
  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        cronLogger.info(`${this.options.name}: Circuit breaker CLOSED (service recovered)`);
      }
    }
  }
  
  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during testing, reopen circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.resetTimeout;
      cronLogger.error(`${this.options.name}: Circuit breaker reopened (test failed)`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.resetTimeout;
      cronLogger.error(
        `${this.options.name}: Circuit breaker OPENED ` +
        `(${this.failureCount} failures, threshold: ${this.options.failureThreshold})`
      );
    }
  }
  
  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
  
  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    cronLogger.info(`${this.options.name}: Circuit breaker manually reset`);
  }
  
  /**
   * Check if circuit is currently operational
   */
  isOperational(): boolean {
    return this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN;
  }
}

/**
 * Pre-configured circuit breakers for common external services
 */
export const TatumCircuitBreaker = new CircuitBreaker({
  name: 'Tatum API',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 5000,        // 5 seconds
  resetTimeout: 30000   // 30 seconds
});


export default CircuitBreaker;
