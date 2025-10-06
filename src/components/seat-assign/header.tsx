import { School } from 'lucide-react';

const AppHeader = () => {
  return (
    <header className="bg-card border-b">
      <div className="container mx-auto p-4 md:p-6 flex items-center gap-4">
        <div className="bg-primary text-primary-foreground p-3 rounded-lg">
          <School className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-primary-dark font-headline">SeatAssign</h1>
          <p className="text-muted-foreground">
            Intelligent Seating Arrangement Generator
          </p>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
