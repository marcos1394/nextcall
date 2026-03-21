/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Turn {
  id: number;
  code: string;
  status: 'waiting' | 'active' | 'completed';
  created_at: string;
}

export interface AppConfig {
  menu_url?: string;
  license_expiry?: string;
  restaurant_logo?: string;
  ad_image?: string;
  ad_is_video?: string;
  footer_image?: string;
  brand_color?: string;
  [key: string]: any;
}

export interface TurnData {
  active: Turn | null;
  waiting: Turn[];
  history: Turn[];
  config: AppConfig;
}

export interface IElectronAPI {
  getTurns: () => Promise<TurnData>;
  createTurn: () => Promise<Turn>;
  
  // SOLUCIÓN AL ERROR DE callTurn:
  // Le decimos explícitamente que puede recibir un número O un objeto
  callTurn: (data: number | { id: number; code?: string }) => Promise<boolean>;
  
  completeTurn: (id: number) => Promise<boolean>;
  saveSetting: (key: string, value: string) => Promise<boolean>;
  
  // SOLUCIÓN A LOS ERRORES DE FUNCIONES FALTANTES:
  getServerUrl: () => Promise<string>;
  onUpdate: (callback: () => void) => () => void;
  onVoiceTrigger: (callback: (code: string) => void) => () => void;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}