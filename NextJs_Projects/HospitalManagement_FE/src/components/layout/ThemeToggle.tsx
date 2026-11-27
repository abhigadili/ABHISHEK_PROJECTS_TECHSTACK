'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Tip } from '@/components/ui/radix-extras';
export function ThemeToggle() { const { mode, toggle } = useTheme(); return <Tip text={mode === 'dark' ? 'Light mode' : 'Dark mode'}><button type="button" onClick={toggle} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} className="grid size-9 cursor-pointer place-items-center rounded-lg border border-line bg-surface hover:bg-surface2">{mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}</button></Tip>; }
