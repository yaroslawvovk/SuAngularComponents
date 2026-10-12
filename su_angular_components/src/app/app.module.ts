/* Import the required functionality from the libraries. */
import { DoBootstrap, Injector, NgModule, ProviderToken, Type } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import { BrowserModule } from '@angular/platform-browser';
import { bootstrapCrtModule, CrtModule } from '@creatio-devkit/common';
import { PageContextDestroyHandler, PageContextInitHandler } from './core/page-context';
import { SaveRecordHandler } from './core/save-coordination';
import { MultiSelectComponent } from './view-elements/inputs/multi-select/multi-select';
import { TextInputComponent } from './view-elements/inputs/text-input/text-input';

/* Custom element tag of every view element; must match the selector in @CrtViewElement. */
const VIEW_ELEMENTS: Array<[string, Type<unknown>]> = [
  ['su-text-input', TextInputComponent],
  ['su-multi-select', MultiSelectComponent]
];

const VIEW_ELEMENT_TYPES = VIEW_ELEMENTS.map(([, component]) => component);

/* The Interface Designer builds handler chains from its own package topology, which does not
   contain this package, so any global handler of this module breaks every designer page.
   The designer only needs the view elements, so it gets this handler-free definition. */
@CrtModule({
  viewElements: VIEW_ELEMENT_TYPES
})
class DesignerCrtModule {}

@CrtModule({
  /* Specify the view elements of the module. */
  viewElements: VIEW_ELEMENT_TYPES,
  /* Global handlers that let view elements take part in page lifecycle and save. */
  requestHandlers: [PageContextInitHandler, PageContextDestroyHandler, SaveRecordHandler]
})
@NgModule({
  declarations: [
    TextInputComponent,
    MultiSelectComponent
  ],
  imports: [BrowserModule],
  providers: [],
})
export class AppModule implements DoBootstrap {
  constructor(private _injector: Injector) {}

  ngDoBootstrap(): void {
    /* Register the view elements as Angular Elements. */
    for (const [tagName, component] of VIEW_ELEMENTS) {
      customElements.define(tagName, createCustomElement(component, { injector: this._injector }));
    }

    /* Bootstrap CrtModule definitions. The designer opens in its own tab,
       so the module is bootstrapped there separately. */
    /* Designer routes: #/PageDesigner/..., #/InterfaceDesigner/... */
    const isDesigner = /^#\/\w*Designer\b/.test(window.location.hash);
    bootstrapCrtModule('su_angular_components', isDesigner ? DesignerCrtModule : AppModule, {
      resolveDependency: (token) => this._injector.get(<ProviderToken<unknown>>token)
    });
  }
}
