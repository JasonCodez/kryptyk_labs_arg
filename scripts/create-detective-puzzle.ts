import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createDetectivePuzzle() {
  try {
    console.log("Creating Detective Agency Mystery escape room puzzle...");

    // First, get or create the category
    let category = await prisma.puzzleCategory.findUnique({
      where: { name: "Escape Room" },
    });

    if (!category) {
      category = await prisma.puzzleCategory.create({
        data: {
          name: "Escape Room",
          description: "Interactive escape room puzzles with multiple stages",
          icon: "🚪",
        },
      });
    }

    // Delete existing Detective Agency puzzle if it exists
    const existingPuzzle = await prisma.puzzle.findFirst({
      where: { title: "🔍 Detective Agency Mystery" },
    });

    if (existingPuzzle) {
      console.log("Deleting existing Detective Agency puzzle...");
      // Delete escape room puzzle first (cascade)
      await prisma.escapeRoomPuzzle.deleteMany({
        where: { puzzleId: existingPuzzle.id },
      });
      // Delete main puzzle
      await prisma.puzzle.delete({
        where: { id: existingPuzzle.id },
      });
      console.log("✓ Existing puzzle deleted");
    }

    // Create the main Puzzle record
    const mainPuzzle = await prisma.puzzle.create({
      data: {
        title: "🔍 Detective Agency Mystery",
        description:
          "A mysterious case lands on your desk. Interview the witness, analyze the evidence, interrogate the suspect, and solve the case before time runs out.",
        content:
          "A detective agency mystery with 4 interconnected rooms. Work through witness interviews, evidence analysis, suspect interrogation, and case closure.",
        categoryId: category.id,
        difficulty: "medium",
        puzzleType: "escape_room",
      },
    });

    // Then create the EscapeRoomPuzzle with stages
    const puzzle = await prisma.escapeRoomPuzzle.create({
      data: {
        puzzleId: mainPuzzle.id,
        roomTitle: "Detective Agency",
        roomDescription:
          "You work at a prestigious detective agency. A mysterious case has just landed on your desk, and you must solve it by interviewing witnesses, analyzing evidence, and interrogating suspects.",
        timeLimitSeconds: 1800, // 30 minutes
        stages: {
          create: [
            // Stage 0: Witness Interview (Interactive Q&A)
            {
              order: 0,
              title: "Room 1: Interactive Witness Interview",
              description:
                "You're a detective at the agency. A crucial witness has arrived. Ask them questions to gather evidence about the crime. You must learn the location and get their full testimony.",
              puzzleType: "text_input",
              correctAnswer: "witness_questioned",
              hints: JSON.stringify([
                "Ask the witness about what they saw",
                "The location is very important",
                "Ask about timing and suspect description",
              ]),
              rewardItem: "Witness Statement",
              rewardDescription: "Critical information from the witness interview",
              puzzleData: JSON.stringify({
                interactionType: "interactive_dialogue",
                initialMessage: "A nervous witness sits across from you in the interrogation room. 'Detective, I have information about the crime,' they say. Ask me questions about WHERE you saw the suspect to proceed with your investigation.",
                finalQuestion: "Based on what the witness told you, where did they see the suspect?",
                finalAnswerHint: "The witness mentioned a specific location - warehouse on 5th Street",
              }),
            },
            // Stage 1: Evidence Analysis (Image Analysis)
            {
              order: 1,
              title: "Room 2: Evidence Analysis",
              description:
                "Examine the crime scene photos carefully. Identify the key evidence that will help solve the case.",
              puzzleType: "text_input",
              correctAnswer: "warehouse",
              hints: JSON.stringify([
                "Look for distinctive features in the crime scene photo",
                "What type of building do you see?",
                "The witness mentioned a specific location",
              ]),
              rewardItem: "Evidence Documented",
              rewardDescription: "Crime scene evidence photographed and analyzed",
              puzzleData: JSON.stringify({
                interactionType: "image_analysis",
                imageUrl: "/images/crime-scene.svg",
                question: "What type of building is shown in this crime scene photo?",
                hints: [
                  "Notice the architectural style and size of the building",
                  "The witness mentioned a location with distinctive features",
                  "Look for industrial-style characteristics",
                ],
              }),
            },
            // Stage 2: Evidence Review (Evidence Carousel)
            {
              order: 2,
              title: "Room 3: Evidence Review",
              description:
                "Review all the collected evidence carefully. You must examine each piece before formulating your theory.",
              puzzleType: "text_input",
              correctAnswer: "guilt",
              hints: JSON.stringify([
                "Review all evidence items carefully",
                "What does the totality of evidence suggest?",
                "Consider motive, means, and opportunity",
              ]),
              rewardItem: "Investigation Complete",
              rewardDescription: "All evidence thoroughly reviewed",
              puzzleData: JSON.stringify({
                interactionType: "evidence_review",
                evidenceItems: [
                  {
                    id: "witness_statement",
                    title: "Witness Statement",
                    content: "Witness confirms seeing suspicious figure at 5th Street warehouse at midnight",
                  },
                  {
                    id: "crime_scene_photo",
                    title: "Crime Scene Photo",
                    content: "Warehouse showing signs of forced entry on loading dock door",
                  },
                  {
                    id: "suspect_vehicle",
                    title: "Suspect Vehicle",
                    content: "Vehicle matching witness description found parked 2 blocks from warehouse",
                  },
                  {
                    id: "financial_records",
                    title: "Financial Records",
                    content: "Suspect has motive: recently lost insurance settlement case",
                  },
                ],
                question: "Based on all evidence reviewed, what is your one-word conclusion about the suspect's guilt or innocence?",
                hints: [
                  "You must review all 4 evidence items before answering",
                  "Consider the financial motive revealed in the records",
                  "Multiple pieces of evidence point to the same conclusion",
                ],
              }),
            },
            // Stage 3: Timeline Reconstruction (Timeline with Drag-Drop)
            {
              order: 3,
              title: "Room 4: Timeline Reconstruction",
              description:
                "Arrange the events in correct chronological order to understand how the crime unfolded.",
              puzzleType: "text_input",
              correctAnswer: "event1,event2,event3,event4,event5",
              hints: JSON.stringify([
                "Drag events to arrange them chronologically",
                "Start with the earliest event",
                "The witness placed the suspect at a specific time",
              ]),
              rewardItem: "Timeline Verified",
              rewardDescription: "Event sequence confirmed",
              puzzleData: JSON.stringify({
                interactionType: "timeline",
                events: [
                  { id: "event1", event: "Witness leaves coffee shop at 11:45 PM" },
                  { id: "event2", event: "Suspect spotted at warehouse - 12:15 AM" },
                  { id: "event3", event: "Crime is discovered - 1:30 AM" },
                  { id: "event4", event: "Police receive anonymous tip - 2:00 AM" },
                  { id: "event5", event: "Suspect apprehended - 3:45 AM" },
                ],
                correctOrder: [
                  "event1",
                  "event2",
                  "event3",
                  "event4",
                  "event5",
                ],
                hint: "Arrange events in chronological order based on timestamps mentioned",
              }),
            },
          ],
        },
      },
      include: {
        stages: true,
      },
    });

    console.log("✅ Detective Agency Mystery puzzle created successfully!");
    console.log(`Puzzle ID: ${puzzle.puzzleId}`);
    console.log("Stages created:");
    puzzle.stages.forEach((stage: any, idx: number) => {
      console.log(`\n  📍 Stage ${stage.order}: ${stage.title}`);
      try {
        const parsed = JSON.parse(stage.puzzleData);
        console.log(`     interactionType: ${parsed.interactionType}`);
        if (parsed.question) console.log(`     question: ${parsed.question}`);
      } catch (e) {
        console.log(`     [Error parsing puzzleData]`);
      }
    });
    console.log("\nNew Interaction Types Demonstrated:");
    console.log("  ✓ interactive_dialogue - Dynamic Q&A with witness");
    console.log("  ✓ image_analysis - Examine crime scene photo");
    console.log("  ✓ evidence_review - Mandatory review of all clues");
    console.log("  ✓ timeline - Drag-drop event sequencing");
  } catch (error) {
    console.error("❌ Error creating puzzle:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createDetectivePuzzle();
