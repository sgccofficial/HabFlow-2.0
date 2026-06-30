import React, { useRef, useState } from 'react';
import { X, Share2, Download, User } from 'lucide-react';
import { Habit } from '../types';
import { calculateStreak, cn } from '../lib/utils';
import { toBlob } from 'html-to-image';
import * as LucideIcons from 'lucide-react';
import { BACKGROUND_TEXTURES } from '../lib/constants';
import { useAppContext } from '../store/AppContext';

interface ShareMilestoneModalProps {
  habit?: Habit;
  overallStats?: {
    totalCompletions: number;
    activeHabits: number;
    consistencyRate: number;
  };
  onClose: () => void;
}

export function ShareMilestoneModal({ habit, overallStats, onClose }: ShareMilestoneModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { user, appSettings } = useAppContext();
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedTexture, setSelectedTexture] = useState(() => {
    return BACKGROUND_TEXTURES.find(t => t.class === appSettings?.texture) || BACKGROUND_TEXTURES[0];
  });
  
  let streak = 0;
  let completionRate = 0;
  let habitColor = '#4f46e5';
  
  if (habit) {
    streak = calculateStreak(habit);
    const daysSinceCreation = Math.max(1, Math.floor((new Date().getTime() - new Date(habit.created).getTime()) / (1000 * 3600 * 24)) + 1);
    completionRate = Math.min(100, Math.round((habit.dates.length / daysSinceCreation) * 100));
    habitColor = habit.color;
  } else if (overallStats) {
    completionRate = overallStats.consistencyRate;
  }

  const generateImageBlob = async () => {
    if (!cardRef.current) return null;
    return await toBlob(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      skipFonts: false
    });
  };

  let shortName = 'My';
  if (user?.displayName) {
    const match = user.displayName.match(/^[a-zA-Z]+/);
    if (match && match[0].length > 0) {
      shortName = match[0];
    } else {
      shortName = user.displayName.split(' ')[0] || 'My';
    }
  }

  const shareTitle = habit ? `${habit.name} Milestone` : `${shortName}'s Habits Journey`;
  const shareText = habit 
    ? `I've completed ${habit.name} for ${streak} days in a row!`
    : `I've reached ${overallStats?.totalCompletions} completions across ${overallStats?.activeHabits} active habits!`;
  const shareFileName = habit
    ? `milestone-${habit.name.replace(/\s+/g, '-').toLowerCase()}.png`
    : `milestone-overall.png`;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const blob = await generateImageBlob();
      if (!blob) throw new Error('Blob generation failed');
      
      const file = new File([blob], shareFileName, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [file]
          });
        } catch (shareErr) {
          console.log('User cancelled or share failed', shareErr);
        }
      } else {
        // Fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setIsSharing(false);
    } catch (err) {
      console.error('Error sharing image', err);
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await generateImageBlob();
      if (!blob) throw new Error('Blob generation failed');
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = shareFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsDownloading(false);
    } catch (err) {
      console.error('Error downloading image', err);
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pb-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Card to be captured */}
          <div 
            ref={cardRef} 
            className={cn("aspect-square w-full flex flex-col items-center justify-center relative overflow-hidden", selectedTexture.shareClass || selectedTexture.class)}
            style={{ backgroundColor: selectedTexture.isImage ? '#1f2937' : habitColor }}
          >
            {selectedTexture.isImage && <div className="absolute inset-0 bg-black/40" />}
            
            <div className="relative z-10 flex flex-col items-center p-8 text-center w-full">
              {habit ? (
                <>
                  <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-md">
                    {habit.name}
                  </h2>
                  <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-xl bg-white/20 backdrop-blur-md text-white border border-white/20">
                    {(() => {
                      const Icon = (LucideIcons as any)[habit.icon] || LucideIcons.CheckCircle;
                      return <Icon className="w-12 h-12" />;
                    })()}
                  </div>
                  <div className="flex gap-4 w-full">
                    <div className="flex-1 p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10">
                      <div className="text-sm font-medium mb-1 text-white/80">Current Streak</div>
                      <div className="text-2xl font-bold text-white drop-shadow-sm">
                        {streak} {streak === 1 ? 'Day' : 'Days'}
                      </div>
                    </div>
                    <div className="flex-1 p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10">
                      <div className="text-sm font-medium mb-1 text-white/80">Consistency</div>
                      <div className="text-2xl font-bold text-white drop-shadow-sm">
                        {completionRate}%
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-6 drop-shadow-md text-center px-4">
                    {shortName}'s Habits
                  </h2>
                  <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl bg-white/20 backdrop-blur-md text-white border border-white/20 overflow-hidden">
                    {user?.photoURL ? (
                      <img src={user.photoURL.startsWith('data:') ? user.photoURL : `${user.photoURL.replace(/=s\d+-c/i, '=s400-c')}${user.photoURL.includes('?') ? '&' : '?'}t=${Date.now()}`} alt="Profile" className="w-full h-full object-cover" crossOrigin={user.photoURL.startsWith('data:') ? undefined : "anonymous"} />
                    ) : (
                      <img src={`https://ui-avatars.com/api/?name=${user?.displayName || 'User'}&size=400`} alt="Profile" className="w-full h-full object-cover" crossOrigin="anonymous" />
                    )}
                  </div>
                  <div className="flex gap-2 w-full px-2">
                    <div className="flex-1 p-3 sm:p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center text-center">
                      <div className="text-[11px] sm:text-xs font-medium mb-1 text-white/80 leading-tight">Completed Tasks</div>
                      <div className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm mt-auto">
                        {overallStats?.totalCompletions || 0}
                      </div>
                    </div>
                    <div className="flex-1 p-3 sm:p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center text-center">
                      <div className="text-[11px] sm:text-xs font-medium mb-1 text-white/80 leading-tight">Active Tasks</div>
                      <div className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm mt-auto">
                        {overallStats?.activeHabits || 0}
                      </div>
                    </div>
                    <div className="flex-1 p-3 sm:p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center text-center">
                      <div className="text-[11px] sm:text-xs font-medium mb-1 text-white/80 leading-tight">Consistency</div>
                      <div className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm mt-auto">
                        {completionRate}%
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="px-3 py-4 flex-1 flex flex-col justify-center min-h-[6rem]">
            <h3 className="text-[15px] font-medium text-gray-500 dark:text-gray-400 mb-2 px-1 text-center">Texture</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-none px-1 items-center" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {BACKGROUND_TEXTURES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedTexture(t)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all focus:outline-none snap-center whitespace-nowrap",
                    selectedTexture === t 
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-2 border-indigo-500 shadow-sm" 
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 flex gap-3">
          <button 
            onClick={handleShare}
            disabled={isSharing || isDownloading}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSharing ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Share2 className="w-4 h-4" /> Share
              </>
            )}
          </button>
          <button 
            onClick={handleDownload}
            disabled={isSharing || isDownloading}
            className="flex-1 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-600 flex items-center justify-center gap-2"
          >
            {isDownloading ? (
              <span className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 dark:border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <Download className="w-4 h-4" /> Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
