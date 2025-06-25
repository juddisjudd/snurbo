import type { RateLimitInfo } from '@/core/types';

export class RateLimiter {
  private userLimits = new Map<string, RateLimitInfo>();
  private channelLimits = new Map<string, RateLimitInfo>();

  checkUserLimit(userId: string, maxRequests: number, windowMs: number = 60000): boolean {
    return this.checkLimit(this.userLimits, userId, maxRequests, windowMs);
  }

  checkChannelLimit(channelId: string, maxRequests: number = 3, windowMs: number = 60000): boolean {
    return this.checkLimit(this.channelLimits, channelId, maxRequests, windowMs);
  }

  private checkLimit(
    limitMap: Map<string, RateLimitInfo>,
    key: string,
    maxRequests: number,
    windowMs: number
  ): boolean {
    const now = Date.now();
    const limit = limitMap.get(key);

    if (!limit || now > limit.resetTime) {
      limitMap.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  getRemainingRequests(userId: string, maxRequests: number): number {
    const limit = this.userLimits.get(userId);
    if (!limit || Date.now() > limit.resetTime) {
      return maxRequests;
    }
    return Math.max(0, maxRequests - limit.count);
  }

  getResetTime(userId: string): Date | null {
    const limit = this.userLimits.get(userId);
    return limit ? new Date(limit.resetTime) : null;
  }

  cleanup(): void {
    const now = Date.now();
    
    for (const [key, limit] of this.userLimits.entries()) {
      if (now > limit.resetTime) {
        this.userLimits.delete(key);
      }
    }
    
    for (const [key, limit] of this.channelLimits.entries()) {
      if (now > limit.resetTime) {
        this.channelLimits.delete(key);
      }
    }
  }
}