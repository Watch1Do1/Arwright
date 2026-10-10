// Demo mode runs entirely in the browser: it never reads or writes the real database
// and never calls the AI server. It is only available when VITE_ENABLE_DEMO=true.
export const DEMO_UID = 'demo-user-123';

export const ENABLE_DEMO = ((import.meta as any).env?.VITE_ENABLE_DEMO) === 'true';

export const isDemoUid = (uid?: string | null): boolean => uid === DEMO_UID;
