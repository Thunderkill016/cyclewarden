export interface ForgeStartActionState {
  ok: boolean;
  error: string | null;
  errorCode: string | null;
  runId: string | null;
  taskId: string | null;
  repository: string | null;
  demo: boolean;
}

export const initialForgeStartActionState: ForgeStartActionState = {
  ok: false,
  error: null,
  errorCode: null,
  runId: null,
  taskId: null,
  repository: null,
  demo: false,
};
