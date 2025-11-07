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

const IntelligentSeatingInputSchema = z.object({
  classrooms: z.array(ClassroomSchema).describe('An array of classroom objects with name, capacity and columns.'),
  students: z.array(StudentSchema).describe('An array of student objects with roll numbers and papers.'),
});
export type IntelligentSeatingInput = z.infer<typeof IntelligentSeatingInputSchema>;

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

  // Fresh allocation (no preservation)
  const assignments: StudentAssignment[] = [];

  // Build per-paper queues preserving input paper order, with roll numbers ordered within each paper
  const paperOrder: string[] = [];
  const byPaper: Record<string, Student[]> = {};
  for (const s of students) {
    if (!byPaper[s.paper]) {
      byPaper[s.paper] = [];
      paperOrder.push(s.paper);
    }
    byPaper[s.paper].push(s);
  }
  for (const p of paperOrder) {
    byPaper[p].sort((a, b) => extractRollNumberNumeric(a.rollNumber) - extractRollNumberNumeric(b.rollNumber));
  }
  let paperIdx = 0; // round-robin pointer

  // Helper: pop next student round-robin across papers
  const pop = (): Student | null => {
    if (paperOrder.length === 0) return null;
    let checked = 0;
    while (checked < paperOrder.length) {
      const paper = paperOrder[paperIdx];
      const q = byPaper[paper];
      paperIdx = (paperIdx + 1) % paperOrder.length;
      checked++;
      if (q && q.length) return q.shift()!;
    }
    return null;
  };

  // Helper: pop next student with a different paper, staying near current rotation
  const popDifferentPaper = (avoid: string): Student | null => {
    if (paperOrder.length === 0) return null;
    let checked = 0;
    let localIdx = paperIdx; // start from current rotation position
    while (checked < paperOrder.length) {
      const paper = paperOrder[localIdx];
      const q = byPaper[paper];
      localIdx = (localIdx + 1) % paperOrder.length;
      checked++;
      if (paper !== avoid && q && q.length) {
        // Advance global pointer to the position after the queue we pulled from
        paperIdx = localIdx;
        return q.shift()!;
      }
    }
    return null;
  };

  const hasRemaining = (): boolean => {
    for (const p of paperOrder) {
      if (byPaper[p]?.length) return true;
    }
    return false;
  };

  // Sort classrooms (prefer 4 columns, then 5, then others)
  const sorted = [...classrooms].sort((a, b) => {
    const pref = (c: number) => (c === 4 ? 0 : c === 5 ? 1 : 2);
    return pref(a.numberOfColumns) - pref(b.numberOfColumns) || a.roomName.localeCompare(b.roomName);
  });

  for (const room of sorted) {
    if (!hasRemaining()) break;

    const columns = Math.max(1, room.numberOfColumns);
    // benches per column (desks, 2 seats per desk)
    const perCol: number[] = room.desksPerColumn && room.desksPerColumn.length === columns
      ? room.desksPerColumn
      : (() => {
          const benches = Math.ceil(room.totalCapacity / 2);
          const base = Math.floor(benches / columns);
          const rem = benches % columns;
          return Array.from({ length: columns }, (_, i) => base + (i < rem ? 1 : 0));
        })();

    // Serial numbers start at 1 per room
    let serial = 1;

    // Helper to get next paper with remaining students, advancing global rotation
    const nextPaper = (exclude?: string): string | null => {
      if (paperOrder.length === 0) return null;
      let checked = 0;
      while (checked < paperOrder.length) {
        const p = paperOrder[paperIdx];
        paperIdx = (paperIdx + 1) % paperOrder.length;
        checked++;
        if (p !== exclude && byPaper[p]?.length) return p;
      }
      return null;
    };

    // Current locked pair for this room to keep sequences stable per side
    let p1: string | null = null;
    let p2: string | null = null;
    const ensurePair = () => {
      if (!p1 || !byPaper[p1]?.length) p1 = nextPaper();
      if (!p2 || !byPaper[p2]?.length || p2 === p1) p2 = nextPaper(p1 || undefined);
    };

    // Iterate columns and rows
    let deskBase = 0;
    for (let col = 0; col < columns; col++) {
      const rows = perCol[col];
      for (let row = 1; row <= rows; row++) {
        if (!hasRemaining() || serial > room.totalCapacity) break;
        const desk = deskBase + row;

        // Keep the paper pair sticky across benches
        ensurePair();
        if (!p1) break; // no students left at all

        const s1 = byPaper[p1]?.shift() || null;
        if (s1) {
          assignments.push({
            rollNumber: s1.rollNumber,
            paper: s1.paper,
            assignment: { roomName: room.roomName, deskNumber: desk, side: 'Side 1', serialNumber: serial },
          });
          serial++;
        }
        if (serial <= room.totalCapacity && p2) {
          const s2 = byPaper[p2]?.shift() || null;
          if (s2) {
            assignments.push({
              rollNumber: s2.rollNumber,
              paper: s2.paper,
              assignment: { roomName: room.roomName, deskNumber: desk, side: 'Side 2', serialNumber: serial },
            });
            serial++;
          }
        }

        // If either paper queue emptied, reset to choose next pair
        if (!byPaper[p1]?.length) p1 = null;
        if (!p2 || !byPaper[p2]?.length) p2 = null;
      }
      deskBase += rows;
    }
  }

  // Gather any remaining students in queues as unassigned
  const unassignedStudents: Student[] = [];
  for (const p of paperOrder) {
    const q = byPaper[p];
    if (q && q.length) unassignedStudents.push(...q);
  }
  return { assignments, unassignedStudents };
}
