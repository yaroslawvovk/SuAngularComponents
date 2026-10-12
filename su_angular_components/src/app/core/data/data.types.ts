import { LookupValue } from '@creatio-devkit/common';
import { QueryFilter } from './query-filter';

/* A record as Model.load returns it: attribute name -> value.
   Lookup attributes come back as LookupValue objects. */
export type EntityRecord = Record<string, unknown>;

export interface SortSpec {
	column: string;
	direction?: 'asc' | 'desc';
}

export interface PageSpec {
	size: number;
	offset?: number;
}

export interface FindOptions {
	columns: string[];
	filter?: QueryFilter;
	orderBy?: SortSpec | SortSpec[];
	page?: PageSpec;
}

export type DataOperation = 'load' | 'insert' | 'update' | 'delete' | 'schema';

/* Thrown for every failed data call, so callers get one error shape
   instead of a mix of rejected promises and { success: false } results. */
export class DataOperationError extends Error {
	constructor(
		public readonly schemaName: string,
		public readonly operation: DataOperation,
		message: string,
		public readonly origin?: unknown
	) {
		super(`[${schemaName}] ${operation} failed: ${message}`);
		this.name = 'DataOperationError';
	}
}

/* Pulls a readable message out of the various error shapes Creatio returns. */
export function extractErrorMessage(error: unknown): string {
	if (typeof error === 'string') {
		return error;
	}
	if (error instanceof Error) {
		return error.message;
	}
	const e = error as Record<string, any> | null | undefined;
	const candidates: unknown[] = [
		e?.['errorInfo']?.['message'],
		e?.['errorInfo'],
		e?.['error']?.['responseStatus']?.['Message'],
		e?.['error']?.['message'],
		e?.['message']
	];
	const message = candidates.find(item => typeof item === 'string' && item !== '');
	return (message as string | undefined) ?? 'Unknown error';
}

/* Returns the id from either a plain id or a LookupValue; '' when empty. */
export function toId(raw: unknown): string {
	const value = raw && typeof raw === 'object' && 'value' in raw
		? (raw as { value: unknown }).value
		: raw;
	return value == null ? '' : String(value);
}

/* Guids may differ in case between the page and the server. */
export function sameId(a: unknown, b: unknown): boolean {
	const left = toId(a);
	return left !== '' && left.toLowerCase() === toId(b).toLowerCase();
}

export function toLookupValue(raw: unknown): LookupValue | null {
	if (!raw || typeof raw !== 'object' || !('value' in raw)) {
		return null;
	}
	const lookup = raw as Partial<LookupValue>;
	if (!lookup.value) {
		return null;
	}
	return {
		...lookup,
		value: lookup.value,
		displayValue: lookup.displayValue ?? ''
	} as LookupValue;
}
