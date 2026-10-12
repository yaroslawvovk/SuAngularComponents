import { EntityRecord } from './data.types';
import { EntityRepository } from './entity-repository';

type PendingOperation =
	| { kind: 'insert'; repository: EntityRepository; values: EntityRecord }
	| { kind: 'update'; repository: EntityRepository; id: string; values: EntityRecord }
	| { kind: 'delete'; repository: EntityRepository; id: string };

/* Collects writes and runs them together in commit().
   Operations run one by one in the order they were added; the first failure stops the batch.
   Keeping the batch behind this class lets us switch to devkit transactions later
   without touching the callers. */
export class UnitOfWork {

	private readonly _operations: PendingOperation[] = [];

	public get size(): number {
		return this._operations.length;
	}

	public insert(repository: EntityRepository, values: EntityRecord): this {
		this._operations.push({ kind: 'insert', repository, values });
		return this;
	}

	public update(repository: EntityRepository, id: string, values: EntityRecord): this {
		this._operations.push({ kind: 'update', repository, id, values });
		return this;
	}

	public delete(repository: EntityRepository, id: string): this {
		this._operations.push({ kind: 'delete', repository, id });
		return this;
	}

	public async commit(): Promise<void> {
		while (this._operations.length) {
			const operation = this._operations[0];
			switch (operation.kind) {
				case 'insert':
					await operation.repository.insert(operation.values);
					break;
				case 'update':
					await operation.repository.update(operation.id, operation.values);
					break;
				case 'delete':
					await operation.repository.delete(operation.id);
					break;
			}
			/* Removed only after success, so a failed commit can be retried from where it stopped. */
			this._operations.shift();
		}
	}
}
