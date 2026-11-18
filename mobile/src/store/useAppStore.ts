import {create} from 'zustand';
export type Pathway='child'|'adult'|null;
type AppState={pathway:Pathway;userName:string;setPathway:(pathway:Pathway)=>void;setUserName:(name:string)=>void};
export const useAppStore=create<AppState>((set)=>({pathway:null,userName:'Amina',setPathway:(pathway)=>set({pathway}),setUserName:(userName)=>set({userName})}));
