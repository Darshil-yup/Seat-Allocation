'use server';

/**
 * @fileOverview Seating arrangement algorithm implementing:
 * - Equal bench distribution across columns (2 seats per bench)
 * - No two students of the same paper on the same bench
 * - Prefer filling 4-column rooms before 5-column rooms
 * - Mock serial numbers 1..N per classroom for print visibility
 */

import { z } from 'zod';

const ClassroomSchema = z.object({
  roomName: z.string().describe('The name or number of the classroom.'),
  totalCapacity: z.number().int().min(1).describe('The total seating capacity of the classroom.'),
  numberOfColumns: z.number().int().min(1).max(8).describe('Number of columns in the classroom.'),
  desksPerColumn: z.array(z.number().int().min(1)).optional().describe('Optional array specifying exact number of desks per column.'),
});

export type Classroom = z.infer<typeof ClassroomSchema>;

const StudentSchema = z.object({
  rollNumber: z.string().describe('The roll number of the student.'),
  paper: z.string().describe('The paper or subject the student is taking.'),
  branch: z.string().describe('The department/branch of the student (e.g., CT, AIDS).'),
  semesterSection: z.string().describe("Semester or semester-section label (e.g., '3-A', '5-B')."),
});

export type Student = z.infer<typeof StudentSchema>;

const IntelligentSeatingInputSchema = z.object({
  classrooms: z.array(ClassroomSchema).describe('An array of classroom objects with name, capacity and columns.'),
  students: z.array(StudentSchema).describe('An array of student objects with roll numbers and papers.'),
});
export type IntelligentSeatingInput = z.infer<typeof IntelligentSeatingInputSchema>;

const SeatingAssignmentSchema = z.object({
  roomName: z.string().describe('The name of the assigned classroom.'),
  deskNumber: z.number().int().min(1).describe('The bench number in the assigned classroom.'),
  side: z.enum(['Side 1', 'Side 2']).describe("The side of the bench ('Side 1' or 'Side 2')."),
  serialNumber: z.number().int().min(1).describe('Mock serial number from 1 to max capacity for display purposes.'),
});

const StudentAssignmentSchema = z.object({
  rollNumber: z.string().describe('The roll number of the student.'),
  paper: z.string().describe('The paper or subject the student is taking.'),
  assignment: SeatingAssignmentSchema.optional().describe('The seating assignment for the student, if assigned.'),
});

export type StudentAssignment = z.infer<typeof StudentAssignmentSchema>;

const IntelligentSeatingOutputSchema = z.object({
  assignments: z.array(StudentAssignmentSchema).describe('An array of student assignments with room, desk, and side.'),
  unassignedStudents: z.array(StudentSchema).describe('An array of students who could not be assigned to a classroom.'),
});
export type IntelligentSeatingOutput = z.infer<typeof IntelligentSeatingOutputSchema>;

// Extract trailing numeric part for ordering within a paper
function extractRollNumberNumeric(rollNumber: string): number {
  const parts = rollNumber.split('-');
  const n = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(n) ? n : 0;
}

export async function intelligentSeating(input: IntelligentSeatingInput): Promise<IntelligentSeatingOutput> {
  const { classrooms, students } = input;

  console.log("=== AI FLOW RECEIVED ===");
  console.log("Classrooms:", JSON.stringify(classrooms, null, 2));
  console.log("Students count:", students.length);

  const totalCapacity = classrooms.reduce((sum: number, c: Classroom) => sum + c.totalCapacity, 0);

  const assignments: StudentAssignment[] = [];
  const unassignedStudents: Student[] = [];

  // Helpers
  const getSemesterNumber = (semSec: string) => semSec.split('-')[0]?.trim() || '0';

  // 1) Group by branch, then by semester, and sort by roll within each
  type BranchBuckets = Record<string, Record<string, Student[]>>; // branch -> sem -> students
  const byBranch: BranchBuckets = {};
  for (const s of students) {
    const sem = getSemesterNumber(s.semesterSection);
    if (!byBranch[s.branch]) byBranch[s.branch] = {};
    if (!byBranch[s.branch][sem]) byBranch[s.branch][sem] = [];
    byBranch[s.branch][sem].push(s);
  }
  Object.keys(byBranch).forEach(branch => {
    Object.keys(byBranch[branch]).forEach(sem => {
      byBranch[branch][sem].sort((a, b) => extractRollNumberNumeric(a.rollNumber) - extractRollNumberNumeric(b.rollNumber));
    });
  });

  const remainingInBranch = (branch: string) =>
    Object.values(byBranch[branch] || {}).reduce((acc, arr) => acc + arr.length, 0);

  const popFromBranchSemester = (branch: string, sem: string): Student | null => {
    const arr = byBranch[branch]?.[sem];
    return arr && arr.length > 0 ? arr.shift()! : null;
  };

  const getTopTwoSemesters = (branch: string): string[] => {
    return Object.keys(byBranch[branch] || {})
      .filter(sem => (byBranch[branch][sem]?.length || 0) > 0)
      .sort((a, b) => (byBranch[branch][b].length - byBranch[branch][a].length) || parseInt(a) - parseInt(b))
      .slice(0, 2);
  };

  // 2) Sort classrooms: prefer 4-column rooms first, then 5, then others
  const sortedClassrooms = [...classrooms].sort((a, b) => {
    const pref = (cols: number) => (cols === 4 ? 0 : cols === 5 ? 1 : 2);
    return pref(a.numberOfColumns) - pref(b.numberOfColumns) || a.roomName.localeCompare(b.roomName);
  });

  // 3) Fill each classroom primarily with a single branch
  for (const classroom of sortedClassrooms) {
    if (Object.keys(byBranch).every(b => remainingInBranch(b) === 0)) break;

    // Choose the branch with the most remaining students
    const chosenBranch = Object.keys(byBranch)
      .filter(b => remainingInBranch(b) > 0)
      .sort((a, b) => remainingInBranch(b) - remainingInBranch(a) || a.localeCompare(b))[0];

    const capacity = classroom.totalCapacity;
    const columns = Math.max(1, classroom.numberOfColumns);

    console.log(`Processing classroom: ${classroom.roomName}`);
    console.log(`Classroom desksPerColumn:`, classroom.desksPerColumn);
    console.log(`Classroom columns:`, columns);

    // Use specific desks per column if provided, otherwise calculate evenly
    const benchesPerColumn: number[] = classroom.desksPerColumn || (() => {
      console.log(`No desksPerColumn provided, calculating evenly for ${capacity} capacity`);
      const benches = Math.ceil(capacity / 2);
      const basePerCol = Math.floor(benches / columns);
      const remainder = benches % columns;
      return Array.from({ length: columns }, (_, i) => basePerCol + (i < remainder ? 1 : 0));
    })();

    console.log(`Final benchesPerColumn:`, benchesPerColumn);

    let serialNumber = 1;
    let deskOffset = 0;

    for (let col = 0; col < columns; col++) {
      const rows = benchesPerColumn[col];
      for (let row = 1; row <= rows; row++) {
        if (serialNumber > capacity) break;
        // Determine the two semesters to pair for this branch at this moment
        const [semA, semB] = getTopTwoSemesters(chosenBranch);
        if (!semA && !semB) break; // nothing left in this branch

        const s1 = semA ? popFromBranchSemester(chosenBranch, semA) : null;
        const s2 = semB ? popFromBranchSemester(chosenBranch, semB) : null; // may be null if only one sem remains

        const deskNumber = deskOffset + row;

        if (s1) {
          assignments.push({
            rollNumber: s1.rollNumber,
            paper: s1.paper,
            assignment: {
              roomName: classroom.roomName,
              deskNumber,
              side: 'Side 1',
              serialNumber,
            },
          });
          serialNumber++;
        }

        if (s2 && serialNumber <= capacity) {
          assignments.push({
            rollNumber: s2.rollNumber,
            paper: s2.paper,
            assignment: {
              roomName: classroom.roomName,
              deskNumber,
              side: 'Side 2',
              serialNumber,
            },
          });
          serialNumber++;
        }
      }
      deskOffset += rows;

      // If this branch ran out mid-room and capacity remains, we will continue to next loop iteration
      // which selects new semesters within the same branch first; only when the branch empties entirely
      // will we move to next branch on the next classroom.
    }

    // If the room still has capacity and this branch is empty, the next classroom will pick another branch.
  }

  // 4) Second pass: place remaining students (any branch) into any room with free seats
  // Collect leftover students
  const leftovers: Student[] = [];
  for (const branch of Object.keys(byBranch)) {
    for (const sem of Object.keys(byBranch[branch])) {
      leftovers.push(...byBranch[branch][sem]);
    }
  }

  if (leftovers.length > 0) {
    // Bucket leftovers by paper to keep pairing rule
    const byPaperLeft: Record<string, Student[]> = {};
    for (const s of leftovers) {
      if (!byPaperLeft[s.paper]) byPaperLeft[s.paper] = [];
      byPaperLeft[s.paper].push(s);
    }
    const paperKeysLeft = Object.keys(byPaperLeft);
    const remainingCountPaper = (p: string) => byPaperLeft[p]?.length || 0;
    const popFromPaper = (p: string): Student | null => {
      const arr = byPaperLeft[p];
      return arr && arr.length > 0 ? arr.shift()! : null;
    };

    const pickTopPaper = () => paperKeysLeft.filter(p => remainingCountPaper(p) > 0)
      .sort((a,b) => remainingCountPaper(b) - remainingCountPaper(a) || a.localeCompare(b))[0];

    const pickOtherPaper = (not: string) => paperKeysLeft.filter(p => p !== not && remainingCountPaper(p) > 0)
      .sort((a,b) => remainingCountPaper(b) - remainingCountPaper(a) || a.localeCompare(b))[0];

    // Helper to compute bench layout and iterate desk numbers in order
    const benchesFor = (room: Classroom) => {
      const columns = Math.max(1, room.numberOfColumns);
      // Use specific desks per column if provided, otherwise calculate evenly
      return room.desksPerColumn || (() => {
        const benches = Math.ceil(room.totalCapacity / 2);
        const basePerCol = Math.floor(benches / columns);
        const remainder = benches % columns;
        return Array.from({ length: columns }, (_, i) => basePerCol + (i < remainder ? 1 : 0));
      })();
    };

    for (const room of sortedClassrooms) {
      if (paperKeysLeft.every(p => remainingCountPaper(p) === 0)) break;

      // Current occupancy in room
      const roomAssignments = assignments.filter(a => a.assignment?.roomName === room.roomName);
      let serialNumber = roomAssignments.length + 1;
      if (serialNumber > room.totalCapacity) continue;

      const perCol = benchesFor(room);
      let deskOffset = 0;
      for (let col = 0; col < perCol.length; col++) {
        const rows = perCol[col];
        for (let row = 1; row <= rows; row++) {
          if (paperKeysLeft.every(p => remainingCountPaper(p) === 0)) break;
          if (serialNumber > room.totalCapacity) break;
          const deskNumber = deskOffset + row;
          // Determine current occupancy of this desk
          const existing = roomAssignments.filter(a => a.assignment?.deskNumber === deskNumber);
          const side1 = existing.find(e => e.assignment?.side === 'Side 1') || null;
          const side2 = existing.find(e => e.assignment?.side === 'Side 2') || null;

          // If both sides filled, continue
          if (side1 && side2) continue;

          // If none, place a new pair
          if (!side1 && !side2) {
            const top = pickTopPaper();
            if (!top) break;
            const s1 = popFromPaper(top);
            const otherPaper = pickOtherPaper(top);
            const s2 = otherPaper ? popFromPaper(otherPaper) : null;

            if (s1) {
              assignments.push({
                rollNumber: s1.rollNumber,
                paper: s1.paper,
                assignment: { roomName: room.roomName, deskNumber, side: 'Side 1', serialNumber },
              });
              serialNumber++; if (serialNumber > room.totalCapacity) continue;
            }
            if (s2) {
              assignments.push({
                rollNumber: s2.rollNumber,
                paper: s2.paper,
                assignment: { roomName: room.roomName, deskNumber, side: 'Side 2', serialNumber },
              });
              serialNumber++;
            }
            continue;
          }

          // If one side occupied, try fill ONLY with a different paper; otherwise leave empty
          const occupied = side1 || side2;
          const occupiedPaper = occupied!.paper;
          const otherPaper = pickOtherPaper(occupiedPaper);
          if (otherPaper) {
            const pick = popFromPaper(otherPaper);
            if (pick) {
              const side: 'Side 1' | 'Side 2' = side1 ? 'Side 2' : 'Side 1';
              assignments.push({
                rollNumber: pick.rollNumber,
                paper: pick.paper,
                assignment: { roomName: room.roomName, deskNumber, side, serialNumber },
              });
              serialNumber++;
            }
          }
        }
        deskOffset += rows;
      }
    }

    // Any still left are truly unassigned
    for (const p of paperKeysLeft) {
      for (const s of byPaperLeft[p]) unassignedStudents.push(s);
    }
  }

  return { assignments, unassignedStudents };
}
