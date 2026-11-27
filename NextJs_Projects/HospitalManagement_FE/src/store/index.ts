import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { bookingReducer } from "./slices/bookingSlice";
/** Dev-only action logger - shows where custom middleware plugs in. */
const logger: Middleware = () => (next) => (action) => {
    if (
        process.env.NODE_ENV === "development" &&
        typeof action === "object" &&
        action &&
        "type" in action &&
        !String((action as { type: string }).type).endsWith("/pending")
    )
        console.debug("[redux]", (action as { type: string }).type);
    return next(action);
};
/** Store factory: one store per browser session (never a module singleton, so SSR requests never share state). */
export const makeStore = () =>
    configureStore({
        reducer: { booking: bookingReducer },
        middleware: (g) => g().concat(logger),
        devTools: process.env.NODE_ENV !== "production",
    });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
