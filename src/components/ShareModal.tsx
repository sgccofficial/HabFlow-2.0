import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Share2, Download, Award, Flame } from 'lucide-react';
import { Habit } from '../types';
import { getIcon } from './HabitCard';
import { BACKGROUND_TEXTURES } from '../lib/constants';
import { cn } from '../lib/utils';

interface ShareModalProps {
  habit?: Habit;
  streak?: number;
  longestStreak?: number;
  overallStats?: { completions: number; active: number };
  onClose: () => void;
}

export function ShareModal({ habit, streak, longestStreak, overallStats, onClose }: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTexture, setSelectedTexture] = useState(BACKGROUND_TEXTURES[1].class); // Default to Dots

  const generateImage = async () => {
    if (!cardRef.current) return null;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // Higher resolution
        backgroundColor: null,
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Failed to generate image', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = habit ? habit.name.replace(/\s+/g, '_') : 'overall';
      const file = new File([blob], `${fileName}_milestone.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Habit Milestone',
          text: `I'm on a ${streak}-day streak with ${habit?.name || 'my habits'}! Built with HabitFlow.`,
          files: [file],
        });
      } else {
        // Fallback to download
        handleDownload(dataUrl);
      }
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

  const handleDownload = async (existingDataUrl?: string) => {
    const dataUrl = existingDataUrl || await generateImage();
    if (!dataUrl) return;

    const link = document.createElement('a');
    const fileName = habit ? habit.name.replace(/\s+/g, '_') : 'overall';
    link.download = `${fileName}_milestone.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Share Milestone</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center overflow-y-auto">
          {/* The Shareable Card */}
          <div 
            ref={cardRef} 
            className="w-full aspect-square rounded-3xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden bg-gray-900"
            style={{ 
              background: BACKGROUND_TEXTURES.find(t => t.class === selectedTexture)?.isImage 
                ? 'transparent'
                : (habit 
                    ? `linear-gradient(135deg, ${habit.color}dd, ${habit.color}ff)`
                    : `linear-gradient(135deg, #4f46e5dd, #7c3aedff)`),
            }}
          >
            {/* Texture Overlay */}
            {selectedTexture && (
              <div className={cn("absolute inset-0 pointer-events-none", 
                BACKGROUND_TEXTURES.find(t => t.class === selectedTexture)?.isImage 
                  ? "opacity-100" 
                  : "opacity-100 mix-blend-overlay",
                BACKGROUND_TEXTURES.find(t => t.class === selectedTexture)?.shareClass || ""
              )}></div>
            )}
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/20 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2"></div>

            <div className="absolute top-6 left-6 opacity-80 text-white text-xs font-bold tracking-widest flex items-center gap-1 z-20 drop-shadow-md">
              HABITFLOW
            </div>

            <div className="relative z-10 flex flex-col items-center p-6 rounded-3xl w-full">
              {habit ? (
                <>
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-lg mb-6 border border-white/30">
                    {getIcon(habit.icon)}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-2 leading-tight drop-shadow-md">{habit.name}</h3>
                  
                  <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 mt-4 border border-white/20 w-full max-w-[200px]">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Flame className="w-6 h-6 text-orange-300" fill="currentColor" />
                      <span className="text-4xl font-extrabold text-white drop-shadow-md">{streak}</span>
                    </div>
                    <span className="text-sm font-medium text-white/90 uppercase tracking-widest drop-shadow-md">Day Streak</span>
                  </div>
                  
                  {typeof longestStreak === 'number' && typeof streak === 'number' && longestStreak > streak && (
                    <div className="mt-4 flex items-center gap-1.5 text-white/80 text-sm font-medium bg-black/10 px-3 py-1.5 rounded-full">
                      <Award className="w-4 h-4" />
                      Personal Best: {longestStreak}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-lg mb-6 border border-white/30">
                    <Award className="w-8 h-8" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-2 leading-tight drop-shadow-md">Overall Progress</h3>
                  
                  <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 mt-4 border border-white/20 w-full max-w-[200px]">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-4xl font-extrabold text-white drop-shadow-md">{overallStats?.completions || 0}</span>
                    </div>
                    <span className="text-sm font-medium text-white/90 uppercase tracking-widest drop-shadow-md">Completions</span>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-1.5 text-white/80 text-sm font-medium bg-black/10 px-3 py-1.5 rounded-full">
                    <Flame className="w-4 h-4 text-orange-300" />
                    Tracking {overallStats?.active || 0} Habits
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="w-full mt-6">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Pattern / Texture</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {BACKGROUND_TEXTURES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTexture(t.class)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                    selectedTexture === t.class 
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                      : "bg-transparent border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full flex gap-3 mt-4">
            <button 
              onClick={handleShare}
              disabled={isGenerating}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
            >
              <Share2 className="w-5 h-5" />
              {isGenerating ? 'Preparing...' : 'Share'}
            </button>
            <button 
              onClick={() => handleDownload()}
              disabled={isGenerating}
              className="px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white text-gray-900 font-medium rounded-xl flex items-center justify-center transition-colors disabled:opacity-70"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
