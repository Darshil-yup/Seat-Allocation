"use client";

import type { Classroom } from "@/types";
import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  roomName: z.string().min(1, "Room name is required."),
  totalCapacity: z.coerce
    .number()
    .int()
    .min(1, "Capacity must be at least 1."),
  numberOfColumns: z.coerce
    .number()
    .int()
    .min(1, "Columns must be at least 1.")
    .max(8, "Columns cannot exceed 8."),
});

type ClassroomManagerProps = {
  classrooms: Classroom[];
  setClassrooms: React.Dispatch<React.SetStateAction<Classroom[]>>;
};

const ClassroomManager = ({
  classrooms,
  setClassrooms,
}: ClassroomManagerProps) => {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomName: "",
      totalCapacity: 0,
      numberOfColumns: 4,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const newClassroom: Classroom = {
      id: new Date().toISOString(),
      ...values,
    };
    setClassrooms((prev) => [...prev, newClassroom]);
    form.reset();
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
            const loaded = JSON.parse(event.target.result as string) as Omit<Classroom, 'id'>[];
            // Basic validation
            if (Array.isArray(loaded) && loaded.every(c => 'roomName' in c && 'totalCapacity' in c)) {
               const newClassroomsWithIds = loaded.map((c, index) => ({
                 ...c, 
                 numberOfColumns: c.numberOfColumns || 4, // Add default for old configs
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
            <Button type="submit" className="w-full">
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
                <TableHead className="text-center">Columns</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classrooms.length > 0 ? (
                classrooms.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.roomName}</TableCell>
                    <TableCell className="text-center">{c.totalCapacity}</TableCell>
                    <TableCell className="text-center">{c.numberOfColumns}</TableCell>
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
};

export default ClassroomManager;
