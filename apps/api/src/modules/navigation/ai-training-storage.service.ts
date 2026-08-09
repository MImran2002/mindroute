import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
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

    const existingFingerprints = await this.loadExistingFingerprints();

    const uniqueRecords: AITrainingRecord[] = [];

    for (const record of records) {
      const fingerprint = this.createFingerprint(record);

      if (existingFingerprints.has(fingerprint)) {
        continue;
      }

      existingFingerprints.add(fingerprint);
      uniqueRecords.push(record);
    }

    if (uniqueRecords.length === 0) {
      this.logger.log(
        `Skipped ${records.length} duplicate AI training record(s)`,
      );
      return;
    }

    const jsonLines =
      uniqueRecords.map((record) => JSON.stringify(record)).join('\n') + '\n';

    await appendFile(this.datasetPath, jsonLines, 'utf8');

    const skippedCount = records.length - uniqueRecords.length;

    this.logger.log(
      `Saved ${uniqueRecords.length} AI training record(s); skipped ${skippedCount} duplicate(s)`,
    );
  }

  private async loadExistingFingerprints(): Promise<Set<string>> {
    const fingerprints = new Set<string>();

    let content: string;

    try {
      content = await readFile(this.datasetPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return fingerprints;
      }

      throw error;
    }

    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as AITrainingRecord;

        fingerprints.add(this.createFingerprint(record));
      } catch {
        this.logger.warn(
          'Skipped malformed line while reading AI training dataset',
        );
      }
    }

    return fingerprints;
  }

  private createFingerprint(record: AITrainingRecord): string {
    const stableRecord = Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => key !== 'requestId' && key !== 'capturedAt',
      ),
    );

    return createHash('sha256')
      .update(JSON.stringify(stableRecord))
      .digest('hex');
  }
}
