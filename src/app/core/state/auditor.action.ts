import { createAction, props } from "@ngrx/store";
import { AuditorState, PrefferedLanguages } from "./auditor.reducer";

export interface AuditorDetails {
    id: number;
    userName: string;
    email: string;
    profileRole?: string;
    billingRole?: string;
    prefferedLanguage?: PrefferedLanguages;
    timezone?: string;
}

export const setAuditorDetails = createAction(
    '[Auditor] setAuditorDetails',
    props<AuditorState>()
);

export const updateAuditorDetails = createAction(
    '[Auditor] updateAuditorDetails',
    props<Partial<AuditorState>>()
);

export const clearAuditorDetails = createAction('[Auditor] clearAuditorDetails');
