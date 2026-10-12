import { BaseRequest, BaseRequestHandler, CrtInject, CrtRequestHandler } from '@creatio-devkit/common';
import { toId } from '../data';
import { RecordSaveCoordinator } from './record-save-coordinator.service';

/* Global handler of the page save. It does nothing for pages without participants.
   Otherwise it validates them, lets the platform save the page record,
   and then lets each participant write its own records. */
@CrtRequestHandler({
	type: 'su.RecordSaveCoordinator.SaveRecord',
	requestType: 'crt.SaveRecordRequest'
})
export class SaveRecordHandler extends BaseRequestHandler {

	constructor(@CrtInject(RecordSaveCoordinator) private readonly _coordinator: RecordSaveCoordinator) {
		super();
	}

	public override async handle(request: BaseRequest): Promise<unknown> {
		const recordId = toId(await request.$context?.['Id']);
		/* Taken before saving: closing the page after save destroys the elements,
		   but their pending data must still be written. */
		const participants = recordId ? this._coordinator.participantsFor(recordId) : [];
		if (!participants.length) {
			return this.next?.handle(request);
		}
		for (const participant of participants) {
			if (participant.validateBeforeSave && !(await participant.validateBeforeSave())) {
				return false;
			}
		}
		const result = await this.next?.handle(request);
		if (result === false) {
			return result;
		}
		for (const participant of participants) {
			try {
				await participant.afterRecordSaved();
			} catch (error) {
				/* The page record is already saved; one failed participant must not block the others. */
				console.error('[su.RecordSaveCoordinator] participant failed after save', error);
			}
		}
		return result;
	}
}
