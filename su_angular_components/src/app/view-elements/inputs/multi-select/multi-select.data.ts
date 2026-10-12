import { LookupValue, generateGuid } from '@creatio-devkit/common';
import {
	EntityDataService,
	EntityRecord,
	EntityRepository,
	filter,
	toId,
	toLookupValue
} from '../../../core/data';

/* Describes the link schema of a many-to-many relation, e.g. SuConfItemInIncident:
   masterColumn (SuIncident) points to the page record, valueColumn (SuConfItem) to the selected value. */
export interface LinkConfig {
	linkSchemaName: string;
	masterColumnName: string;
	valueColumnName: string;
}

export interface OptionsQuery {
	search: string;
	excludeIds: string[];
	offset: number;
	size: number;
}

/* Data access of the multi-select: reads and writes the link records
   and loads the values available for selection. */
export class MultiSelectDataSource {

	constructor(
		private readonly _data: EntityDataService,
		private readonly _config: LinkConfig
	) {}

	/* Schema of the selected values, e.g. SuConfItem. */
	public getValueSchemaName(): Promise<string> {
		return this._data.metadata.getReferenceSchemaName(this._config.linkSchemaName, this._config.valueColumnName);
	}

	/* Schema of the page record, e.g. SuIncident. */
	public getMasterSchemaName(): Promise<string> {
		return this._data.metadata.getReferenceSchemaName(this._config.linkSchemaName, this._config.masterColumnName);
	}

	public async masterRecordExists(recordId: string): Promise<boolean> {
		return this._data.repository(await this.getMasterSchemaName()).exists(recordId);
	}

	/* Selected values sorted by caption; a value linked twice is shown once. */
	public async loadSelected(recordId: string): Promise<LookupValue[]> {
		const rows = await this._links().find({
			columns: [this._config.valueColumnName],
			filter: filter().equal(this._config.masterColumnName, recordId)
		});
		const byId = new Map<string, LookupValue>();
		for (const row of rows) {
			const value = toLookupValue(row[this._config.valueColumnName]);
			if (value && !byId.has(toId(value))) {
				byId.set(toId(value), value);
			}
		}
		return Array.from(byId.values())
			.sort((a, b) => a.displayValue.localeCompare(b.displayValue));
	}

	public async loadOptions(query: OptionsQuery): Promise<LookupValue[]> {
		const schemaName = await this.getValueSchemaName();
		const metadata = this._data.metadata;
		const schema = await metadata.getSchema(schemaName);
		const primary = await metadata.getPrimaryAttributeName(schemaName);
		const display = await metadata.getPrimaryDisplayAttributeName(schemaName);
		const color = schema.primaryColorAttributeName;

		const where = filter().notIn(primary, query.excludeIds);
		if (query.search) {
			where.contain(display, query.search);
		}
		const rows = await this._data.repository(schemaName).find({
			columns: Array.from(new Set([primary, display, ...(color ? [color] : [])])),
			filter: where,
			orderBy: { column: display },
			page: { size: query.size, offset: query.offset }
		});
		return rows.map(row => this._toOption(row, primary, display, color));
	}

	public async addLink(recordId: string, valueId: string): Promise<void> {
		const primary = await this._data.metadata.getPrimaryAttributeName(this._config.linkSchemaName);
		await this._links().insert({
			[primary]: generateGuid(),
			[this._config.masterColumnName]: recordId,
			[this._config.valueColumnName]: valueId
		});
	}

	public async removeLink(recordId: string, valueId: string): Promise<void> {
		await this._links().deleteWhere(
			filter()
				.equal(this._config.masterColumnName, recordId)
				.equal(this._config.valueColumnName, valueId)
		);
	}

	private _links(): EntityRepository {
		return this._data.repository(this._config.linkSchemaName);
	}

	private _toOption(row: EntityRecord, primary: string, display: string, color?: string): LookupValue {
		const option: LookupValue = {
			value: toId(row[primary]),
			displayValue: String(row[display] ?? '')
		};
		const colorValue = color ? row[color] : undefined;
		if (typeof colorValue === 'string' && colorValue) {
			option.primaryColorValue = colorValue;
		}
		return option;
	}
}
