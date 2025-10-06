import type { Classroom as AIClassroom, Student as AIStudent, StudentAssignment as AIStudentAssignment } from '@/ai/flows/intelligent-seating';

export type Classroom = {
  id: string;
  roomName: string;
  totalCapacity: number;
  numberOfColumns: number;
};

export type Student = AIStudent & { 
    branch: 'CT' | 'AIDS' | 'CSE(IOT)' | string;
    semesterSection: string;
};

// Add serialNumber to the assignment details
export type StudentAssignment = Omit<AIStudentAssignment, 'assignment' | 'paper'> & {
    paper: string;
    branch: 'CT' | 'AIDS' | 'CSE(IOT)' | string;
    semesterSection: string;
    assignment?: {
        roomName: string;
        deskNumber: number;
        side: 'Side 1' | 'Side 2';
        serialNumber: number;
    };
};


export type Allocation = {
    assignments: StudentAssignment[];
    unassignedStudents: Student[];
};
