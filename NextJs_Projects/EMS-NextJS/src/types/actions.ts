/** Form-action state shared by Server Actions (server) and forms (client). Plain, serialisable data only. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** echoed back so a form can be re-populated after a failed server-side validation (progressive enhancement) */
  values?: Record<string, string>;
  data?: Record<string, string | number>;
}
