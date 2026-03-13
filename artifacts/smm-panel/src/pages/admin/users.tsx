import { useState, type FormEvent } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminListUsers, useAdminUpdateUser, useAdminAdjustBalance } from "@workspace/api-client-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Search, Ban, CheckCircle, Edit, DollarSign, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminListUsers({ search: search || undefined });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateMut = useAdminUpdateUser();
  const balanceMut = useAdminAdjustBalance();

  const handleToggleBan = (id: number, currentBanned: boolean) => {
    updateMut.mutate({ id, data: { banned: !currentBanned } }, {
      onSuccess: () => {
        toast({ title: "User updated" });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      }
    });
  };

  const handleAdjustBalance = (e: FormEvent, id: number) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = parseFloat(formData.get("amount") as string);
    if(isNaN(amount)) return;

    balanceMut.mutate({ id, data: { amount } }, {
      onSuccess: () => {
        toast({ title: "Balance updated" });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  return (
    <DashboardLayout isAdminLayout={true}>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">User Management</h2>
            <p className="text-muted-foreground mt-1">View and manage all registered users.</p>
          </div>
        </div>

        <Card className="shadow-md border-border/60">
          <CardHeader className="p-4 border-b border-border/50 bg-secondary/20">
            <div className="flex items-center gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by username, email..." 
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
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
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
                ) : data?.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.users.map((u) => (
                    <TableRow key={u.id} className="group">
                      <TableCell className="font-mono text-muted-foreground">{u.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-bold text-foreground">{u.username}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                           <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5"><Shield className="w-3 h-3 mr-1"/> Admin</Badge>
                        ) : (
                           <span className="text-sm capitalize text-muted-foreground">{u.role}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-display font-bold text-primary">
                        {formatCurrency(u.balance)}
                      </TableCell>
                      <TableCell className="text-center font-medium text-muted-foreground">
                        {formatNumber(u.totalOrders)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(u.totalSpend)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.banned ? "destructive" : "success"} className="shadow-sm">
                          {u.banned ? "Banned" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        
                        {/* Adjust Balance Modal */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="outline" className="h-8 w-8 hover:text-green-600 border-border" title="Adjust Balance">
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Adjust Balance for {u.username}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={(e) => handleAdjustBalance(e, u.id)} className="space-y-4 pt-4">
                              <p className="text-sm text-muted-foreground mb-4">Current balance: <span className="font-bold text-foreground">{formatCurrency(u.balance)}</span></p>
                              <div>
                                <label className="text-sm font-medium">Amount to add/subtract (use negative for deduction)</label>
                                <Input type="number" step="0.01" name="amount" required className="mt-1" placeholder="e.g. 50.00 or -10.00" />
                              </div>
                              <Button type="submit" className="w-full" disabled={balanceMut.isPending}>
                                {balanceMut.isPending ? "Processing..." : "Confirm Adjustment"}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>

                        <Button 
                          size="icon" 
                          variant="outline" 
                          className={`h-8 w-8 ${u.banned ? 'text-success border-success/30 hover:bg-success/10' : 'text-destructive border-destructive/30 hover:bg-destructive/10'}`} 
                          onClick={() => handleToggleBan(u.id, u.banned)}
                          title={u.banned ? "Unban User" : "Ban User"}
                          disabled={updateMut.isPending || u.role === 'admin'}
                        >
                          {u.banned ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
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
