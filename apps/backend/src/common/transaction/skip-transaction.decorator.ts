import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSACTION_KEY = 'skip_transaction';
export const SkipTransaction = () => SetMetadata(SKIP_TRANSACTION_KEY, true);
