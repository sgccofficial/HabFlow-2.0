import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { Plus, Trash2, Calendar, List, CheckSquare, Edit3, Save, X } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function JournalPage() {
  const { journal, habits, addJournalEntry, updateJournalEntry, deleteJournalEntry, activeHabitId, setActiveHabitId } = useAppContext();
  
  const [newContent, setNewContent] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, content: string, setContent: React.Dispatch<React.SetStateAction<string>>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const selectionStart = textarea.selectionStart;
      const textBefore = content.substring(0, selectionStart);
      const lines = textBefore.split('\n');
      const lastLine = lines[lines.length - 1];

      const listRe = /^(\s*)([-*])\s+(\[[ xX]\]\s+)?(.*)$/;
      const match = lastLine.match(listRe);
      
      if (match) {
        const [ , indent, bullet, checkboxWithSpace, text ] = match;
        
        if (!text.trim()) {
          e.preventDefault();
          const newTextBefore = lines.slice(0, -1).join('\n') + '\n';
          const newContent = newTextBefore + content.substring(textarea.selectionEnd);
          setContent(newContent);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          e.preventDefault();
          const prefix = `${indent}${bullet} ${checkboxWithSpace ? '[ ] ' : ''}`;
          const insertText = '\n' + prefix;
          const newTextBefore = textBefore + insertText;
          const newContent = newTextBefore + content.substring(textarea.selectionEnd);
          setContent(newContent);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        }
      }
    }
  };

  const handleCheckboxToggle = (e: React.ChangeEvent<HTMLDivElement>, entryId: string, currentContent: string) => {
    const target = e.target as HTMLInputElement;
    if (target.tagName === 'INPUT' && target.type === 'checkbox') {
      const checkboxes = Array.from(e.currentTarget.querySelectorAll('input[type="checkbox"]'));
      const index = checkboxes.indexOf(target);
      if (index > -1) {
        let count = 0;
        const newContent = currentContent.replace(/^(\s*)([-*])\s+\[( |x|X)\]/gm, (match, space, bullet) => {
          if (count === index) {
            count++;
            return match.toLowerCase().includes('x') ? `${space}${bullet} [ ]` : `${space}${bullet} [x]`;
          }
          count++;
          return match;
        });
        updateJournalEntry(entryId, newContent);
      }
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    addJournalEntry({
      habitId: activeHabitId || 'general',
      content: newContent.trim(),
      date: formatDate(new Date())
    });
    setNewContent('');
  };

  const filteredJournal = journal
    .filter(j => activeHabitId === null || activeHabitId === 'general' ? true : j.habitId === activeHabitId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .concat()
    .reverse(); // Display newest at top? Wait, sort descending and then just map.

  filteredJournal.reverse(); // To ensure descending order if we want. Actually sort desc already does newest first.
  const sortedJournal = journal
    .filter(j => !activeHabitId ? true : j.habitId === activeHabitId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


  const insertSyntax = (syntax: string, isEditing: boolean = false) => {
    if (isEditing) {
      setEditContent(prev => prev + (prev.length > 0 && !prev.endsWith('\n') ? '\n' : '') + syntax);
    } else {
      setNewContent(prev => prev + (prev.length > 0 && !prev.endsWith('\n') ? '\n' : '') + syntax);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 pt-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Journal</h1>
        </header>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveHabitId(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${!activeHabitId ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            All Notes
          </button>
          {habits.map(h => (
            <button
              key={h.id}
              onClick={() => setActiveHabitId(h.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeHabitId === h.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}
            >
              {h.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleAdd} className="mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex gap-2 px-2 pt-2 pb-1 border-b border-gray-100 dark:border-gray-800 mb-2">
              <button type="button" onClick={() => insertSyntax('- [ ] ')} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Add Checkbox">
                <CheckSquare className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => insertSyntax('- ')} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Add Bullet">
                <List className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => handleTextareaKeyDown(e, newContent, setNewContent)}
              placeholder="Write down your thoughts... Supports Markdown!"
              className="w-full p-3 bg-transparent border-none resize-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
              rows={4}
            />
            <div className="flex justify-between items-center px-2 pb-2">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(), 'MMM d, yyyy')}
              </span>
              <button
                type="submit"
                disabled={!newContent.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:dark:bg-gray-700 text-white font-medium text-sm rounded-xl transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          {sortedJournal.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No journal entries found.</p>
          ) : (
            sortedJournal.map(entry => {
              const habit = habits.find(h => h.id === entry.habitId);
              return (
                <div key={entry.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 relative group">
                  {editingEntryId === entry.id ? (
                    <div>
                      <div className="flex gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <button type="button" onClick={() => insertSyntax('- [ ] ', true)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Add Checkbox">
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => insertSyntax('- ', true)} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors" title="Add Bullet">
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => handleTextareaKeyDown(e, editContent, setEditContent)}
                        className="w-full p-2 bg-transparent border-none resize-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
                        rows={5}
                      />
                      <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <button onClick={() => setEditingEntryId(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium">
                          Cancel
                        </button>
                        <button onClick={() => { updateJournalEntry(entry.id, editContent); setEditingEntryId(null); }} className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1 font-medium">
                          <Save className="w-3 h-3" /> Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-500">{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                        {habit && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md" style={{ backgroundColor: habit.color + '20', color: habit.color }}>
                            {habit.name}
                          </span>
                        )}
                      </div>
                      <div 
                        className="prose dark:prose-invert prose-sm max-w-none text-gray-800 dark:text-gray-200"
                        onChange={(e: any) => handleCheckboxToggle(e, entry.id, entry.content)}
                      >
                        <Markdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            input: ({ node, checked, disabled, ...props }) => (
                              <input 
                                {...props}
                                type="checkbox"
                                checked={checked || false}
                                disabled={false}
                                className="cursor-pointer mr-2 mt-1 align-middle w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-gray-700 focus:ring-indigo-500"
                                onChange={() => {}}
                              />
                            )
                          }}
                        >
                          {entry.content}
                        </Markdown>
                      </div>
                      
                      <div className="absolute top-4 right-4 flex gap-1 transition-opacity">
                        <button 
                          onClick={() => { setEditingEntryId(entry.id); setEditContent(entry.content); }}
                          className="p-1.5 text-gray-400 hover:text-indigo-500 bg-gray-50 dark:bg-gray-800 rounded-md"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteJournalEntry(entry.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-800 rounded-md"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
