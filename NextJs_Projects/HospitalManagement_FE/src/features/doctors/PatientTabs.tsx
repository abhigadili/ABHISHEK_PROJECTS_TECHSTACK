'use client';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
/** Radix Tabs whose panels are SERVER-rendered nodes passed as props (a Client Component rendering server markup it never imports). */
export function PatientTabs({ records, prescriptions, labs, add }: { records: ReactNode; prescriptions: ReactNode; labs: ReactNode; add: ReactNode }) {
  return <Tabs defaultValue="records"><TabsList aria-label="Patient sections"><TabsTrigger value="records">Medical records</TabsTrigger><TabsTrigger value="rx">Prescriptions</TabsTrigger><TabsTrigger value="lab">Laboratory</TabsTrigger><TabsTrigger value="add">Add record</TabsTrigger></TabsList><TabsContent value="records">{records}</TabsContent><TabsContent value="rx">{prescriptions}</TabsContent><TabsContent value="lab">{labs}</TabsContent><TabsContent value="add">{add}</TabsContent></Tabs>;
}
