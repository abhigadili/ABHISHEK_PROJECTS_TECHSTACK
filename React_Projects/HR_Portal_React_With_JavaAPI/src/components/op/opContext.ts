import { createContext, useContext } from 'react';
/** The id of the operation whose form is being rendered (lets field-level defaults depend on the operation). */
export const OpContext = createContext<string>('');
export const useOpContext = () => useContext(OpContext);
