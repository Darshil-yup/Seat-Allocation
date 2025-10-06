'use server';

/**
 * @fileOverview This file defines a Genkit flow for intelligently distributing students across classrooms.
 *
 * - intelligentSeating - A function that distributes students across classrooms using AI for balanced occupancy.
 * - IntelligentSeatingInput - The input type for the intelligentSeating function.
 * - IntelligentSeatingOutput - The return type for the intelligentSeating function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

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


const intelligentSeatingFlow = ai.defineFlow(
  {
    name: 'intelligentSeatingFlow',
    inputSchema: IntelligentSeatingInputSchema,
    outputSchema: IntelligentSeatingOutputSchema,
  },
  async ({ classrooms, students }) => {
    const totalCapacity = classrooms.reduce((sum, c) => sum + c.totalCapacity, 0);

    if (students.length > totalCapacity) {
      return { assignments: [], unassignedStudents: students };
    }
    
    const prompt = `You are an expert exam administrator. Your task is to create an optimal seating arrangement for an exam.

    RULES:
    1.  The most important rule is: **Students with the same "paper" must NEVER be seated at the same desk.** A desk has two sides: 'Side 1' and 'Side 2'.
    2.  You will be given a list of classrooms with their capacities and a list of students with their papers.
    3.  Assign students to desks sequentially within each classroom.
    4.  Fill all classrooms as efficiently as possible.
    5.  Any students that cannot be seated according to the rules must be returned in the 'unassignedStudents' list.

    Classrooms:
    ${JSON.stringify(classrooms, null, 2)}

    Students:
    ${JSON.stringify(students, null, 2)}

    Generate a JSON output with the seating assignments.
    `;

    const { output } = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-pro',
      output: {
          schema: IntelligentSeatingOutputSchema,
      },
    });

    return output!;
  }
);


export async function intelligentSeating(input: IntelligentSeatingInput): Promise<IntelligentSeatingOutput> {
  return intelligentSeatingFlow(input);
}
