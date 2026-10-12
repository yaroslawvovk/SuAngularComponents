/* A view element that stores its own data next to a page record (child records, links)
   and has to take part in saving that record. */
export interface RecordSaveParticipant {

	/* Id of the page record the element belongs to. */
	readonly recordId: string;

	/* Called before the page record is saved. Returning false cancels the save,
	   e.g. when a required element is empty. */
	validateBeforeSave?(): boolean | Promise<boolean>;

	/* Called after the save request has passed through the platform.
	   The page may still have refused to save (validation, a page handler),
	   so check that the page record exists before writing records that reference it. */
	afterRecordSaved(): Promise<void>;
}
