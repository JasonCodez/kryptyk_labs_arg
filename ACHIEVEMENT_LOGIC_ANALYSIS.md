## Achievement Unlock Logic Analysis

### Auto-Collectible Achievements (Can be collected via button)
These achievements can be automatically tracked and collected:

1. **puzzles_solved** - Track number of puzzles solved
   - First Blood (1 puzzle)
   - Decade Club (10 puzzles)
   - Century Club (100 puzzles)
   - Legend Status (500 puzzles)
   - Cryptic God (1000 puzzles)
   ✅ Fully implemented

2. **submission_accuracy** - Track puzzles solved on first try
   - Perfect Shot (1 puzzle first try)
   - Bullseye (10 puzzles first try)
   - Sharpshooter (50 puzzles first try)
   - Instant Solver (3 puzzles without errors)
   ✅ Needs accuracy tracking logic

### Manual/Event-Based Achievements (Require special handling)
These need event listeners or periodic checks:

1. **time_based** - Time of day or speed-based
   - Speed Runner (solve in < 5 min)
   - Lightning Fast (solve in < 1 min)
   - Early Bird (solve before 6 AM)
   - Night Owl (solve after midnight)
   ❌ Requires session timing data

2. **streak** - Consecutive days solving
   - On Fire (7-day streak)
   - Streak Master (30-day streak)
   - Unstoppable (100-day streak)
   ❌ Requires streak tracking system

3. **team_size** - Team-related conditions
   - Team Player (join team)
   - Connector (5+ members)
   - Alliance Leader (10+ members)
   ❌ Requires team management system

4. **puzzle_category** - Category-specific counts
   - Crypto Master (50 crypto puzzles)
   - Logic Guru (50 logic puzzles)
   - Wordsmith (50 word puzzles)
   - Explorer (10 different categories)
   ❌ Needs category tracking

5. **custom** - Special logic needed
   - Mentor (help 3 team members)
   - Hint Minimalist (20 without hints)
   - Hint Hoarder (use all hints on 10)
   - Comeback King (50+ attempts)
   - Social Butterfly (5 invites)
   ❌ Requires custom tracking

### Current Implementation Status
- ✅ puzzles_solved: Working
- ⚠️ submission_accuracy: Needs accuracy data from puzzles
- ❌ time_based: Not implemented
- ❌ streak: Not implemented
- ❌ team_size: Not implemented
- ❌ puzzle_category: Not implemented
- ❌ custom: Not implemented

### Recommendation
Focus on fully implementing the two auto-collect types first:
1. puzzles_solved ✅
2. submission_accuracy (needs puzzle data structure update)

Then add event-based unlock system for others.
