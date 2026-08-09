import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { AITrainingRecord } from './interfaces/ai-training-record.interface';

@Injectable()
export class AITrainingStorageService {
  private readonly logger = new Logger(AITrainingStorageService.name);

  private readonly datasetPath = join(
    process.cwd(),
    'data',
    'ai-training-records.jsonl',
  );

  async appendRecords(records: AITrainingRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await mkdir(dirname(this.datasetPath), {
      recursive: true,
    });

    const jsonLines =
      records.map((record) => JSON.stringify(record)).join('\n') + '\n';

    await appendFile(this.datasetPath, jsonLines, 'utf8');

    this.logger.log(
      `Saved ${records.length} AI training observation(s) for request ${records[0].requestId}`,
    );
  }
}
