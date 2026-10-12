import { Injectable } from '@angular/core';
import { ViewModelContext } from '@creatio-devkit/common';
import { sameId } from '../data';

/* Open pages report their view model context through the init/destroy handlers.
   A view element knows only its record id, so it looks its page context up by that id
   when it needs to send a request on behalf of the page. */
@Injectable({ providedIn: 'root' })
export class PageContextRegistry {

	/* Guards against a leak if a destroy request is ever missed. */
	private static readonly MAX_CONTEXTS = 50;

	private readonly _contexts = new Set<ViewModelContext>();

	public add(context: ViewModelContext): void {
		this._contexts.delete(context);
		this._contexts.add(context);
		if (this._contexts.size > PageContextRegistry.MAX_CONTEXTS) {
			const oldest = this._contexts.values().next().value;
			if (oldest) {
				this._contexts.delete(oldest);
			}
		}
	}

	public remove(context: ViewModelContext): void {
		this._contexts.delete(context);
	}

	/* Newest pages first: a record opened twice belongs to the page opened last. */
	public async findByRecordId(recordId: string): Promise<ViewModelContext | null> {
		if (!recordId) {
			return null;
		}
		const contexts = Array.from(this._contexts).reverse();
		for (const context of contexts) {
			try {
				if (sameId(await context['Id'], recordId)) {
					return context;
				}
			} catch {
				/* The page is being destroyed; skip it. */
			}
		}
		return null;
	}
}
