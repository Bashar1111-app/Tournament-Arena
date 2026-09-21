import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Upload, CheckCircle2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';

interface ResultReportModalProps {
  tournamentId: string;
  matchId: string;
  onClose: () => void;
  homePlayerName: string;
  awayPlayerName: string;
}

export const ResultReportModal: React.FC<ResultReportModalProps> = ({
  tournamentId,
  matchId,
  onClose,
  homePlayerName,
  awayPlayerName
}) => {
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nameMatchInfo, setNameMatchInfo] = useState<{ match: boolean; home: string; away: string; isValidImage: boolean } | null>(null);

  const [performanceStats, setPerformanceStats] = useState<any>(null);

  const analyzeImage = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    setNameMatchInfo(null);
    setPerformanceStats(null);
    try {
      // Compress image before analysis - Increased quality for AI accuracy
      const options = {
        maxSizeMB: 0.8, // Increased to 800KB for better text clarity
        maxWidthOrHeight: 1920, // Full HD resolution
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const response = await fetch('/api/analyze-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageBase64: base64,
            homePlayerName,
            awayPlayerName
          }),
        });
        
        if (response.status === 404) {
          setError("Backend Error: This hosting provider (e.g. GitHub Pages) does not support AI Logic. Please use the official AI Studio link.");
          setIsAnalyzing(false);
          return;
        }

        const data = await response.json();
        
        if (!response.ok) {
          setError(data.error || "Failed to analyze image. Please try again.");
          setIsAnalyzing(false);
          return;
        }

        if (data.isResultScreenshot === false) {
          setError("Invalid Screenshot! Please upload a valid game result screen.");
          setNameMatchInfo({
            match: false,
            home: '',
            away: '',
            isValidImage: false
          });
          setIsAnalyzing(false);
          return;
        }

        if (data.homeScore !== null && data.homeScore !== undefined && data.awayScore !== null && data.awayScore !== undefined) {
          setHomeScore(data.homeScore.toString());
          setAwayScore(data.awayScore.toString());
          setPerformanceStats(data.stats);
          
          setNameMatchInfo({
            match: !!data.isNameMatch,
            home: data.homeNameFound || 'N/A',
            away: data.awayNameFound || 'N/A',
            isValidImage: true
          });
        } else {
          console.warn("AI could not extract data clearly:", data);
          setError("AI could not read scores. Please enter them manually, but ensure image is correct.");
          setNameMatchInfo({
            match: !!data.isNameMatch,
            home: data.homeNameFound || 'N/A',
            away: data.awayNameFound || 'N/A',
            isValidImage: true
          });
        }
        setIsAnalyzing(false);
      };
    } catch (err) {
      console.error("AI Analysis error:", err);
      setIsAnalyzing(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    try {
      const options = {
        maxSizeMB: 0.5, // Increased to 500KB for visible quality
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      setScreenshot(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));
      setError(null);
      
      // Trigger AI Analysis
      analyzeImage(compressedFile);
    } catch (err) {
      console.error("Processing error:", err);
      setError('Failed to process image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !screenshot || homeScore === '' || awayScore === '') return;

    setIsUploading(true);
    try {
      // In a real production app, we would upload to Firebase Storage
      // For this environment, we'll store the base64 as a placeholder screenshotUrl
      const reader = new FileReader();
      reader.readAsDataURL(screenshot);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const matchRef = doc(db, `tournaments/${tournamentId}/matches/${matchId}`);
        await updateDoc(matchRef, {
          homeScore: parseInt(homeScore),
          awayScore: parseInt(awayScore),
          screenshotUrl: base64data,
          status: 'reported',
          reportedBy: auth.currentUser?.uid,
          updatedAt: serverTimestamp(),
          stats: performanceStats
        });
        
        onClose();
      };
    } catch (err) {
      console.error("Upload error:", err);
      setError('Failed to submit result');
      setIsUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-[#111827] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden rgb-border">
        <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl">
              <Upload className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-display font-black text-white uppercase italic tracking-tight">Report Result</h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Submit proof and final scoreline</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 sm:space-y-8">
          {/* Scoreline Input */}
          <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
            <div className="text-center space-y-2 min-w-0">
              <label className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest block truncate">{homePlayerName}</label>
              <input 
                type="number"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                placeholder="0"
                required
                className="w-full h-14 sm:h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-xl sm:text-2xl font-black text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="text-center">
              <span className="text-xl sm:text-2xl font-black text-zinc-700 italic">VS</span>
            </div>
            <div className="text-center space-y-2 min-w-0">
              <label className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest block truncate">{awayPlayerName}</label>
              <input 
                type="number"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                placeholder="0"
                required
                className="w-full h-14 sm:h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-xl sm:text-2xl font-black text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">Evidence Screenshot (HD Auto-Optimization)</label>
            <div 
              onClick={() => document.getElementById('screenshot-upload')?.click()}
              className={`relative h-48 rounded-[32px] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden ${
                previewUrl ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10 bg-white/5 hover:border-amber-500/30'
              }`}
            >
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-10 h-10 text-amber-500 mb-2 animate-spin" />
                        <span className="text-[11px] font-black uppercase tracking-widest animate-pulse">AI Scanning Result...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-10 h-10 text-amber-500 mb-2" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Image Optimized & Scanned</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <ImageIcon className="w-8 h-8 text-zinc-500" />
                  </div>
                  <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Tap to upload match proof</span>
                </>
              )}
              <input 
                id="screenshot-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
          )}

          {nameMatchInfo && nameMatchInfo.isValidImage && (
            <div className={`p-4 rounded-2xl border ${nameMatchInfo.match ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-1.5 rounded-lg ${nameMatchInfo.match ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {nameMatchInfo.match ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Loader2 className="w-4 h-4 text-red-500" />}
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest ${nameMatchInfo.match ? 'text-green-500' : 'text-red-500'}`}>
                  {nameMatchInfo.match ? 'Identity Verified' : 'Identity Mismatch Detected'}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                  Found in Screen: <span className="text-white italic ml-1">{nameMatchInfo.home || 'N/A'} vs {nameMatchInfo.away || 'N/A'}</span>
                </p>
                {!nameMatchInfo.match && (
                  <p className="text-[9px] font-medium text-red-400 italic">Warning: The names in the screenshot do not match this match's players.</p>
                )}
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={isUploading || !screenshot || isAnalyzing || (nameMatchInfo !== null && (!nameMatchInfo.match || !nameMatchInfo.isValidImage))}
            className={`w-full h-16 rounded-[24px] font-black uppercase tracking-[0.2em] text-xs shadow-xl italic transition-all flex items-center justify-center gap-3 ${
              (nameMatchInfo !== null && (!nameMatchInfo.match || !nameMatchInfo.isValidImage))
                ? 'bg-red-500/20 text-red-500 border border-red-500/50 cursor-not-allowed'
                : 'bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50'
            }`}
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isAnalyzing ? (
              'Verifying with AI...'
            ) : (nameMatchInfo !== null && !nameMatchInfo.isValidImage) ? (
              'Invalid Screenshot'
            ) : (nameMatchInfo !== null && !nameMatchInfo.match) ? (
              'Player Mismatch'
            ) : (
              'Deploy Final Result'
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
};
