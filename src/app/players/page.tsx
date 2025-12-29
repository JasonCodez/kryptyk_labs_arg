"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Trophy, Users, Heart } from "lucide-react";

interface PlayerProfile {
  id: string;
  name: string;
  email: string;
  image: string;
  createdAt: string;
  stats: {
    puzzlesSolved: number;
    totalPoints: number;
    achievementsCount: number;
    teamsCount: number;
    followers: number;
  };
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "puzzles" | "points" | "followers">("name");
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    fetchPlayers();
  }, [search, sortBy]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        sortBy,
        limit: "20",
        skip: "0",
      });

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();
      setPlayers(data.users);
      setSkip(0);
    } catch (error) {
      console.error("Failed to fetch players:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        sortBy,
        limit: "20",
        skip: String(skip + 20),
      });

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();
      setPlayers((prev) => [...prev, ...data.users]);
      setSkip((prev) => prev + 20);
    } catch (error) {
      console.error("Failed to load more players:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      {/* Header */}
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
          <Link href="/dashboard" style={{ color: '#3891A6' }} className="hover:opacity-80">
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔍 Find Players</h1>
          <p style={{ color: '#DDDBF1' }}>
            Discover and follow other players, check their achievements and team participation
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players by name or email..."
              className="w-full pl-12 pr-4 py-3 rounded-lg text-white placeholder-gray-500"
              style={{
                backgroundColor: 'rgba(56, 145, 166, 0.1)',
                borderColor: '#3891A6',
                borderWidth: '1px',
              }}
            />
          </div>

          {/* Sort Buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { value: "name", label: "Name" },
              { value: "puzzles", label: "Puzzles Solved" },
              { value: "points", label: "Points" },
              { value: "followers", label: "Followers" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sortBy === option.value
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
                style={{
                  backgroundColor:
                    sortBy === option.value
                      ? "#3891A6"
                      : "rgba(56, 145, 166, 0.2)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Players Grid */}
        {loading && players.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#DDDBF1' }}>Loading players...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#DDDBF1' }}>No players found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {players.map((player) => (
                <Link key={player.id} href={`/profile/${player.id}`}>
                  <div
                    className="h-full border rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer group"
                    style={{
                      backgroundColor: 'rgba(56, 145, 166, 0.1)',
                      borderColor: '#3891A6',
                    }}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      {player.image ? (
                        <img
                          src={player.image}
                          alt={player.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                          style={{ backgroundColor: 'rgba(56, 145, 166, 0.3)' }}
                        >
                          👤
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate group-hover:opacity-80">
                          {player.name || "Anonymous"}
                        </h3>
                        <p
                          style={{ color: '#DDDBF1' }}
                          className="text-xs truncate"
                        >
                          {player.email}
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div
                        className="rounded p-2"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                      >
                        <p
                          style={{ color: '#DDDBF1' }}
                          className="text-xs mb-1"
                        >
                          Puzzles
                        </p>
                        <p className="font-bold text-white">
                          {player.stats.puzzlesSolved}
                        </p>
                      </div>
                      <div
                        className="rounded p-2"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                      >
                        <p
                          style={{ color: '#DDDBF1' }}
                          className="text-xs mb-1"
                        >
                          Points
                        </p>
                        <p className="font-bold" style={{ color: '#FDE74C' }}>
                          {player.stats.totalPoints}
                        </p>
                      </div>
                      <div
                        className="rounded p-2"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                      >
                        <p
                          style={{ color: '#DDDBF1' }}
                          className="text-xs mb-1"
                        >
                          Achievements
                        </p>
                        <p className="font-bold text-white">
                          {player.stats.achievementsCount}
                        </p>
                      </div>
                      <div
                        className="rounded p-2"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                      >
                        <p
                          style={{ color: '#DDDBF1' }}
                          className="text-xs mb-1"
                        >
                          Teams
                        </p>
                        <p className="font-bold text-white">
                          {player.stats.teamsCount}
                        </p>
                      </div>
                    </div>

                    {/* Social */}
                    <div className="flex items-center justify-between pt-4 border-t" style={{ borderTopColor: 'rgba(56, 145, 166, 0.3)' }}>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1" style={{ color: '#EF4444' }}>
                          <Heart className="w-4 h-4" />
                          {player.stats.followers}
                        </div>
                      </div>
                      <span style={{ color: '#FDE74C' }} className="group-hover:opacity-80 transition-colors">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Load More */}
            {players.length % 20 === 0 && players.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#3891A6' }}
                >
                  {loading ? "Loading..." : "Load More Players"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
