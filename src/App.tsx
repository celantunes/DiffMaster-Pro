/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { diffLines, diffChars, Change } from 'diff';
import { 
  Plus, 
  Minus, 
  ArrowRight, 
  ArrowLeft, 
  Copy, 
  Download, 
  Trash2, 
  FileText,
  CheckCircle2,
  RefreshCw,
  ArrowLeftRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

interface AlignedRow {
  left: {
    content: string | null;
    lineNumber: number | null;
  };
  right: {
    content: string | null;
    lineNumber: number | null;
  };
  sideC: {
    content: string | null;
    lineNumber: number | null;
  };
  type: DiffType;
  id: string;
}

const CharacterDiff = ({ text1, text2, mode, ignoreWhitespace }: { text1: string | null, text2: string | null, mode: 'base' | 'diff', ignoreWhitespace: boolean }) => {
  const t1 = text1 || "";
  const t2 = text2 || "";
  
  const diffs = useMemo(() => {
    let result = diffChars(t1, t2);
    if (ignoreWhitespace) {
      return result.filter(part => {
        if ((part.added || part.removed) && part.value.trim() === "") {
          return false;
        }
        return true;
      });
    }
    return result;
  }, [t1, t2, ignoreWhitespace]);
  
  return (
    <>
      {diffs.map((part, index) => {
        if (mode === 'base') {
          if (part.added) return null;
          return (
            <span 
              key={index} 
              className={cn(part.removed && "bg-red-400/40 text-red-900 font-bold rounded-sm")}
            >
              {part.value}
            </span>
          );
        } else {
          if (part.removed) return null;
          return (
            <span 
              key={index} 
              className={cn(part.added && "bg-emerald-400/40 text-emerald-900 font-bold rounded-sm")}
            >
              {part.value}
            </span>
          );
        }
      })}
    </>
  );
};

export default function App() {
  const [leftText, setLeftText] = useState("Apple\nBanana\nCherry\nDate\nElderberry");
  const [rightText, setRightText] = useState("Apple\nBanana\nCitrus\nFig\nGrape");
  const [sideCText, setSideCText] = useState("Apple\nBanana\nCherry\nDurian\nGrape");
  const [isSideCActive, setIsSideCActive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [horizontalScroll, setHorizontalScroll] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sideARef = useRef<HTMLDivElement>(null);
  const sideBRef = useRef<HTMLDivElement>(null);
  const sideCRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const railBCRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);

  // Synchronized scroll logic
  const isSyncing = useRef(false);
  const syncScroll = useCallback((e: React.UIEvent<HTMLDivElement>, source: 'A' | 'B' | 'C' | 'rail' | 'railBC') => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    
    const scrollTop = e.currentTarget.scrollTop;
    
    if (source !== 'A' && sideARef.current) sideARef.current.scrollTop = scrollTop;
    if (source !== 'B' && sideBRef.current) sideBRef.current.scrollTop = scrollTop;
    if (source !== 'C' && sideCRef.current) sideCRef.current.scrollTop = scrollTop;
    if (source !== 'rail' && railRef.current) railRef.current.scrollTop = scrollTop;
    if (source !== 'railBC' && railBCRef.current) railBCRef.current.scrollTop = scrollTop;
    
    isSyncing.current = false;
  }, []);

  // Compute the diff and align rows
  const diffRows = useMemo(() => {
    // Basic alignment for 2 sides first
    const changesAB = diffLines(leftText, rightText, { ignoreWhitespace });
    const rows: AlignedRow[] = [];
    
    let leftLineCounter = 1;
    let rightLineCounter = 1;

    let i = 0;
    while (i < changesAB.length) {
      const current = changesAB[i];
      const next = changesAB[i + 1];

      if (!current.added && !current.removed) {
        const lines = (current.value || '').split(/\r?\n/);
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop();
        lines.forEach((line) => {
          rows.push({
            left: { content: line, lineNumber: leftLineCounter++ },
            right: { content: line, lineNumber: rightLineCounter++ },
            sideC: { content: null, lineNumber: null },
            type: 'unchanged',
            id: `row-${Math.random().toString(36).substring(2, 9)}`
          });
        });
        i++;
      } 
      else if (current.removed && next && next.added) {
        const removedLines = (current.value || '').split(/\r?\n/);
        if (removedLines[removedLines.length - 1] === '' && removedLines.length > 1) removedLines.pop();
        const addedLines = (next.value || '').split(/\r?\n/);
        if (addedLines[addedLines.length - 1] === '' && addedLines.length > 1) addedLines.pop();
        const maxLines = Math.max(removedLines.length, addedLines.length);
        for (let j = 0; j < maxLines; j++) {
          const lCont = removedLines[j] !== undefined ? removedLines[j] : null;
          const rCont = addedLines[j] !== undefined ? addedLines[j] : null;
          let rowType: DiffType = 'modified';
          if (ignoreWhitespace && lCont !== null && rCont !== null && lCont.trim() === rCont.trim()) rowType = 'unchanged';
          if (lCont === null) rowType = 'added';
          if (rCont === null) rowType = 'removed';
          rows.push({
            left: { content: lCont, lineNumber: lCont !== null ? leftLineCounter++ : null },
            right: { content: rCont, lineNumber: rCont !== null ? rightLineCounter++ : null },
            sideC: { content: null, lineNumber: null },
            type: rowType,
            id: `row-mod-${Math.random().toString(36).substring(2, 9)}`
          });
        }
        i += 2;
      }
      else if (current.removed) {
        const lines = (current.value || '').split(/\r?\n/);
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop();
        lines.forEach((line) => {
          let rowType: DiffType = 'removed';
          if (ignoreWhitespace && line.trim() === "") rowType = 'unchanged';
          rows.push({
            left: { content: line, lineNumber: leftLineCounter++ },
            right: { content: null, lineNumber: null },
            sideC: { content: null, lineNumber: null },
            type: rowType,
            id: `row-rem-${Math.random().toString(36).substring(2, 9)}`
          });
        });
        i++;
      }
      else if (current.added) {
        const lines = (current.value || '').split(/\r?\n/);
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop();
        lines.forEach((line) => {
          let rowType: DiffType = 'added';
          if (ignoreWhitespace && line.trim() === "") rowType = 'unchanged';
          rows.push({
            left: { content: null, lineNumber: null },
            right: { content: line, lineNumber: rightLineCounter++ },
            sideC: { content: null, lineNumber: null },
            type: rowType,
            id: `row-add-${Math.random().toString(36).substring(2, 9)}`
          });
        });
        i++;
      }
    }

    if (!isSideCActive) return rows;

    // Robust Alignment for Side C against Lado B
    const changesBC = diffLines(rightText, sideCText, { ignoreWhitespace });
    
    const bToRowMap = new Map<number, AlignedRow>();
    rows.forEach(r => {
      if (r.right.lineNumber !== null) {
        bToRowMap.set(r.right.lineNumber, r);
      }
    });

    const bcRows: AlignedRow[] = [];
    let bLinePointer = 1;
    let cLinePointer = 1;

    for (let i = 0; i < changesBC.length; i++) {
      const current = changesBC[i];
      const next = changesBC[i + 1];

      if (!current.added && !current.removed) {
        const lines = current.value.split(/\r?\n/);
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop();
        lines.forEach(line => {
          const row = bToRowMap.get(bLinePointer);
          if (row) {
            row.sideC = { content: line, lineNumber: cLinePointer++ };
            bcRows.push(row);
          } else {
            bcRows.push({
              left: { content: null, lineNumber: null },
              right: { content: line, lineNumber: bLinePointer },
              sideC: { content: line, lineNumber: cLinePointer++ },
              type: 'unchanged',
              id: `row-bc-sync-${Math.random().toString(36).substring(2, 9)}`
            });
          }
          bLinePointer++;
        });
      }
      else if (current.removed && next && next.added) {
        const removedLines = current.value.split(/\r?\n/);
        if (removedLines[removedLines.length - 1] === '' && removedLines.length > 1) removedLines.pop();
        const addedLines = next.value.split(/\r?\n/);
        if (addedLines[addedLines.length - 1] === '' && addedLines.length > 1) addedLines.pop();

        const max = Math.max(removedLines.length, addedLines.length);
        for (let j = 0; j < max; j++) {
          const lB = removedLines[j];
          const lC = addedLines[j];
          if (lB !== undefined) {
            const row = bToRowMap.get(bLinePointer);
            if (row) {
              row.sideC = lC !== undefined ? { content: lC, lineNumber: cLinePointer++ } : { content: null, lineNumber: null };
              bcRows.push(row);
            } else {
              bcRows.push({
                left: { content: null, lineNumber: null },
                right: { content: lB, lineNumber: bLinePointer },
                sideC: lC !== undefined ? { content: lC, lineNumber: cLinePointer++ } : { content: null, lineNumber: null },
                type: 'modified',
                id: `row-bc-sync-mod-${Math.random().toString(36).substring(2, 9)}`
              });
            }
            bLinePointer++;
          } else if (lC !== undefined) {
            bcRows.push({
              left: { content: null, lineNumber: null },
              right: { content: null, lineNumber: null },
              sideC: { content: lC, lineNumber: cLinePointer++ },
              type: 'added',
              id: `row-bc-sync-only-c-${Math.random().toString(36).substring(2, 9)}`
            });
          }
        }
        i++; // skip next since we've handled it
      }
      else if (current.removed) {
        const lines = current.value.split(/\r?\n/);
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop();
        lines.forEach(line => {
          const row = bToRowMap.get(bLinePointer);
          if (row) {
            row.sideC = { content: null, lineNumber: null };
            bcRows.push(row);
          }
          bLinePointer++;
        });
      }
      else if (current.added) {
        const lines = current.value.split(/\r?\n/);
        if (lines[lines.length - 1] === '' && lines.length > 1) lines.pop();
        lines.forEach(line => {
          bcRows.push({
            left: { content: null, lineNumber: null },
            right: { content: null, lineNumber: null },
            sideC: { content: line, lineNumber: cLinePointer++ },
            type: 'added',
            id: `row-bc-sync-add-c-${Math.random().toString(36).substring(2, 9)}`
          });
        });
      }
    }

    // Now weave in rows that only have Lado A content
    const result: AlignedRow[] = [];
    let bcIdx = 0;
    rows.forEach(r => {
      if (r.right.lineNumber === null) {
        // This is a removal from A (only A has it)
        result.push(r);
      } else {
        // This row has B. Re-sync with bcRows.
        // There might be C-only rows before this B line.
        while (bcIdx < bcRows.length && (bcRows[bcIdx].right.lineNumber === null || bcRows[bcIdx].right.lineNumber < r.right.lineNumber)) {
           result.push(bcRows[bcIdx]);
           bcIdx++;
        }
        if (bcIdx < bcRows.length && bcRows[bcIdx].right.lineNumber === r.right.lineNumber) {
          result.push(bcRows[bcIdx]);
          bcIdx++;
        }
      }
    });

    // Append any remaining C-only lines
    while (bcIdx < bcRows.length) {
      result.push(bcRows[bcIdx]);
      bcIdx++;
    }

    return result;
  }, [leftText, rightText, sideCText, isSideCActive, ignoreWhitespace]);

  const handleMergeToRight = useCallback((row: AlignedRow) => {
    const leftContent = row.left.content;
    const rightContent = row.right.content;

    // We need to modify rightText based on what happened
    // This is tricky with raw strings. It's easier if we re-generate the text from the rows.
    // For a cleaner merge implementation, we'll update the rightText by processing the rows.
    
    let newRightLines: string[] = [];
    diffRows.forEach(r => {
      // If this is the row clicked, we take from left.
      if (r.id === row.id) {
        if (leftContent !== null) {
          newRightLines.push(leftContent);
        }
      } else {
        // Otherwise keep current right content if exists
        if (r.right.content !== null) {
          newRightLines.push(r.right.content);
        }
      }
    });

    setRightText(newRightLines.join('\n'));
  }, [diffRows]);

  const handleMergeSelected = useCallback(() => {
    let newRightLines: string[] = [];
    diffRows.forEach(r => {
      // If row is selected or was already same/added on right, keep/update
      if (selectedRowIds.has(r.id)) {
        if (r.left.content !== null) {
          newRightLines.push(r.left.content);
        }
      } else {
        if (r.right.content !== null) {
          newRightLines.push(r.right.content);
        }
      }
    });

    setRightText(newRightLines.join('\n'));
    setSelectedRowIds(new Set());
    
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    });
  }, [diffRows, selectedRowIds]);

  const toggleRowSelection = (id: string, isDiff: boolean) => {
    if (!isDiff) return;
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
  };

  const toggleSelectAllDiffs = () => {
    const diffNodeIds = diffRows.filter(r => r.type !== 'unchanged').map(r => r.id);
    if (selectedRowIds.size === diffNodeIds.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(diffNodeIds));
    }
  };

  const handleCopyToClipboard = async () => {
    setIsCopying(true);
    const textToCopy = isSideCActive ? sideCText : rightText;
    await navigator.clipboard.writeText(textToCopy);
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!sideARef.current || !minimapRef.current) return;
    
    const rect = minimapRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clickY = clientY - rect.top;
    const percentage = clickY / rect.height;
    
    const scrollHeight = sideARef.current.scrollHeight;
    const clientHeight = sideARef.current.clientHeight;
    
    const targetScroll = percentage * (scrollHeight - clientHeight);
    
    // Trigger sync
    if (sideARef.current) sideARef.current.scrollTop = targetScroll;
    if (sideBRef.current) sideBRef.current.scrollTop = targetScroll;
    if (sideCRef.current) sideCRef.current.scrollTop = targetScroll;
    if (railRef.current) railRef.current.scrollTop = targetScroll;
    if (railBCRef.current) railBCRef.current.scrollTop = targetScroll;
  };

  const handleMergeToC = useCallback((row: AlignedRow) => {
    const sideBContent = row.right.content;
    
    let newCLines: string[] = [];
    diffRows.forEach(r => {
      if (r.id === row.id) {
        if (sideBContent !== null) {
          newCLines.push(sideBContent);
        }
      } else {
        if (r.sideC.content !== null) {
          newCLines.push(r.sideC.content);
        }
      }
    });

    setSideCText(newCLines.join('\n'));
  }, [diffRows]);

  const clear = () => {
    setLeftText("");
    setRightText("");
    setSideCText("");
  };

  const handleSwap = () => {
    const temp = leftText;
    setLeftText(rightText);
    setRightText(temp);
  };

  const handleExport = () => {
    setIsExporting(true);
    const textToExport = isSideCActive ? sideCText : rightText;
    const blob = new Blob([textToExport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged-result.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7']
    });

    setTimeout(() => setIsExporting(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-main font-sans selection:bg-acc-blue selection:text-white">
      {/* Header */}
      <header className="h-16 bg-bg-secondary border-b border-border-main sticky top-0 z-50 px-6 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <div className="text-acc-blue">
            <RefreshCw size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-text-main">DiffMaster Pro</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSwap}
            className="btn px-4 py-2 border border-border-main rounded-md text-sm font-medium text-text-main bg-bg-secondary hover:bg-bg-primary transition-all flex items-center gap-2 cursor-pointer"
            title="Inverter Lados (Swap)"
          >
            <ArrowLeftRight size={16} /> Inverter Lados
          </button>
          <label className="flex items-center gap-2 px-3 py-1.5 border border-border-main rounded-md text-[11px] font-bold uppercase transition-all hover:bg-bg-primary cursor-pointer">
            <input 
              type="checkbox" 
              checked={isSideCActive}
              onChange={(e) => setIsSideCActive(e.target.checked)}
              className="accent-acc-blue"
            />
            Ativar Lado C
          </label>
          <label className="flex items-center gap-2 px-3 py-1.5 border border-border-main rounded-md text-[11px] font-bold uppercase transition-all hover:bg-bg-primary cursor-pointer">
            <input 
              type="checkbox" 
              checked={ignoreWhitespace}
              onChange={(e) => setIgnoreWhitespace(e.target.checked)}
              className="accent-acc-blue"
            />
            Ignorar Espaços
          </label>
          <label className="flex items-center gap-2 px-3 py-1.5 border border-border-main rounded-md text-[11px] font-bold uppercase transition-all hover:bg-bg-primary cursor-pointer">
            <input 
              type="checkbox" 
              checked={horizontalScroll}
              onChange={(e) => setHorizontalScroll(e.target.checked)}
              className="accent-acc-blue"
            />
            Scroll Horizontal
          </label>
          <button 
            onClick={() => setIsFullWidth(!isFullWidth)}
            className="btn px-4 py-2 border border-border-main rounded-md text-sm font-medium text-text-main bg-bg-secondary hover:bg-bg-primary transition-all flex items-center gap-2 cursor-pointer"
            title={isFullWidth ? "Contrair" : "Largura Total"}
          >
            {isFullWidth ? <Minimize2 size={16} /> : <Maximize2 size={16} />} 
          </button>
          <button 
            onClick={handleCopyToClipboard}
            className="btn px-4 py-2 border border-border-main rounded-md text-sm font-medium text-text-main bg-bg-secondary hover:bg-bg-primary transition-all flex items-center gap-2 cursor-pointer"
          >
            {isCopying ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />} 
            {isCopying ? 'Copiado!' : 'Copiar Resultado'}
          </button>
          <button 
            onClick={clear}
            className="btn px-4 py-2 border border-border-main rounded-md text-sm font-medium text-text-main bg-bg-secondary hover:bg-bg-primary transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 size={16} /> Limpar
          </button>
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="btn px-4 py-2 bg-acc-blue hover:bg-acc-blue-dark text-white rounded-md text-sm font-medium transition-all flex items-center gap-2 cursor-pointer border-none shadow-sm"
          >
            {isExporting ? <CheckCircle2 size={16} /> : <Download size={16} />} 
            {isExporting ? 'Exportado' : 'Exportar Mesclagem'}
          </button>
        </div>
      </header>

      <main className={cn(
        "flex flex-col gap-6 overflow-hidden transition-all duration-300",
        isFullWidth ? "p-4 max-w-none w-full h-[calc(100vh-64px)]" : "p-6 max-w-[1600px] mx-auto h-[calc(100vh-64px)]"
      )}>
        {/* Input Controls */}
        <section className={cn("grid gap-6 shrink-0", isSideCActive ? "grid-cols-3" : "grid-cols-2")}>
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} /> ORIGINAL (LADO A)
            </label>
            <textarea 
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              className={cn(
                "w-full h-32 p-4 bg-bg-secondary border border-border-main rounded-lg font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-acc-blue/20 focus:border-acc-blue transition-all resize-none shadow-sm",
                horizontalScroll ? "whitespace-pre overflow-x-auto" : "whitespace-pre-wrap"
              )}
              placeholder="Cole o texto original aqui..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} /> DESTINO (LADO B)
            </label>
            <textarea 
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              className={cn(
                "w-full h-32 p-4 bg-bg-secondary border border-border-main rounded-lg font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-acc-blue/20 focus:border-acc-blue transition-all resize-none shadow-sm",
                horizontalScroll ? "whitespace-pre overflow-x-auto" : "whitespace-pre-wrap"
              )}
              placeholder="Cole a versão para comparar aqui..."
            />
          </div>
          {isSideCActive && (
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} /> OUTRO (LADO C)
              </label>
              <textarea 
                value={sideCText}
                onChange={(e) => setSideCText(e.target.value)}
                className={cn(
                  "w-full h-32 p-4 bg-bg-secondary border border-border-main rounded-lg font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-acc-blue/20 focus:border-acc-blue transition-all resize-none shadow-sm",
                  horizontalScroll ? "whitespace-pre overflow-x-auto" : "whitespace-pre-wrap"
                )}
                placeholder="Cole a terceira versão aqui..."
              />
            </div>
          )}
        </section>

        {/* Diff Visualizer */}
        <div className="flex-1 flex flex-col bg-bg-secondary border border-border-main rounded-lg overflow-hidden shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] mb-4 min-h-0">
          <div className="bg-bg-primary px-4 py-3 border-b border-border-main flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-[12px] font-bold text-text-muted uppercase tracking-widest">Visualização de Diferenças</span>
              {diffRows.some(r => r.type !== 'unchanged') && (
                <button 
                  onClick={toggleSelectAllDiffs}
                  className="text-[10px] font-bold text-acc-blue hover:underline uppercase cursor-pointer"
                >
                  {selectedRowIds.size === diffRows.filter(r => r.type !== 'unchanged').length ? 'Desmarcar Tudo' : 'Selecionar Divergências'}
                </button>
              )}
              {selectedRowIds.size > 0 && (
                <motion.button 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={handleMergeSelected}
                  className="bg-acc-blue text-white px-3 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-acc-blue-dark transition-colors shadow-sm cursor-pointer"
                >
                  Sincronizar Selecionados ({selectedRowIds.size})
                </motion.button>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-acc-red border border-acc-red-dark/20" />
                <span className="text-[11px] font-semibold text-text-muted uppercase">Remoção</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-acc-green border border-acc-green-dark/20" />
                <span className="text-[11px] font-semibold text-text-muted uppercase">Adição</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-200 border border-amber-500/20" />
                <span className="text-[11px] font-semibold text-text-muted uppercase">Alteração</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden relative border border-border-main rounded-lg shadow-sm">
            <div className="flex-1 flex min-w-0 bg-white overflow-hidden">
              {/* Lado A Column */}
              <div 
                ref={sideARef}
                onScroll={e => syncScroll(e, 'A')}
                className="flex-1 basis-0 min-w-0 overflow-auto font-mono text-[13px] line-height-[1.6] border-r border-border-main hide-v-scroll"
              >
                <div className="sticky top-0 bg-bg-primary border-b border-border-main p-2 px-4 flex items-center justify-between z-10 text-[11px] font-bold text-text-muted uppercase tracking-wider w-full min-w-fit">
                  <div className="flex items-center gap-4">
                    <span className="w-6 shrink-0">Sel.</span>
                    <span>ORIGINAL (LADO A)</span>
                  </div>
                  <span className="opacity-40">Linha</span>
                </div>
                <div className="min-w-fit w-full">
                  {diffRows.map((row) => (
                    <motion.div 
                      key={`left-${row.id}`}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => toggleRowSelection(row.id, row.type !== 'unchanged')}
                      className={cn(
                        "flex items-stretch border-b border-slate-50 cursor-pointer transition-colors w-full",
                        row.type === 'removed' ? "bg-acc-red/50 hover:bg-acc-red/70" : 
                        row.type === 'modified' ? "bg-amber-50 hover:bg-amber-100" : 
                        "bg-white hover:bg-slate-50",
                        selectedRowIds.has(row.id) && "ring-2 ring-acc-blue ring-inset z-10"
                      )}
                    >
                      <div className="w-10 flex items-center justify-center shrink-0 border-r border-slate-100 py-1">
                        {row.type !== 'unchanged' && (
                          <div className={cn(
                            "w-4 h-4 border-2 rounded transition-all flex items-center justify-center",
                            selectedRowIds.has(row.id) ? "bg-acc-blue border-acc-blue" : "border-slate-300 bg-white"
                          )}>
                            {selectedRowIds.has(row.id) && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        "w-12 flex-shrink-0 text-right pr-3 font-medium border-r border-slate-100 py-1 text-[11px] select-none",
                        row.type === 'removed' ? "bg-acc-red text-acc-red-dark" : "text-slate-300 bg-slate-50/50"
                      )}>
                        {row.left.lineNumber || ''}
                      </div>
                      <div className={cn(
                        "flex-1 px-3 py-1 min-h-[24px] flex items-center pr-10",
                        horizontalScroll ? "whitespace-pre overflow-visible" : "whitespace-pre-wrap break-all"
                      )}>
                        <span className={cn(row.type === 'removed' && "text-acc-red-dark")}>
                          {row.type === 'modified' ? (
                            <CharacterDiff text1={row.left.content} text2={row.right.content} mode="base" ignoreWhitespace={ignoreWhitespace} />
                          ) : (
                            row.left.content === null ? '' : row.left.content
                          )}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Middle Rail Column (A to B) */}
              <div 
                ref={railRef}
                className="w-[40px] bg-slate-100 border-r border-border-main overflow-hidden shrink-0 flex-shrink-0"
              >
                <div className="sticky top-0 bg-slate-200 border-b border-border-main z-10 h-8 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400">#</span>
                </div>
                {diffRows.map((row) => (
                  <div key={`rail-${row.id}`} className="h-[25px] flex items-center justify-center border-b border-slate-200 bg-slate-100">
                    {row.type !== 'unchanged' && row.left.content !== null && (
                      <button 
                        onClick={() => handleMergeToRight(row)}
                        className="w-5 h-5 flex items-center justify-center text-acc-blue hover:bg-acc-blue hover:text-white rounded-full transition-all cursor-pointer"
                        title="Merge A -> B"
                      >
                        <ArrowRight size={10} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Lado B Column (Target) */}
              <div 
                ref={sideBRef}
                onScroll={e => syncScroll(e, 'B')}
                className="flex-1 basis-0 min-w-0 overflow-auto font-mono text-[13px] line-height-[1.6] border-r border-border-main"
              >
                <div className="sticky top-0 bg-bg-primary border-b border-border-main p-2 px-4 flex items-center justify-between z-10 text-[11px] font-bold text-text-muted uppercase tracking-wider w-full min-w-fit">
                  <span className="opacity-40">Linha</span>
                  <span>DESTINO (LADO B)</span>
                </div>
                <div className="min-w-fit w-full">
                  {diffRows.map((row) => {
                    const isBModifiedByC = isSideCActive && row.sideC.content !== null && row.right.content !== row.sideC.content;
                    return (
                      <motion.div 
                        key={`right-${row.id}`}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "flex items-stretch border-b border-slate-50 w-full",
                          row.type === 'added' ? "bg-acc-green/50" : 
                          row.type === 'modified' ? "bg-amber-50" : 
                          isBModifiedByC ? "bg-amber-50/50" :
                          "bg-white"
                        )}
                      >
                        <div className={cn(
                          "w-12 flex-shrink-0 text-right pr-3 font-medium border-r border-slate-100 py-1 text-[11px] select-none",
                          row.type === 'added' ? "bg-acc-green text-acc-green-dark" : "text-slate-300 bg-slate-50/50"
                        )}>
                          {row.right.lineNumber || ''}
                        </div>
                        <div className={cn(
                          "flex-1 px-3 py-1 min-h-[24px] flex items-center pr-10",
                          horizontalScroll ? "whitespace-pre overflow-visible" : "whitespace-pre-wrap break-all"
                        )}>
                          <span className={cn(row.type === 'added' && "text-acc-green-dark")}>
                            {row.type === 'modified' ? (
                              <CharacterDiff text1={row.left.content} text2={row.right.content} mode="diff" ignoreWhitespace={ignoreWhitespace} />
                            ) : (
                              row.right.content === null ? '' : row.right.content
                            )}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Second Rail Column (B to C) */}
              {isSideCActive && (
                <div 
                  ref={railBCRef}
                  className="w-[40px] bg-slate-100 border-r border-border-main overflow-hidden shrink-0 flex-shrink-0"
                >
                  <div className="sticky top-0 bg-slate-200 border-b border-border-main z-10 h-8 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400">#</span>
                  </div>
                  {diffRows.map((row) => (
                    <div key={`rail-bc-${row.id}`} className="h-[25px] flex items-center justify-center border-b border-slate-200 bg-slate-100">
                      {row.right.content !== null && row.right.content !== row.sideC.content && (
                        <button 
                          onClick={() => handleMergeToC(row)}
                          className="w-5 h-5 flex items-center justify-center text-acc-blue hover:bg-acc-blue hover:text-white rounded-full transition-all cursor-pointer"
                          title="Merge B -> C"
                        >
                          <ArrowRight size={10} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Lado C Column */}
              {isSideCActive && (
                <div 
                  ref={sideCRef}
                  onScroll={e => syncScroll(e, 'C')}
                  className="flex-1 basis-0 min-w-0 overflow-auto font-mono text-[13px] line-height-[1.6]"
                >
                  <div className="sticky top-0 bg-bg-primary border-b border-border-main p-2 px-4 flex items-center justify-between z-10 text-[11px] font-bold text-text-muted uppercase tracking-wider w-full min-w-fit">
                    <span className="opacity-40">Linha</span>
                    <span>OUTRO (LADO C)</span>
                  </div>
                  <div className="min-w-fit w-full">
                    {diffRows.map((row) => {
                      const isCModified = row.sideC.content !== null && row.sideC.content !== row.right.content;
                      return (
                        <motion.div 
                          key={`right-c-${row.id}`}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            "flex items-stretch border-b border-slate-50 w-full",
                            isCModified ? "bg-amber-50" : "bg-white"
                          )}
                        >
                          <div className={cn(
                            "w-12 flex-shrink-0 text-right pr-3 font-medium border-r border-slate-100 py-1 text-[11px] select-none",
                            isCModified ? "bg-amber-100 text-amber-900" : "text-slate-300 bg-slate-50/50"
                          )}>
                            {row.sideC.lineNumber || ''}
                          </div>
                          <div className={cn(
                            "flex-1 px-3 py-1 min-h-[24px] flex items-center pr-10",
                            horizontalScroll ? "whitespace-pre overflow-visible" : "whitespace-pre-wrap break-all"
                          )}>
                             <CharacterDiff text1={row.right.content} text2={row.sideC.content} mode="diff" ignoreWhitespace={ignoreWhitespace} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {diffRows.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted opacity-40 bg-white z-20">
                  <Copy size={64} strokeWidth={1.5} className="mb-4" />
                  <p className="font-semibold text-lg uppercase tracking-tight">Nenhum dado detectado</p>
                </div>
              )}
            </div>

            {/* Minimap Sidebar */}
            <div 
              ref={minimapRef}
              onMouseDown={handleMinimapClick}
              className="w-16 h-full bg-slate-50 border-l border-border-main shrink-0 cursor-crosshair relative select-none hover:bg-slate-100 transition-colors"
            >
              <div className="absolute inset-0 flex flex-col">
                {diffRows.map((row) => (
                  <div 
                    key={`mini-${row.id}`}
                    className={cn(
                      "w-full flex-1",
                      row.type === 'added' ? "bg-emerald-400" :
                      row.type === 'removed' ? "bg-red-400" :
                      row.type === 'modified' ? "bg-amber-400" :
                      "bg-transparent"
                    )}
                    style={{ flexBasis: `${100 / Math.max(diffRows.length, 1)}%` }}
                  />
                ))}
              </div>
              <div className="absolute top-0 right-0 p-1 bg-white/80 text-[8px] font-bold text-text-muted uppercase rotate-90 origin-top-right whitespace-nowrap">
                Minimap
              </div>
            </div>
          </div>
          
          {/* Footer Stats */}
          <footer className="shrink-0 h-10 bg-bg-secondary border-t border-border-main px-6 flex items-center gap-6 text-[12px] text-text-muted font-medium">
            <div className="flex items-center gap-2">
              <span className="dot shrink-0 w-2 h-2 rounded-full bg-slate-400"></span>
              <span>{diffRows.length} Linhas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dot shrink-0 w-2 h-2 rounded-full bg-red-500"></span>
              <span>{diffRows.filter(r => r.type === 'removed').length} Remoções</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dot shrink-0 w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{diffRows.filter(r => r.type === 'added').length} Adições</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="dot shrink-0 w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{diffRows.filter(r => r.type === 'modified').length} Alterações</span>
            </div>
            <div className="ml-auto opacity-50 flex items-center gap-2">
              <CheckCircle2 size={14} /> Sistema Sincronizado
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
