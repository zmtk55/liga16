// Punto de acceso único a datos. Siempre usa Supabase (modo único en este proyecto).
import { supabaseProvider } from './supabase';
import type { DataProvider } from './provider';

export const db: DataProvider = supabaseProvider as never;
