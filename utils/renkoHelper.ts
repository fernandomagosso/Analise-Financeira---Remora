import { FinancialDataPoint } from '../types';

export interface RenkoBrick {
  index: number;
  date: string;
  open: number;
  close: number;
  high: number; 
  low: number;  
  type: 'up' | 'down';
  bounds: [number, number]; // Corpo [min, max]
  wickBounds: [number, number]; // Pavio [min, max]
  // Indicadores herdados do candle gerador
  mm72?: number;
  jma?: number;
  topoFundo?: number;
}

export const calculateRenkoBricks = (data: FinancialDataPoint[], brickSize: number): RenkoBrick[] => {
  if (!data || data.length === 0 || brickSize <= 0) return [];

  const bricks: RenkoBrick[] = [];
  
  // Normaliza o preço inicial para o "grid" do Renko
  let currentRefPrice = Math.floor(data[0].close / brickSize) * brickSize;
  let brickIndex = 0;

  // Variáveis para rastrear extremos (pavios) entre formações de tijolos
  let periodHigh = data[0].high;
  let periodLow = data[0].low;

  for (let i = 0; i < data.length; i++) {
    const { close, high, low, date, mm72, jma, topoFundo } = data[i];

    // Atualiza os extremos do período atual (acumula pavio)
    if (high > periodHigh) periodHigh = high;
    if (low < periodLow) periodLow = low;

    let createdBricksInThisStep: RenkoBrick[] = [];

    // Tenta criar tijolos de ALTA
    while (close >= currentRefPrice + brickSize) {
      const brickOpen = currentRefPrice;
      const brickClose = currentRefPrice + brickSize;
      
      createdBricksInThisStep.push({
        index: brickIndex++,
        date: date,
        open: brickOpen,
        close: brickClose,
        high: brickClose,
        low: brickOpen,
        type: 'up',
        bounds: [brickOpen, brickClose],
        wickBounds: [brickOpen, brickClose], // Provisório
        mm72,
        jma,
        topoFundo // Carrega o indicador se houver neste candle
      });
      
      currentRefPrice += brickSize;
    }

    // Tenta criar tijolos de BAIXA
    while (close <= currentRefPrice - brickSize) {
      const brickOpen = currentRefPrice;
      const brickClose = currentRefPrice - brickSize;
      
      createdBricksInThisStep.push({
        index: brickIndex++,
        date: date,
        open: brickOpen,
        close: brickClose,
        high: brickOpen, // No Down, High é o Open
        low: brickClose, // No Down, Low é o Close
        type: 'down',
        bounds: [brickClose, brickOpen], // [min, max]
        wickBounds: [brickClose, brickOpen], // Provisório
        mm72,
        jma,
        topoFundo
      });
      
      currentRefPrice -= brickSize;
    }

    // Se tijolos foram criados, distribuímos os pavios acumulados
    if (createdBricksInThisStep.length > 0) {
      // 1. Identificar quem fica com o pavio superior (tijolo mais alto) e inferior (tijolo mais baixo)
      
      let maxBrickIdx = 0;
      let minBrickIdx = 0;
      let maxVal = -Infinity;
      let minVal = Infinity;

      createdBricksInThisStep.forEach((b, idx) => {
        const bTop = b.bounds[1];
        const bBottom = b.bounds[0];
        
        if (bTop > maxVal) { maxVal = bTop; maxBrickIdx = idx; }
        if (bBottom < minVal) { minVal = bBottom; minBrickIdx = idx; }
      });

      // Aplica Pavio Superior
      const highestBrick = createdBricksInThisStep[maxBrickIdx];
      const lowestBrick = createdBricksInThisStep[minBrickIdx];

      highestBrick.wickBounds[1] = Math.max(periodHigh, highestBrick.bounds[1]);
      
      // Aplica Pavio Inferior
      lowestBrick.wickBounds[0] = Math.min(periodLow, lowestBrick.bounds[0]);

      // IMPORTANTE: Garantir que wickBounds cubra pelo menos o corpo (fallback visual)
      createdBricksInThisStep.forEach(b => {
         b.wickBounds[0] = Math.min(b.wickBounds[0], b.bounds[0]);
         b.wickBounds[1] = Math.max(b.wickBounds[1], b.bounds[1]);
      });

      // Se houver Topo/Fundo neste candle, atribuímos ao tijolo mais extremo visualmente
      if (topoFundo) {
         // Lógica simples: Se o topoFundo está mais perto do High do período, poe no highestBrick
         // Se perto do Low, poe no lowestBrick
         const distHigh = Math.abs(topoFundo - periodHigh);
         const distLow = Math.abs(topoFundo - periodLow);
         
         if (distHigh < distLow) {
            highestBrick.topoFundo = topoFundo;
         } else {
            lowestBrick.topoFundo = topoFundo;
         }
      }

      // Adiciona ao array principal
      bricks.push(...createdBricksInThisStep);

      // Reseta os acumuladores para o próximo candle
      if (i < data.length - 1) {
         periodHigh = data[i+1].high; 
         periodLow = data[i+1].low;
      }
    }
  }

  return bricks;
};