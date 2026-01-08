export { default } from "./page_new";
/* legacy implementation disabled (kept for reference)
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
      return;
    }
    if (session?.user?.email) {
      checkAdminStatus();
    }
  }, [session, status]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/admin/check");
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "pointsReward" ? parseInt(value) : value,
    }));
  };

  const handleHintChange = (index: number, value: string) => {
    const newHints = [...formData.hints];
    newHints[index] = value;
    setFormData((prev) => ({ ...prev, hints: newHints }));
  };

  const handleAddHint = () => {
    setFormData((prev) => ({ ...prev, hints: [...prev.hints, ""] }));
  };

  const handleRemoveHint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index),
    }));
  };

  const handlePuzzleDataChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      puzzleData: { ...prev.puzzleData, [key]: value },
    }));
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      // Check if Sudoku puzzle was generated
      // Check if Sudoku has puzzle generated
      if (formData.puzzleType === 'sudoku' && !sudokuPuzzle) {
        setFormError("Please generate a Sudoku puzzle first");
        setSubmitting(false);
        return;
      }

      const filteredHints = formData.hints.filter((h) => h.trim() !== "");

      // Prepare data with Sudoku-specific fields or Escape Room stages
      const submitData = {
        ...formData,
        hints: filteredHints,
        ...(formData.puzzleType === 'sudoku' && sudokuPuzzle && {
          sudokuGrid: sudokuPuzzle.puzzle,
          sudokuSolution: sudokuPuzzle.solution,
          sudokuDifficulty: sudokuDifficulty,
        }),
        ...(formData.puzzleType === 'escape_room' && {
          escapeRoomStages: formData.escapeRoomStages,
        }),
      };

      console.log("Submitting puzzle data:", submitData);

      const response = await fetch("/api/admin/puzzles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create puzzle");
      }

      const createdPuzzle = await response.json();
      setPuzzleId(createdPuzzle.id);

      setFormSuccess("✅ Puzzle created successfully!");
      setTimeout(() => {
        setFormData({
          title: "",
          description: "",
          content: "",
          category: DEFAULT_CATEGORY,
          difficulty: DEFAULT_DIFFICULTY,
          puzzleType: "general",
          correctAnswer: "",
          pointsReward: 100,
          hints: ["", "", ""],
          isMultiPart: false,
          parts: [
            { title: "Part 1", content: "", answer: "", points: 50 },
            { title: "Part 2", content: "", answer: "", points: 50 },
          ],
          puzzleData: {},
        });
      }, 2000);
    } catch (err) {
      console.error("Form submission error:", err);
      setFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <p style={{ color: '#FDE74C' }} className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">❌ Access Denied</h1>
          <p style={{ color: '#DDDBF1' }} className="mb-6">You don't have permission to access the admin panel.</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 text-white font-semibold rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#3891A6' }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>Kryptyk Labs</div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/arg"
              className="px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: 'rgba(56, 145, 166, 0.2)', borderColor: '#3891A6', color: '#3891A6' }}
            >
              🎮 ARG Manager
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: '#2a3a3b', borderColor: '#3891A6' }}
            >
              ← Back
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-white mb-2">🧩 Universal Puzzle Maker</h1>
          <p className="text-[#9BD1D6] mb-8">Create any type of puzzle with advanced tools</p>

          <div className="flex gap-4 mb-8 flex-wrap overflow-x-auto pb-2">
            {(['create', 'templates', 'difficulty', 'hints', 'versions', 'scheduling', 'test', 'analytics', 'bulk', 'relationships', 'validation', 'library'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-sm"
                style={{
                  backgroundColor: activeTab === tab ? '#3891A6' : 'rgba(56, 145, 166, 0.2)',
                  color: activeTab === tab ? '#020202' : '#3891A6',
                  border: `2px solid ${activeTab === tab ? '#3891A6' : 'rgba(56, 145, 166, 0.5)'}`,
                }}
              >
                {tab === 'create' && '✏️ Create'}
                {tab === 'templates' && '📋 Templates'}
                {tab === 'difficulty' && '📊 Difficulty'}
                {tab === 'hints' && '💡 Hints'}
                {tab === 'versions' && '📌 Versions'}
                {tab === 'scheduling' && '⏰ Schedule'}
                {tab === 'test' && '🧪 Test'}
                {tab === 'analytics' && '📈 Analytics'}
                {tab === 'bulk' && '⚙️ Bulk'}
                {tab === 'relationships' && '🔗 Links'}
                {tab === 'validation' && '✓ Validate'}
                {tab === 'library' && '📚 Library'}
              </button>
            ))}
          </div>

          {activeTab === 'create' && (
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 space-y-6">
                  {formError && <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200">{formError}</div>}
                  {formSuccess && <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-200">{formSuccess}</div>}

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Puzzle Type *</label>
                    <select name="puzzleType" value={formData.puzzleType} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white">
                      {PUZZLE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Title *</label>
                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="Puzzle title" className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Describe the puzzle" className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-20" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Content</label>
                    <textarea name="content" value={formData.content} onChange={handleInputChange} placeholder="Puzzle content or description" className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 h-24" />
                  </div>

                  {formData.puzzleType === 'sudoku' && (
                    <SudokuGenerator
                      difficulty={sudokuDifficulty}
                      onDifficultyChange={setSudokuDifficulty}
                      onPuzzleGenerated={(puzzle, solution) => {
                        setSudokuPuzzle({ puzzle, solution });
                      }}
                    />
                  )}

                  {formData.puzzleType !== 'general' && formData.puzzleType !== 'sudoku' && <PuzzleTypeFields puzzleType={formData.puzzleType} puzzleData={formData.puzzleData} onDataChange={handlePuzzleDataChange} />}

                  <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Category</label>
                        <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white">
                          {PUZZLE_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Difficulty</label>
                        <select name="difficulty" value={formData.difficulty} onChange={handleInputChange} className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white">
                          {PUZZLE_DIFFICULTIES.map((diff) => (
                            <option key={diff.value} value={diff.value}>{diff.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                  {formData.puzzleType !== 'sudoku' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Correct Answer *</label>
                      <input type="text" name="correctAnswer" value={formData.correctAnswer} onChange={handleInputChange} placeholder="Answer" className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500" required />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Points</label>
                    <input type="number" name="pointsReward" value={formData.pointsReward} onChange={handleInputChange} min="1" className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white" />
                  </div>

                  {formData.puzzleType !== 'escape_room' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Hints ({formData.hints.filter(h => h.trim()).length})</label>
                      <div className="space-y-2 mb-3">
                        {formData.hints.map((hint, index) => (
                          <div key={index} className="flex gap-2">
                            <input type="text" value={hint} onChange={(e) => handleHintChange(index, e.target.value)} placeholder={`Hint ${index + 1}`} className="flex-1 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500" />
                            {formData.hints.length > 1 && (
                              <button type="button" onClick={() => handleRemoveHint(index)} className="px-3 py-2 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/50">Remove</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={handleAddHint} className="w-full px-4 py-2 rounded-lg bg-slate-600/50 border border-slate-500 text-gray-300 hover:bg-slate-600">+ Add Hint</button>
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold transition">
                    {submitting ? "Creating..." : "🚀 Create Puzzle"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <PuzzleTemplates onApplyTemplate={(t) => console.log('Template applied:', t)} currentPuzzleType={formData.puzzleType} />
            </div>
          )}

          {activeTab === 'difficulty' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <DifficultyCalculator onDifficultyChange={(diff, score) => setFormData({...formData, difficulty: diff})} puzzleType={formData.puzzleType} />
            </div>
          )}

          {activeTab === 'hints' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <AdvancedHintsSystem hints={[]} onChange={(h) => console.log('Hints updated:', h)} />
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <PuzzleVersioning puzzleId={puzzleId || 'new'} currentStatus="draft" onStatusChange={(s) => console.log('Status:', s)} />
            </div>
          )}

          {activeTab === 'scheduling' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <SchedulingPanel onScheduleChange={(s) => console.log('Schedule:', s)} />
            </div>
          )}

          {activeTab === 'test' && <SolutionTester correctAnswer={formData.correctAnswer} hints={formData.hints.filter(h => h.trim())} puzzleTitle={formData.title} />}

          {activeTab === 'analytics' && puzzleId && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <AnalyticsDashboard puzzleId={puzzleId} />
            </div>
          )}

          {activeTab === 'bulk' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <BulkOperations onBulkAction={(a, c) => console.log('Bulk action:', a, c)} />
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <PuzzleRelationships puzzleId={puzzleId || 'new'} onRelationshipAdd={(r) => console.log('Relationship:', r)} />
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <CustomValidation onValidatorAdd={(v) => console.log('Validator:', v)} />
            </div>
          )}

          {activeTab === 'library' && <ContentLibrary />}
        </div>
      </div>
    </div>
  );
}

*/
