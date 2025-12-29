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

  return (
    <div style={{ backgroundColor: '#020202' }} className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50" style={{ backgroundColor: 'rgba(2, 2, 2, 0.95)', borderBottomColor: '#3891A6', borderBottomWidth: '1px' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-8 w-auto" />
            <div className="text-xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
          <div className="flex gap-4 items-center">
            <span className="text-sm" style={{ color: '#DDDBF1' }}>{session?.user?.name || session?.user?.email}</span>
            <Link
              href="/api/auth/signout"
              className="px-3 py-1.5 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: '#AB9F9D' }}
            >
              Sign Out
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="pt-24 pb-16 px-4" style={{ backgroundImage: 'linear-gradient(135deg, rgba(56, 145, 166, 0.1) 0%, rgba(253, 231, 76, 0.05) 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-4">Puzzle Categories</h1>
          <p style={{ color: '#DDDBF1' }}>Explore our collection of puzzles organized by category. Choose a category to get started!</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-12 max-w-7xl mx-auto">
        {categories.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: '#DDDBF1' }} className="text-lg">No categories available yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/puzzles?category=${category.id}`}
                className="group rounded-lg border overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl flex flex-col"
                style={{
                  backgroundColor: 'rgba(56, 145, 166, 0.08)',
                  borderColor: category.color || '#3891A6',
                  borderWidth: '2px',
                }}
              >
                {/* Icon Header */}
                <div
                  className="h-24 flex items-center justify-center text-6xl transition-all group-hover:scale-110"
                  style={{
                    backgroundColor: `${category.color || '#3891A6'}20`,
                  }}
                >
                  {category.icon || '🎯'}
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">{category.name}</h3>
                  {category.description && (
                    <p style={{ color: '#DDDBF1' }} className="text-sm mb-4 flex-1">
                      {category.description}
                    </p>
                  )}

                  {/* Puzzle Count */}
                  <div className="pt-4" style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)', borderTopWidth: '1px' }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#AB9F9D' }} className="text-sm font-medium">
                        {category.puzzleCount} puzzle{category.puzzleCount !== 1 ? 's' : ''}
                      </span>
                      <span style={{ color: '#3891A6' }} className="text-lg font-bold">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
