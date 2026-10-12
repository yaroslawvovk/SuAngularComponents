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

@CrtModule({
  /* Specify the view elements of the module. */
  viewElements: [TextInputComponent, MultiSelectComponent],
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

    /* Bootstrap CrtModule definitions. */
    bootstrapCrtModule('su_angular_components', AppModule, {
      resolveDependency: (token) => this._injector.get(<ProviderToken<unknown>>token)
    });
  }
}
