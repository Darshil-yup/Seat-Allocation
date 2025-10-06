"use client";

import type { Student } from "@/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, PlusCircle, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StudentManagerProps = {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
};

const StudentManager = ({ students, setStudents }: StudentManagerProps) => {
  const [manualRoll, setManualRoll] = useState("");
  const [manualPaper, setManualPaper] = useState("");
  const [manualBranch, setManualBranch] = useState<string>("");
  const [manualSemester, setManualSemester] = useState("");
  
  const [range, setRange] = useState({ start: "", end: "", paper: "", branch: "", semesterSection: "" });
  const { toast } = useToast();

  const getSemesterNumber = (semesterSection: string) => {
    return semesterSection.split('-')[0].trim();
  }

  const addManualStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualRoll.trim() === "" || manualPaper.trim() === "" || manualBranch.trim() === "" || manualSemester.trim() === "") {
        toast({
            title: "Missing Information",
            description: "Please fill out all student details.",
            variant: "destructive",
        });
        return;
    };
    
    const semesterNumber = getSemesterNumber(manualSemester);
    if (!semesterNumber) {
        toast({ title: "Invalid Semester", description: "Semester format should be e.g., '3-A' or '3'.", variant: "destructive" });
        return;
    }
    const rollNumber = `${manualBranch}-${semesterNumber}-${manualRoll}`;

    if (students.some((s) => s.rollNumber === rollNumber)) {
      toast({
        title: "Duplicate Student",
        description: `Student with roll number ${rollNumber} already exists.`,
        variant: "destructive",
      });
      return;
    }

    setStudents((prev) => [...prev, { 
        rollNumber: rollNumber, 
        paper: manualPaper.trim().toUpperCase(),
        branch: manualBranch,
        semesterSection: manualSemester.trim().toUpperCase(),
    }]);
    setManualRoll("");
    // Keep other fields for faster entry
  };

  const addRangeStudents = (e: React.FormEvent) => {
    e.preventDefault();
    const startNum = parseInt(range.start);
    const endNum = parseInt(range.end);

    if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
      toast({
        title: "Invalid Range",
        description: "Please enter a valid start and end number for the range.",
        variant: "destructive",
      });
      return;
    }
    
    if (range.paper.trim() === "" || range.branch.trim() === "" || range.semesterSection.trim() === "") {
        toast({
            title: "Missing Information",
            description: "Please provide all details for the range.",
            variant: "destructive",
        });
        return;
    }
    
    const semesterNumber = getSemesterNumber(range.semesterSection);
     if (!semesterNumber) {
        toast({ title: "Invalid Semester", description: "Semester format should be e.g., '3-A' or '3'.", variant: "destructive" });
        return;
    }

    const newStudents: Student[] = [];
    for (let i = startNum; i <= endNum; i++) {
        const rollNumber = `${range.branch}-${semesterNumber}-${i}`;
        if (!students.some(s => s.rollNumber === rollNumber)) {
            newStudents.push({ 
                rollNumber, 
                paper: range.paper.trim().toUpperCase(),
                branch: range.branch,
                semesterSection: range.semesterSection.trim().toUpperCase(),
            });
        }
    }
    
    setStudents(prev => [...prev, ...newStudents].sort((a,b) => a.rollNumber.localeCompare(b.rollNumber)));
    setRange({ ...range, start: "", end: "" });
    toast({
        title: "Students Added",
        description: `${newStudents.length} new students were added from the range.`,
    });
  };

  const deleteStudent = (rollNumber: string) => {
    setStudents((prev) => prev.filter((s) => s.rollNumber !== rollNumber));
  };
  
  const clearAllStudents = () => {
    setStudents([]);
    toast({
      title: "All students cleared.",
    });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Student Input</CardTitle>
            <CardDescription>
              Add students with their details. Roll Numbers are auto-generated.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="range">Range Entry</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="mt-4">
            <form onSubmit={addManualStudent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="manual-branch">Branch</Label>
                        <Select onValueChange={setManualBranch} value={manualBranch}>
                            <SelectTrigger id="manual-branch">
                                <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CT">CT</SelectItem>
                                <SelectItem value="AIDS">AIDS</SelectItem>
                                <SelectItem value="CSE(IOT)">CSE(IOT)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="manual-semester">Semester/Section</Label>
                        <Input
                        id="manual-semester"
                        value={manualSemester}
                        onChange={(e) => setManualSemester(e.target.value)}
                        placeholder="e.g., 3-A"
                        />
                    </div>
                    <div>
                        <Label htmlFor="manual-roll">Roll Number (Ending part)</Label>
                        <Input
                        id="manual-roll"
                        value={manualRoll}
                        onChange={(e) => setManualRoll(e.target.value)}
                        placeholder="e.g., 1 or 101"
                        />
                    </div>
                    <div>
                        <Label htmlFor="manual-paper">Paper/Subject</Label>
                        <Input
                        id="manual-paper"
                        value={manualPaper}
                        onChange={(e) => setManualPaper(e.target.value)}
                        placeholder="e.g., Physics"
                        />
                    </div>
                </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Student
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="range" className="mt-4">
            <form onSubmit={addRangeStudents} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="range-branch">Branch</Label>
                    <Select onValueChange={(value) => setRange({ ...range, branch: value })} value={range.branch}>
                        <SelectTrigger id="range-branch">
                            <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CT">CT</SelectItem>
                            <SelectItem value="AIDS">AIDS</SelectItem>
                            <SelectItem value="CSE(IOT)">CSE(IOT)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="range-semester">Semester/Section</Label>
                    <Input
                        id="range-semester"
                        value={range.semesterSection}
                        onChange={(e) => setRange({ ...range, semesterSection: e.target.value })}
                        placeholder="e.g., 5-A"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="range-paper">Paper/Subject</Label>
                    <Input
                        id="range-paper"
                        value={range.paper}
                        onChange={(e) => setRange({ ...range, paper: e.target.value })}
                        placeholder="e.g., Chemistry"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="range-start">Start No.</Label>
                    <Input
                        id="range-start"
                        type="number"
                        value={range.start}
                        onChange={(e) => setRange({ ...range, start: e.target.value })}
                        placeholder="e.g., 1"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="range-end">End No.</Label>
                    <Input
                        id="range-end"
                        type="number"
                        value={range.end}
                        onChange={(e) => setRange({ ...range, end: e.target.value })}
                        placeholder="e.g., 120"
                    />
                </div>
              </div>
              <Button type="submit" className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Range
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Student List ({students.length} total)
                </h3>
                {students.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={clearAllStudents}>
                        <Trash2 className="mr-2 h-4 w-4" /> Clear All
                    </Button>
                )}
            </div>
          <ScrollArea className="h-40 border rounded-lg p-2">
            {students.length > 0 ? (
              <ul className="space-y-1">
                {students.map((s) => (
                  <li
                    key={s.rollNumber}
                    className="flex justify-between items-center p-2 rounded-md hover:bg-secondary"
                  >
                    <div>
                        <span className="text-sm font-medium">{s.rollNumber}</span>
                        <span className="text-xs text-muted-foreground ml-2">({s.branch} - {s.semesterSection})</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm">{s.paper}</span>
                        <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteStudent(s.rollNumber)}
                        >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No students added yet.</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentManager;
