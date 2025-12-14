import React, { useState } from 'react';
import { Upload, TrendingUp, TrendingDown, Minus, BarChart2, FileText, AlertCircle, Sparkles, Activity } from 'lucide-react';
import Chart from './components/Chart';
import AnalysisModal from './components/AnalysisModal';
import { FinancialDataPoint, TradeSignal } from './types';
import { parseCSV, calculateSummary } from './utils/csvHelper';
import { generateTradeSignal } from './services/geminiService';

type AppStage = 'idle' | 'dashboard';

const App: React.FC = () => {
  const [data, setData] = useState<FinancialDataPoint[]>([]);
  const [appStage, setAppStage] = useState<AppStage>('idle');
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  // AI Signal State
  const [tradeSignal, setTradeSignal] = useState<TradeSignal | null>(null);
  const [loadingSignal, setLoadingSignal] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoadingFile(true);
    setError(null);
    setFileName(file.name);
    setTradeSignal(null); // Reset signal

    try {
      const parsedData = await parseCSV(file);
      setData(parsedData);
      setAppStage('dashboard');

      // Trigger Signal Analysis Immediately
      setLoadingSignal(true);
      const summary = calculateSummary(parsedData);
      const recentData = parsedData.slice(-60); 
      
      generateTradeSignal({ summary, recentData })
        .then(signal => setTradeSignal(signal))
        .catch(e => console.error("Failed to generate signal", e))
        .finally(() => setLoadingSignal(false));

    } catch (err: any) {
      setError(err.message || "Erro ao processar arquivo");
      setData([]);
      setAppStage('idle');
    } finally {
      setLoadingFile(false);
      event.target.value = '';
    }
  };

  const summary = calculateSummary(data);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md fixed top-0 w-full z-10 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Fin<span className="text-emerald-500">Analyst</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
           {appStage === 'dashboard' && (
               <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium rounded-full shadow-lg shadow-emerald-900/40 transition-all transform hover:scale-105"
               >
                   <Sparkles size={14} />
                   IA Insights
               </button>
           )}
           <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Gemini AI Ready
           </div>
        </div>
      </header>

      <main className="pt-24 pb-6 px-6 h-screen flex flex-col gap-6 max-w-[1920px] mx-auto">
        
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div>
                <h1 className="text-lg font-semibold text-white">
                    Painel de Análise de Mercado
                </h1>
                <p className="text-sm text-slate-400">
                    Visualize dados históricos com indicadores técnicos e receba insights via IA.
                </p>
            </div>

            <div className="flex items-center gap-4">
                {fileName && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-md border border-slate-700 text-sm">
                        <FileText size={16} className="text-emerald-500" />
                        <span className="truncate max-w-[150px]">{fileName}</span>
                    </div>
                )}
                
                <label className="cursor-pointer group relative overflow-hidden transition-all text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-emerald-900/20 bg-emerald-600 hover:bg-emerald-500">
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                    {loadingFile ? (
                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <Upload size={18} />
                    )}
                    <span>{fileName ? 'Importar Outro CSV' : 'Importar CSV'}</span>
                </label>
            </div>
        </div>

        {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
                <AlertCircle className="text-red-500" />
                {error}
            </div>
        )}

        {/* --- STAGE: IDLE --- */}
        {appStage === 'idle' && (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md p-8 border border-slate-800 rounded-2xl bg-slate-900/50">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUp size={40} className="text-emerald-500 opacity-50" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-200">Comece sua Análise</h2>
                    <p className="text-slate-400">
                        Carregue um arquivo CSV contendo dados do ativo (OHLC) e indicadores (MM72, JMA) para visualizar a análise.
                    </p>
                </div>
            </div>
        )}

        {/* --- STAGE: DASHBOARD (FULL WIDTH) --- */}
        {appStage === 'dashboard' && (
            <div className="flex-1 flex flex-col gap-6 min-h-0 animate-fadeIn">
                
                {/* AI SIGNAL CARD */}
                <div className="grid grid-cols-1 gap-6">
                    <div className={`relative rounded-xl border p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 overflow-hidden transition-all ${
                        loadingSignal ? 'bg-slate-800 border-slate-700' :
                        tradeSignal?.action === 'COMPRA' ? 'bg-emerald-500/10 border-emerald-500/30' : 
                        tradeSignal?.action === 'VENDA' ? 'bg-rose-500/10 border-rose-500/30' : 
                        'bg-slate-800 border-slate-700'
                    }`}>
                        
                        {/* Background Pulse Animation */}
                        {loadingSignal && (
                           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skeleton-shimmer"></div>
                        )}

                        <div className="flex items-center gap-4 z-10">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                                loadingSignal ? 'bg-slate-700 text-slate-500' :
                                tradeSignal?.action === 'COMPRA' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 
                                tradeSignal?.action === 'VENDA' ? 'bg-rose-500 text-white shadow-rose-500/20' : 
                                'bg-slate-700 text-slate-300'
                            }`}>
                                {loadingSignal ? <Activity className="animate-pulse" /> : 
                                 tradeSignal?.action === 'COMPRA' ? <TrendingUp size={24} /> :
                                 tradeSignal?.action === 'VENDA' ? <TrendingDown size={24} /> :
                                 <Minus size={24} />
                                }
                            </div>
                            
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Recomendação IA</h2>
                                {loadingSignal ? (
                                    <div className="h-6 w-32 bg-slate-700 rounded animate-pulse"></div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className={`text-2xl font-bold ${
                                            tradeSignal?.action === 'COMPRA' ? 'text-emerald-400' : 
                                            tradeSignal?.action === 'VENDA' ? 'text-rose-400' : 
                                            'text-slate-200'
                                        }`}>
                                            {tradeSignal?.action || 'NEUTRO'}
                                        </span>
                                        {tradeSignal?.confidence && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-950/30 border border-white/10 text-slate-400">
                                                Confiança: {tradeSignal.confidence}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reason Text */}
                        <div className="flex-1 md:text-right z-10">
                             {loadingSignal ? (
                                 <div className="flex flex-col gap-2 items-start md:items-end">
                                     <div className="h-4 w-full md:w-2/3 bg-slate-700 rounded animate-pulse"></div>
                                     <div className="h-4 w-1/2 md:w-1/3 bg-slate-700 rounded animate-pulse"></div>
                                 </div>
                             ) : (
                                 <p className="text-slate-300 text-sm leading-relaxed max-w-2xl ml-auto italic">
                                     "{tradeSignal?.reason || 'Aguardando dados suficientes para análise técnica...'}"
                                 </p>
                             )}
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard 
                        label="Último Fechamento" 
                        value={summary ? `$${summary.lastClose.toFixed(2)}` : '--'} 
                        trend={summary?.priceChangePercentage}
                    />
                    <StatCard 
                        label="Máxima Histórica" 
                        value={summary ? `$${summary.highestPrice.toFixed(2)}` : '--'} 
                    />
                    <StatCard 
                        label="Mínima Histórica" 
                        value={summary ? `$${summary.lowestPrice.toFixed(2)}` : '--'} 
                    />
                    <StatCard 
                        label="Volume Médio" 
                        value={summary ? (summary.averageVolume / 1000).toFixed(1) + 'k' : '--'} 
                        icon={<BarChart2 size={16} className="text-slate-500" />}
                    />
                </div>

                {/* Main Chart Area - Full Width */}
                <div className="flex-1 min-h-[400px] w-full">
                    <Chart key="dashboard-chart" data={data} initialChartType="area" initialBrickSize={25} />
                </div>
            </div>
        )}
      </main>

      {/* AI Modal Component */}
      <AnalysisModal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)} 
         data={data} 
      />
    </div>
  );
};

const StatCard = ({ label, value, trend, icon }: { label: string, value: string, trend?: number, icon?: React.ReactNode }) => (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-between hover:border-slate-600 transition-colors">
        <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
            {icon}
        </div>
        <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-white">{value}</span>
            {trend !== undefined && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded mb-1 ${trend >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
                </span>
            )}
        </div>
    </div>
);

export default App;