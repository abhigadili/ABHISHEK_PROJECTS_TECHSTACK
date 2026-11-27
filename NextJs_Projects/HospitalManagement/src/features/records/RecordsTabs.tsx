'use client';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Radix Tabs (accessible keyboard navigation, aria roles). The tab PANELS are Server Components passed in as props/children:
 * a Client Component can render server-rendered markup it never imports ("passing Server Components as children").
 */
export function RecordsTabs({ timeline, conditions, documents }: { timeline: ReactNode; conditions: ReactNode; documents: ReactNode }) {
  return (
    <Tabs defaultValue="timeline">
      <TabsList aria-label="Medical record sections"><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="conditions">Chronic conditions</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger></TabsList>
      <TabsContent value="timeline">{timeline}</TabsContent>
      <TabsContent value="conditions">{conditions}</TabsContent>
      <TabsContent value="documents">{documents}</TabsContent>
    </Tabs>
  );
}
