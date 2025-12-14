import { GoogleGenAI } from "@google/genai";
import { MessageRole, FinancialDataPoint, TradeSignal } from "../types";

// Helper para instanciar o cliente AI com a chave fornecida ou fallback para env
const getAIClient = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY;
  if (!key) {
    throw new Error("API Key não configurada. Por favor, adicione sua chave nas configurações.");
  }
  return new GoogleGenAI({ apiKey: key });
};

const TECHNICAL_SYSTEM_INSTRUCTION = `
Você é um Agente de Análise Gráfica Financeira Sênior.
OBJETIVO: Analisar ativos com base em dados históricos (Renko/Price Action).
DADOS: Abertura, Fechamento, Máxima, Mínima, MM72, JMA, Topos/Fundos.
REGRAS:
1. Tendência macro: Preço vs MM72.
2. Estrutura: Pivots de alta/baixa.
3. Viés: Preço vs JMA.
OUTPUT: Markdown, Resumo Executivo, Detalhes, Recomendação Final.
`;

const REPORT_SYSTEM_INSTRUCTION = `
ATUE COMO: Analista Financeiro Sênior (CNPI).
TAREFA: Gerar um RELATÓRIO TÉCNICO ESTRUTURADO em JSON.
DADOS FORNECIDOS: Histórico de preços (OHLC), Média Móvel 72 (Tendência), JMA (Fluxo), Topos e Fundos.

ESTRUTURA DA RESPOSTA (JSON):
- title: Título profissional do relatório.
- action: "COMPRA", "VENDA" ou "NEUTRO/AGUARDAR".
- prices: Objeto com "entry" (preço atual ou gatilho), "target" (alvo projetado) e "stop" (stop loss técnico). Se não houver recomendação clara, use "N/A".
- executiveSummary: Resumo de 2 linhas para destaque.
- content: O corpo completo do relatório em Markdown (Análise de Tendência, Pontos de Atenção, Justificativa).

TOM DE VOZ: Profissional, objetivo, claro e data-driven.
`;

const SIGNAL_SYSTEM_INSTRUCTION = `
Você é um algoritmo de trading quantitativo.
OBJETIVO: Analisar os dados técnicos e gerar um sinal de trade CLARO.
REGRAS:
- Tendência de Alta: Preço acima da MM72 e Topos/Fundos Ascendentes.
- Tendência de Baixa: Preço abaixo da MM72 e Topos/Fundos Descendentes.
- JMA: Confirma o fluxo de curto prazo.
OUTPUT: JSON estrito.
`;

const formatContextData = (contextData: { summary: any; recentData: FinancialDataPoint[] }) => {
    const hasIndicators = contextData.recentData.some(d => d.mm72 !== undefined || d.jma !== undefined);
      
    const tableHeader = hasIndicators 
    ? "Date | Open | High | Low | Close | MM72 | JMA | TopoFundo"
    : "Date | Open | High | Low | Close | Volume";

    const tableRows = contextData.recentData.map(d => {
    if (hasIndicators) {
        return `${d.date} | ${d.open} | ${d.high} | ${d.low} | ${d.close} | ${d.mm72?.toFixed(2) ?? 'N/A'} | ${d.jma?.toFixed(2) ?? 'N/A'} | ${d.topoFundo ?? '-'}`;
    }
    return `${d.date} | ${d.open} | ${d.high} | ${d.low} | ${d.close} | ${d.volume}`;
    }).join('\n');

    return `
DADOS RECENTES (Últimos ${contextData.recentData.length}):
${tableHeader}
${tableRows}

Resumo: Max: ${contextData.summary.highestPrice.toFixed(2)} | Min: ${contextData.summary.lowestPrice.toFixed(2)} | Fechamento: ${contextData.summary.lastClose.toFixed(2)}
    `;
};

export const analyzeFinancialData = async (
  history: { role: MessageRole; text: string }[],
  currentMessage: string,
  contextData?: { summary: any; recentData: FinancialDataPoint[] },
  apiKey?: string
): Promise<string> => {
  try {
    const ai = getAIClient(apiKey);
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: { systemInstruction: TECHNICAL_SYSTEM_INSTRUCTION, temperature: 0.2 },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });

    const dataContext = contextData ? formatContextData(contextData) : "";
    const prompt = dataContext ? `CONTEXTO:\n${dataContext}\n\nUSER:\n${currentMessage}` : currentMessage;

    const result = await chat.sendMessage({ message: prompt });
    return result.text || "Sem resposta.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `Erro na análise: ${error.message || "Verifique sua chave de API."}`;
  }
};

// Interface para o retorno do relatório estruturado
export interface ReportResponse {
    title: string;
    action: string;
    prices: {
        entry: string;
        target: string;
        stop: string;
    };
    executiveSummary: string;
    content: string;
}

// Função Atualizada para Gerar Relatório Completo (JSON)
export const generateReport = async (
    userInstruction: string,
    contextData?: { summary: any; recentData: FinancialDataPoint[] },
    apiKey?: string
): Promise<ReportResponse | null> => {
    try {
        const ai = getAIClient(apiKey);
        const dataContext = contextData ? formatContextData(contextData) : "";
        const fullPrompt = `DADOS TÉCNICOS DO MERCADO:\n${dataContext}\n\nINSTRUÇÃO ESPECÍFICA DO USUÁRIO PARA O RELATÓRIO:\n${userInstruction || "Faça uma análise geral padrão focada em Swing Trade."}`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                systemInstruction: REPORT_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING" },
                        action: { type: "STRING", enum: ["COMPRA", "VENDA", "NEUTRO/AGUARDAR"] },
                        prices: {
                            type: "OBJECT",
                            properties: {
                                entry: { type: "STRING" },
                                target: { type: "STRING" },
                                stop: { type: "STRING" }
                            }
                        },
                        executiveSummary: { type: "STRING" },
                        content: { type: "STRING" }
                    },
                    required: ["title", "action", "prices", "content", "executiveSummary"]
                }
            }
        });

        if (result.text) {
            return JSON.parse(result.text) as ReportResponse;
        }
        return null;
    } catch (error) {
        console.error("Gemini Report Error:", error);
        return null;
    }
}

// Nova função para o Sinal de Dashboard (JSON Estruturado)
export const generateTradeSignal = async (
  contextData: { summary: any; recentData: FinancialDataPoint[] },
  apiKey?: string
): Promise<TradeSignal | null> => {
  try {
    const ai = getAIClient(apiKey);
    const dataContext = formatContextData(contextData);
    const prompt = `Analise os últimos dados técnicos. Determine a ação (COMPRA, VENDA ou NEUTRO) com base no cruzamento de preço com médias e estrutura de topos/fundos. Forneça um motivo curto (max 100 caracteres).
    DADOS:
    ${dataContext}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SIGNAL_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
           type: "OBJECT",
           properties: {
             action: { type: "STRING", enum: ["COMPRA", "VENDA", "NEUTRO"] },
             reason: { type: "STRING" },
             confidence: { type: "STRING", enum: ["ALTA", "MÉDIA", "BAIXA"] }
           },
           required: ["action", "reason", "confidence"]
        }
      }
    });

    if (result.text) {
      return JSON.parse(result.text) as TradeSignal;
    }
    return null;
  } catch (error) {
    console.error("Gemini Signal Error:", error);
    return null;
  }
};