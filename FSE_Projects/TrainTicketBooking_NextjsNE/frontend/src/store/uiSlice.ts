import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
export interface Toast { id: string; kind: 'success' | 'error' | 'info'; title: string; message?: string }
const slice = createSlice({
  name: 'ui', initialState: { toasts: [] as Toast[] },
  reducers: {
    toastAdded: { reducer: (s, a: PayloadAction<Toast>) => { s.toasts.push(a.payload); }, prepare: (t: Omit<Toast, 'id'>) => ({ payload: { ...t, id: nanoid() } }) },
    toastRemoved: (s, a: PayloadAction<string>) => { s.toasts = s.toasts.filter((t) => t.id !== a.payload); },
  },
});
export const { toastAdded, toastRemoved } = slice.actions;
export default slice.reducer;
