import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { CreateRouteSelectionDto } from './dto/create-route-selection.dto';
import type { RouteSelection } from './interfaces/route-selection.interface';

@Injectable()
export class RouteSelectionService {
  private readonly logger = new Logger(RouteSelectionService.name);

  private readonly datasetPath = join(
    process.cwd(),
    'data',
    'ai-route-selections.jsonl',
  );

  async recordSelection(
    input: CreateRouteSelectionDto,
  ): Promise<RouteSelection> {
    const selection: RouteSelection = {
      requestId: input.requestId,
      routeId: input.routeId,
      selectedAt: new Date().toISOString(),
      labelSource: 'user-choice',
    };

    await mkdir(dirname(this.datasetPath), {
      recursive: true,
    });

    await appendFile(
      this.datasetPath,
      `${JSON.stringify(selection)}\n`,
      'utf8',
    );

    this.logger.log(
      `Recorded user selection ${selection.routeId} for request ${selection.requestId}`,
    );

    return selection;
  }
}
