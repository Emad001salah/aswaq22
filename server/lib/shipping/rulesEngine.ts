/**
 * rulesEngine.ts — Dynamic Pricing & Rules Engine (Logistics v2.0)
 *
 * Provides database-backed configuration rules and dynamic surge pricing
 * based on supply (available drivers) vs. demand (pending shipments) ratios.
 */

import { prisma } from '../../../src/lib/prisma.ts';
import { logger } from '../logger.ts';

export interface LogisticsConfigRules {
  maxDriverSpeedKmh:    number;
  geofenceRadiusMeters: number;
  baseCodFee:           number;
  platformCommissionPct: number;
  maxSlaDelayMins:      number;
}

export class RulesEngine {
  // Default fallback values
  private static DEFAULT_RULES: LogisticsConfigRules = {
    maxDriverSpeedKmh:     160,
    geofenceRadiusMeters:  150,
    baseCodFee:            300,
    platformCommissionPct: 10,
    maxSlaDelayMins:       15,
  };

  /**
   * Fetch current configuration rules from Database with local fallback
   */
  static async getRules(): Promise<LogisticsConfigRules> {
    try {
      // Fetch dynamic settings from database settings or feature flag settings
      const settings = await prisma.adminLog.findFirst({
        where: { action: 'UPDATE_LOGISTICS_RULES' },
        orderBy: { timestamp: 'desc' },
      });

      if (settings && settings.details) {
        const parsed = JSON.parse(settings.details);
        return {
          ...this.DEFAULT_RULES,
          ...parsed,
        };
      }
    } catch (err: any) {
      logger.warn({ message: '[RulesEngine] Failed to load rules from DB, using defaults', error: err.message });
    }

    return this.DEFAULT_RULES;
  }

  /**
   * Calculate Dynamic Surge Pricing based on Supply (available drivers) and Demand (pending shipments)
   */
  static calculateDynamicPrice(params: {
    baseFee:         number;
    availableAgents: number;
    pendingOrders:   number;
    isPeakHour:      boolean;
    weatherCondition?: 'CLEAR' | 'RAINY' | 'STORM';
  }): {
    surgeMultiplier: number;
    surgeFee:        number;
    totalFee:        number;
  } {
    const { baseFee, availableAgents, pendingOrders, isPeakHour, weatherCondition = 'CLEAR' } = params;

    let surgeMultiplier = 1.0;

    // 1. Demand/Supply Ratio Factor
    // If we have more orders than drivers, increase price
    if (pendingOrders > 0 && availableAgents === 0) {
      surgeMultiplier += 0.5; // No drivers available: add 50% surge
    } else if (pendingOrders > 0 && availableAgents > 0) {
      const ratio = pendingOrders / availableAgents;
      if (ratio > 2.0) {
        surgeMultiplier += 0.3; // High demand: add 30% surge
      } else if (ratio > 4.0) {
        surgeMultiplier += 0.6; // Extreme demand: add 60% surge
      }
    }

    // 2. Peak Hours Factor (e.g. 5 PM to 9 PM)
    if (isPeakHour) {
      surgeMultiplier += 0.2; // Add 20%
    }

    // 3. Weather Condition Factor
    if (weatherCondition === 'RAINY') {
      surgeMultiplier += 0.25; // Add 25%
    } else if (weatherCondition === 'STORM') {
      surgeMultiplier += 0.5;  // Add 50%
    }

    // Cap surge multiplier at 2.5x to prevent user abandonment
    surgeMultiplier = Math.min(surgeMultiplier, 2.5);

    const totalFee = baseFee * surgeMultiplier;
    const surgeFee = totalFee - baseFee;

    return {
      surgeMultiplier: parseFloat(surgeMultiplier.toFixed(2)),
      surgeFee:        parseFloat(surgeFee.toFixed(2)),
      totalFee:        parseFloat(totalFee.toFixed(2)),
    };
  }
}
