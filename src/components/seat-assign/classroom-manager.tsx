"use client";

import React, { useState } from "react";
import type { Classroom } from "@/types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building,
  PlusCircle,
  Trash2,
  FileDown,
  Upload,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  roomName: z.string().min(1, "Room name is required."),
  totalCapacity: z.coerce
    .number()
    .int()
    .min(0, "Capacity must be at least 0."), // Allow 0 for advanced mode
  numberOfColumns: z.coerce
    .number()
    .int()
    .min(1, "Columns must be at least 1.")
    .max(8, "Columns cannot exceed 8."),
  desksPerColumn: z.string().optional(),
});

type ClassroomManagerProps = {
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
};

const ClassroomManager = React.memo(({
  classrooms,
  setClassrooms,
}: ClassroomManagerProps) => {
  const { toast } = useToast();
  const [useAdvancedMode, setUseAdvancedMode] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomName: "",
      totalCapacity: 0,
      numberOfColumns: 4,
      desksPerColumn: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("Form submitted with values:", values);
    console.log("Advanced mode:", useAdvancedMode);
    
    let desksPerColumn: number[] | undefined;
    let totalCapacity = values.totalCapacity;

    if (useAdvancedMode) {
      // In advanced mode, we need desks per column
      if (!values.desksPerColumn || values.desksPerColumn.trim() === "") {
        toast({
          title: "Missing Configuration",
          description: "Please enter the number of desks per column.",
          variant: "destructive",
        });
        return;
      }

      try {
        desksPerColumn = values.desksPerColumn
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n) && n > 0);
        
        console.log("Parsed desks per column:", desksPerColumn);
        console.log("Expected columns:", values.numberOfColumns);
        
        if (desksPerColumn.length !== values.numberOfColumns) {
          toast({
            title: "Invalid Configuration",
            description: `Please provide exactly ${values.numberOfColumns} desk counts separated by commas. Got ${desksPerColumn.length} values: [${desksPerColumn.join(', ')}]`,
            variant: "destructive",
          });
          return;
        }
        
        // Calculate total capacity from desks per column (each desk has 2 seats)
        totalCapacity = desksPerColumn.reduce((sum, desks) => sum + (desks * 2), 0);
        console.log("Calculated total capacity:", totalCapacity);
      } catch (error) {
        console.error("Error parsing desks per column:", error);
        toast({
          title: "Invalid Format",
          description: "Please enter desk counts as numbers separated by commas (e.g., 8,7,7,8,7).",
          variant: "destructive",
        });
        return;
      }
    } else {
      // In simple mode, we need a valid total capacity
      if (totalCapacity <= 0) {
        toast({
          title: "Invalid Capacity",
          description: "Please enter a valid seating capacity (at least 1).",
          variant: "destructive",
        });
        return;
      }
    }

    const newClassroom: Classroom = {
      id: new Date().toISOString(),
      roomName: values.roomName,
      totalCapacity,
      numberOfColumns: values.numberOfColumns,
      desksPerColumn,
    };
    
    setClassrooms((prev) => [...prev, newClassroom]);
    form.reset();
    toast({
      title: "Classroom Added",
      description: `${values.roomName} has been added with ${totalCapacity} seats.`,
    });
  };

  const deleteClassroom = (id: string) => {
    setClassrooms((prev) => prev.filter((c) => c.id !== id));
  };
  
  const saveConfiguration = () => {
    if (classrooms.length === 0) {
      toast({
        title: "No classrooms to save",
        description: "Add at least one classroom before saving.",
        variant: "destructive"
      });
      return;
    }
    const data = JSON.stringify(classrooms.map(({id, ...rest}) => rest), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seat-assign-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Configuration Saved",
      description: "Your classroom setup has been saved successfully.",
    });
  };

  const loadConfiguration = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = (event.target as FileReader | null)?.result;
            if (typeof result !== 'string') {
              throw new Error('Failed to read file contents.');
            }
            const loaded = JSON.parse(result) as Omit<Classroom, 'id'>[];
            // Basic validation
            if (Array.isArray(loaded) && loaded.every(c => 'roomName' in c && 'totalCapacity' in c)) {
               const newClassroomsWithIds = loaded.map((c, index) => ({
                 ...c, 
                 numberOfColumns: (c as any).numberOfColumns || 4, // default for old configs
                 id: new Date().toISOString() + index
                }));
               setClassrooms(newClassroomsWithIds);
               toast({
                title: "Configuration Loaded",
                description: "Your classroom setup has been loaded.",
              });
            } else {
              throw new Error("Invalid file format.");
            }
          } catch (error) {
            toast({
              title: "Error loading file",
              description: "The selected file is not a valid configuration file.",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Building className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Classroom Configuration</CardTitle>
            <CardDescription>
              Add, edit, or remove classrooms for the exam.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center space-x-2">
          <Switch
            id="advanced-mode"
            checked={useAdvancedMode}
            onCheckedChange={setUseAdvancedMode}
          />
          <Label htmlFor="advanced-mode">
            Advanced Mode: Specify desks per column
          </Label>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roomName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room Name/Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Hall A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!useAdvancedMode && (
                <FormField
                  control={form.control}
                  name="totalCapacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seating Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="e.g., 50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               <FormField
                control={form.control}
                name="numberOfColumns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Columns</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="8" placeholder="e.g., 4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {useAdvancedMode && (
              <FormField
                control={form.control}
                name="desksPerColumn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desks per Column</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., 8,7,7,8,7 (comma-separated)" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      Enter the number of desks for each column separated by commas. 
                      Each desk seats 2 students. Total capacity will be calculated automatically.
                    </p>
                  </FormItem>
                )}
              />
            )}
            
            <Button 
              type="submit" 
              className="w-full"
              onClick={() => {
                console.log("Button clicked!");
                console.log("Form values:", form.getValues());
                console.log("Form errors:", form.formState.errors);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Classroom
            </Button>
          </form>
        </Form>
        <ScrollArea className="h-64 mt-6 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead className="text-center">Capacity</TableHead>
                <TableHead className="text-center">Layout</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classrooms.length > 0 ? (
                classrooms.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.roomName}</TableCell>
                    <TableCell className="text-center">{c.totalCapacity}</TableCell>
                    <TableCell className="text-center">
                      {c.desksPerColumn ? (
                        <div className="text-xs">
                          <div>{c.numberOfColumns} cols</div>
                          <div className="text-muted-foreground">
                            {c.desksPerColumn.join('-')} desks
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs">
                          {c.numberOfColumns} columns
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteClassroom(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                    No classrooms added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={loadConfiguration}>
          <Upload className="mr-2 h-4 w-4" /> Load Config
        </Button>
        <Button onClick={saveConfiguration}>
          <FileDown className="mr-2 h-4 w-4" /> Save Config
        </Button>
      </CardFooter>
    </Card>
  );
});

ClassroomManager.displayName = 'ClassroomManager';
export default ClassroomManager;
