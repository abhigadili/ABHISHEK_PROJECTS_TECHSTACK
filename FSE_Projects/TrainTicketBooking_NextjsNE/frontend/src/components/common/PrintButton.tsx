'use client';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
export function PrintButton() { return <Button variant="outline" onClick={() => window.print()}><Printer size={16} />Print ticket</Button>; }
