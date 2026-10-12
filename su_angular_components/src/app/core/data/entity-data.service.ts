import { Injectable } from '@angular/core';
import { EntityRepository } from './entity-repository';
import { SchemaMetadataService } from './schema-metadata.service';
import { UnitOfWork } from './unit-of-work';

/* Entry point of the data layer for components: inject it and ask for a repository by schema name. */
@Injectable({ providedIn: 'root' })
export class EntityDataService {

	private readonly _repositories = new Map<string, EntityRepository>();

	constructor(public readonly metadata: SchemaMetadataService) {}

	public repository(schemaName: string): EntityRepository {
		let repository = this._repositories.get(schemaName);
		if (!repository) {
			repository = new EntityRepository(schemaName, this.metadata);
			this._repositories.set(schemaName, repository);
		}
		return repository;
	}

	public unitOfWork(): UnitOfWork {
		return new UnitOfWork();
	}
}
