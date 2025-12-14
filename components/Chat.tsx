import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage, MessageRole, FinancialDataPoint } from '../types';
import { analyzeFinancialData } from '../services/geminiService';
import { calculateSummary } from '../utils/csvHelper';

interface ChatProps {
  data: FinancialDataPoint[];
}

const Chat: React.FC<ChatProps> = ({ data }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: MessageRole.MODEL,
      text: "Olá. Sou seu Agente Sênior de Análise Gráfica. Importe um arquivo CSV contendo os dados do ativo (OHLC) e indicadores (MM72, JMA, Topos) para receber sua recomendação de trading.",
      timestamp: Date.now()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Trigger initial analysis when data is loaded
  useEffect(() => {
    if (data && data.length > 0 && messages.length === 1) {
      handleInitialAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleInitialAnalysis = async () => {
    setIsLoading(true);
    const summary = calculateSummary(data);
    const recentData = data.slice(-50); // Get more context for moving averages
    
    // Prompt específico para gerar o relatório inicial
    const initialPrompt = "Analise os dados fornecidos aplicando rigorosamente as regras do setup (MM72, Pivots e JMA). Gere o relatório completo com a recomendação final.";
    
    try {
        const responseText = await analyzeFinancialData([], initialPrompt, { summary, recentData });
        
        setMessages(prev => [
            ...prev,
            {
                role: MessageRole.MODEL,
                text: responseText,
                timestamp: Date.now()
            }
        ]);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: MessageRole.USER,
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context
      const summary = data.length > 0 ? calculateSummary(data) : undefined;
      const recentData = data.length > 0 ? data.slice(-50) : [];

      // Convert internal chat history to service format
      const historyForService = messages.map(m => ({ role: m.role, text: m.text }));

      const responseText = await analyzeFinancialData(
        historyForService,
        userMsg.text,
        data.length > 0 ? { summary, recentData } : undefined
      );

      setMessages(prev => [
        ...prev,
        {
          role: MessageRole.MODEL,
          text: responseText,
          timestamp: Date.now()
        }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: MessageRole.MODEL,
          text: "Erro na análise. Certifique-se que o CSV possui os indicadores corretos.",
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-emerald-400" />
        <h2 className="font-semibold text-slate-200">Agente Técnico (Renko/Setup)</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.role === MessageRole.USER ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === MessageRole.USER
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {msg.role === MessageRole.USER ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === MessageRole.USER
                  ? 'bg-blue-600/20 text-blue-100 border border-blue-600/30'
                  : 'bg-slate-700/50 text-slate-200 border border-slate-600'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white animate-pulse" />
             </div>
             <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-400">
                Processando setup e regras...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-850 border-t border-slate-700">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={data.length > 0 ? "Ex: Onde está o próximo suporte?" : "Carregue o CSV com MM72 e JMA"}
            disabled={isLoading}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-4 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;