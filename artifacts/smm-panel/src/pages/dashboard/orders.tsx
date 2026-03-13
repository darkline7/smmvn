import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useListOrders, useRefillOrder, useCancelOrder } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Search, RefreshCw, XCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Orders() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListOrders({ 
    status: status !== "all" ? status as any : undefined,
    search: search || undefined
  });

  const refillMut = useRefillOrder();
  const cancelMut = useCancelOrder();

  const handleRefill = (id: number) => {
    refillMut.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Refill requested", description: `Order #${id} refill request submitted.` });
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const handleCancel = (id: number) => {
    cancelMut.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Cancellation requested", description: `Order #${id} cancellation submitted.` });
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'completed': return 'success';
      case 'processing': return 'default';
      case 'pending': return 'warning';
      case 'cancelled': case 'failed': return 'destructive';
      case 'partial': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Order History</h2>
          <p className="text-muted-foreground mt-1">Track and manage all your past and current orders.</p>
        </div>

        <Card className="shadow-md border-border/60">
          <CardHeader className="p-4 border-b border-border/50 bg-secondary/20">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Order ID or Link..." 
                  className="pl-9 h-10 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full md:w-[180px] h-10 bg-background">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead className="w-[130px]">Ngày</TableHead>
                  <TableHead className="min-w-[160px]">Dịch vụ</TableHead>
                  <TableHead className="min-w-[160px]">Link</TableHead>
                  <TableHead className="text-right w-[80px]">Charge</TableHead>
                  <TableHead className="text-center w-[70px]">Start</TableHead>
                  <TableHead className="text-center w-[70px]">Số lượng</TableHead>
                  <TableHead className="text-center w-[70px]">Remains</TableHead>
                  <TableHead className="w-[110px]">Trạng thái</TableHead>
                  <TableHead className="text-right w-[80px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10} className="h-16">
                        <div className="animate-pulse bg-secondary h-6 w-full rounded"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      Không tìm thấy đơn hàng nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.orders.map((order) => (
                    <TableRow key={order.id} className="group text-sm">
                      <TableCell className="font-mono font-semibold text-primary">{order.id}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(order.createdAt), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="block truncate font-medium text-foreground text-xs" title={order.serviceName}>
                          {order.serviceName}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <a href={order.link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 truncate w-fit max-w-full"
                          title={order.link}>
                          {order.link} <ExternalLink className="h-3 w-3 inline shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">${Number(order.charge||0).toFixed(2)}</TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{order.startCount ?? '-'}</TableCell>
                      <TableCell className="text-center tabular-nums font-medium">{order.quantity ?? '-'}</TableCell>
                      <TableCell className="text-center tabular-nums text-muted-foreground">{order.remains ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(order.status) as any} className="capitalize text-xs px-2 py-0.5 shadow-sm">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {order.status === 'completed' && (
                          <Button size="icon" variant="outline" className="h-7 w-7 text-primary" onClick={() => handleRefill(order.id)} title="Request Refill" disabled={refillMut.isPending}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(order.status === 'pending' || order.status === 'processing') && (
                          <Button size="icon" variant="outline" className="h-7 w-7 text-destructive" onClick={() => handleCancel(order.id)} title="Request Cancel" disabled={cancelMut.isPending}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
