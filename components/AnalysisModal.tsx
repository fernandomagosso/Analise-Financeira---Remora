import React, { useState, useEffect } from 'react';
import { X, Sparkles, FileText, Copy, Check, RefreshCw, TrendingUp, TrendingDown, Target, ShieldAlert, DollarSign } from 'lucide-react';
import { FinancialDataPoint } from '../types';
import { calculateSummary } from '../utils/csvHelper';
import { generateReport, ReportResponse } from '../services/geminiService';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: FinancialDataPoint[];
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, data }) => {
  const [instruction, setInstruction] = useState('');
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
        // Maintain state if reopened to allow reviewing
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setReportData(null);
    setErrorMsg(null);
    setCopied(false);

    try {
        const summary = calculateSummary(data);
        const recentData = data.slice(-60);
        
        const result = await generateReport(instruction, { summary, recentData });
        if (result) {
            setReportData(result);
        } else {
            setErrorMsg("Não foi possível gerar a análise. Tente novamente.");
        }
    } catch (e) {
        setErrorMsg("Erro de conexão ao gerar o relatório.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (reportData) {
        // Reconstrói o formato de email a partir do JSON
        const emailFormat = `
${reportData.title.toUpperCase()}
----------------------------------------
RECOMENDAÇÃO: ${reportData.action}

PREÇOS DE REFERÊNCIA:
> Entrada: ${reportData.prices.entry}
> Alvo:    ${reportData.prices.target}
> Stop:    ${reportData.prices.stop}

RESUMO EXECUTIVO:
${reportData.executiveSummary}

ANÁLISE DETALHADA:
${reportData.content}
----------------------------------------
Gerado por AI - Remora
        `.trim();

        navigator.clipboard.writeText(emailFormat);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
      setReportData(null);
      setInstruction('');
      setErrorMsg(null);
      setCopied(false);
  };

  const getActionColor = (action: string) => {
      if (action.includes('COMPRA')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      if (action.includes('VENDA')) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  };

  const getActionGradient = (action: string) => {
      if (action.includes('COMPRA')) return 'from-emerald-600 to-teal-700';
      if (action.includes('VENDA')) return 'from-rose-600 to-red-700';
      return 'from-slate-600 to-slate-700';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container - WIDER (max-w-5xl) and HIGHER */}
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeInScale">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-800/80">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <FileText className="text-emerald-500" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-100">Gerador de Relatórios AI</h2>
                    <p className="text-xs text-slate-400">Análise Quantitativa & Técnica Avançada</p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700"
            >
                <X size={24} />
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-900/50">
            
            {/* 1. INPUT STATE */}
            {!reportData && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full p-8 max-w-2xl mx-auto space-y-8 animate-fadeIn">
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-white">Configurar Nova Análise</h3>
                        <p className="text-slate-400">Defina o foco do relatório ou deixe em branco para uma análise padrão.</p>
                    </div>

                    <div className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-1 shadow-inner">
                        <textarea
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="Ex: 'Foque em operações de curto prazo', 'Analise divergências de volume', ou 'Verifique a tendência semanal'."
                            className="w-full h-40 bg-slate-900/50 rounded-lg p-5 text-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                        />
                    </div>
                    
                    {errorMsg && (
                        <div className="text-red-400 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                            {errorMsg}
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        className="w-full max-w-md bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-lg font-semibold py-4 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                    >
                        <Sparkles size={24} />
                        Gerar Análise Completa
                    </button>
                </div>
            )}

            {/* 2. LOADING STATE */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles size={32} className="text-emerald-400 animate-pulse" />
                        </div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-slate-200">Processando Dados de Mercado...</h3>
                        <p className="text-slate-500 mt-2">Calculando médias, identificando pivots e estruturando relatório.</p>
                    </div>
                </div>
            )}

            {/* 3. REPORT RESULT STATE */}
            {reportData && (
                <div className="p-8 space-y-8 animate-fadeIn max-w-5xl mx-auto">
                    
                    {/* TOP ACTION BAR */}
                    <div className="flex justify-between items-center">
                         <button 
                            onClick={handleClear}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
                        >
                            <RefreshCw size={16} /> Nova Análise
                        </button>
                        <div className="flex gap-3">
                             <button
                                onClick={handleCopy}
                                className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg ${
                                    copied 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                }`}
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                                {copied ? 'Copiado para E-mail' : 'Copiar Relatório'}
                            </button>
                        </div>
                    </div>

                    {/* HERO SECTION - VISUAL CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* MAIN ACTION CARD */}
                        <div className={`col-span-1 md:col-span-1 p-6 rounded-2xl bg-gradient-to-br ${getActionGradient(reportData.action)} text-white shadow-xl relative overflow-hidden group`}>
                             <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                                 {reportData.action.includes('COMPRA') ? <TrendingUp size={80} /> : <TrendingDown size={80} />}
                             </div>
                             <p className="text-sm font-medium opacity-80 uppercase tracking-wider mb-1">Recomendação</p>
                             <h2 className="text-4xl font-black tracking-tight mb-2">{reportData.action}</h2>
                             <p className="text-sm opacity-90 line-clamp-3 leading-relaxed">
                                 {reportData.executiveSummary}
                             </p>
                        </div>

                        {/* PRICE TARGETS GRID */}
                        <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-4">
                            
                            {/* Entry Price */}
                            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                    <DollarSign size={18} className="text-blue-400" />
                                    <span className="text-xs font-bold uppercase">Entrada</span>
                                </div>
                                <span className="text-2xl font-bold text-white tracking-tight">{reportData.prices.entry}</span>
                            </div>

                            {/* Target Price */}
                            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                    <Target size={18} className="text-emerald-400" />
                                    <span className="text-xs font-bold uppercase">Alvo</span>
                                </div>
                                <span className="text-2xl font-bold text-emerald-400 tracking-tight">{reportData.prices.target}</span>
                            </div>

                            {/* Stop Price */}
                            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition-colors">
                                <div className="flex items-center gap-2 text-slate-400 mb-2">
                                    <ShieldAlert size={18} className="text-rose-400" />
                                    <span className="text-xs font-bold uppercase">Stop Loss</span>
                                </div>
                                <span className="text-2xl font-bold text-rose-400 tracking-tight">{reportData.prices.stop}</span>
                            </div>
                        </div>
                    </div>

                    {/* REPORT CONTENT BODY */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center gap-2">
                            <FileText size={16} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{reportData.title}</span>
                        </div>
                        <div className="p-8 text-slate-800 font-serif leading-relaxed whitespace-pre-wrap text-base">
                            {reportData.content}
                        </div>
                    </div>

                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;