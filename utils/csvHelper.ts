import Papa from 'papaparse';
import { FinancialDataPoint } from '../types';

// Helper function to parse date strings into a comparable timestamp and ISO string
const parseAndNormalizeDate = (val: any): { timestamp: number, isoDate: string } | null => {
  if (!val) return null;
  
  // If already a number (unlikely for CSV but possible)
  if (typeof val === 'number') {
    const d = new Date(val);
    return { 
      timestamp: val, 
      isoDate: d.toISOString().split('T')[0] 
    };
  }

  let str = String(val).trim();
  // Clean potential time parts
  str = str.split(' ')[0].split('T')[0];

  // Try to split by common separators
  const parts = str.split(/[\/\-\.]/); // Matches / or - or .
  
  let dateObj: Date | null = null;

  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);

    if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
      // Heuristics for format detection
      
      // Case 1: YYYY-MM-DD (First part is year > 31)
      if (a > 31) {
        dateObj = new Date(a, b - 1, c);
      }
      // Case 2: DD-MM-YYYY (Last part is year > 31) - Common in Brazil
      else if (c > 31) {
        dateObj = new Date(c, b - 1, a);
      }
      // Case 3: DD-MM-YY (Last part is 2 digits)
      else if (parts[2].length === 2) {
        dateObj = new Date(2000 + c, b - 1, a);
      }
      // Case 4: Ambiguous (e.g. 01/01/2023) - Assume DD/MM/YYYY for PT-BR context
      else {
        dateObj = new Date(c, b - 1, a);
      }
    }
  }

  // Fallback: Try standard Date constructor
  if (!dateObj || isNaN(dateObj.getTime())) {
    const tryDate = new Date(str);
    if (!isNaN(tryDate.getTime())) {
      dateObj = tryDate;
    }
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    // Manually format to YYYY-MM-DD to avoid UTC shifts
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return {
      timestamp: dateObj.getTime(),
      isoDate: `${year}-${month}-${day}`
    };
  }

  return null;
};

export const parseCSV = (file: File): Promise<FinancialDataPoint[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedData: FinancialDataPoint[] = results.data
            .map((row: any): FinancialDataPoint | null => {
              // Normalize keys
              const normalizedRow: any = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key.toLowerCase().trim()] = row[key];
              });

              const dateVal = normalizedRow.date || normalizedRow.data;
              const closeVal = normalizedRow.close || normalizedRow.fechamento || normalizedRow.ultimo;

              if (!dateVal || !closeVal) return null;

              const dateInfo = parseAndNormalizeDate(dateVal);
              if (!dateInfo) return null;

              // Helper for fuzzy match keys
              const findKey = (search: string) => Object.keys(normalizedRow).find(k => k.includes(search));
              
              const mm72Key = findKey('mm72') || findKey('media_72') || findKey('exp_72');
              const jmaKey = findKey('jma') || findKey('scapp');
              const toposKey = findKey('topos') || findKey('fundo') || findKey('detector');

              const parseNum = (val: any) => {
                if (!val) return 0;
                if (typeof val === 'number') return val;
                
                const strVal = String(val).trim();
                if (strVal.includes(',') && strVal.includes('.')) {
                    if (strVal.lastIndexOf(',') > strVal.lastIndexOf('.')) {
                        return parseFloat(strVal.replace(/\./g, '').replace(',', '.'));
                    }
                } else if (strVal.includes(',')) {
                    return parseFloat(strVal.replace(',', '.'));
                }
                return parseFloat(strVal);
              };

              return {
                date: dateInfo.isoDate, // Standardized YYYY-MM-DD
                open: parseNum(normalizedRow.open || normalizedRow.abertura || closeVal),
                high: parseNum(normalizedRow.high || normalizedRow.maxima || closeVal),
                low: parseNum(normalizedRow.low || normalizedRow.minima || closeVal),
                close: parseNum(closeVal),
                volume: parseInt(String(normalizedRow.volume || normalizedRow.volume || '0').replace(/\./g, '').replace(',', '.'), 10),
                
                mm72: mm72Key ? parseNum(normalizedRow[mm72Key]) : undefined,
                jma: jmaKey ? parseNum(normalizedRow[jmaKey]) : undefined,
                topoFundo: toposKey ? parseNum(normalizedRow[toposKey]) : undefined,
              };
            })
            .filter((item): item is FinancialDataPoint => item !== null && !isNaN(item.close));

          if (parsedData.length === 0) {
            reject(new Error("Nenhum dado válido encontrado. Verifique as colunas Data e Close."));
          } else {
            // STRICT SORT: Oldest (Small Date) to Newest (Big Date)
            parsedData.sort((a, b) => {
              const timeA = new Date(a.date).getTime();
              const timeB = new Date(b.date).getTime();
              return timeA - timeB;
            });
            resolve(parsedData);
          }
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
};

export const calculateSummary = (data: FinancialDataPoint[]) => {
  if (data.length === 0) return null;

  let maxPrice = -Infinity;
  let minPrice = Infinity;
  let totalVolume = 0;
  
  data.forEach(d => {
    if (d.high > maxPrice) maxPrice = d.high;
    if (d.low < minPrice) minPrice = d.low;
    totalVolume += d.volume;
  });

  const first = data[0];
  const last = data[data.length - 1];
  const change = ((last.close - first.open) / first.open) * 100;

  return {
    startDate: first.date,
    endDate: last.date,
    highestPrice: maxPrice,
    lowestPrice: minPrice,
    averageVolume: totalVolume / data.length,
    priceChangePercentage: change,
    lastClose: last.close
  };
};