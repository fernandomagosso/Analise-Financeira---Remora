export interface FinancialDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Indicadores Técnicos
  mm72?: number; // Média Móvel Exponencial 72
  jma?: number;  // ScApp_JMA
  topoFundo?: number; // Detector de Topos e Fundos
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface ChatMessage {
  role: MessageRole;
  text: string;
  timestamp: number;
}

export interface AnalysisSummary {
  ticker?: string;
  startDate: string;
  endDate: string;
  highestPrice: number;
  lowestPrice: number;
  averageVolume: number;
  priceChangePercentage: number;
}

export interface TradeSignal {
  action: 'COMPRA' | 'VENDA' | 'NEUTRO';
  reason: string;
  confidence: 'ALTA' | 'MÉDIA' | 'BAIXA';
}