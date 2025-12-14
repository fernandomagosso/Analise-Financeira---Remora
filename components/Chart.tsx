import React, { useState, useMemo, useEffect } from 'react';
import {
  Area,
  ComposedChart, 
  Bar,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Settings, BarChart2, Activity, AlertTriangle, Eye, EyeOff, Layers } from 'lucide-react';
import { FinancialDataPoint } from '../types';
import { calculateRenkoBricks } from '../utils/renkoHelper';

interface ChartProps {
  data: FinancialDataPoint[];
  initialChartType?: 'area' | 'renko';
  initialBrickSize?: number;
}

type ChartType = 'area' | 'renko';

// Componente Customizado para renderizar T e F
const TopoFundoMarker = (props: any) => {
  const { cx, cy, payload } = props;
  
  // Se não houver sinalização, não renderiza
  if (!payload || payload.isTopSignal === undefined) return null;

  const isTop = payload.isTopSignal;

  return (
    <text 
      x={cx} 
      y={cy + (isTop ? -15 : 20)} // Offset visual
      fill={isTop ? '#ef4444' : '#10b981'} // Vermelho T, Verde F
      textAnchor="middle" 
      dominantBaseline="middle"
      fontSize={14}
      fontWeight="bold"
      style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))', pointerEvents: 'none', userSelect: 'none' }}
    >
      {isTop ? "T" : "F"}
    </text>
  );
};

const Chart: React.FC<ChartProps> = ({ data, initialChartType = 'area', initialBrickSize = 25 }) => {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [brickSize, setBrickSize] = useState<number>(initialBrickSize); 
  
  // Atualiza estado se as props mudarem (ex: reinício do componente)
  useEffect(() => {
    setChartType(initialChartType);
    setBrickSize(initialBrickSize);
  }, [initialChartType, initialBrickSize]);

  // Estados de visibilidade dos indicadores
  const [showMM72, setShowMM72] = useState(true);
  const [showJMA, setShowJMA] = useState(true);
  const [showSignals, setShowSignals] = useState(true);

  // --- ALGORITMO DE FILTRO ZIGZAG ---
  // Avalia topos e fundos relevantes baseados em alternância estrita (Topo -> Fundo -> Topo)
  // Se houver múltiplos topos consecutivos, mantém apenas o mais alto.
  // Se houver múltiplos fundos consecutivos, mantém apenas o mais baixo.
  const filterRelevantSignals = (items: any[]) => {
    const validIndices = new Set<number>();
    let pending = null; // { index, type: 'top' | 'bottom', value }

    items.forEach((item, i) => {
      // 1. Detectar se há dado cru do indicador no CSV
      if (item.topoFundo === undefined || item.topoFundo === null) return;

      // 2. Definir geometricamente se é candidato a Topo ou Fundo
      // (Renko usa wickBounds, Area usa high/low)
      const high = item.wickBounds ? item.wickBounds[1] : item.high;
      const low = item.wickBounds ? item.wickBounds[0] : item.low;
      
      const distHigh = Math.abs(item.topoFundo - high);
      const distLow = Math.abs(item.topoFundo - low);
      
      // Se estiver mais perto da máxima, é candidato a Topo.
      const isTopCandidate = distHigh <= distLow;
      const price = isTopCandidate ? high : low;

      // 3. Lógica ZigZag (Alternância Estrita)
      if (!pending) {
        pending = { index: i, type: isTopCandidate ? 'top' : 'bottom', value: price };
        return;
      }

      if (pending.type === 'top') {
        if (isTopCandidate) {
           // Conflito: Temos um Topo pendente e apareceu outro Topo.
           // REGRA: Se este novo for MAIS ALTO, ele assume o posto.
           if (price >= pending.value) {
              pending = { index: i, type: 'top', value: price };
           }
        } else {
           // Alternância: É um Fundo. 
           // Confirmamos o Topo anterior como relevante.
           validIndices.add(pending.index);
           // Iniciamos a busca por um novo fundo
           pending = { index: i, type: 'bottom', value: price };
        }
      } else { // pending.type === 'bottom'
         if (!isTopCandidate) {
            // Conflito: Temos um Fundo pendente e apareceu outro Fundo.
            // REGRA: Se este novo for MAIS BAIXO, ele assume.
            if (price <= pending.value) {
               pending = { index: i, type: 'bottom', value: price };
            }
         } else {
            // Alternância: É um Topo.
            // Confirmamos o Fundo anterior como relevante.
            validIndices.add(pending.index);
            // Iniciamos a busca por um novo topo
            pending = { index: i, type: 'top', value: price };
         }
      }
    });

    // Adiciona o último sinal pendente (o sinal atual do mercado)
    if (pending) validIndices.add(pending.index);

    return validIndices;
  };

  // Processamento de dados para Área
  const areaData = useMemo(() => {
    if (chartType !== 'area') return [];
    
    // 1. Executa o filtro de relevância
    const relevantIndices = filterRelevantSignals(data);

    return data.map((d, i) => {
      // Verifica se este índice foi marcado como relevante pelo algoritmo
      const isRelevant = relevantIndices.has(i);

      if (!isRelevant) {
          // Se não for relevante, passamos o dado sem as props de desenho do sinal
          return { ...d, topoFundoPoint: null, isTopSignal: undefined };
      }

      // Recalcula geometria para garantir precisão
      const distHigh = Math.abs(d.topoFundo! - d.high);
      const distLow = Math.abs(d.topoFundo! - d.low);
      const isTop = distHigh <= distLow;

      return {
        ...d,
        topoFundoPoint: isTop ? d.high : d.low, // Ancoragem exata no preço
        isTopSignal: isTop
      };
    });
  }, [data, chartType]);

  // Processamento de dados para Renko
  const renkoData = useMemo(() => {
    if (chartType !== 'renko') return [];
    
    const bricks = calculateRenkoBricks(data, brickSize);
    
    // 1. Executa o filtro de relevância nos tijolos
    const relevantIndices = filterRelevantSignals(bricks);

    return bricks.map((b, i) => {
      const isRelevant = relevantIndices.has(i);
      
      if (!isRelevant) {
          return { ...b, topoFundoPoint: null, isTopSignal: undefined };
      }

      const high = b.wickBounds[1];
      const low = b.wickBounds[0];
      
      const distHigh = Math.abs((b.topoFundo || 0) - high);
      const distLow = Math.abs((b.topoFundo || 0) - low);
      const isTop = distHigh <= distLow;

      return {
        ...b,
        topoFundoPoint: isTop ? high : low,
        isTopSignal: isTop
      };
    });
  }, [data, brickSize, chartType]);

  // Definição dos dados ativos
  const activeData = chartType === 'renko' ? renkoData : areaData;

  // Cálculo do domínio Y
  const yDomain = useMemo(() => {
    if (activeData.length === 0) return ['auto', 'auto'];

    let min = Infinity;
    let max = -Infinity;

    activeData.forEach((d: any) => {
      // Preço Base
      const l = d.low !== undefined ? d.low : (d.wickBounds ? d.wickBounds[0] : d.close);
      const h = d.high !== undefined ? d.high : (d.wickBounds ? d.wickBounds[1] : d.close);
      
      if (l < min) min = l;
      if (h > max) max = h;

      // Indicadores (MM72, JMA) apenas se estiverem visíveis
      if (showMM72 && d.mm72 && !isNaN(d.mm72)) {
         if (d.mm72 > max) max = d.mm72;
         if (d.mm72 < min) min = d.mm72;
      }
      if (showJMA && d.jma && !isNaN(d.jma)) {
         if (d.jma > max) max = d.jma;
         if (d.jma < min) min = d.jma;
      }
      
      if (showSignals && d.topoFundoPoint) {
         if (d.topoFundoPoint > max) max = d.topoFundoPoint;
         if (d.topoFundoPoint < min) min = d.topoFundoPoint;
      }
    });

    const padding = (max - min) * 0.1 || (max * 0.01); 
    
    if (min === Infinity || max === -Infinity) return ['auto', 'auto'];

    return [min - padding, max + padding];
  }, [activeData, showMM72, showJMA, showSignals]);

  if (!data || data.length === 0) return null;

  // Custom Tooltip Expandido
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-600 p-3 rounded-lg shadow-xl text-slate-200 text-xs z-50 min-w-[180px]">
          <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
            <span className="font-semibold text-slate-300">
                {chartType === 'renko' ? `Data: ${item.date}` : `Data: ${item.date}`}
            </span>
            {chartType === 'renko' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.type === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {item.type === 'up' ? 'COMPRA' : 'VENDA'}
                </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-y-1 gap-x-4 mb-3">
              <span className="text-slate-500">Abertura:</span>
              <span className="text-right font-mono">{item.open.toFixed(2)}</span>
              
              <span className="text-slate-500">Máxima:</span>
              <span className="text-right font-mono text-emerald-400/80">{chartType === 'renko' ? item.wickBounds[1].toFixed(2) : item.high.toFixed(2)}</span>
              
              <span className="text-slate-500">Mínima:</span>
              <span className="text-right font-mono text-red-400/80">{chartType === 'renko' ? item.wickBounds[0].toFixed(2) : item.low.toFixed(2)}</span>
              
              <span className="text-slate-400 font-bold">Fechamento:</span>
              <span className="text-right font-mono font-bold">{item.close.toFixed(2)}</span>
          </div>

          {(item.mm72 || item.jma || item.isTopSignal !== undefined) && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
                {item.mm72 && (
                <div className="flex justify-between text-orange-400">
                    <span>MM72:</span>
                    <span className="font-mono">{item.mm72.toFixed(2)}</span>
                </div>
                )}
                {item.jma && (
                <div className="flex justify-between text-cyan-400">
                    <span>JMA:</span>
                    <span className="font-mono">{item.jma.toFixed(2)}</span>
                </div>
                )}
                {item.isTopSignal !== undefined && (
                <div className="flex justify-between mt-1 pt-1 border-t border-slate-700/50">
                    <span className="text-white">Sinal:</span> 
                    <span className={`font-bold ${item.isTopSignal ? 'text-red-400' : 'text-emerald-400'}`}>
                        {item.isTopSignal ? 'TOPO RELEVANTE' : 'FUNDO RELEVANTE'}
                    </span>
                </div>
                )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <div className="w-full h-full bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm flex flex-col">
        
        {/* Header com Controles */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4">
          <div className="flex items-center gap-4">
              <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${chartType === 'renko' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                {chartType === 'renko' ? `Renko (${brickSize}R)` : 'Candle/Linha'}
              </h3>
              
              {/* Seletor de Tipo */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                onClick={() => setChartType('area')}
                className={`p-1.5 rounded transition-all ${chartType === 'area' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title="Gráfico de Linha/Área"
                >
                <Activity size={16} />
                </button>
                <button
                onClick={() => setChartType('renko')}
                className={`p-1.5 rounded transition-all ${chartType === 'renko' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title="Gráfico Renko"
                >
                <BarChart2 size={16} />
                </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             {/* Controles de Indicadores */}
             <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                 <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
                    <Layers size={12} /> Camadas:
                 </span>
                 
                 <button 
                    onClick={() => setShowMM72(!showMM72)}
                    className={`text-xs px-2 py-1 rounded border transition-all flex items-center gap-1 ${showMM72 ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'}`}
                 >
                    {showMM72 ? <Eye size={12} /> : <EyeOff size={12} />} MM72
                 </button>

                 <button 
                    onClick={() => setShowJMA(!showJMA)}
                    className={`text-xs px-2 py-1 rounded border transition-all flex items-center gap-1 ${showJMA ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'}`}
                 >
                    {showJMA ? <Eye size={12} /> : <EyeOff size={12} />} JMA
                 </button>

                 <button 
                    onClick={() => setShowSignals(!showSignals)}
                    className={`text-xs px-2 py-1 rounded border transition-all flex items-center gap-1 ${showSignals ? 'bg-white/10 text-white border-white/30' : 'bg-slate-800 text-slate-500 border-transparent hover:bg-slate-700'}`}
                 >
                    {showSignals ? <Eye size={12} /> : <EyeOff size={12} />} Sinais
                 </button>
             </div>

            {/* Controles Específicos do Renko */}
            {chartType === 'renko' && (
              <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700">
                <Settings size={14} className="text-slate-500" />
                <select 
                  value={brickSize} 
                  onChange={(e) => setBrickSize(Number(e.target.value))}
                  className="bg-transparent text-slate-200 text-xs py-1 focus:outline-none cursor-pointer"
                >
                  <option value={0.25} className="bg-slate-900">0.25R</option>
                  <option value={0.5} className="bg-slate-900">0.50R</option>
                  <option value={2} className="bg-slate-900">2R</option>
                  <option value={4} className="bg-slate-900">4R</option>
                  <option value={6} className="bg-slate-900">6R</option>
                  <option value={12} className="bg-slate-900">12R</option>
                  <option value={18} className="bg-slate-900">18R</option>
                  <option value={25} className="bg-slate-900">25R</option>
                  <option value={35} className="bg-slate-900">35R</option>
                  <option value={60} className="bg-slate-900">60R</option>
                  <option value={80} className="bg-slate-900">80R</option>
                  <option value={120} className="bg-slate-900">120R</option>
                  <option value={250} className="bg-slate-900">250R</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 w-full min-h-0 relative">
          {chartType === 'renko' && activeData.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10 bg-slate-800/80">
                <AlertTriangle className="w-8 h-8 mb-2 text-yellow-500" />
                <p>Nenhum tijolo gerado com {brickSize}R.</p>
                <p className="text-xs mt-1">O tamanho do R é muito grande para a volatilidade deste ativo.</p>
                <button 
                    onClick={() => setBrickSize(1)} 
                    className="mt-3 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white transition-colors"
                >
                    Tentar 1R
                </button>
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <ComposedChart data={activeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10}
                  minTickGap={50}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  domain={yDomain}
                  tickFormatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                
                <Area 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorClose)" 
                  strokeWidth={2}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#34d399' }}
                />

                {showMM72 && (
                    <Line 
                    type="monotone" 
                    dataKey="mm72" 
                    stroke="#f97316" 
                    strokeWidth={3} 
                    strokeDasharray="4 4" 
                    dot={false}
                    activeDot={false}
                    connectNulls={true} 
                    />
                )}

                {showJMA && (
                    <Line 
                    type="monotone" 
                    dataKey="jma" 
                    stroke="#06b6d4" 
                    strokeWidth={2} 
                    strokeDasharray="2 2" 
                    dot={false}
                    activeDot={false}
                    connectNulls={true} 
                    />
                )}

                {/* Usa topoFundoPoint (Preço) como Y */}
                {showSignals && (
                    <Scatter 
                    dataKey="topoFundoPoint" 
                    shape={<TopoFundoMarker />} 
                    legendType="none"
                    isAnimationActive={false}
                    />
                )}
              </ComposedChart>
            ) : (
              // RENKO CHART
              <ComposedChart 
                data={activeData} 
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }} 
                barGap={0} 
                barCategoryGap={1} 
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="index" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  tick={false}
                  label={{ value: 'Tijolos', position: 'insideBottom', fill: '#64748b', fontSize: 10 }}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  domain={yDomain}
                  tickFormatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  allowDataOverflow={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                
                {/* 1. Pavio (Atrás) */}
                <Bar 
                  dataKey="wickBounds" 
                  barSize={2} 
                  isAnimationActive={false}
                >
                   {activeData.map((entry: any, index: number) => (
                      <Cell key={`wick-${index}`} fill={entry.type === 'up' ? '#10b981' : '#ef4444'} />
                   ))}
                </Bar>

                {/* 2. Corpo (Frente) */}
                <Bar 
                  dataKey="bounds" 
                  isAnimationActive={false}
                >
                   {activeData.map((entry: any, index: number) => (
                      <Cell 
                        key={`body-${index}`} 
                        fill={entry.type === 'up' ? '#10b981' : '#ef4444'} 
                        stroke={entry.type === 'up' ? '#047857' : '#b91c1c'}
                      />
                   ))}
                </Bar>

                {/* 3. Indicadores (Sobreposto) */}
                {showMM72 && (
                    <Line 
                    type="monotone" 
                    dataKey="mm72" 
                    stroke="#f97316"
                    strokeWidth={3} 
                    strokeDasharray="4 4" 
                    dot={false}
                    connectNulls={true} 
                    isAnimationActive={false}
                    />
                )}

                {showJMA && (
                    <Line 
                    type="monotone" 
                    dataKey="jma" 
                    stroke="#06b6d4" 
                    strokeWidth={2} 
                    strokeDasharray="2 2" 
                    dot={false}
                    connectNulls={true} 
                    isAnimationActive={false}
                    />
                )}

                {showSignals && (
                    <Scatter 
                    dataKey="topoFundoPoint" 
                    shape={<TopoFundoMarker />} 
                    legendType="none"
                    isAnimationActive={false}
                    />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Chart;