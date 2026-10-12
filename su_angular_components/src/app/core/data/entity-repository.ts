import {
	DataSourceLoadOptions,
	DataSourceParameter,
	DataSourceParameters,
	DataSourceSaveResult,
	JsonObject,
	ModelParameterType
} from '@creatio-devkit/common';
import {
	DataOperation,
	DataOperationError,
	EntityRecord,
	FindOptions,
	SortSpec,
	extractErrorMessage,
	toId
} from './data.types';
import { QueryFilter, filter } from './query-filter';
import { SchemaMetadataService } from './schema-metadata.service';

/* CRUD over one entity schema. Values passed to insert/update may hold LookupValue objects:
   they are reduced to ids, so a record loaded by find() can be written back as is. */
export class EntityRepository {

	constructor(
		public readonly schemaName: string,
		private readonly _metadata: SchemaMetadataService
	) {}

	public async find(options: FindOptions): Promise<EntityRecord[]> {
		if (options.filter?.matchesNothing) {
			return [];
		}
		const model = await this._metadata.getModel(this.schemaName);
		const parameters: DataSourceParameters = [];
		if (options.filter && !options.filter.isEmpty) {
			parameters.push(this._toFilterParameter(options.filter));
		}
		return this._run('load', async () => {
			const rows = await model.load({
				attributes: options.columns,
				parameters,
				options: this._toLoadOptions(options)
			});
			return rows as EntityRecord[];
		});
	}

	public async findOne(options: Omit<FindOptions, 'page'>): Promise<EntityRecord | null> {
		const rows = await this.find({ ...options, page: { size: 1 } });
		return rows[0] ?? null;
	}

	public async getById(id: string, columns: string[]): Promise<EntityRecord | null> {
		const primary = await this._metadata.getPrimaryAttributeName(this.schemaName);
		return this.findOne({ columns, filter: filter().equal(primary, id) });
	}

	public async exists(id: string): Promise<boolean> {
		const primary = await this._metadata.getPrimaryAttributeName(this.schemaName);
		return (await this.getById(id, [primary])) !== null;
	}

	public async insert(values: EntityRecord): Promise<void> {
		const model = await this._metadata.getModel(this.schemaName);
		await this._save('insert', () => model.insert(this._toDto(values)));
	}

	public async update(id: string, values: EntityRecord): Promise<void> {
		const model = await this._metadata.getModel(this.schemaName);
		await this._save('update', () => model.update(this._toDto(values), this._primaryParameter(id)));
	}

	public async delete(id: string): Promise<void> {
		const model = await this._metadata.getModel(this.schemaName);
		await this._save('delete', () => model.delete(this._primaryParameter(id)));
	}

	/* Model.delete only takes a primary key, so matching records are found first. */
	public async deleteWhere(where: QueryFilter): Promise<number> {
		const primary = await this._metadata.getPrimaryAttributeName(this.schemaName);
		const rows = await this.find({ columns: [primary], filter: where });
		for (const row of rows) {
			await this.delete(toId(row[primary]));
		}
		return rows.length;
	}

	private _toLoadOptions(options: FindOptions): DataSourceLoadOptions {
		const loadOptions: DataSourceLoadOptions = {};
		if (options.page) {
			loadOptions.pagingConfig = {
				rowCount: options.page.size,
				rowsOffset: options.page.offset ?? 0
			};
		}
		const sorting: SortSpec[] = options.orderBy
			? (Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy])
			: [];
		if (sorting.length) {
			loadOptions.sortingConfig = {
				columns: sorting.map(item => ({
					columnName: item.column,
					direction: item.direction ?? 'asc'
				}))
			};
		}
		return loadOptions;
	}

	/* FilterGroup exposes `items` as a getter, which a plain copy loses when the platform
	   serializes the parameter. Copying it explicitly is the workaround from the Creatio docs. */
	private _toFilterParameter(where: QueryFilter): DataSourceParameter {
		const group = where.toFilterGroup();
		const value: Record<string, unknown> = Object.assign({}, group) as unknown as Record<string, unknown>;
		value['items'] = group.items;
		return { type: ModelParameterType.Filter, value };
	}

	private _primaryParameter(id: string): DataSourceParameters {
		return [{ type: ModelParameterType.PrimaryColumnValue, value: id }];
	}

	private _toDto(values: EntityRecord): JsonObject {
		const dto: JsonObject = {};
		for (const [key, value] of Object.entries(values)) {
			dto[key] = value && typeof value === 'object' && 'value' in value
				? toId(value)
				: value as JsonObject[string];
		}
		return dto;
	}

	private async _save(operation: DataOperation, action: () => Promise<DataSourceSaveResult>): Promise<void> {
		const result = await this._run(operation, action);
		if (!result?.success) {
			throw new DataOperationError(this.schemaName, operation, extractErrorMessage(result), result);
		}
	}

	private async _run<T>(operation: DataOperation, action: () => Promise<T>): Promise<T> {
		try {
			return await action();
		} catch (error) {
			if (error instanceof DataOperationError) {
				throw error;
			}
			throw new DataOperationError(this.schemaName, operation, extractErrorMessage(error), error);
		}
	}
}
