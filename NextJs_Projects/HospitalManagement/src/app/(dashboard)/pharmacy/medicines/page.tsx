import { redirect } from 'next/navigation';
/** The medicine catalogue lives at /pharmacy; this keeps the breadcrumb parent of /pharmacy/medicines/[id] valid. */
export default function MedicinesIndex() { redirect('/pharmacy'); }
