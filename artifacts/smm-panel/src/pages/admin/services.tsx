import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminListServices, useAdminUpdateService } from "@workspace/api-client-react";
import { Search, Plus, Edit, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminServices() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminListServices({ search: search || undefined });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMut = useAdminUpdateService();

  const handleToggleStatus = (service: any) => {
    const newStatus = service.status === 'active' ? 'inactive' : 'active';
    // Requires sending all required fields based on schema, mocking for this UI demo since we'd normally load full object in a form
    // Assuming partial updates work on backend, otherwise a full form is needed.
    toast({ title: "Mock Status Toggle", description: `Would change status to ${newStatus}` });
  };

  return (
    <DashboardLayout isAdminLayout={true}>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Services</h2>
            <p className="text-muted-foreground mt-1">Manage all API and manual services.</p>
          </div>
          <Button className="gap-2 shadow-md shadow-primary/20"><Plus className="w-4 h-4"/> New Service</Button>
        </div>

        <Card className="shadow-md border-border/60">
          <CardHeader className="p-4 border-b border-border/50 bg-secondary/20">
            <div className="flex items-center gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search service name or ID..." 
                  className="pl-9 h-10 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Rate ($/1k)</TableHead>
                  <TableHead className="text-center">Min/Max</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="h-16">
                        <div className="animate-pulse bg-secondary h-6 w-full rounded"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No services found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.services.map((s) => (
                    <TableRow key={s.id} className="group">
                      <TableCell className="font-mono text-muted-foreground">{s.id}</TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate" title={s.name}>{s.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{s.categoryName}</TableCell>
                      <TableCell className="text-right font-display font-bold text-primary">${s.rate.toFixed(2)}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {s.min} / {s.max}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.providerId ? (
                           <Badge variant="outline" className="font-normal bg-secondary">{s.providerName}</Badge>
                        ) : (
                           <span className="text-muted-foreground italic">Manual</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.status === 'active' ? 'success' : 'secondary'} className="shadow-sm capitalize">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="icon" variant="outline" className="h-8 w-8 border-border">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-8 w-8 border-border" 
                          onClick={() => handleToggleStatus(s)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
