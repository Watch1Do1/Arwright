import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { WritingDocument, Paragraph, ParagraphKind } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface WritingEditorProps {
  document: WritingDocument;
  onChange: (doc: WritingDocument) => void;
  isDarkMode: boolean;
  fontSize: number;
  fontFamily: string;
  lineSpacing: number;
  textColor: string;
  isMLA: boolean;
  mlaName: string;
  mlaInstructor: string;
  mlaCourse: string;
  mlaDate: string;
  isPageView: boolean;
  onPageChange?: (activePage: number, totalPages: number) => void;
  onInteraction?: () => void;
  onPaste?: (text: string) => void;
  isDeletingRef?: React.MutableRefObject<boolean>;
}

const PAGE_WIDTH = '8.5in';
const PAGE_MIN_HEIGHT = '11in';
const MARGIN_INCHES = 1;
const MARGIN_PX = MARGIN_INCHES * 96;
const PAGE_HEIGHT_PX = 11 * 96;

const WritingEditor: React.FC<WritingEditorProps> = ({
  document: docModel,
  onChange,
  isDarkMode,
  fontSize,
  fontFamily,
  lineSpacing,
  textColor,
  isMLA,
  mlaName,
  mlaInstructor,
  mlaCourse,
  mlaDate,
  isPageView,
  onPageChange,
  onInteraction,
  onPaste,
  isDeletingRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const runLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const totalHeight = (headerRef.current?.offsetHeight ?? 0) + container.scrollHeight + (MARGIN_PX * 2);
    const pages = Math.max(1, Math.ceil(totalHeight / PAGE_HEIGHT_PX));
    
    setPageCount(pages);
  }, []);

  useLayoutEffect(() => {
    runLayout();
  }, [docModel, fontSize, lineSpacing, fontFamily, isMLA, mlaName, mlaInstructor, mlaCourse, mlaDate, runLayout]);

  const handlePageScroll = useCallback(() => {
    if (!scrollContainerRef.current || !containerRef.current) return;
    const scrollPos = scrollContainerRef.current.scrollTop;
    const pageIdx = Math.floor((scrollPos + MARGIN_PX) / PAGE_HEIGHT_PX);
    setActivePage(Math.max(0, pageIdx));
  }, []);

  useEffect(() => {
    const scroll = scrollContainerRef.current;
    if (scroll) {
      scroll.addEventListener('scroll', handlePageScroll);
      return () => scroll.removeEventListener('scroll', handlePageScroll);
    }
  }, [handlePageScroll]);

  useEffect(() => {
    onPageChange?.(activePage, pageCount);
  }, [activePage, pageCount, onPageChange]);

  const updateParagraphText = (id: string, text: string) => {
    const newParagraphs = docModel.paragraphs.map(p => 
      p.id === id ? { ...p, text } : p
    );
    onChange({ paragraphs: newParagraphs });
  };

  const [interactionTimeout, setInteractionTimeout] = useState<NodeJS.Timeout | null>(null);
  const debouncedInteraction = useCallback(() => {
    if (interactionTimeout) clearTimeout(interactionTimeout);
    const timeout = setTimeout(() => {
      onInteraction?.();
    }, 1000);
    setInteractionTimeout(timeout);
  }, [interactionTimeout, onInteraction]);

  const handleParagraphInput = (id: string, text: string) => {
    updateParagraphText(id, text);
    debouncedInteraction();
  };

  const splitParagraph = (id: string, offset: number) => {
    const idx = docModel.paragraphs.findIndex(p => p.id === id);
    if (idx === -1) return;

    const currentP = docModel.paragraphs[idx];
    const textBefore = currentP.text.substring(0, offset);
    const textAfter = currentP.text.substring(offset);

    const newParagraphs = [...docModel.paragraphs];
    newParagraphs[idx] = { ...currentP, text: textBefore };
    
    const newP: Paragraph = {
      id: uuidv4(),
      kind: currentP.kind === 'title' ? 'body' : currentP.kind,
      text: textAfter
    };
    
    newParagraphs.splice(idx + 1, 0, newP);
    onChange({ paragraphs: newParagraphs });
    onInteraction?.();

    // Focus new paragraph
    setTimeout(() => {
      const nextEl = blockRefs.current[newP.id];
      if (nextEl) {
        nextEl.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(nextEl.childNodes[0] || nextEl, 0);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  };

  const mergeParagraph = (id: string, direction: 'back' | 'forward') => {
    const idx = docModel.paragraphs.findIndex(p => p.id === id);
    if (idx === -1) return;

    if (direction === 'back' && idx > 0) {
      const currentP = docModel.paragraphs[idx];
      const prevP = docModel.paragraphs[idx - 1];
      
      const newParagraphs = [...docModel.paragraphs];
      const prevTextLen = prevP.text.length;
      newParagraphs[idx - 1] = { ...prevP, text: prevP.text + currentP.text };
      newParagraphs.splice(idx, 1);
      
      onChange({ paragraphs: newParagraphs });
      onInteraction?.();

      // Focus prev and set caret
      setTimeout(() => {
        const prevEl = blockRefs.current[prevP.id];
        if (prevEl) {
          prevEl.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          // Find the exact node and offset for the caret
          // Simplified: end of prev text
          const textNode = prevEl.childNodes[0];
          if (textNode) {
            range.setStart(textNode, prevTextLen);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }, 0);
    } else if (direction === 'forward' && idx < docModel.paragraphs.length - 1) {
      const currentP = docModel.paragraphs[idx];
      const nextP = docModel.paragraphs[idx + 1];
      
      const newParagraphs = [...docModel.paragraphs];
      newParagraphs[idx] = { ...currentP, text: currentP.text + nextP.text };
      newParagraphs.splice(idx + 1, 1);
      
      onChange({ paragraphs: newParagraphs });
      onInteraction?.();
    }
  };

  const handleBlockKeyDown = (e: React.KeyboardEvent, p: Paragraph) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const offset = range.startOffset;

    if (e.key === 'Enter') {
      e.preventDefault();
      splitParagraph(p.id, offset);
    } else if (e.key === 'Backspace' && offset === 0 && selection.isCollapsed) {
      if (p.kind !== 'title') { // Don't merge title into something else or delete it easily
        e.preventDefault();
        mergeParagraph(p.id, 'back');
      }
    } else if (e.key === 'ArrowUp' && offset === 0) {
      const idx = docModel.paragraphs.findIndex(item => item.id === p.id);
      if (idx > 0) {
        e.preventDefault();
        const prevId = docModel.paragraphs[idx - 1].id;
        blockRefs.current[prevId]?.focus();
      }
    } else if (e.key === 'ArrowDown' && offset === p.text.length) {
      const idx = docModel.paragraphs.findIndex(item => item.id === p.id);
      if (idx < docModel.paragraphs.length - 1) {
        e.preventDefault();
        const nextId = docModel.paragraphs[idx + 1].id;
        blockRefs.current[nextId]?.focus();
      }
    }
  };

  const handleBlockPaste = (e: React.ClipboardEvent, p: Paragraph) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) {
      // Normal insert
      document.execCommand('insertText', false, text);
    } else {
      // Split logic for multi-line paste
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const offset = range.startOffset;

      const currentP = p;
      const textBefore = currentP.text.substring(0, offset);
      const textAfter = currentP.text.substring(offset);

      const idx = docModel.paragraphs.findIndex(item => item.id === p.id);
      const newParagraphs = [...docModel.paragraphs];
      
      // Update current
      newParagraphs[idx] = { ...currentP, text: textBefore + lines[0] };
      
      // Add middle lines
      const middleParas = lines.slice(1, -1).map(l => ({
        id: uuidv4(),
        kind: 'body' as ParagraphKind,
        text: l
      }));
      
      // Add last line
      const lastP: Paragraph = {
        id: uuidv4(),
        kind: currentP.kind === 'title' ? 'body' : currentP.kind,
        text: lines[lines.length - 1] + textAfter
      };

      newParagraphs.splice(idx + 1, 0, ...middleParas, lastP);
      onChange({ paragraphs: newParagraphs });
      onInteraction?.();
      onPaste?.(text);

      setTimeout(() => {
        const lastEl = blockRefs.current[lastP.id];
        if (lastEl) {
          lastEl.focus();
          // set caret to end of pasted text
          const selection = window.getSelection();
          const range = document.createRange();
          range.setStart(lastEl.childNodes[0] || lastEl, lines[lines.length - 1].length);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }, 0);
    }
  };

  const getFontStack = () => {
    switch (fontFamily) {
      case 'tnr': return '"Times New Roman", Times, serif';
      case 'serif': return 'Georgia, serif';
      case 'mono': return 'JetBrains Mono, monospace';
      default: return 'Inter, sans-serif';
    }
  };

  return (
    <div 
      ref={scrollContainerRef}
      className={`flex-1 overflow-y-auto px-4 py-12 flex flex-col items-center transition-colors scroll-smooth custom-sidebar-scrollbar ${
        isDarkMode ? 'bg-stone-950' : 'bg-stone-100'
      }`}
      style={{ 
        backgroundImage: isDarkMode 
          ? 'radial-gradient(circle, #1c1917 1px, transparent 1px)' 
          : 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <div 
        className="relative transition-all origin-top flex flex-col shrink-0"
        style={{ 
          width: PAGE_WIDTH,
          minHeight: PAGE_MIN_HEIGHT,
          fontFamily: getFontStack(),
          color: textColor,
          backgroundColor: 'white',
          boxShadow: isDarkMode 
            ? '0 0 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 20px 50px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.05)',
          marginBottom: '120px',
          padding: `${MARGIN_INCHES}in`,
          position: 'relative',
          borderRadius: '1px'
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] z-10"></div>
        
        <div 
          className="relative z-20 flex flex-col flex-1"
          style={{ 
            fontSize: `${fontSize}pt`,
            lineHeight: lineSpacing,
          }}
        >
          {/* MLA Header Area */}
          {isMLA && (
            <div 
              ref={headerRef}
              className="text-left text-[12pt] leading-tight text-stone-700 select-none mb-12"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              <div className="mb-1">{mlaName}</div>
              <div className="mb-1">{mlaInstructor}</div>
              <div className="mb-1">{mlaCourse}</div>
              <div className="mb-1">{mlaDate}</div>
            </div>
          )}

          <div
            ref={containerRef}
            className="flex flex-col flex-1"
          >
            {docModel.paragraphs.map((p, idx) => {
              const isTitle = p.kind === 'title' || p.kind === 'works-cited-title';
              const isWorksCited = p.kind === 'works-cited-entry';
              const isBody = p.kind === 'body';

              return (
                <ParagraphBlock
                  key={p.id}
                  paragraph={p}
                  isTitle={isTitle}
                  isWorksCited={isWorksCited}
                  isBody={isBody}
                  isMLA={isMLA}
                  isDarkMode={isDarkMode}
                  onInput={(text) => handleParagraphInput(p.id, text)}
                  onKeyDown={(e) => handleBlockKeyDown(e, p)}
                  onPaste={(e) => handleBlockPaste(e, p)}
                  onFocus={onInteraction}
                  blockRef={(el) => blockRefs.current[p.id] = el}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ParagraphBlockProps {
  paragraph: Paragraph;
  isTitle: boolean;
  isWorksCited: boolean;
  isBody: boolean;
  isMLA: boolean;
  isDarkMode: boolean;
  onInput: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onFocus: () => void;
  blockRef: (el: HTMLDivElement | null) => void;
}

const ParagraphBlock: React.FC<ParagraphBlockProps> = ({
  paragraph,
  isTitle,
  isWorksCited,
  isBody,
  isMLA,
  isDarkMode,
  onInput,
  onKeyDown,
  onPaste,
  onFocus,
  blockRef,
}) => {
  const innerRef = useRef<HTMLDivElement>(null);

  // Synchronize text from props only if it differs from current content
  // Normalize comparison to handle small DOM-to-JS differences
  useEffect(() => {
    if (innerRef.current) {
      const normalizedPropText = paragraph.text;
      const normalizedDomText = innerRef.current.innerText.replace(/\n$/, '');
      if (normalizedDomText !== normalizedPropText) {
        innerRef.current.innerText = paragraph.text;
      }
    }
  }, [paragraph.text]);

  return (
    <div
      ref={(el) => {
        innerRef.current = el;
        blockRef(el);
      }}
      contentEditable="true"
      suppressContentEditableWarning={true}
      onInput={(e) => onInput(e.currentTarget.innerText)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onFocus={onFocus}
      spellCheck="true"
      className={`outline-none break-words cursor-text relative mb-4 ${
        isTitle ? 'text-center font-bold text-[1.2em] mt-8 mb-8 empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 empty:before:pointer-events-none' : ''
      } ${
        isWorksCited ? 'pl-[0.5in] -indent-[0.5in]' : ''
      } ${
        isBody && isMLA ? 'text-indent-[0.5in]' : ''
      } ${
        isDarkMode ? 'caret-stone-900' : 'caret-indigo-500'
      }`}
      data-placeholder={isTitle ? "Title" : ""}
      style={{
        textIndent: (isBody && isMLA) ? '0.5in' : '0'
      }}
    />
  );
};

export default WritingEditor;
