/* eslint-disable react-refresh/only-export-components */
import type {ReactNode} from "react";
const user={id:'u0',email:'demo@example.invalid',role:localStorage.getItem('fixtureRole')==='admin'?'admin':'organizer',player_id:'p0'};
export const useAuth=()=>({user,loading:false,isConfigured:true,signOut:async()=>{}});
export const AuthProvider=({children}:{children:ReactNode})=>children;
