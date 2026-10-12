/* Import the required functionality from the libraries. */
import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	HostBinding,
	Input,
	NgZone,
	OnChanges,
	OnDestroy,
	SimpleChanges,
	ViewChild,
	ViewEncapsulation
} from '@angular/core';
import { CrtInput, CrtInterfaceDesignerItem, CrtViewElement, LookupValue } from '@creatio-devkit/common';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { EntityDataService, sameId, toId } from '../../../core/data';
import { Translations, translate } from '../../../core/i18n/i18n';
import { RecordNavigationService } from '../../../core/navigation';
import { RecordSaveCoordinator, RecordSaveParticipant } from '../../../core/save-coordination';
import { MultiSelectDataSource } from './multi-select.data';

/* Required for the raw-loader require() call below. */
declare const require: any;

type LabelPosition = 'above' | 'left' | 'auto' | 'hidden';

/* idle: nothing to show yet (no record, designer, loading or load error);
   deferred: the page record is not saved yet, changes are kept in memory until the page is saved;
   live: the page record exists, every change is written at once. */
type Mode = 'idle' | 'deferred' | 'live';

type TextKey = 'search' | 'empty' | 'loading' | 'required' | 'addRecord' | 'remove' | 'loadError' | 'saveError';

const TEXTS: Translations<TextKey> = {
	en: {
		search: 'Search',
		empty: 'No data',
		loading: 'Loading...',
		required: 'Required field',
		addRecord: 'Add new record',
		remove: 'Remove',
		loadError: 'Failed to load data',
		saveError: 'Failed to save changes'
	},
	uk: {
		search: 'Пошук',
		empty: 'Немає даних',
		loading: 'Завантаження...',
		required: 'Обов\'язкове поле',
		addRecord: 'Додати новий запис',
		remove: 'Видалити',
		loadError: 'Не вдалося завантажити дані',
		saveError: 'Не вдалося зберегти зміни'
	},
	ru: {
		search: 'Поиск',
		empty: 'Нет данных',
		loading: 'Загрузка...',
		required: 'Обязательное поле',
		addRecord: 'Добавить новую запись',
		remove: 'Удалить',
		loadError: 'Не удалось загрузить данные',
		saveError: 'Не удалось сохранить изменения'
	}
};

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;
const DROPDOWN_MAX_HEIGHT = 360;
const DROPDOWN_MIN_WIDTH = 240;
/* Distance from the list bottom at which the next page starts loading. */
const LOAD_MORE_THRESHOLD_PX = 40;

/* Inputs that define which data the element shows; a change reloads it. */
const DATA_INPUTS = ['recordId', 'recordRelationColumnName', 'selectSchemaName', 'selectColumnName'];

let instanceCounter = 0;

function byCaption(a: LookupValue, b: LookupValue): number {
	return a.displayValue.localeCompare(b.displayValue);
}

@Component({
	selector: 'su-multi-select',
	standalone: false,
	templateUrl: './multi-select.html',
	styleUrls: ['./multi-select.scss'],
	encapsulation: ViewEncapsulation.ShadowDom,
	changeDetection: ChangeDetectionStrategy.OnPush
})

/* Register the component as a Freedom UI view element of the "su.MultiSelect" type.
   Its inputs repeat crt.MultiSelect, so a page switches over by changing "type" only. */
@CrtViewElement({
	selector: 'su-multi-select',
	type: 'su.MultiSelect'
})

/* Add the component to the "Custom components" group of the Freedom UI Designer library. */
@CrtInterfaceDesignerItem({
	toolbarConfig: {
		caption: 'Multi select',
		name: 'MultiSelect',
		icon: require('!!raw-loader?{esModule:false}!../../../../assets/icons/multi-select.svg'),
		defaultPropertyValues: {
			label: 'Multi select',
			labelPosition: 'above'
		}
	}
})

export class MultiSelectComponent implements OnChanges, OnDestroy {

	/* Id of the page record, bound as "$Id". */
	@Input()
	@CrtInput()
	public recordId: string = '';

	/* Column of the link schema that points to the page record, e.g. "SuIncident". */
	@Input()
	@CrtInput()
	public recordRelationColumnName: string = '';

	/* Link schema of the many-to-many relation, e.g. "SuConfItemInIncident". */
	@Input()
	@CrtInput()
	public selectSchemaName: string = '';

	/* Column of the link schema that holds the selected value, e.g. "SuConfItem". */
	@Input()
	@CrtInput()
	public selectColumnName: string = '';

	@Input()
	@CrtInput()
	public label: string = '';

	@Input()
	@CrtInput()
	public labelPosition: LabelPosition = 'above';

	@Input()
	@CrtInput()
	public placeholder: string = '';

	@Input()
	@CrtInput()
	public tooltip: string = '';

	@Input()
	@CrtInput()
	public required = false;

	@Input()
	@CrtInput()
	public readonly = false;

	/* Shows the "+" button in the dropdown that opens the add page of the value schema. */
	@Input()
	@CrtInput()
	public enableAddRecord = false;

	@Input()
	@CrtInput()
	public visible = true;

	@ViewChild('control')
	private _control?: ElementRef<HTMLElement>;

	@ViewChild('searchInput')
	private _searchInput?: ElementRef<HTMLInputElement>;

	@ViewChild('list')
	private _list?: ElementRef<HTMLElement>;

	public readonly t = translate(TEXTS);
	public readonly labelId = `su-multi-select-${++instanceCounter}`;
	public readonly listId = `${this.labelId}-list`;
	public readonly isDesigner: boolean;

	public selected: LookupValue[] = [];
	public options: LookupValue[] = [];
	public optionsLoading = false;
	public isOpen = false;
	public search = '';
	public activeIndex = -1;
	public dropdownStyle: Record<string, string> = {};
	public message = '';
	public showRequiredError = false;

	private _mode: Mode = 'idle';
	private _source: MultiSelectDataSource | null = null;
	/* Bumped on every (re)load; a response with an older version is dropped. */
	private _loadVersion = 0;
	private _optionsVersion = 0;
	private _optionsExhausted = false;
	private _destroyed = false;
	private _unregisterParticipant: (() => void) | null = null;
	private readonly _search$ = new Subject<string>();
	private readonly _searchSubscription: Subscription;

	private readonly _onDocumentMouseDown = (event: Event): void => {
		/* The shadow root retargets event.target to the host, so check the full path. */
		if (!event.composedPath().includes(this._host.nativeElement)) {
			this._zone.run(() => this.close());
		}
	};

	private readonly _onViewportChange = (): void => {
		this._zone.run(() => {
			this._updatePosition();
			this._render();
		});
	};

	constructor(
		private readonly _host: ElementRef<HTMLElement>,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _zone: NgZone,
		private readonly _data: EntityDataService,
		private readonly _navigation: RecordNavigationService,
		private readonly _coordinator: RecordSaveCoordinator
	) {
		this.isDesigner = !!_host.nativeElement.closest('crt-interface-designer');
		this._searchSubscription = this._search$
			.pipe(debounceTime(SEARCH_DEBOUNCE_MS))
			.subscribe(text => {
				if (text !== this.search) {
					this.search = text;
					void this._loadOptions(true);
				}
			});
	}

	@HostBinding('class.su-hidden')
	public get isHidden(): boolean {
		return this.visible === false;
	}

	public get showLabel(): boolean {
		return !!this.label && this.labelPosition !== 'hidden';
	}

	public get canEdit(): boolean {
		return !this.readonly && this._mode !== 'idle';
	}

	public ngOnChanges(changes: SimpleChanges): void {
		if (DATA_INPUTS.some(name => name in changes)) {
			void this._initialize();
		}
	}

	public ngOnDestroy(): void {
		this.close();
		this._destroyed = true;
		this._unregisterParticipant?.();
		this._searchSubscription.unsubscribe();
	}

	public trackById(_index: number, item: LookupValue): string {
		return item.value;
	}

	public onControlClick(): void {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	/* Keys pressed on a chip button bubble up here too; only the field itself opens the dropdown. */
	public onControlKeydown(event: KeyboardEvent): void {
		if (event.target !== event.currentTarget) {
			return;
		}
		if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
			event.preventDefault();
			this.open();
		}
	}

	public open(): void {
		if (!this.canEdit || this.isOpen) {
			return;
		}
		this.isOpen = true;
		this.search = '';
		this.activeIndex = -1;
		this._updatePosition();
		document.addEventListener('mousedown', this._onDocumentMouseDown, true);
		window.addEventListener('scroll', this._onViewportChange, true);
		window.addEventListener('resize', this._onViewportChange);
		this._render();
		setTimeout(() => this._searchInput?.nativeElement.focus());
		void this._loadOptions(true);
	}

	public close(): void {
		if (!this.isOpen) {
			return;
		}
		this.isOpen = false;
		this.options = [];
		this.optionsLoading = false;
		/* Drops the response of a request still in flight. */
		this._optionsVersion++;
		document.removeEventListener('mousedown', this._onDocumentMouseDown, true);
		window.removeEventListener('scroll', this._onViewportChange, true);
		window.removeEventListener('resize', this._onViewportChange);
		this._render();
	}

	public onSearch(text: string): void {
		this._search$.next(text.trim());
	}

	public onSearchKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this._moveActive(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				this._moveActive(-1);
				break;
			case 'Enter':
				event.preventDefault();
				if (this.options[this.activeIndex]) {
					void this.onSelect(this.options[this.activeIndex]);
				}
				break;
			case 'Escape':
				event.preventDefault();
				this.close();
				this._control?.nativeElement.focus();
				break;
		}
	}

	public onListScroll(): void {
		const list = this._list?.nativeElement;
		if (!list || this.optionsLoading || this._optionsExhausted) {
			return;
		}
		if (list.scrollTop + list.clientHeight >= list.scrollHeight - LOAD_MORE_THRESHOLD_PX) {
			void this._loadOptions(false);
		}
	}

	/* The dropdown stays open, so several values can be picked in a row. */
	public async onSelect(option: LookupValue): Promise<void> {
		const source = this._source;
		if (!source || !this.canEdit || this.selected.some(item => sameId(item, option))) {
			return;
		}
		const recordId = this._recordId;
		this.message = '';
		this.showRequiredError = false;
		this.selected = [...this.selected, option].sort(byCaption);
		this.options = this.options.filter(item => !sameId(item, option));
		this.activeIndex = Math.min(this.activeIndex, this.options.length - 1);
		this._render();
		if (this._mode !== 'live') {
			return;
		}
		try {
			await source.addLink(recordId, option.value);
		} catch (error) {
			this.selected = this.selected.filter(item => !sameId(item, option));
			this._fail(this.t.saveError, error);
		}
	}

	public async onRemove(event: Event, value: LookupValue): Promise<void> {
		event.stopPropagation();
		const source = this._source;
		if (!source || !this.canEdit) {
			return;
		}
		const recordId = this._recordId;
		this.message = '';
		this.selected = this.selected.filter(item => !sameId(item, value));
		this._render();
		if (this._mode !== 'live') {
			return;
		}
		try {
			await source.removeLink(recordId, value.value);
		} catch (error) {
			this.selected = [...this.selected, value].sort(byCaption);
			this._fail(this.t.saveError, error);
		}
	}

	/* Opens the edit page of the value in the current tab. Works in read-only mode as well. */
	public async onChipClick(event: Event, value: LookupValue): Promise<void> {
		event.stopPropagation();
		const source = this._source;
		if (!source) {
			return;
		}
		try {
			const schemaName = await source.getValueSchemaName();
			await this._navigation.openRecord(schemaName, value.value, this._recordId);
		} catch (error) {
			this._fail(this.t.loadError, error);
		}
	}

	/* Opens the add page of the value schema with the search text as the caption.
	   The new record is not selected automatically: it appears in the list next time. */
	public async onAddRecord(): Promise<void> {
		const source = this._source;
		if (!source) {
			return;
		}
		const search = this.search;
		this.close();
		try {
			const schemaName = await source.getValueSchemaName();
			const displayName = await this._data.metadata.getPrimaryDisplayAttributeName(schemaName);
			await this._navigation.createRecord(schemaName, search ? { [displayName]: search } : {}, this._recordId);
		} catch (error) {
			this._fail(this.t.loadError, error);
		}
	}

	private get _recordId(): string {
		return toId(this.recordId);
	}

	private async _initialize(): Promise<void> {
		const version = ++this._loadVersion;
		this.close();
		this._mode = 'idle';
		this._source = null;
		this.selected = [];
		this.message = '';
		this.showRequiredError = false;
		this._unregisterParticipant?.();
		this._unregisterParticipant = null;

		const recordId = this._recordId;
		if (this.isDesigner || !recordId || !this.recordRelationColumnName || !this.selectSchemaName || !this.selectColumnName) {
			this._render();
			return;
		}
		const source = new MultiSelectDataSource(this._data, {
			linkSchemaName: this.selectSchemaName,
			masterColumnName: this.recordRelationColumnName,
			valueColumnName: this.selectColumnName
		});
		this._source = source;
		this._unregisterParticipant = this._coordinator.register(this._createParticipant(recordId, source));

		try {
			const exists = await source.masterRecordExists(recordId);
			if (version !== this._loadVersion) {
				return;
			}
			if (exists) {
				const selected = await source.loadSelected(recordId);
				if (version !== this._loadVersion) {
					return;
				}
				this.selected = selected;
				this._mode = 'live';
			} else {
				this._mode = 'deferred';
			}
		} catch (error) {
			if (version !== this._loadVersion) {
				return;
			}
			this._fail(this.t.loadError, error);
		}
		this._render();
	}

	private _createParticipant(recordId: string, source: MultiSelectDataSource): RecordSaveParticipant {
		return {
			recordId,
			validateBeforeSave: () => this._validateBeforeSave(),
			afterRecordSaved: () => this._commitDeferred(recordId, source)
		};
	}

	/* An element that failed to load does not block the save. */
	private _validateBeforeSave(): boolean {
		const valid = !this.required || this._mode === 'idle' || this.selected.length > 0;
		this.showRequiredError = !valid;
		this._render();
		return valid;
	}

	/* Writes the values picked before the page record existed.
	   Runs even if the page was closed by the save: the values are still held here. */
	private async _commitDeferred(recordId: string, source: MultiSelectDataSource): Promise<void> {
		if (this._mode !== 'deferred' || this._source !== source) {
			return;
		}
		if (!(await source.masterRecordExists(recordId))) {
			return;
		}
		/* From here on the record exists, so the element switches to live mode
		   even if some links fail: the reload below shows what was really saved. */
		this._mode = 'live';
		try {
			for (const value of [...this.selected]) {
				await source.addLink(recordId, value.value);
			}
		} catch (error) {
			this._fail(this.t.saveError, error);
		}
		if (this._destroyed || this._source !== source) {
			return;
		}
		try {
			this.selected = await source.loadSelected(recordId);
		} catch (error) {
			this._fail(this.t.loadError, error);
		}
		this._render();
	}

	private async _loadOptions(reset: boolean): Promise<void> {
		const source = this._source;
		if (!source || !this.isOpen) {
			return;
		}
		const version = ++this._optionsVersion;
		if (reset) {
			this.options = [];
			this.activeIndex = -1;
			this._optionsExhausted = false;
		}
		this.optionsLoading = true;
		this._render();
		try {
			/* Selected values are excluded on the server, and the list drops a value once it is picked,
			   so the list length is the right offset even after picks. */
			const page = await source.loadOptions({
				search: this.search,
				excludeIds: this.selected.map(item => item.value),
				offset: this.options.length,
				size: PAGE_SIZE
			});
			if (version !== this._optionsVersion) {
				return;
			}
			this.options = [...this.options, ...page];
			this._optionsExhausted = page.length < PAGE_SIZE;
		} catch (error) {
			if (version !== this._optionsVersion) {
				return;
			}
			this._fail(this.t.loadError, error);
		}
		this.optionsLoading = false;
		this._render();
	}

	private _moveActive(step: number): void {
		if (!this.options.length) {
			return;
		}
		this.activeIndex = Math.max(0, Math.min(this.options.length - 1, this.activeIndex + step));
		this._render();
		this._list?.nativeElement
			.querySelectorAll<HTMLElement>('.ms__option')[this.activeIndex]
			?.scrollIntoView({ block: 'nearest' });
	}

	/* The dropdown uses position: fixed, so containers with overflow: hidden do not clip it.
	   It opens upwards when there is not enough room below the field. */
	private _updatePosition(): void {
		const control = this._control?.nativeElement;
		if (!control) {
			return;
		}
		const rect = control.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && rect.top > spaceBelow;
		const space = (openUp ? rect.top : spaceBelow) - 8;
		this.dropdownStyle = {
			left: `${rect.left}px`,
			width: `${Math.max(rect.width, DROPDOWN_MIN_WIDTH)}px`,
			'max-height': `${Math.min(DROPDOWN_MAX_HEIGHT, Math.max(space, 160))}px`,
			...(openUp
				? { bottom: `${window.innerHeight - rect.top + 4}px` }
				: { top: `${rect.bottom + 4}px` })
		};
	}

	private _fail(message: string, error: unknown): void {
		console.error('[su.MultiSelect]', error);
		this.message = message;
		this._render();
	}

	/* Data calls resolve outside Angular's change detection; this brings the view up to date. */
	private _render(): void {
		if (!this._destroyed) {
			this._zone.run(() => this._cdr.markForCheck());
		}
	}
}
