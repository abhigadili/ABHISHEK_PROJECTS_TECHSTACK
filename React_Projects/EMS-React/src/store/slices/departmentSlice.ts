import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * The department filter is *cross-feature client state*: choose "Engineering" on the employees screen and the same department
 * stays selected on attendance, org chart and reports. (Department DATA itself is server state → RTK Query.)
 */
const departmentSlice = createSlice({
  name: 'departments',
  initialState: { filterId: null as number | null },
  reducers: {
    setDepartmentFilter(state, a: PayloadAction<number | null>) {
      state.filterId = a.payload;
    },
  },
});
export const { setDepartmentFilter } = departmentSlice.actions;
export default departmentSlice.reducer;
