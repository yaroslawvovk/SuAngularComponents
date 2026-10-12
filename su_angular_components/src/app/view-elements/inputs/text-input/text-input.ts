/* Import the required functionality from the libraries. */
import {
	Component,
	EventEmitter,
	Input,
	Output,
	ViewEncapsulation
} from '@angular/core';
import {
	CrtInput,
	CrtInterfaceDesignerItem,
	CrtOutput,
	CrtValidationInfo,
	CrtValidationInput,
	CrtViewElement
} from '@creatio-devkit/common';

/* Required for the raw-loader require() call below. */
declare const require: any;

/* Counter used to generate a unique id per component instance
   so that the <label for="..."> stays correct on pages with several inputs. */
let instanceCounter = 0;

@Component({
	selector: 'su-text-input',
	standalone: false,
	templateUrl: './text-input.html',
	styleUrls: ['./text-input.scss'],
	encapsulation: ViewEncapsulation.ShadowDom
})

/* Register the component as a Freedom UI view element of the "usr.Input" type. */
@CrtViewElement({
	selector: 'su-text-input',
	type: 'su.TextInput'
})

/* Add the component to the "Custom components" group of the Freedom UI Designer library. */
@CrtInterfaceDesignerItem({
	toolbarConfig: {
		caption: 'Text Input',
		name: 'TextInput',
		icon: require('!!raw-loader?{esModule:false}!../../../../assets/icons/pen.svg'),
		defaultPropertyValues: {
			label: 'Text input'
		}
	}
})

export class TextInputComponent {

	/* The bound value. Two-way binding works because of the valueChange output below:
	   bind it in the page schema as "value": "$SomePageAttribute". */
	@Input()
	@CrtInput()
	public value: string = '';

	/* Emits the new value to the bound page attribute. The "<property>Change"
	   naming convention is what makes the binding two-way. */
	@Output()
	@CrtOutput()
	public valueChange = new EventEmitter<string>();

	/* The field caption. */
	@Input()
	@CrtInput()
	public label: string = '';

	/* The placeholder shown while the field is empty. */
	@Input()
	@CrtInput()
	public placeholder: string = '';

  @Input()
  @CrtInput()
  public isReadonly = false;


	/* Blocks editing and dims the field. */
	@Input()
	@CrtInput()
	public disabled = false;

	/* Optional character limit. */
	@Input()
	@CrtInput()
	public maxLength?: number;

	/* Receives the validation state of the bound attribute from page validators. */
	@Input()
	@CrtValidationInput()
	public valueValidationInfo?: CrtValidationInfo;

	public readonly inputId = `su-text-input-${++instanceCounter}`;

  public get isInvalid(): boolean {
      return this.valueValidationInfo?.valid === false;
  }

  public get validationMessage(): string {
      const info = this.valueValidationInfo as unknown as Record<string, any> | undefined;
      return info?.['message'] ?? info?.['messages']?.[0] ?? info?.['text'] ?? '';
  }

	/* Writes the typed value back to the bound page attribute. */
	public onInput(newValue: string): void {
		if (newValue === this.value) {
			return;
		}
		this.value = newValue;
		this.valueChange.emit(newValue);
	}
}
