import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AITrainingRecord } from './interfaces/ai-training-record.interface';
import type { RouteSelection } from './interfaces/route-selection.interface';
import type { SupervisedTrainingRecord } from './interfaces/supervised-training-record.interface';

@Injectable()
export class SupervisedTrainingDatasetService {
  private readonly logger = new Logger(SupervisedTrainingDatasetService.name);

  private readonly trainingDatasetPath = join(
    process.cwd(),
    'data',
    'ai-training-records.jsonl',
  );

  private readonly selectionDatasetPath = join(
    process.cwd(),
    'data',
    'ai-route-selections.jsonl',
  );

  async getRecords(): Promise<SupervisedTrainingRecord[]> {
    const trainingRecords = await this.readJsonLines<AITrainingRecord>(
      this.trainingDatasetPath,
    );

    const selections = await this.readJsonLines<RouteSelection>(
      this.selectionDatasetPath,
    );

    const selectionByRequestId = new Map(
      selections.map((selection) => [selection.requestId, selection]),
    );

    return trainingRecords.flatMap((record) => {
      const selection = selectionByRequestId.get(record.requestId);

      if (!selection) {
        return [];
      }

      return [
        {
          ...record,
          selected: record.routeId === selection.routeId ? 1 : 0,
          selectedAt: selection.selectedAt,
          targetSource: 'user-choice',
        } satisfies SupervisedTrainingRecord,
      ];
    });
  }

  private async readJsonLines<T>(path: string): Promise<T[]> {
    let content: string;

    try {
      content = await readFile(path, 'utf8');
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
          return [JSON.parse(line) as T];
        } catch {
          this.logger.warn(`Skipping malformed JSONL record in ${path}`);

          return [];
        }
      });
  }
}
