"use client";

import { useState, useEffect, useCallback } from "react";
import type { Classroom, Student, Allocation, StudentAssignment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import AppHeader from "@/components/seat-assign/header";
import ClassroomManager from "@/components/seat-assign/classroom-manager";
import StudentManager from "@/components/seat-assign/student-manager";
import AllocationDashboard from "@/components/seat-assign/allocation-dashboard";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { FileDown, Upload } from "lucide-react";
import { intelligentSeating, type IntelligentSeatingInput, type IntelligentSeatingOutput } from "@/ai/flows/intelligent-seating";

// This function transforms the frontend data types to the AI flow's expected input types
const prepareFlowInput = (classrooms: Classroom[], students: Student[]): IntelligentSeatingInput => {
  const flowClassrooms = classrooms.map(c => ({
    roomName: c.roomName,
    totalCapacity: c.totalCapacity,
    numberOfColumns: c.numberOfColumns,
    desksPerColumn: c.desksPerColumn,
  }));
  
  const flowStudents = students.map(s => ({
    rollNumber: s.rollNumber,
    paper: s.paper,
    branch: s.branch,
    semesterSection: s.semesterSection,
  }));

  return { classrooms: flowClassrooms, students: flowStudents };
};

// This function transforms the AI flow's output to the frontend's data types
const processFlowOutput = (output: IntelligentSeatingOutput, originalStudents: Student[]): Allocation => {
  const studentMap = new Map(originalStudents.map(s => [s.rollNumber, s]));

  const assignments: StudentAssignment[] = output.assignments.map((a) => {
    const originalStudent = studentMap.get(a.rollNumber);
    return {
      ...a,
      branch: originalStudent?.branch || '',
      semesterSection: originalStudent?.semesterSection || '',
      // The AI model already provides the correct serial number
      assignment: a.assignment
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
  const [disableAutoAllocate, setDisableAutoAllocate] = useState(false);
  const { toast } = useToast();

  const runAllocation = useCallback(async () => {
    if (disableAutoAllocate) {
      return; // do not alter allocation while loading snapshot
    }
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
      console.log("=== SENDING TO AI FLOW ===");
      console.log("Flow input classrooms:", JSON.stringify(flowInput.classrooms, null, 2));
      const result = await intelligentSeating(flowInput);
      const processedResult = processFlowOutput(result, students);
      
      // Sort assignments by room, then by serial number (which is already optimized)
      const sortedAssignments = processedResult.assignments
        .sort((a,b) => {
            const roomCompare = a.assignment!.roomName.localeCompare(b.assignment!.roomName);
            if (roomCompare !== 0) return roomCompare;
            return a.assignment!.serialNumber - b.assignment!.serialNumber;
        });

      setAllocation({ ...processedResult, assignments: sortedAssignments });

    } catch (error) {
      console.error("Allocation failed:", error);
      toast({
        title: "Allocation Failed",
        description: "Could not generate seating arrangement. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  }, [students, classrooms, toast, disableAutoAllocate]);

  useEffect(() => {
    // Optimized debounce for better performance
    const handler = setTimeout(() => {
      runAllocation();
    }, 300);

    return () => clearTimeout(handler);
  }, [students, classrooms, runAllocation]);

  // Snapshot save/load
  type Snapshot = {
    version: number;
    createdAt: string;
    classrooms: Classroom[];
    students: Student[];
    allocation: Allocation;
  };

  const exportSnapshot = () => {
    const snapshot: Snapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      classrooms,
      students,
      allocation,
    };
    const data = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `seat-assign-snapshot-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Snapshot Saved', description: 'Allocation snapshot downloaded.' });
  };

  const importSnapshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = (event.target as FileReader | null)?.result as string;
          const snap = JSON.parse(text) as Snapshot;
          if (!snap || !Array.isArray(snap.classrooms) || !Array.isArray(snap.students) || !snap.allocation) {
            throw new Error('Invalid snapshot');
          }
          setDisableAutoAllocate(true);
          setClassrooms(snap.classrooms);
          setStudents(snap.students);
          setAllocation(snap.allocation);
          setTimeout(() => setDisableAutoAllocate(false), 100); // re-enable soon after
          toast({ title: 'Snapshot Loaded', description: 'Restored previous arrangement.' });
        } catch (err) {
          toast({ title: 'Load Failed', description: 'File is not a valid snapshot.', variant: 'destructive' });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="container mx-auto p-2 sm:p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 items-start">
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
        <div className="flex flex-col sm:flex-row gap-2 justify-center mb-6">
          <Button variant="outline" onClick={exportSnapshot}>
            <FileDown className="mr-2 h-4 w-4" /> Save Snapshot
          </Button>
          <Button onClick={importSnapshot}>
            <Upload className="mr-2 h-4 w-4" /> Load Snapshot
          </Button>
        </div>
        <footer className="text-center text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} YCCE-SeatAssign. All rights reserved.</p>
          <p>An AI-powered utility for modern problems.</p>
        </footer>
      </main>
    </div>
  );
}
