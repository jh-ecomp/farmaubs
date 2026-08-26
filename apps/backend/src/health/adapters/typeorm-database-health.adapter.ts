import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseHealthPort } from '../ports/database-health.port';

@Injectable()
export class TypeOrmDatabaseHealthAdapter implements DatabaseHealthPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async isUp(): Promise<boolean> {
    try {
      await this.withTimeout(this.dataSource.query('SELECT 1'), 2000);
      return true;
    } catch {
      return false;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
