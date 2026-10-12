import { Injectable } from '@angular/core';
import { DataSchema, DataSchemaAttribute, Model } from '@creatio-devkit/common';
import { DataOperationError, extractErrorMessage } from './data.types';

/* Caches Model instances and schemas. Schemas never change while the page is open,
   so each one is requested once; parallel callers share the request in flight. */
@Injectable({ providedIn: 'root' })
export class SchemaMetadataService {

	private readonly _models = new Map<string, Promise<Model>>();
	private readonly _schemas = new Map<string, Promise<DataSchema>>();

	public getModel(schemaName: string): Promise<Model> {
		return this._cached(this._models, schemaName, () => Model.create(schemaName));
	}

	public getSchema(schemaName: string): Promise<DataSchema> {
		return this._cached(this._schemas, schemaName, async () => {
			const model = await this.getModel(schemaName);
			return model.getSchema();
		});
	}

	public async getAttribute(schemaName: string, attributeName: string): Promise<DataSchemaAttribute> {
		const schema = await this.getSchema(schemaName);
		const attribute = schema.attributes.find(item => item.name === attributeName);
		if (!attribute) {
			throw new DataOperationError(schemaName, 'schema', `attribute "${attributeName}" not found`);
		}
		return attribute;
	}

	/* Name of the schema a lookup attribute points to, e.g. SuConfItemInIncident.SuConfItem -> SuConfItem. */
	public async getReferenceSchemaName(schemaName: string, attributeName: string): Promise<string> {
		const attribute = await this.getAttribute(schemaName, attributeName);
		if (!attribute.referenceSchemaName) {
			throw new DataOperationError(schemaName, 'schema', `attribute "${attributeName}" is not a lookup`);
		}
		return attribute.referenceSchemaName;
	}

	public async getPrimaryAttributeName(schemaName: string): Promise<string> {
		const schema = await this.getSchema(schemaName);
		return schema.primaryAttributeName || 'Id';
	}

	/* Falls back to the primary attribute when the schema has no display column. */
	public async getPrimaryDisplayAttributeName(schemaName: string): Promise<string> {
		const schema = await this.getSchema(schemaName);
		return schema.primaryDisplayAttributeName || schema.primaryAttributeName || 'Id';
	}

	/* A failed request is dropped from the cache so the next call retries. */
	private _cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
		const cached = cache.get(key);
		if (cached) {
			return cached;
		}
		const request = load().catch(error => {
			cache.delete(key);
			throw error instanceof DataOperationError
				? error
				: new DataOperationError(key, 'schema', extractErrorMessage(error), error);
		});
		cache.set(key, request);
		return request;
	}
}
