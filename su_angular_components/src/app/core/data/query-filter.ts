import {
	ComparisonType,
	EntityColumnValue,
	FilterGroup,
	LogicalOperatorType
} from '@creatio-devkit/common';

/* Fluent wrapper over the devkit FilterGroup, so callers write
   filter().equal('Contact', id).contain('Name', text) instead of the verbose devkit calls. */
export class QueryFilter {

	private readonly _group: FilterGroup;

	/* Set when a condition can never be true, e.g. in() with an empty list. */
	private _hasFalseCondition = false;

	constructor(private readonly _logicalOperation: LogicalOperatorType = LogicalOperatorType.And) {
		this._group = new FilterGroup(_logicalOperation);
	}

	public get isEmpty(): boolean {
		return Object.keys(this._group.items).length === 0;
	}

	/* True when the filter can never match, so the repository can skip the server call.
	   One false condition kills an AND group; an OR group dies only if nothing else is left. */
	public get matchesNothing(): boolean {
		if (!this._hasFalseCondition) {
			return false;
		}
		return this._logicalOperation === LogicalOperatorType.And || this.isEmpty;
	}

	public equal(column: string, value: EntityColumnValue): this {
		this._group.addSchemaColumnFilterWithParameter(ComparisonType.Equal, column, value);
		return this;
	}

	public notEqual(column: string, value: EntityColumnValue): this {
		this._group.addSchemaColumnFilterWithParameter(ComparisonType.Not_equal, column, value);
		return this;
	}

	public contain(column: string, text: string): this {
		this._group.addSchemaColumnFilterWithParameter(ComparisonType.Contain, column, text);
		return this;
	}

	public in(column: string, values: EntityColumnValue[]): this {
		if (!values.length) {
			this._hasFalseCondition = true;
			return this;
		}
		this._group.addSchemaColumnInFilterWithParameters(ComparisonType.Equal, column, values);
		return this;
	}

	/* An empty list excludes nothing, so it adds no condition. */
	public notIn(column: string, values: EntityColumnValue[]): this {
		if (values.length) {
			this._group.addSchemaColumnInFilterWithParameters(ComparisonType.Not_equal, column, values);
		}
		return this;
	}

	public isNull(column: string): this {
		this._group.addSchemaColumnIsNullFilter(column);
		return this;
	}

	public isNotNull(column: string): this {
		this._group.addSchemaColumnIsNotNullFilter(column);
		return this;
	}

	/* Adds a nested group, e.g. an OR block inside an AND filter. */
	public group(logicalOperation: LogicalOperatorType, build: (nested: QueryFilter) => void): this {
		const nested = new QueryFilter(logicalOperation);
		build(nested);
		if (nested.matchesNothing) {
			this._hasFalseCondition = true;
		} else if (!nested.isEmpty) {
			this._group.add(nested.toFilterGroup());
		}
		return this;
	}

	public toFilterGroup(): FilterGroup {
		return this._group;
	}
}

export function filter(logicalOperation: LogicalOperatorType = LogicalOperatorType.And): QueryFilter {
	return new QueryFilter(logicalOperation);
}
