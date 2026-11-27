import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
/** Global application settings that affect formatting across modules. */
interface SettingsState { currency: string; dateFormat: 'DD MMM YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY'; weekStartsOn: 0 | 1 }
const load = (): SettingsState => {
  const d: SettingsState = { currency: 'INR', dateFormat: 'DD MMM YYYY', weekStartsOn: 1 };
  try { return { ...d, ...JSON.parse(localStorage.getItem('hr.settings') || '{}') }; } catch { return d; }
};
const slice = createSlice({
  name: 'settings', initialState: load(),
  reducers: { updateSettings(s, a: PayloadAction<Partial<SettingsState>>) { Object.assign(s, a.payload); try { localStorage.setItem('hr.settings', JSON.stringify(s)); } catch { /* ignore */ } } },
});
export const { updateSettings } = slice.actions;
export default slice.reducer;
