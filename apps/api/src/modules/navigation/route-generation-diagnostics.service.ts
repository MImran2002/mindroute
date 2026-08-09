import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { RouteGenerationStats } from './interfaces/route-generation-stats.interface';
import type { StoredRouteGenerationDiagnostics } from './interfaces/stored-route-generation-diagnostics.interface';

@Injectable()
export class RouteGenerationDiagnosticsService {
  private readonly logger = new Logger(RouteGenerationDiagnosticsService.name);

  private readonly datasetPath = join(
    process.cwd(),
    'data',
    'route-generation-diagnostics.jsonl',
  );

  async appendRecord(record: StoredRouteGenerationDiagnostics): Promise<void> {
    await mkdir(dirname(this.datasetPath), {
      recursive: true,
    });

    await appendFile(this.datasetPath, `${JSON.stringify(record)}\n`, 'utf8');

    this.logger.log(
      `Saved route-generation diagnostics for request ${record.requestId}`,
    );
  }

  async getStats(): Promise<RouteGenerationStats> {
    const records = await this.readRecords();

    if (records.length === 0) {
      return {
        totalRequests: 0,
        averagePlansAttempted: 0,
        averageProviderSuccesses: 0,
        averageRoutesAfterDeduplication: 0,
        requestsWithOneRoute: 0,
        requestsWithTwoRoutes: 0,
        requestsWithThreeRoutes: 0,
        providerFailureRate: 0,
        duplicateRemovalRate: 0,
        candidateSourceSurvivalCounts: {},
      };
    }

    const totalPlansAttempted = records.reduce(
      (sum, record) => sum + record.plansAttempted,
      0,
    );

    const totalProviderSuccesses = records.reduce(
      (sum, record) => sum + record.providerSuccesses,
      0,
    );

    const totalProviderFailures = records.reduce(
      (sum, record) => sum + record.providerFailures,
      0,
    );

    const totalBeforeDeduplication = records.reduce(
      (sum, record) => sum + record.routesBeforeDeduplication,
      0,
    );

    const totalDuplicatesRemoved = records.reduce(
      (sum, record) => sum + record.duplicatesRemoved,
      0,
    );

    const totalRoutesAfterDeduplication = records.reduce(
      (sum, record) => sum + record.routesAfterDeduplication,
      0,
    );

    const candidateSourceSurvivalCounts: Record<string, number> = {};

    for (const record of records) {
      for (const source of record.survivingCandidateSources) {
        candidateSourceSurvivalCounts[source] =
          (candidateSourceSurvivalCounts[source] ?? 0) + 1;
      }
    }

    const average = (value: number): number =>
      Number((value / records.length).toFixed(2));

    return {
      totalRequests: records.length,

      averagePlansAttempted: average(totalPlansAttempted),

      averageProviderSuccesses: average(totalProviderSuccesses),

      averageRoutesAfterDeduplication: average(totalRoutesAfterDeduplication),

      requestsWithOneRoute: records.filter(
        (record) => record.routesAfterDeduplication === 1,
      ).length,

      requestsWithTwoRoutes: records.filter(
        (record) => record.routesAfterDeduplication === 2,
      ).length,

      requestsWithThreeRoutes: records.filter(
        (record) => record.routesAfterDeduplication >= 3,
      ).length,

      providerFailureRate:
        totalPlansAttempted === 0
          ? 0
          : Number((totalProviderFailures / totalPlansAttempted).toFixed(4)),

      duplicateRemovalRate:
        totalBeforeDeduplication === 0
          ? 0
          : Number(
              (totalDuplicatesRemoved / totalBeforeDeduplication).toFixed(4),
            ),

      candidateSourceSurvivalCounts,
    };
  }

  private async readRecords(): Promise<StoredRouteGenerationDiagnostics[]> {
    let content: string;

    try {
      content = await readFile(this.datasetPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      throw error;
    }

    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as StoredRouteGenerationDiagnostics];
        } catch {
          this.logger.warn(
            'Skipping malformed route-generation diagnostics record',
          );

          return [];
        }
      });
  }
}
