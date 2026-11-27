import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Shell layout state shared by the header (toggle button), the sidebar and the content area. */
interface LayoutState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
}
const initialState: LayoutState = { sidebarCollapsed: false, mobileNavOpen: false };

const layoutSlice = createSlice({
  name: 'layout',
  initialState,
  reducers: {
    sidebarToggled(s) {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    },
    mobileNavSet(s, a: PayloadAction<boolean>) {
      s.mobileNavOpen = a.payload;
    },
  },
});
export const layoutActions = layoutSlice.actions;
export default layoutSlice.reducer;
