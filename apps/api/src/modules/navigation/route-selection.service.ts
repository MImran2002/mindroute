import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { CreateRouteSelectionDto } from './dto/create-route-selection.dto';
import type { AITrainingRecord } from './interfaces/ai-training-record.interface';
import type { RouteSelection } from './interfaces/route-selection.interface';

@Injectable()
export class RouteSelectionService {
  private readonly logger = new Logger(RouteSelectionService.name);

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

  async recordSelection(
    input: CreateRouteSelectionDto,
  ): Promise<RouteSelection> {
    const routeExists = await this.trainingRecordExists(
      input.requestId,
      input.routeId,
    );

    if (!routeExists) {
      throw new NotFoundException(
        `No captured route ${input.routeId} exists for request ${input.requestId}`,
      );
    }

    const existingSelection = await this.findSelectionByRequestId(
      input.requestId,
    );

    if (existingSelection) {
      throw new ConflictException(
        `A route has already been selected for request ${input.requestId}`,
      );
    }

    const selection: RouteSelection = {
      requestId: input.requestId,
      routeId: input.routeId,
      selectedAt: new Date().toISOString(),
      labelSource: 'user-choice',
    };

    await mkdir(dirname(this.selectionDatasetPath), {
      recursive: true,
    });

    await appendFile(
      this.selectionDatasetPath,
      `${JSON.stringify(selection)}\n`,
      'utf8',
    );

    this.logger.log(
      `Recorded user selection ${selection.routeId} for request ${selection.requestId}`,
    );

    return selection;
  }

  private async trainingRecordExists(
    requestId: string,
    routeId: string,
  ): Promise<boolean> {
    const records = await this.readJsonLines<AITrainingRecord>(
      this.trainingDatasetPath,
    );

    return records.some(
      (record) => record.requestId === requestId && record.routeId === routeId,
    );
  }

  private async findSelectionByRequestId(
    requestId: string,
  ): Promise<RouteSelection | undefined> {
    const selections = await this.readJsonLines<RouteSelection>(
      this.selectionDatasetPath,
    );

    return selections.find((selection) => selection.requestId === requestId);
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
