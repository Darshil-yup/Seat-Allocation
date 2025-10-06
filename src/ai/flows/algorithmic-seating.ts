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

    // Assign students paper by paper, allowing mixed papers in classrooms
    const paperNames = Object.keys(studentsByPaper).sort();

    for (const paperName of paperNames) {
        const studentsInPaper = studentsByPaper[paperName];

        for (const student of studentsInPaper) {
            let assigned = false;

            // Find the first available seat where the student can sit
            for (const seat of seatTracker) {
                if (!seat.occupied) {
                    // Check if same desk has a student with same class (paper + semester) - not allowed for anti-cheating
                    const sameClassOnDesk = seatTracker.some(s => {
                        if (s.roomName === seat.roomName &&
                            s.deskNumber === seat.deskNumber &&
                            s.side !== seat.side &&
                            s.occupied) {

                            // Find the other student's data to get their class ID
                            const otherStudent = students.find(st => st.rollNumber === s.rollNumber);
                            if (otherStudent) {
                                return getClassId(otherStudent) === getClassId(student);
                            }
                        }
                        return false;
                    });

                    if (!sameClassOnDesk) {
                        // Assign the seat
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
                }
            }

            if (!assigned) {
                unassignedStudents.push(student);
            }
        }
    }

    return { assignments, unassignedStudents };
}



// Export the same interface for compatibility
export const intelligentSeating = algorithmicSeating;