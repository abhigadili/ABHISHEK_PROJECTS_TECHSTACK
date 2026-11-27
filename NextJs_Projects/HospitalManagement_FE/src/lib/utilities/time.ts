/** Time helpers kept OUTSIDE components so render functions stay pure (React compiler lint) - callers pass the result as data. */
export const msUntil = (d: Date | string) => new Date(d).getTime() - Date.now();
export const daysUntil = (d: Date | string) => Math.floor(msUntil(d) / 86_400_000);
