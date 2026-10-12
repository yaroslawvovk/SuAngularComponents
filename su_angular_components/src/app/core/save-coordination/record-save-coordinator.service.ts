import { Injectable } from '@angular/core';
import { sameId } from '../data';
import { RecordSaveParticipant } from './record-save-participant';

/* Keeps the participants of the open pages. The crt.SaveRecordRequest handler asks it
   which participants belong to the record being saved. */
@Injectable({ providedIn: 'root' })
export class RecordSaveCoordinator {

	private readonly _participants = new Set<RecordSaveParticipant>();

	/* Returns the function that unregisters the participant. */
	public register(participant: RecordSaveParticipant): () => void {
		this._participants.add(participant);
		return () => this._participants.delete(participant);
	}

	public participantsFor(recordId: string): RecordSaveParticipant[] {
		return Array.from(this._participants).filter(item => sameId(item.recordId, recordId));
	}
}
