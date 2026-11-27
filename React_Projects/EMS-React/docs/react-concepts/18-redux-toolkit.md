# 18 · Redux Toolkit (RTK)

## 1. Concept explanation
Redux is a predictable container for **shared client state**: one store, state changes only by dispatching *actions*, handled by pure
*reducers*. **Redux Toolkit** is the official, batteries-included way to write it: `configureStore` (sensible defaults, DevTools,
thunk middleware), `createSlice` (reducer + actions + initial state in one place, written with **Immer** so "mutating" code produces an
immutable update), `createAsyncThunk` (async workflows with automatic `pending/fulfilled/rejected` actions), `createSelector`
(memoised derived data) and `createEntityAdapter` (normalised collections).

Scope here: RTK owns **cross-feature client state and command workflows**. Server data caching is **RTK Query** (doc 19). Redux vs
Context decision guide: doc 08.

## 2. Syntax
```ts
const slice = createSlice({ name: 'employees', initialState, reducers: { toggleSelected(state, a: PayloadAction<number>) { state.selectedIds.push(a.payload); } },
  extraReducers: (b) => b.addCase(thunk.pending, …).addCase(thunk.fulfilled, …).addCase(thunk.rejected, …) });
export const thunk = createAsyncThunk('employees/fetchDirectory', async (arg, { rejectWithValue }) => { … });
export const store = configureStore({ reducer, middleware: (gd) => gd().concat(api.middleware), devTools: true });
export const useAppSelector = useSelector.withTypes<RootState>();
```

## 3. Actual EMS implementation (every required item)
| Item | Where |
|---|---|
| `configureStore`, **middleware**, **Redux DevTools** | `app/store/store.ts` — `emsApi.middleware` + a custom `rejectedThunkLogger` middleware (dev only); `devTools: env.isDev` |
| Typed hooks | `app/store/hooks.ts` → `useAppDispatch`, `useAppSelector`, `useAppStore` via `.withTypes<…>()`; components never import the untyped hooks |
| Typed thunks | `store/thunk.ts` → `createAsyncThunk.withTypes<{ state; dispatch; rejectValue: string }>()` |
| `createSlice`, initial state, reducers, actions, **payload** | all seven slices below |
| `extraReducers`, **pending / fulfilled / rejected**, **loading states**, **error handling** | `authSlice` (login/bootstrap/logout), `attendanceSlice` (`action: 'checking-in' \| 'checking-out'` disables buttons), `dashboardSlice` (`idle \| loading \| ready \| forbidden \| failed`), `employeeSlice` |
| **Normalised state** | `employeeSlice` — `createEntityAdapter` → `{ ids, entities }`, `setAll`, `upsertOne`, `removeOne`, `getSelectors` |
| **State immutability through Immer** | `toggleSelected` uses `splice/push` on the draft; a test proves the *previous* state object is untouched |
| `createSelector` | `store/selectors/dashboardSelectors.ts`, `employeeSelectors.ts` |
| **Root reducer wrapper** (reset on logout / session expiry) | `app/store/store.ts#rootReducer` |
| `sessionExpired` bridge | `AuthenticationProvider` registers `() => dispatch(sessionExpired())` with the HTTP layer |

**The seven slices** (`src/store/slices/`):
| Slice | State | Why it's Redux |
|---|---|---|
| `authSlice.ts` | status, user, profile, error, `bootstrapped` | session lifecycle with thunks (`bootstrapSession`, `login`, `logout`); thunk `condition` makes bootstrap run once |
| `employeeSlice.ts` | normalised **directory** (pickers), row selection, recently viewed | cross-screen lookup cache; `fetchEmployeeDirectory` paginates and has a `condition` guard (no duplicate loads) |
| `departmentSlice.ts` | `filterId` | the department filter that follows the user across employees/attendance/org/reports |
| `attendanceSlice.ts` | today's record + in-flight command | check-in/out is a *command*, not a cacheable GET |
| `leaveSlice.ts` | status filter, year, calendar month | shared by history, approvals-adjacent and calendar screens |
| `notificationSlice.ts` | unread count | needed on every screen and polled |
| `dashboardSlice.ts` | dashboard snapshot + status | single consumer; derived chart series via selectors |

No data is stored twice: the paged employee table is RTK Query, the employee *directory* is a different shape for pickers; the
dashboard lives only in its slice; leave data lives only in RTK Query (the slice keeps only UI state).

## 4. Relevant file paths
`src/app/store/store.ts`, `src/app/store/hooks.ts`, `src/store/thunk.ts`, `src/store/slices/*.ts`, `src/store/selectors/*.ts`, `src/store/slices/slices.test.ts`.

## 5. Practical implementation — a command workflow with loading and error state
```ts
export const checkIn = createAppThunk('attendance/checkIn', async (arg: { workMode?: WorkMode; remarks?: string }, { dispatch, rejectWithValue }) => {
  try { const rec = await attendanceApi.checkIn(arg.workMode, arg.remarks);
        dispatch(emsApi.util.invalidateTags([{ type: 'Attendance', id: 'LIST' }]));   // tell RTK Query its list is stale
        return rec; }
  catch (e) { return rejectWithValue(errorMessage(e)); }                               // serialisable string payload
});
builder.addCase(checkIn.pending,  (s) => { s.action = 'checking-in'; s.error = null; })
       .addCase(checkIn.fulfilled,(s, a) => { s.action = null; s.today = a.payload; })
       .addCase(checkIn.rejected, (s, a) => { s.action = null; s.error = a.payload ?? 'Check-in failed'; });
```
Tests (`slices.test.ts`, 27 tests): `pending` flag visible *during* the call; backend message surfaced on 422; logout resets every slice
**and** the RTK Query cache (no data leak between users); `condition` prevents a second directory fetch; selector memoisation
(`toBe` same reference after an unrelated action).

## 6. Why the concept is used
Check-in/out, the session, the dashboard and the badge are shared, asynchronous, and benefit from DevTools traceability and
explicit transitions. Slices keep each concern's reducers, actions, thunks and selectors together.

## 7. Advantages and limitations
**+** predictable, debuggable (time-travel), Immer removes spread-hell, typed hooks, memoised selectors, ecosystem (RTK Query, listener middleware). **−** more files/ceremony than local state; easy to over-use (don't put form text or server lists here); serialisable-state rule (no `Error`, `Date`, class instances — hence string `rejectValue` and plain `QueryError`); a custom root-reducer wrapper is needed to reset on logout.

## 8. Interview-related considerations
* Redux principles (single store, read-only state, pure reducers); why RTK over classic Redux.
* How does Immer let you "mutate"? When is it *not* safe (returning a new value **and** mutating)?
* `createAsyncThunk` lifecycle actions; `rejectWithValue`; `condition`; `unwrap()`; cancellation via `signal`.
* Normalisation and `createEntityAdapter`; why store ids + entities.
* Serialisability check; middleware order; DevTools; when *not* to use Redux.
