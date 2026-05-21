import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, CheckCircle2, ArrowLeft, Download, Send, AlertCircle, Loader2, Info } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ThinkingEvent, IntegrityReport, WritingMode, WritingDocument, ParagraphKind as GlobalParagraphKind } from '../types';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pdfBlob: Blob, pageCount: number) => void;
  document: WritingDocument;
  mlaName: string;
  mlaInstructor: string;
  mlaCourse: string;
  mlaDate: string;
  isDarkMode: boolean;
  isMLA: boolean;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  textColor: string;
}

type PDFParagraphKind = GlobalParagraphKind | 'mla-header-line' | 'blank';

interface PDFParagraph {
  text: string;
  kind: PDFParagraphKind;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  document: docModel,
  mlaName,
  mlaInstructor,
  mlaCourse,
  mlaDate,
  isDarkMode,
  isMLA,
  fontFamily,
  fontSize,
  lineSpacing,
  textColor,
}) => {
  const [viewMode, setViewMode] = useState<'replica' | 'pdf'>('replica');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const revokeOldUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  const pdfBuffer = React.useMemo(() => {
    const buffer: PDFParagraph[] = [];

    if (isMLA) {
      buffer.push({ kind: 'mla-header-line', text: mlaName });
      buffer.push({ kind: 'mla-header-line', text: mlaInstructor });
      buffer.push({ kind: 'mla-header-line', text: mlaCourse });
      buffer.push({ kind: 'mla-header-line', text: mlaDate });
      buffer.push({ kind: 'blank', text: '' });
    }

    docModel.paragraphs.forEach(p => {
      // Add titles
      if (p.kind === 'title') {
        buffer.push({ kind: 'title', text: p.text });
        buffer.push({ kind: 'blank', text: '' });
      } else {
        buffer.push({ kind: p.kind as PDFParagraphKind, text: p.text });
      }
    });

    return buffer;
  }, [docModel, mlaName, mlaInstructor, mlaCourse, mlaDate, isMLA]);

  const generatePDF = React.useCallback(() => {
    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const doc = new jsPDF({
          unit: 'pt',
          format: 'letter',
          orientation: 'portrait',
        });

        // 1. Resolve Mode & Constants
        const margin = 72; // 1 inch
        const pageWidth = 612;
        const pageHeight = 792;
        
        let pdfFontSize = fontSize;
        let pdfLineSpacing = lineSpacing;
        let pdfFontName: 'helvetica' | 'times' | 'courier' = 'helvetica';
        let pdfTextColor = textColor;

        if (isMLA) {
          // MODE 2 — MLA LOCK MODE (MLA Assist ON)
          pdfFontSize = 12;
          pdfLineSpacing = 2.0;
          pdfFontName = 'times';
          pdfTextColor = '#000000';
        } else {
          // MODE 1 — STYLE INHERIT MODE (MLA Assist OFF)
          pdfFontSize = fontSize;
          pdfLineSpacing = lineSpacing;
          pdfTextColor = textColor || '#1c1917';
          switch (fontFamily) {
            case 'mono': pdfFontName = 'courier'; break;
            case 'tnr':
            case 'serif': pdfFontName = 'times'; break;
            default: pdfFontName = 'helvetica';
          }
        }

        // Helper to sanitize text for Standard 14 fonts (WinAnsiEncoding)
        const sanitizeForPDF = (str: string) => {
          return str
            .replace(/[\u201c\u201d]/g, '"') // Smart double quotes
            .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
            .replace(/[\u2014]/g, "--")      // Em dash
            .replace(/[\u2013]/g, "-")       // En dash
            .replace(/[\u2026]/g, "...")     // Ellipsis
            .replace(/[^\x00-\x7F\xA0-\xFF]/g, ""); // Remove non-WinAnsi characters to prevent substitution
        };

        const lineHeight = pdfFontSize * pdfLineSpacing;
        doc.setFont(pdfFontName, 'normal');
        doc.setFontSize(pdfFontSize);
        doc.setTextColor(pdfTextColor);

        let currentY = margin;
        let currentPageNum = 1;
        const contentWidth = pageWidth - (margin * 2);

        // 2. Render Running Header
        const renderRunningHeader = (pageNum: number) => {
          if (!isMLA) return;
          const lastName = sanitizeForPDF(mlaName.split(' ').pop() || '');
          
          const prevFont = doc.getFont().fontName;
          const prevSize = doc.getFontSize();
          
          doc.setFont('times', 'normal');
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          const headerText = `${lastName} ${pageNum}`;
          const textWidth = doc.getTextWidth(headerText);
          doc.text(headerText, pageWidth - margin - textWidth, 36); 
          
          // Manually restore font state as save/restoreGraphicsState doesn't handle fonts
          doc.setFont(prevFont as any, 'normal');
          doc.setFontSize(prevSize);
        };

        // 3. Render Atoms from Buffer
        const renderParagraphUnit = (p: PDFParagraph) => {
          if (p.kind === 'blank') {
            currentY += lineHeight;
            return;
          }

          const isTitle = p.kind === 'title' || p.kind === 'works-cited-title';
          const isHanging = p.kind === 'works-cited-entry';
          const indentAmount = 36; // 0.5 inch
          
          const sanitizedText = sanitizeForPDF(p.text);
          
          const applyStyle = () => {
            if (isTitle) {
              doc.setFont(pdfFontName, 'bold');
              doc.setFontSize(pdfFontSize * 1.2);
            } else {
              doc.setFont(pdfFontName, 'normal');
              doc.setFontSize(pdfFontSize);
            }
            doc.setTextColor(pdfTextColor);
          };

          applyStyle();

          const splitWidth = isHanging ? (contentWidth - indentAmount) : contentWidth;
          const lines = doc.splitTextToSize(sanitizedText, splitWidth);
          const currentLineHeight = (isTitle ? pdfFontSize * 1.2 : pdfFontSize) * pdfLineSpacing;
          const pHeight = lines.length * currentLineHeight;

          // Page Break Logic (Atomic)
          if (currentY + pHeight > pageHeight - margin) {
            if (currentY > margin) {
              doc.addPage();
              currentPageNum++;
              currentY = margin;
              renderRunningHeader(currentPageNum);
              applyStyle();
            }
          }

          lines.forEach((line: string, index: number) => {
            let xPos = margin;
            if (isTitle) {
              const tw = doc.getTextWidth(line);
              xPos = (pageWidth - tw) / 2;
            } else if (isHanging && index > 0) {
              xPos = margin + indentAmount;
            } else if (isMLA && p.kind === 'body' && index === 0) {
              xPos = margin + indentAmount;
            }
            
            const activeFontSize = isTitle ? pdfFontSize * 1.2 : pdfFontSize;
            doc.text(line, xPos, currentY + (activeFontSize * 0.85));
            currentY += currentLineHeight;
          });

          // Reset to normal font after title
          if (isTitle) {
            doc.setFont(pdfFontName, 'normal');
            doc.setFontSize(pdfFontSize);
          }
        };

        if (isMLA) renderRunningHeader(1);
        pdfBuffer.forEach(p => renderParagraphUnit(p));

        setPageCount(currentPageNum);
        const blob = doc.output('blob');
        setPdfBlob(blob);
        const url = URL.createObjectURL(blob);
        setPdfUrl(prev => { revokeOldUrl(prev); return url; });

      } catch (error) {
        console.error('PDF Generation Error:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  }, [pdfBuffer, isMLA, mlaName, fontSize, lineSpacing, textColor, fontFamily]);

  useEffect(() => {
    if (isOpen) {
      generatePDF();
    } else {
      // Cleanup
      setPdfUrl(prev => {
        revokeOldUrl(prev);
        return null;
      });
      setPdfBlob(null);
      setPageCount(0);
      setShowSuccess(false);
      setViewMode('replica');
    }
  }, [isOpen, generatePDF]);

  const handleSubmit = async () => {
    if (!pdfBlob) return;
    
    setIsSubmitting(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const now = new Date();
    setTimestamp(now.toLocaleString());
    onSubmit(pdfBlob, pageCount);
    
    setIsSubmitting(false);
    setShowSuccess(true);
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    const titlePara = docModel.paragraphs.find(p => p.kind === 'title');
    const fileName = titlePara ? titlePara.text.replace(/\s+/g, '_') : 'Manuscript';
    link.download = `${fileName}_Final.pdf`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-300">
      
      {/* Top Bar */}
      <div className={`h-16 border-b flex items-center justify-between px-6 z-10 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200 shadow-sm'}`}>
        <div className="flex items-center space-x-4">
          <button 
            onClick={onClose}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-stone-800 text-stone-400 hover:text-stone-100' : 'hover:bg-stone-100 text-stone-600'}`}
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-bold">Back to Draft</span>
          </button>
          <div className={`h-6 w-px ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>
          <div className="flex items-center space-x-2">
            <FileText size={18} className="text-indigo-500" />
            <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>PDF Preview</h2>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`flex p-1 rounded-xl mr-4 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-100'}`}>
            <button 
              onClick={() => setViewMode('replica')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'replica' ? 'bg-white dark:bg-stone-700 text-indigo-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
              Visual Replica
            </button>
            <button 
              onClick={() => setViewMode('pdf')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'pdf' ? 'bg-white dark:bg-stone-700 text-indigo-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
              PDF Reality
            </button>
          </div>

          <button 
            onClick={handleDownload}
            disabled={isGenerating || !pdfUrl}
            className={`p-2.5 rounded-xl transition-all border ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-100' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
            title="Download PDF"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isGenerating || isSubmitting || showSuccess || !pdfUrl}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
              showSuccess 
                ? 'bg-emerald-600 text-white cursor-default' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-500/20'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : showSuccess ? (
              <>
                <CheckCircle2 size={18} />
                <span>Submitted</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Submit PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden bg-stone-900/5">
        
        {/* PDF Viewer / Replica */}
        <div className="flex-1 overflow-hidden relative flex flex-col items-center">
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <Loader2 size={48} className="text-indigo-500 animate-spin" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Simulating Print Layout...</p>
            </div>
          ) : viewMode === 'replica' ? (
            /* HIGH FIDELITY HTML REPLICA */
            <div className="w-full h-full overflow-y-auto p-12 flex flex-col items-center custom-sidebar-scrollbar">
              <div 
                className="bg-white shadow-2xl origin-top transition-transform duration-500 flex flex-col shrink-0"
                style={{ 
                  width: '8.5in',
                  minHeight: '11in',
                  padding: '1in',
                  fontFamily: isMLA ? '"Times New Roman", Times, serif' : 
                    (fontFamily === 'mono' ? 'monospace' : (fontFamily === 'tnr' || fontFamily === 'serif' ? 'serif' : 'sans-serif')),
                  fontSize: isMLA ? '12pt' : `${fontSize}pt`,
                  lineHeight: isMLA ? '2.0' : lineSpacing,
                  color: isMLA ? '#000000' : textColor,
                  position: 'relative',
                  borderRadius: '1px'
                }}
              >
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] z-10"></div>

                <div className="whitespace-pre-wrap relative z-20 flex-1">
                  {pdfBuffer.map((p, i) => {
                    if (p.kind === 'blank') return <div key={i} className="h-4"></div>;
                    
                    const isTitle = p.kind === 'title' || p.kind === 'works-cited-title';
                    const isHanging = p.kind === 'works-cited-entry';
                    const isHeader = p.kind === 'mla-header-line';
                    
                    if (isTitle) {
                      return (
                        <div 
                          key={i} 
                          className="text-center mb-0"
                          style={{ 
                            fontWeight: 'bold', 
                            fontSize: isMLA ? '14.4pt' : `${fontSize * 1.2}pt`,
                            marginTop: '24pt',
                            marginBottom: '24pt'
                          }}
                        >
                          {p.text}
                        </div>
                      );
                    }
                    
                    if (isHanging) {
                      return (
                        <div key={i} style={{ paddingLeft: '0.5in', textIndent: '-0.5in' }} className="mb-0">
                          {p.text}
                        </div>
                      );
                    }
                    
                    if (isHeader) {
                      return <div key={i} className="mb-0">{p.text}</div>;
                    }

                    return (
                      <div key={i} style={{ textIndent: (isMLA && p.kind === 'body') ? '0.5in' : '0' }} className="mb-0">
                        {p.text}
                      </div>
                    );
                  })}
                </div>

                {/* Page Number Mockup */}
                {isMLA && (
                  <div className="absolute top-[0.5in] right-[1in] text-[12pt] z-20" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                    {mlaName.split(' ').pop()} 1
                  </div>
                )}
              </div>
              <div className="h-24 shrink-0"></div>
            </div>
          ) : pdfUrl ? (
            /* ACTUAL PDF EXPORT VIEW */
            <div className="w-full h-full flex flex-col p-8 items-center overflow-auto no-scrollbar">
              <object 
                key={pdfUrl}
                data={pdfUrl + '#view=FitH&toolbar=0'} 
                type="application/pdf"
                className="w-full max-w-4xl h-full shadow-2xl bg-white rounded-lg"
              >
                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-xl space-y-6 max-w-lg mx-auto my-auto">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                    <FileText size={40} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-stone-800 font-black uppercase tracking-widest text-sm mb-2">PDF Stream Ready</h3>
                    <p className="text-stone-500 text-xs leading-relaxed">Your professional manuscript has been generated. Most browsers can display it here, but if yours is restricted, you can view the external source or download the master file.</p>
                  </div>
                  <div className="flex flex-col w-full space-y-3">
                    <button 
                      onClick={() => window.open(pdfUrl, '_blank')}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
                    >
                      Open in Full Browser
                    </button>
                    <button 
                      onClick={handleDownload}
                      className="w-full py-3 border border-stone-200 text-stone-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-stone-50"
                    >
                      Download Final PDF
                    </button>
                  </div>
                </div>
              </object>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle size={48} className="text-rose-500" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Preview Failed to Load</p>
              <button onClick={generatePDF} className="text-indigo-500 underline text-xs font-bold uppercase tracking-widest">Retry</button>
            </div>
          )}
        </div>

        {/* Sidebar / Confidence Indicators */}
        <div className={`w-80 border-l flex flex-col p-8 overflow-y-auto no-scrollbar ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-100'}`}>
          <h3 className={`text-[10px] font-black uppercase tracking-widest mb-8 ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Compliance Audit</h3>
          
          <div className="space-y-8">
            {isMLA && (
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>MLA Formatting</span>
                  <CheckCircle2 size={16} className="text-emerald-500" />
                </div>
                <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Determined based on header, font, and indentation standards.</p>
              </div>
            )}

            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>
                  {isMLA ? 'Double-Spaced' : 'Standard Spacing'}
                </span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>
                {isMLA ? '24pt rhythmic verticality applied for academic readability.' : '1.5x line height applied for optimal reading comfort.'}
              </p>
            </div>

            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>Page Count</span>
                <span className="text-xs font-mono font-bold text-indigo-500">{pageCount} Pages</span>
              </div>
              <div className="h-1 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-full"></div>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-600'}`}>1-Inch Margins</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>Uniform padding enforced across all document boundaries.</p>
            </div>
          </div>

          <div className="mt-auto pt-12">
            <div className={`p-4 rounded-2xl border flex flex-col space-y-3 ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center space-x-2">
                <Info size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Format Notice</span>
              </div>
              {isMLA ? (
                <p className="text-[10px] leading-relaxed text-indigo-700/70">MLA formatting is applied automatically and locked in the final PDF.</p>
              ) : (
                <p className="text-[10px] leading-relaxed text-indigo-700/70">Your PDF will match the formatting you see in the editor.</p>
              )}
              <div className={`h-px w-full ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-100'}`}></div>
              <p className="text-[10px] leading-relaxed font-bold text-stone-400">This PDF is the canonical document instructors will review.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-stone-900/90 p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`max-w-md w-full rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl border ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}
            >
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-8 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={48} />
              </div>
              <h3 className={`text-xl font-black uppercase tracking-[0.2em] mb-4 ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Submission Confirmed</h3>
              <p className={`text-sm leading-relaxed mb-8 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                Your manuscript has been successfully transmitted and locked for instructor review.
              </p>
              
              <div className={`w-full p-6 rounded-2xl border text-left space-y-4 mb-10 ${isDarkMode ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Timestamp</span>
                  <span className={`text-xs font-mono ${isDarkMode ? 'text-stone-200' : 'text-stone-600'}`}>{timestamp}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Document Title</span>
                  <span className={`text-xs font-bold truncate max-w-[200px] ${isDarkMode ? 'text-stone-200' : 'text-stone-600'}`}>
                    {docModel.paragraphs.find(p => p.kind === 'title')?.text || 'Untitled Manuscript'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Page Count</span>
                  <span className={`text-xs font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-600'}`}>{pageCount} Pages</span>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
              >
                Close Portal
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PDFPreviewModal;
