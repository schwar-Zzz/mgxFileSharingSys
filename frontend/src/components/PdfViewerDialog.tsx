import { useEffect, useState } from 'react';
import { PDFViewer, ScrollStrategy } from '@embedpdf/react-pdf-viewer';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type PdfViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  title: string;
};

export default function PdfViewerDialog({ open, onOpenChange, src, title }: PdfViewerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);

  const forceLayout = () => {
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
  };

  useEffect(() => {
    if (!open || !src) {
      setMounted(false);
      return;
    }

    setMounted(false);
    const timer = window.setTimeout(() => {
      setViewerKey((k) => k + 1);
      setMounted(true);
      forceLayout();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [open, src]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
      className="left-0 top-0 z-[60] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0  rounded-none border-0 bg-white p-0 data-[state=open]:animate-none data-[state=closed]:animate-none sm:rounded-none"
      onWheel={(e)=>(e.stopPropagation())}
      onTouchMove={(e)=>(e.stopPropagation())}
      >
        <DialogTitle className="sr-only">{title || 'PDF viewer'}</DialogTitle>

        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <p className="truncate text-sm font-medium text-slate-900">{title || 'PDF viewer'}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {src && mounted ? (
            <div
            className="h-full w-full"
            style={{
                touchAction: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}
            >
                <PDFViewer
                    key={`${src}-${viewerKey}`}
                    className="h-full w-full"
                    style={{ width: '100%', height: '100%' }}
                    onReady={() => forceLayout()}
                    config={{
                    src,
                    theme: { preference: 'light' },
                    scroll: {
                        defaultStrategy: ScrollStrategy.Vertical,
                        defaultPageGap: 20,
                    },
                    pan: {
                        defaultMode: 'mobile',
                    },
                    }}
                />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Loading PDF...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}