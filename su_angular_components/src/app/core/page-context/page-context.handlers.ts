import { BaseRequest, BaseRequestHandler, CrtInject, CrtRequestHandler } from '@creatio-devkit/common';
import { PageContextRegistry } from './page-context.registry';

@CrtRequestHandler({
	type: 'su.PageContext.Init',
	requestType: 'crt.HandleViewModelInitRequest'
})
export class PageContextInitHandler extends BaseRequestHandler {

	constructor(@CrtInject(PageContextRegistry) private readonly _registry: PageContextRegistry) {
		super();
	}

	public override async handle(request: BaseRequest): Promise<unknown> {
		if (request.$context) {
			this._registry.add(request.$context);
		}
		return this.next?.handle(request);
	}
}

@CrtRequestHandler({
	type: 'su.PageContext.Destroy',
	requestType: 'crt.HandleViewModelDestroyRequest'
})
export class PageContextDestroyHandler extends BaseRequestHandler {

	constructor(@CrtInject(PageContextRegistry) private readonly _registry: PageContextRegistry) {
		super();
	}

	public override async handle(request: BaseRequest): Promise<unknown> {
		if (request.$context) {
			this._registry.remove(request.$context);
		}
		return this.next?.handle(request);
	}
}
