import { Injectable } from '@angular/core';
import { BaseRequest, HandlerChainService, ViewModelContext } from '@creatio-devkit/common';
import { PageContextRegistry } from '../page-context';

/* Opens Creatio pages from a view element through the standard page requests,
   so navigation behaves exactly like clicking a lookup link on a regular field. */
@Injectable({ providedIn: 'root' })
export class RecordNavigationService {

	constructor(private readonly _contexts: PageContextRegistry) {}

	/* Opens the edit page of a record in the current tab.
	   hostRecordId is the record of the page the element sits on: its context is passed
	   with the request, so the platform treats the call as coming from that page. */
	public async openRecord(schemaName: string, recordId: string, hostRecordId?: string): Promise<void> {
		await this._process({
			type: 'crt.UpdateRecordRequest',
			entityName: schemaName,
			recordId,
			$context: await this._resolveContext(hostRecordId)
		});
	}

	/* Opens the add page of a schema, optionally with prefilled values. */
	public async createRecord(
		schemaName: string,
		defaultValues: Record<string, unknown> = {},
		hostRecordId?: string
	): Promise<void> {
		await this._process({
			type: 'crt.CreateRecordRequest',
			entityName: schemaName,
			defaultValues: Object.entries(defaultValues).map(([attributeName, value]) => ({ attributeName, value })),
			$context: await this._resolveContext(hostRecordId)
		});
	}

	private async _resolveContext(hostRecordId?: string): Promise<ViewModelContext> {
		const context = hostRecordId ? await this._contexts.findByRecordId(hostRecordId) : null;
		return context ?? {};
	}

	/* Page requests carry extra fields that BaseRequest does not declare. */
	private _process(request: Record<string, unknown>): Promise<unknown> {
		return HandlerChainService.instance.process(request as unknown as BaseRequest);
	}
}
