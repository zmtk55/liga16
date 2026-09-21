// Punto de acceso único a datos. Cambia entre demo y supabase por variables de entorno.
import { DATA_MODE, type DataProvider } from './provider';
import { demoProvider } from './demo';
import { supabaseProvider } from './supabase';

export const db: DataProvider = DATA_MODE === 'supabase' ? supabaseProvider : demoProvider;
export { DATA_MODE };
