import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { HabitCard } from './HabitCard';
import { Plus, GripVertical } from 'lucide-react';
import { CalendarModal } from './CalendarModal';
import { EditHabitModal } from './EditHabitModal';
import { Habit } from '../types';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  DragOverlay
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { calculateStreak } from '../lib/utils';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'
];
const ICONS = ['Activity', 'Book', 'Code', 'Dumbbell', 'Coffee', 'Heart', 'Music'];

function SortableHabit({ 
  habit, onEdit, onOpenCalendar, isSelectionMode, isSelected, toggleSelection, onLongPress
}: { 
  habit: Habit, onEdit: () => void, onOpenCalendar: () => void, 
  isSelectionMode: boolean, isSelected: boolean, toggleSelection: () => void, onLongPress: () => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: habit.id,
    disabled: false
  });

  const timerRef = React.useRef<any>(null);
  const startPosRef = React.useRef<{x: number, y: number} | null>(null);
  const [isHolding, setIsHolding] = React.useState(false);

  const clearTimer = () => { 
    if (timerRef.current) clearTimeout(timerRef.current); 
    startPosRef.current = null;
    setIsHolding(false);
  };
  
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSelectionMode) return;
    clearTimer();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    startPosRef.current = { x: clientX, y: clientY };
    setIsHolding(true);

    timerRef.current = setTimeout(() => {
      onLongPress();
      clearTimer();
    }, 600);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!startPosRef.current) return;
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const dx = clientX - startPosRef.current.x;
    const dy = clientY - startPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 10) {
      clearTimer();
    }
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : (isHolding ? 0.8 : 1),
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      onMouseDown={isSelectionMode ? undefined : handleStart}
      onMouseUp={clearTimer}
      onMouseLeave={clearTimer}
      onMouseMove={handleMove}
      onTouchStart={isSelectionMode ? undefined : handleStart}
      onTouchEnd={clearTimer}
      onTouchMove={handleMove}
      className={isSelected ? "opacity-60 transition-opacity" : "transition-opacity"}
    >
      <div 
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }} 
        {...attributes} 
        {...listeners}
        onClick={isSelectionMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleSelection(); } : undefined}
      >
        <div className={isSelectionMode ? "flex items-center gap-3" : ""}>
          {isSelectionMode && (
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'}`}>
                {isSelected && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </div>
            </div>
          )}
          <div className="flex-1 w-full min-w-0 relative">
            <HabitCard 
              habit={habit} 
              onEdit={onEdit} 
              onOpenCalendar={onOpenCalendar} 
            />
            {isSelectionMode && (
              <div className="absolute inset-0 z-20 cursor-pointer" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryHeader({ 
  category, onLongPress 
}: { 
  category: string, onLongPress: () => void 
}) {
  const timerRef = React.useRef<any>(null);
  const startPosRef = React.useRef<{x: number, y: number} | null>(null);

  const clearTimer = () => { 
    if (timerRef.current) clearTimeout(timerRef.current); 
    startPosRef.current = null;
  };
  
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    clearTimer();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    startPosRef.current = { x: clientX, y: clientY };

    timerRef.current = setTimeout(() => {
      onLongPress();
      clearTimer();
    }, 600);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!startPosRef.current) return;
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const dx = clientX - startPosRef.current.x;
    const dy = clientY - startPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 10) {
      clearTimer();
    }
  };

  return (
    <div 
      className="inline-flex w-fit items-center px-4 py-2 rounded-2xl bg-white/40 dark:bg-black/30 backdrop-blur-md shadow-sm border border-white/20 dark:border-white/10 select-none cursor-pointer"
      onMouseDown={handleStart}
      onMouseUp={clearTimer}
      onMouseLeave={clearTimer}
      onMouseMove={handleMove}
      onTouchStart={handleStart}
      onTouchEnd={clearTimer}
      onTouchMove={handleMove}
    >
      <span className="text-base font-bold text-gray-900 dark:text-white">
        {category || 'Your Habits'}
      </span>
    </div>
  );
}

function DroppableCategory({ id, children, category }: { id: string, children: React.ReactNode, category: string }) {
  const { setNodeRef } = useDroppable({
    id: id,
    data: { category }
  });
  return <div ref={setNodeRef} className="flex flex-col gap-3 min-h-[50px]">{children}</div>;
}

export function HabitsPage() {
  const { habits, addHabit, reorderHabits, updateHabit } = useAppContext();
  const [newHabitName, setNewHabitName] = useState('');
  
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [calendarHabit, setCalendarHabit] = useState<Habit | null>(null);
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryModalState, setCategoryModalState] = useState<'hidden' | 'input' | 'options' | 'rename' | 'group-options'>('hidden');
  const [longPressedCategory, setLongPressedCategory] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameCategoryName, setRenameCategoryName] = useState('');
  const [dragState, setDragState] = useState<{activeId: string, overCategory: string, overId?: string} | null>(null);
  const [pendingMove, setPendingMove] = useState<{ finalHabits: Habit[], oldCategory: string } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    addHabit({
      name: newHabitName.trim(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      icon: ICONS[Math.floor(Math.random() * ICONS.length)],
      reminderTime: '09:00',
    });
    setNewHabitName('');
  };

  const [localHabits, setLocalHabits] = useState<Habit[] | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setLocalHabits(habits);
    const activeHabit = habits.find(h => h.id === event.active.id);
    if (activeHabit) {
      setDragState({
        activeId: activeHabit.id,
        overCategory: activeHabit.category || ''
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setDragState(prev => {
      if (!prev) return prev;
      let overCategory = prev.overCategory;
      const overHabit = habits.find(h => h.id === overId);
      if (overHabit) {
        overCategory = overHabit.category || '';
      } else if (overId.startsWith('category-')) {
        overCategory = over.data?.current?.category || '';
      }
      if (prev.overCategory !== overCategory) {
        return { ...prev, overCategory };
      }
      return prev;
    });

    setLocalHabits(prev => {
      if (!prev) return prev;

      const activeIndex = prev.findIndex(h => h.id === activeId);
      const overIndex = prev.findIndex(h => h.id === overId);

      if (activeIndex === -1) return prev;
      
      const activeItem = prev[activeIndex];
      let overCategory = activeItem.category || '';
      
      if (overIndex !== -1) {
        overCategory = prev[overIndex].category || '';
      } else if (overId.startsWith('category-')) {
        overCategory = over.data?.current?.category || '';
      }

      if (activeItem.category !== overCategory) {
        const newHabits = [...prev];
        newHabits[activeIndex] = { ...activeItem, category: overCategory };
        
        if (overIndex !== -1) {
           return arrayMove(newHabits, activeIndex, overIndex);
        } else {
           let lastCatIndex = -1;
           newHabits.forEach((h, i) => {
              if ((h.category || '') === overCategory) lastCatIndex = i;
           });
           if (lastCatIndex !== -1) {
              return arrayMove(newHabits, activeIndex, lastCatIndex);
           }
        }
        return newHabits;
      }
      
      return prev;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragState(null);

    let finalHabits = localHabits || habits;

    if (over && active.id !== over.id) {
       const activeIndex = finalHabits.findIndex(h => h.id === active.id);
       const overIndex = finalHabits.findIndex(h => h.id === over.id);

       if (activeIndex !== -1 && overIndex !== -1) {
         finalHabits = arrayMove(finalHabits, activeIndex, overIndex);
       }
    }

    const activeHabitOriginal = habits.find(h => h.id === active.id);
    const oldCategory = activeHabitOriginal?.category || '';
    
    let newCategory = oldCategory;
    if (over) {
        const movedItem = finalHabits.find(h => h.id === active.id);
        newCategory = movedItem?.category || '';
    }

    if (oldCategory !== newCategory && oldCategory !== '') {
       const itemsInOldCategory = habits.filter(h => (h.category || '') === oldCategory);
       if (itemsInOldCategory.length === 1) {
          setPendingMove({
             finalHabits,
             oldCategory
          });
          return;
       }
    }

    setLocalHabits(null);
    reorderHabits(finalHabits);
  };

  const displayHabits = React.useMemo(() => {
    return localHabits || habits;
  }, [habits, localHabits]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleLongPress = (id: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([id]));
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const catName = newCategoryName.trim();
    if (selectedIds.size > 0) {
      const newHabits = habits.map(h => {
        if (selectedIds.has(h.id)) {
          return { ...h, category: catName };
        }
        return h;
      });
      reorderHabits(newHabits);
    }
    setCategoryModalState('hidden');
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setNewCategoryName('');
  };

  return (
    <div className="pb-24 pt-8 px-4">
      <div className="max-w-md mx-auto">
        {isSelectionMode && (
          <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 z-50 p-4 flex items-center justify-between shadow-xl rounded-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center gap-3">
              <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <span className="font-semibold text-gray-900 dark:text-white">{selectedIds.size} Selected</span>
            </div>
            <button 
              onClick={() => setCategoryModalState('options')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            >
              Edit
            </button>
          </div>
        )}

        <header className="mb-8 p-4 rounded-2xl bg-white/40 dark:bg-black/30 backdrop-blur-md shadow-sm border border-white/20 dark:border-white/10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">HabitFlow</h1>
          <p className="text-gray-700 dark:text-gray-300 mt-1 font-medium">Build better habits, one step at a time.</p>
        </header>

        <form onSubmit={handleAdd} className="relative mb-6">
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            maxLength={30}
            placeholder="What do you want to build?"
            className="w-full pl-4 pr-12 py-4 rounded-2xl bg-white dark:bg-gray-800 border-none shadow-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white dark:placeholder-gray-500 font-medium"
          />
          <button
            type="submit"
            disabled={!newHabitName.trim()}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-6">
          {habits.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white/70 dark:bg-black/50 backdrop-blur-lg shadow-sm border border-white/20 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium">
              <p>No habits yet.</p>
              <p className="text-sm mt-1">Add one to get started!</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-6">
                {(() => {
                  const groups: Record<string, Habit[]> = {};
                  // Pre-populate with all existing categories to prevent them from vanishing when empty during drag
                  habits.forEach(h => {
                    const cat = h.category?.trim() || '';
                    if (!groups[cat]) groups[cat] = [];
                  });
                  displayHabits.forEach(h => {
                    const cat = h.category?.trim() || '';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(h);
                  });
                  const categories = Object.entries(groups).sort((a, b) => {
                    if (a[0] === '') return 1;
                    if (b[0] === '') return -1;
                    return 0;
                  });
                  return categories.map(([category, categoryHabits]) => (
                    <div key={category === '' ? 'uncategorized' : category} className="space-y-3">
                      <CategoryHeader 
                        category={category} 
                        onLongPress={() => {
                          if (category) {
                            setLongPressedCategory(category);
                            setCategoryModalState('group-options');
                          }
                        }} 
                      />
                      <SortableContext
                        items={categoryHabits.map(h => h.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <DroppableCategory id={`category-${category || 'uncategorized'}`} category={category}>
                          {categoryHabits.length === 0 ? (
                            <div className="py-4 text-center text-sm text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                              Empty group
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3 min-h-[50px] pb-4">
                              {categoryHabits.map((habit) => (
                                <SortableHabit
                                  key={habit.id}
                                  habit={habit}
                                  onEdit={() => setEditingHabit(habit)}
                                  onOpenCalendar={() => setCalendarHabit(habit)}
                                  isSelectionMode={isSelectionMode}
                                  isSelected={selectedIds.has(habit.id)}
                                  toggleSelection={() => toggleSelection(habit.id)}
                                  onLongPress={() => handleLongPress(habit.id)}
                                />
                              ))}
                            </div>
                          )}
                        </DroppableCategory>
                      </SortableContext>
                    </div>
                  ));
                })()}
              </div>
              <DragOverlay dropAnimation={null}>
                {dragState && dragState.activeId && habits.find(h => h.id === dragState.activeId) ? (
                  <div className="opacity-90 shadow-2xl scale-105 transition-transform">
                    <HabitCard 
                      habit={habits.find(h => h.id === dragState.activeId)!} 
                      onEdit={() => {}} 
                      onOpenCalendar={() => {}} 
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      {editingHabit && (
        <EditHabitModal 
          habit={editingHabit} 
          onClose={() => setEditingHabit(null)} 
        />
      )}

      {calendarHabit && (
        <CalendarModal 
          habit={calendarHabit} 
          onClose={() => setCalendarHabit(null)} 
        />
      )}

      {categoryModalState !== 'hidden' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6">
            {categoryModalState === 'input' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Create Group</h3>
                
                <form onSubmit={handleCreateCategory}>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder="Group name..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-none shadow-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white mb-6 font-medium"
                    autoFocus
                  />
                  
                  {(() => {
                    const selectedHabits = habits.filter(h => selectedIds.has(h.id));
                    const uniqueCategories = Array.from(new Set(selectedHabits.map(h => h.category).filter(Boolean)));
                    const commonCategory = uniqueCategories.length === 1 ? uniqueCategories[0] : null;
                    
                    if (commonCategory) {
                      return (
                        <div className="flex justify-end mb-4 -mt-2">
                          <button
                            type="button"
                            onClick={() => setCategoryModalState('options')}
                            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-medium transition-colors"
                          >
                            Options
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCategoryModalState('hidden')}
                      className="flex-1 py-3 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newCategoryName.trim()}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-xl transition-colors shadow-sm"
                    >
                      Apply
                    </button>
                  </div>
                </form>
              </>
            )}

            {categoryModalState === 'options' && (() => {
              const selectedHabits = displayHabits.filter(h => selectedIds.has(h.id));
              const uniqueCategories = Array.from(new Set(selectedHabits.map(h => h.category || '')));
              const isSameGroup = uniqueCategories.length === 1;
              const commonCategory = isSameGroup ? uniqueCategories[0] : null;
              const hasRealCategory = commonCategory !== '' && commonCategory !== null;
              
              const selectedNames = selectedHabits.map(h => h.name).join(', ');
              
              return (
                <>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit</h3>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setCategoryModalState('input')}
                      className="w-full py-3 px-2 text-left text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium rounded-lg transition-colors"
                    >
                      Create new group
                    </button>
                    {hasRealCategory && (
                      <>
                        <button
                          onClick={() => {
                            selectedHabits.forEach(h => updateHabit(h.id, { category: '' }));
                            setCategoryModalState('hidden');
                            setIsSelectionMode(false);
                            setSelectedIds(new Set());
                          }}
                          className="w-full py-3 px-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-lg transition-colors line-clamp-2"
                        >
                          Remove {selectedNames} from "{commonCategory}"
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setCategoryModalState('hidden')}
                      className="w-full py-3 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-2 border border-gray-200 dark:border-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}

            {categoryModalState === 'group-options' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Group</h3>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setRenameCategoryName(longPressedCategory);
                      setCategoryModalState('rename');
                    }}
                    className="w-full py-3 px-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Rename "{longPressedCategory}"
                  </button>
                  <button
                    onClick={() => {
                      habits.forEach(h => {
                        if (h.category === longPressedCategory) {
                          updateHabit(h.id, { category: '' });
                        }
                      });
                      setCategoryModalState('hidden');
                    }}
                    className="w-full py-3 px-2 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium rounded-lg transition-colors"
                  >
                    Delete "{longPressedCategory}"
                  </button>
                  <button
                    onClick={() => setCategoryModalState('hidden')}
                    className="w-full py-3 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-2 border border-gray-200 dark:border-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {categoryModalState === 'rename' && (() => {
              const commonCategory = longPressedCategory;
              
              if (!commonCategory) return null;
              
              return (
                <>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Rename Group</h3>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!renameCategoryName.trim()) return;
                    
                    const newName = renameCategoryName.trim();
                    habits.forEach(h => {
                      if (h.category === commonCategory) {
                        updateHabit(h.id, { category: newName });
                      }
                    });
                    
                    setCategoryModalState('hidden');
                    setIsSelectionMode(false);
                    setSelectedIds(new Set());
                  }}>
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="New group name..."
                      value={renameCategoryName}
                      onChange={(e) => setRenameCategoryName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-none shadow-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white mb-6 font-medium"
                      autoFocus
                    />
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCategoryModalState('group-options')}
                        className="flex-1 py-3 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={!renameCategoryName.trim() || renameCategoryName.trim() === commonCategory}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-xl transition-colors shadow-sm"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Delete group "{pendingMove.oldCategory}"?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You're moving the last task away from this group.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  reorderHabits(pendingMove.finalHabits);
                  setPendingMove(null);
                  setLocalHabits(null);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm"
              >
                Yes
              </button>
              <button
                onClick={() => {
                  setPendingMove(null);
                  setLocalHabits(null);
                }}
                className="flex-1 py-3 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
