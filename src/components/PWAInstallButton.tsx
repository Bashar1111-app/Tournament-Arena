import React, { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-xl font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-xl font-black uppercase italic tracking-widest text-[10px] shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all active:scale-95"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="w-full max-w-sm rounded-[32px] bg-[#111827] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-300" />
              
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-zinc-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center space-y-6">
                <div className="p-4 bg-amber-500/10 rounded-3xl">
                  <Smartphone className="w-12 h-12 text-amber-500" />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Install on iPhone</h3>
                  <p className="mt-2 text-xs font-medium text-zinc-400 leading-relaxed">
                    Follow these steps to add FC Arena to your home screen:
                  </p>
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-black text-xs">1</div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">Tap the <span className="text-amber-500">Share</span> button in Safari</p>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-black text-xs">2</div>
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">Tap <span className="text-amber-500">Add to Home Screen</span></p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase italic tracking-widest text-[10px] transition-all"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
