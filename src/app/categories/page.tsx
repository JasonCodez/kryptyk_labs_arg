"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  puzzleCount: number;
}

export default function CategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchCategories();
    }
  }, [status, router]);

  async function fetchCategories() {
    try {
      const response = await fetch("/api/puzzle-categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#020202' }}>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p style={{ color: '#FDE74C' }} className="text-lg">Loading categories...</p>
        </div>
      </main>
    );
  }

  const categoryEmojis: Record<string, string> = {
    'anagram': '🔤',
    'general': '🎲',
    'hidden word': '💥',
    'word crack': '💥',
    'word scry': '💥',
    'wordscry': '💥',
    'word search': '🔎',
    'logic': '🧠',
    'math': '🔢',
    'word': '📝',
    'trivia': '❓',
    'pattern': '🔲',
    'cipher': '🔐',
    'riddle': '💡',
    'spatial': '📐',
    'memory': '🧩',
    'sequence': '🔗',
    'sudoku': '🔣',
    'crossword': '✏️',
    'escape': '🚪',
    'mystery': '🕵️',
    'detective': '🔍',
    'code': '💻',
    'visual': '👁️',
    'lateral': '🤔',
    'number': '🔢',
    'strategy': '♟️',
  };

  function getCategoryIcon(cat: Category) {
    const key = cat.name.toLowerCase().replace(/_/g, ' ');
    // Check longer/more-specific names first
    const orderedMappings: [string, string][] = [
      ['anagram', '🔤'],
      ['hidden word', '💥'],
      ['wordscry', '💥'],
      ['word scry', '💥'],
      ['word crack', '💥'],
      ['word search', '🔎'],
      ['word', '📝'],
      ['general', '🎲'],
      ['logic', '🧠'],
      ['math', '🔢'],
      ['trivia', '❓'],
      ['pattern', '🔲'],
      ['cipher', '🔐'],
      ['riddle', '💡'],
      ['spatial', '📐'],
      ['memory', '🧩'],
      ['sequence', '🔗'],
      ['sudoku', '🔢'],
      ['crossword', '✏️'],
      ['escape', '🚪'],
      ['mystery', '🕵️'],
      ['detective', '🔍'],
      ['code', '💻'],
      ['visual', '👁️'],
      ['lateral', '🤔'],
      ['number', '🔢'],
      ['strategy', '♟️'],
    ];
    for (const [term, emoji] of orderedMappings) {
      if (key.includes(term)) return emoji;
    }
    return cat.icon || '🧩';
  }

  function formatCategoryName(name: string) {
    const normalized = name.toLowerCase().replace(/_/g, ' ');
    if (normalized === 'hidden word' || normalized === 'word crack' || normalized === 'word scry' || normalized === 'wordscry') {
      return 'Hidden Word';
    }

    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  const categoryDescriptions: Record<string, string> = {
    'anagram': 'Unscramble letters to form words before time runs out. Fast thinking and sharp vocabulary win the day.',
    'general': 'A mix of everything — trivia, logic, wordplay, and lateral thinking all in one grab bag.',
    'hidden word': 'Guess the hidden word before you run out of tries. Every guess sharpens the board and narrows the field.',
    'word crack': 'Guess the hidden word before you run out of tries. Every guess sharpens the board and narrows the field.',
    'word scry': 'Guess the hidden word before you run out of tries. Every guess sharpens the board and narrows the field.',
    'wordscry': 'Guess the hidden word before you run out of tries. Every guess sharpens the board and narrows the field.',
    'word search': 'Scan the grid and find every hidden word. Race against time or take it slow — just don\'t miss any.',
    'logic': 'Pure reasoning puzzles that test your ability to think step-by-step and eliminate possibilities.',
    'math': 'Number-crunching challenges ranging from arithmetic tricks to advanced problem-solving.',
    'word': 'Classic word puzzles — anagrams, fill-in-the-blanks, and vocabulary challenges.',
    'trivia': 'Test your knowledge across a wide range of topics from history to pop culture.',
    'pattern': 'Spot the pattern, predict the next element. Visual and numerical sequences to decode.',
    'cipher': 'Crack encoded messages using classic and modern cipher techniques.',
    'riddle': 'Brain teasers and riddles that require creative, out-of-the-box thinking.',
    'spatial': 'Puzzles that challenge your spatial reasoning and ability to visualize shapes and rotations.',
    'memory': 'Challenge your recall and short-term memory with sequence and matching puzzles.',
    'sequence': 'Figure out the rule behind a series of numbers, letters, or symbols and find what comes next.',
    'sudoku': 'Fill the grid so every row, column, and box contains each digit exactly once. A true classic.',
    'crossword': 'Interlocking word grids where every clue leads to another. Vocabulary meets deduction.',
    'code': 'Programming and logic puzzles for the technically minded. Debug, decode, and compute.',
    'visual': 'Puzzles that rely on observation, optical illusions, and visual pattern recognition.',
    'lateral': 'Situations that seem impossible until you think sideways. Creative reasoning required.',
    'number': 'All things numerical — arithmetic, algebra, and number theory puzzles.',
    'strategy': 'Tactical puzzles where every move counts. Plan ahead and outthink the challenge.',
  };

  function getCategoryDescription(cat: Category) {
    const key = cat.name.toLowerCase().replace(/_/g, ' ');
    // Sort by key length descending so more specific matches win
    const sorted = Object.entries(categoryDescriptions).sort((a, b) => b[0].length - a[0].length);
    for (const [term, desc] of sorted) {
      if (key.includes(term)) return desc;
    }
    return cat.description || 'Test your skills with this collection of puzzles.';
  }

  return (
    <div style={{ backgroundColor: '#020202' }} className="min-h-screen">
      {/* Header */}
      <div className="pt-24 pb-10 sm:pb-16 px-4" style={{ backgroundImage: 'linear-gradient(135deg, rgba(56, 145, 166, 0.1) 0%, rgba(253, 231, 76, 0.05) 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2 sm:mb-4">Puzzle Categories</h1>
          <p className="text-sm sm:text-base" style={{ color: '#DDDBF1' }}>Choose a category to start playing!</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 sm:py-12 max-w-7xl mx-auto">
        {categories.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: '#DDDBF1' }} className="text-lg">No categories available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {categories.filter((c) => !['escape', 'mystery'].includes(c.name.toLowerCase())).map((category) => {
              const color = category.color || '#3891A6';
              return (
              <Link
                key={category.id}
                href={`/puzzles?category=${category.id}`}
                className="group rounded-lg border overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl flex flex-col relative"
                style={{
                  backgroundColor: `${color}08`,
                  borderColor: `${color}40`,
                  borderWidth: '2px',
                }}
              >
                {/* Puzzle count badge */}
                <div
                  className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    color: color,
                    backgroundColor: `${color}14`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                  {category.puzzleCount} puzzle{category.puzzleCount !== 1 ? 's' : ''}
                </div>

                {/* Icon Header */}
                <div
                  className="h-14 sm:h-24 flex items-center justify-center text-4xl sm:text-6xl transition-all group-hover:scale-110"
                  style={{ backgroundColor: `${color}12` }}
                >
                  {getCategoryIcon(category)}
                </div>

                {/* Content */}
                <div className="p-3 sm:p-6 flex flex-col flex-1">
                  <h3 className="text-sm sm:text-2xl font-bold text-white mb-1 sm:mb-2 leading-tight">{formatCategoryName(category.name)}</h3>
                  <p style={{ color: '#DDDBF1' }} className="hidden sm:block text-sm mb-4 flex-1">
                    {getCategoryDescription(category)}
                  </p>
                  {/* Mobile: show puzzle count inline instead of badge */}
                  <p className="sm:hidden text-[11px] font-medium mt-0.5" style={{ color: color }}>{category.puzzleCount} puzzle{category.puzzleCount !== 1 ? 's' : ''}</p>

                  <div className="hidden sm:block pt-4" style={{ borderTopColor: `${color}20`, borderTopWidth: '1px' }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: color }} className="text-sm font-semibold">
                        Browse puzzles
                      </span>
                      <span style={{ color: color }} className="text-lg font-bold">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
