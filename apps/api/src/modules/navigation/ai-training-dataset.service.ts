import { Injectable } from '@nestjs/common';

@Injectable()
export class AITrainingDatasetService {
  toCsv<T extends object>(records: T[]): string {
    if (records.length === 0) {
      return '';
    }

    const headers = Object.keys(records[0]) as Array<keyof T>;

    const rows = records.map((record) =>
      headers.map((header) => this.escapeCsvValue(record[header])).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }
}
