import type { Delta } from './api/ipc/deltas';
import type { Session } from './api/ipc/sessions';

export type UISession = {
	session: Session;
	deltas: Partial<Record<string, Delta[]>>;
	earliestDeltaTimestampMs: number;
	latestDeltaTimestampMs: number;
};
