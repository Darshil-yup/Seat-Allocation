"use client";

import { useState, useEffect, useCallback } from "react";
import type { Classroom, Student, Allocation, StudentAssignment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/seat-assign/header";
import ClassroomManager from "@/components/seat-assign/classroom-manager";
import StudentManager from "@/components/seat-assign/student-manager";
import AllocationDashboard from "@/components/seat-assign/allocation-dashboard";
import { Separator } from "@/components/ui/separator";
import { intelligentSeating, type IntelligentSeatingInput, type IntelligentSeatingOutput } from "@/ai/flows/algorithmic-seating";

// This function transforms the frontend data types to the AI flow's expected input types
const prepareFlowInput = (classrooms: Classroom[], students: Student[]): IntelligentSeatingInput => {
  const flowClassrooms = classrooms.map(c => ({
    roomName: c.roomName,
    totalCapacity: c.totalCapacity
  }));
  
  const flowStudents = students.map(s => ({
    rollNumber: s.rollNumber,
    paper: s.paper
  }));

  return { classrooms: flowClassrooms, students: flowStudents };
};

// This function transforms the AI flow's output to the frontend's data types
const processFlowOutput = (output: IntelligentSeatingOutput, originalStudents: Student[]): Allocation => {
  const studentMap = new Map(originalStudents.map(s => [s.rollNumber, s]));

  const assignments: StudentAssignment[] = output.assignments.map((a, index) => {
    const originalStudent = studentMap.get(a.rollNumber);
    return {
      ...a,
      branch: originalStudent?.branch || '',
      semesterSection: originalStudent?.semesterSection || '',
      // The AI model provides the assignment, we just add the serial number
      assignment: a.assignment ? { ...a.assignment, serialNumber: index + 1 } : undefined
    };
  });
  
  const unassignedStudents: Student[] = output.unassignedStudents.map(s => {
      const originalStudent = studentMap.get(s.rollNumber);
      return originalStudent!;
  }).filter(Boolean);

  return { assignments, unassignedStudents };
};

export default function Home() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allocation, setAllocation] = useState<Allocation>({
    assignments: [],
    unassignedStudents: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runAllocation = useCallback(async () => {
    setIsLoading(true);
    if (students.length === 0 || classrooms.length === 0) {
      setAllocation({ assignments: [], unassignedStudents: students });
      setIsLoading(false);
      return;
    }

    const totalCapacity = classrooms.reduce((acc, c) => acc + (c.totalCapacity || 0), 0);
    if (totalCapacity < students.length) {
        toast({
            title: "Not Enough Capacity",
            description: "Total classroom capacity is less than the number of students.",
            variant: "destructive",
        });
    }

    try {
      const flowInput = prepareFlowInput(classrooms, students);
      const result = await intelligentSeating(flowInput);
      const processedResult = processFlowOutput(result, students);
      
      // Ensure serial numbers are correctly assigned based on the final sorted list
      const sortedAssignments = processedResult.assignments
        .sort((a,b) => {
            const roomCompare = a.assignment!.roomName.localeCompare(b.assignment!.roomName);
            if (roomCompare !== 0) return roomCompare;
            const deskCompare = a.assignment!.deskNumber - b.assignment!.deskNumber;
            if (deskCompare !== 0) return deskCompare;
            return a.assignment!.side.localeCompare(b.assignment!.side);
        })
        .map((a, index) => ({...a, assignment: {...a.assignment!, serialNumber: index + 1}}));

      setAllocation({ ...processedResult, assignments: sortedAssignments });

    } catch (error) {
      console.error("AI allocation failed:", error);
      toast({
        title: "AI Allocation Failed",
        description: "Could not generate seating arrangement. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  }, [students, classrooms, toast]);

  useEffect(() => {
    // Debounce the allocation to avoid running it on every keystroke
    const handler = setTimeout(() => {
      runAllocation();
    }, 1000); // Increased debounce time for AI calls

    return () => clearTimeout(handler);
  }, [students, classrooms, runAllocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <ClassroomManager classrooms={classrooms} setClassrooms={setClassrooms} />
            <StudentManager students={students} setStudents={setStudents} />
          </div>
          <div className="lg:sticky lg:top-8">
            <AllocationDashboard
              classrooms={classrooms}
              students={students}
              allocation={allocation}
              isLoading={isLoading}
            />
          </div>
        </div>
        <Separator className="my-12" />
        <footer className="text-center text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} SeatAssign. All rights reserved.</p>
          <p>An AI-powered utility for modern problems.</p>
        </footer>
      </main>
    </div>
  );
}
