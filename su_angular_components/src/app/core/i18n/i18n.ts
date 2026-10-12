export type SupportedLanguage = 'en' | 'uk' | 'ru';

export type Translations<TKey extends string> = Record<SupportedLanguage, Record<TKey, string>>;

/* Uses <html lang> when the host page sets it, otherwise the browser language. */
export function currentLanguage(): SupportedLanguage {
	const source = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
	if (source.startsWith('uk')) {
		return 'uk';
	}
	if (source.startsWith('ru')) {
		return 'ru';
	}
	return 'en';
}

/* Returns the dictionary of the current language. */
export function translate<TKey extends string>(translations: Translations<TKey>): Record<TKey, string> {
	return translations[currentLanguage()];
}
