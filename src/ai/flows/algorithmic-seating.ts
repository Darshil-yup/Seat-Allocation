'use server';

/**
 * @fileOverview Algorithmic seat allocation without AI dependency
 * 
 * This implementation uses traditional algorithms to distribute students across classrooms
 * with the constraint that students with the same paper cannot sit at the same desk.
 */

import { z } from 'zod';

const ClassroomSchema = z.object({
    roomName: z.string().describe('The name or number of the classroom.'),
    totalCapacity: z.number().int().min(1).describe('The total seating capacity of the classroom.'),
});

export type Classroom = z.infer<typeof ClassroomSchema>;

const StudentSchema = z.object({
    rollNumber: z.string().describe('The roll number of the student.'),
    paper: z.string().describe('The paper or subject the student is taking.'),
});

export type Student = z.infer<typeof StudentSchema>;

const IntelligentSeatingInputSchema = z.object({
    classrooms: z.array(ClassroomSchema).describe('An array of classroom objects with name and capacity.'),
    students: z.array(StudentSchema).describe('An array of student objects with roll numbers and papers.'),
});
export type IntelligentSeatingInput = z.infer<typeof IntelligentSeatingInputSchema>;

const SeatingAssignmentSchema = z.object({
    roomName: z.string().describe('The name of the assigned classroom.'),
    deskNumber: z.number().int().min(1).describe('The desk number in the assigned classroom.'),
    side: z.enum(['Side 1', 'Side 2']).describe("The side of the desk ('Side 1' or 'Side 2')."),
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



export async function algorithmicSeating(input: IntelligentSeatingInput): Promise<IntelligentSeatingOutput> {
    const { classrooms, students } = input;

    // Check if we have enough total capacity
    const totalCapacity = classrooms.reduce((sum, c) => sum + c.totalCapacity, 0);
    if (students.length > totalCapacity) {
        return { assignments: [], unassignedStudents: students };
    }

    const assignments: StudentAssignment[] = [];
    const unassignedStudents: Student[] = [];

    // Group students by paper/branch first
    const studentsByPaper = students.reduce((acc, student) => {
        if (!acc[student.paper]) {
            acc[student.paper] = [];
        }
        acc[student.paper].push(student);
        return acc;
    }, {} as Record<string, Student[]>);

    // Helper function to get class identifier (paper + semester for anti-cheating)
    const getClassId = (student: Student) => {
        // Extract semester from roll number (e.g., "3" from "CT-3-45")
        const rollParts = student.rollNumber.split('-');
        const semester = rollParts.length >= 2 ? rollParts[1] : '0';
        return `${student.paper}-${semester}`;
    };

    // Sort students within each paper group by roll number
    Object.keys(studentsByPaper).forEach(paper => {
        studentsByPaper[paper].sort((a, b) => {
            // Handle different roll number formats
            const extractNumbers = (rollNumber: string) => {
                const matches = rollNumber.match(/\d+/g);
                if (!matches) return [0];
                return matches.map(num => parseInt(num));
            };

            const aNums = extractNumbers(a.rollNumber);
            const bNums = extractNumbers(b.rollNumber);

            // Compare each number part
            for (let i = 0; i < Math.max(aNums.length, bNums.length); i++) {
                const aNum = aNums[i] || 0;
                const bNum = bNums[i] || 0;

                if (aNum !== bNum) {
                    return aNum - bNum;
                }
            }

            return a.rollNumber.localeCompare(b.rollNumber);
        });
    });

    // Create seat tracker for all classrooms
    const seatTracker: Array<{
        roomName: string;
        deskNumber: number;
        side: 'Side 1' | 'Side 2';
        occupied: boolean;
        paper?: string;
        rollNumber?: string;
    }> = [];

    // Initialize all seats sequentially
    for (const classroom of classrooms) {
        const maxDesks = Math.ceil(classroom.totalCapacity / 2);
        for (let desk = 1; desk <= maxDesks; desk++) {
            // Add Side 1
            seatTracker.push({
                roomName: classroom.roomName,
                deskNumber: desk,
                side: 'Side 1',
                occupied: false,
            });

            // Add Side 2 only if capacity allows
            if ((desk - 1) * 2 + 2 <= classroom.totalCapacity) {
                seatTracker.push({
                    roomName: classroom.roomName,
                    deskNumber: desk,
                    side: 'Side 2',
                    occupied: false,
                });
            }
        }
    }

    // COMPLETELY RANDOMIZE student assignment to break all patterns
    const allStudents = [...students];
    
    // Fisher-Yates shuffle for complete randomization
    for (let i = allStudents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allStudents[i], allStudents[j]] = [allStudents[j], allStudents[i]];
    }

    // Use completely randomized order
    const studentsToAssign = allStudents;

    for (const student of studentsToAssign) {
        let assigned = false;
        
        // Create a list of all available seats and shuffle them
        const availableSeats = seatTracker.filter(seat => !seat.occupied);
        
        // Shuffle available seats to add more randomness
        for (let i = availableSeats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSeats[i], availableSeats[j]] = [availableSeats[j], availableSeats[i]];
        }

        // Try to find a seat that doesn't violate anti-cheating rules
        for (const seat of availableSeats) {
            // Check if same desk has a student with same class (paper + semester) - STRICT RULE
            const sameClassOnDesk = seatTracker.some(s => {
                if (s.roomName === seat.roomName &&
                    s.deskNumber === seat.deskNumber &&
                    s.side !== seat.side &&
                    s.occupied) {

                    const otherStudent = students.find(st => st.rollNumber === s.rollNumber);
                    if (otherStudent) {
                        return getClassId(otherStudent) === getClassId(student);
                    }
                }
                return false;
            });

            if (sameClassOnDesk) {
                continue; // Skip this seat - same class not allowed on same desk
            }

            // Check for same paper on same desk - also not allowed
            const samePaperOnDesk = seatTracker.some(s => {
                if (s.roomName === seat.roomName &&
                    s.deskNumber === seat.deskNumber &&
                    s.side !== seat.side &&
                    s.occupied) {

                    const otherStudent = students.find(st => st.rollNumber === s.rollNumber);
                    return otherStudent && otherStudent.paper === student.paper;
                }
                return false;
            });

            if (samePaperOnDesk) {
                continue; // Skip this seat - same paper not allowed on same desk
            }

            // This seat is valid - assign it
            seat.occupied = true;
            seat.paper = student.paper;
            seat.rollNumber = student.rollNumber;

            assignments.push({
                rollNumber: student.rollNumber,
                paper: student.paper,
                assignment: {
                    roomName: seat.roomName,
                    deskNumber: seat.deskNumber,
                    side: seat.side,
                },
            });

            assigned = true;
            break;
        }

        if (!assigned) {
            unassignedStudents.push(student);
        }
    }

    // Validate the seating arrangement for anti-cheating compliance
    const validationResult = validateSeatingArrangement(assignments, students);

    console.log('Seating Validation Results:', validationResult);

    return { assignments, unassignedStudents };
}

/**
 * Validates the seating arrangement to ensure anti-cheating compliance
 */
function validateSeatingArrangement(assignments: StudentAssignment[], allStudents: Student[]): {
    isValid: boolean;
    violations: string[];
    statistics: {
        totalStudents: number;
        sameDeskViolations: number;
        adjacentSamePaperCount: number;
        paperDistribution: Record<string, number>;
    };
} {
    const violations: string[] = [];
    let sameDeskViolations = 0;
    let adjacentSamePaperCount = 0;
    const paperDistribution: Record<string, number> = {};

    // Helper function to get class identifier
    const getClassId = (student: Student) => {
        const rollParts = student.rollNumber.split('-');
        const semester = rollParts.length >= 2 ? rollParts[1] : '0';
        return `${student.paper}-${semester}`;
    };

    // Group assignments by room and desk
    const deskMap = new Map<string, StudentAssignment[]>();

    for (const assignment of assignments) {
        if (!assignment.assignment) continue;

        const deskKey = `${assignment.assignment.roomName}-${assignment.assignment.deskNumber}`;
        if (!deskMap.has(deskKey)) {
            deskMap.set(deskKey, []);
        }
        deskMap.get(deskKey)!.push(assignment);

        // Count paper distribution
        paperDistribution[assignment.paper] = (paperDistribution[assignment.paper] || 0) + 1;
    }

    // Check for same-class students on same desk (major violation)
    for (const [deskKey, studentsOnDesk] of deskMap) {
        if (studentsOnDesk.length === 2) {
            const student1 = allStudents.find(s => s.rollNumber === studentsOnDesk[0].rollNumber)!;
            const student2 = allStudents.find(s => s.rollNumber === studentsOnDesk[1].rollNumber)!;

            if (getClassId(student1) === getClassId(student2)) {
                violations.push(`Same class students on desk ${deskKey}: ${student1.rollNumber} and ${student2.rollNumber}`);
                sameDeskViolations++;
            }
        }
    }

    // Check for adjacent same-paper clustering (warning level)
    const roomDesks = new Map<string, Map<number, StudentAssignment[]>>();

    for (const assignment of assignments) {
        if (!assignment.assignment) continue;

        const roomName = assignment.assignment.roomName;
        const deskNumber = assignment.assignment.deskNumber;

        if (!roomDesks.has(roomName)) {
            roomDesks.set(roomName, new Map());
        }
        if (!roomDesks.get(roomName)!.has(deskNumber)) {
            roomDesks.get(roomName)!.set(deskNumber, []);
        }
        roomDesks.get(roomName)!.get(deskNumber)!.push(assignment);
    }

    // Count adjacent same-paper instances
    for (const [, desks] of roomDesks) {
        const deskNumbers = Array.from(desks.keys()).sort((a, b) => a - b);

        for (let i = 0; i < deskNumbers.length - 1; i++) {
            const currentDesk = desks.get(deskNumbers[i])!;
            const nextDesk = desks.get(deskNumbers[i + 1])!;

            // Check if adjacent desks have students from same paper
            for (const student1 of currentDesk) {
                for (const student2 of nextDesk) {
                    if (student1.paper === student2.paper) {
                        adjacentSamePaperCount++;
                    }
                }
            }
        }
    }

    return {
        isValid: violations.length === 0,
        violations,
        statistics: {
            totalStudents: assignments.length,
            sameDeskViolations,
            adjacentSamePaperCount,
            paperDistribution,
        },
    };
}

// Export the same interface for compatibility
export const intelligentSeating = algorithmicSeating;