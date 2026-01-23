import { Shell } from "@/components/layout/Shell";
import { useHistory } from "@/hooks/use-calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, Leaf } from "lucide-react";

export default function History() {
  const { data: history, isLoading } = useHistory();

  return (
    <Shell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Calculation History</h1>
          <p className="text-muted-foreground">Review your past energy estimates and track different scenarios.</p>
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Past Estimates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Leaf className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No history yet. Run your first calculation!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>System Size</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                    <TableHead className="text-right">CO₂ Reduced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {item.createdAt && format(new Date(item.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{item.pvWattage} W</TableCell>
                      <TableCell>{item.batteryCapacity} kWh</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {item.savingsKwh.toLocaleString()} kWh
                      </TableCell>
                      <TableCell className="text-right">
                        {item.co2Reduction.toLocaleString()} kg
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
