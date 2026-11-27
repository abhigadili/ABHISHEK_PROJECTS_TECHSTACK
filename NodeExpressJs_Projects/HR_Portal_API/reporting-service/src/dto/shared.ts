import { z } from '@hr/common';
export const fyShape = z.string().regex(/^\d{4}-\d{2}$/);
