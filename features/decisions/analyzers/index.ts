/**
 * Analyzers Registry
 * Ponto central para executar todos os analyzers
 */

import { DealView, Activity } from '@/types';
import { AnalyzerResult } from '../types';
import { analyzeStagnantDeals, stagnantDealsConfig } from './stagnantDealsAnalyzer';
import { analyzeOverdueActivities, overdueActivitiesConfig } from './overdueActivitiesAnalyzer';
import decisionQueueService from '../services/decisionQueueService';

export interface AnalyzerRegistry {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  run: (deals: DealView[], activities: Activity[]) => AnalyzerResult;
}

// Registry of all available analyzers
export const analyzers: AnalyzerRegistry[] = [
  {
    id: stagnantDealsConfig.id,
    name: stagnantDealsConfig.name,
    description: stagnantDealsConfig.description,
    enabled: stagnantDealsConfig.enabled,
    run: (deals, activities) => analyzeStagnantDeals(deals, activities),
  },
  {
    id: overdueActivitiesConfig.id,
    name: overdueActivitiesConfig.name,
    description: overdueActivitiesConfig.description,
    enabled: overdueActivitiesConfig.enabled,
    run: (deals, activities) => analyzeOverdueActivities(activities, deals),
  },
];

/**
 * Run all enabled analyzers and add decisions to queue
 */
export async function runAllAnalyzers(
  deals: DealView[], 
  activities: Activity[]
): Promise<{
  results: AnalyzerResult[];
  totalDecisions: number;
  addedDecisions: number;
}> {
  const results: AnalyzerResult[] = [];
  let totalDecisions = 0;
  let addedDecisions = 0;

  for (const analyzer of analyzers) {
    if (!analyzer.enabled) continue;

    try {
      const result = analyzer.run(deals, activities);
      results.push(result);
      
      // Save analyzer result for history
      decisionQueueService.saveAnalyzerResult(result);
      
      // Add decisions to queue
      const added = decisionQueueService.addDecisions(result.decisions);
      
      totalDecisions += result.decisions.length;
      addedDecisions += added;
    } catch (error) {
      console.error(`Error running analyzer ${analyzer.id}:`, error);
      results.push({
        analyzerId: analyzer.id,
        analyzerName: analyzer.name,
        decisions: [],
        metadata: {
          executedAt: new Date().toISOString(),
          itemsAnalyzed: 0,
          decisionsGenerated: 0,
          errors: [String(error)],
        },
      });
    }
  }

  // Clean up expired decisions
  decisionQueueService.clearExpired();

  return { results, totalDecisions, addedDecisions };
}

/**
 * Run a specific analyzer by ID
 */
export function runAnalyzer(
  analyzerId: string,
  deals: DealView[],
  activities: Activity[]
): AnalyzerResult | null {
  const analyzer = analyzers.find(a => a.id === analyzerId);
  
  if (!analyzer) {
    return null;
  }

  const result = analyzer.run(deals, activities);
  decisionQueueService.saveAnalyzerResult(result);
  decisionQueueService.addDecisions(result.decisions);
  
  return result;
}

export { analyzeStagnantDeals, analyzeOverdueActivities };
