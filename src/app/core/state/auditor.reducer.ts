import { createReducer, on } from "@ngrx/store";
import { clearAuditorDetails, setAuditorDetails, updateAuditorDetails } from "./auditor.action";

export enum PrefferedLanguages {
    EnglishUS = 'en-US',
    SpanishPR = 'es-PR',
    GermanDefault = 'de-DE',
    frenchDefault = 'fr-FR',
    arabicSA = 'ar-SA'
}

export enum LanguagesRoutes {
    EnglishUSRoute = '/translation-demo/',
    SpanishPRRoute = '/translation-demo/es-PR/',
    GermanDefaultRoute = '/translation-demo/de-DE/',
    FrenchDefaultRoute = '/translation-demo/fr-FR/',
    ArabicSARoute = '/translation-demo/ar-SA/',
}

export interface AuditorState {
    id: number | null;
    userName: string | null;
    email: string | null;
    profileRole?: string;
    billingRole?: string;
    prefferedLanguage?: PrefferedLanguages;
    timeZone?: string;
}

export const initialAuditorState: AuditorState = {
    id: null,
    userName: null,
    email: null,
    profileRole: undefined,
    billingRole: undefined,
    prefferedLanguage: undefined,
    timeZone: undefined
};

export const auditorReducer = createReducer(
    initialAuditorState,
    on(setAuditorDetails, (state, { id, userName, email, profileRole, billingRole, prefferedLanguage, timeZone } : AuditorState ) => ({
        ...state,
        id,
        userName,
        email,
        profileRole,
        billingRole,
        prefferedLanguage,
        timeZone
    })),
    on(updateAuditorDetails, (state, { id, userName, email, profileRole, billingRole, prefferedLanguage, timeZone }) => ({
        ...state,
        ...(id !== undefined && { id }),
        ...(userName !== undefined && { userName }),
        ...(email !== undefined && { email }),
        ...(profileRole !== undefined && { profileRole }),
        ...(billingRole !== undefined && { billingRole }),
        ...(prefferedLanguage !== undefined && { prefferedLanguage }),
        ...(timeZone !== undefined && { timeZone })
    })),
    on(clearAuditorDetails, () => ({ ...initialAuditorState }))
);
