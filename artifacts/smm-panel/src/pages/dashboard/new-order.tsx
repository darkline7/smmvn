import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCategories, useListServices, useCreateOrder, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Info, Clock, RefreshCw, XCircle, Zap, Link as LinkIcon, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const orderSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  serviceId: z.coerce.number().min(1, "Service is required"),
  link: z.string().url("Must be a valid URL"),
  quantity: z.coerce.number().min(1, "Quantity must be greater than 0"),
});

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useGetMe();
  const { data: categoriesData, isLoading: catLoading } = useListCategories();
  const { data: servicesData, isLoading: srvLoading } = useListServices();
  const createOrderMut = useCreateOrder();

  const form = useForm<z.infer<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      categoryId: "",
      link: "",
      quantity: 100,
    },
  });

  const selectedCategoryId = form.watch("categoryId");
  const selectedServiceId = form.watch("serviceId");
  const quantity = form.watch("quantity");

  // Filter services by category
  const filteredServices = useMemo(() => {
    if (!servicesData?.services || !selectedCategoryId) return [];
    return servicesData.services.filter(s => s.categoryId.toString() === selectedCategoryId);
  }, [servicesData, selectedCategoryId]);

  // Find selected service details
  const selectedService = useMemo(() => {
    if (!filteredServices || !selectedServiceId) return null;
    return filteredServices.find(s => s.id === selectedServiceId) || null;
  }, [filteredServices, selectedServiceId]);

  // Auto-set first service when category changes
  useEffect(() => {
    if (filteredServices.length > 0 && selectedServiceId === undefined) {
      form.setValue("serviceId", filteredServices[0].id);
    }
  }, [filteredServices, form, selectedServiceId]);

  // Calculate price
  const price = useMemo(() => {
    if (!selectedService || !quantity) return 0;
    return (quantity / 1000) * Number(selectedService.rate);
  }, [selectedService, quantity]);

  const onSubmit = (values: z.infer<typeof orderSchema>) => {
    if (selectedService && (values.quantity < selectedService.min || values.quantity > selectedService.max)) {
      toast({ variant: "destructive", title: "Invalid Quantity", description: `Quantity must be between ${selectedService.min} and ${selectedService.max}` });
      return;
    }
    if (user && price > user.balance) {
      toast({ variant: "destructive", title: "Insufficient Balance", description: "Please add funds to your account." });
      return;
    }

    createOrderMut.mutate({ data: { serviceId: values.serviceId, link: values.link, quantity: values.quantity } }, {
      onSuccess: () => {
        toast({ title: "Order Placed Successfully!", description: "Your order is now being processed." });
        setLocation("/orders");
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Failed to place order", description: err.message });
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">New Order</h2>
          <p className="text-muted-foreground mt-1 text-lg">Select a service and place your order instantly.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Order Form */}
          <Card className="lg:col-span-2 shadow-lg border-border/60">
            <CardHeader className="bg-secondary/30 border-b border-border/50 rounded-t-2xl pb-6">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" /> Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base bg-background shadow-sm border-input">
                              <SelectValue placeholder={catLoading ? "Loading categories..." : "Select a category"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoriesData?.categories?.filter(c => c.active).map(cat => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Service</FormLabel>
                        <Select 
                          disabled={!selectedCategoryId || filteredServices.length === 0} 
                          onValueChange={(val) => field.onChange(parseInt(val))} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 text-base bg-background shadow-sm border-input">
                              <SelectValue placeholder={
                                !selectedCategoryId ? "Select a category first" : 
                                filteredServices.length === 0 ? "No services in this category" : 
                                "Select a service"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredServices.map(srv => (
                              <SelectItem key={srv.id} value={srv.id.toString()}>
                                {srv.id} - {srv.name} (${Number(srv.rate).toFixed(2)}/1k)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Link</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder="https://instagram.com/p/..." className="h-12 pl-10 text-base shadow-sm" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">Quantity</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                              <Input type="number" className="h-12 pl-10 text-base shadow-sm font-mono text-lg" {...field} />
                            </div>
                          </FormControl>
                          {selectedService && (
                            <FormDescription className="text-xs font-medium">
                              Min: {formatNumber(selectedService.min)} / Max: {formatNumber(selectedService.max)}
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col justify-between pt-1">
                      <label className="text-base font-semibold text-foreground mb-2">Total Charge</label>
                      <div className="h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-2xl font-display shadow-inner">
                        ${price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full text-lg shadow-lg shadow-primary/25 mt-4" 
                    disabled={createOrderMut.isPending || !selectedService || !quantity || !form.watch("link")}
                  >
                    {createOrderMut.isPending ? "Processing..." : "Place Order Now"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Service Details Card */}
          <div className="space-y-6">
            <Card className="shadow-md border-border/60 sticky top-24">
              <CardHeader className="bg-primary text-primary-foreground rounded-t-2xl pb-6">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Info className="h-5 w-5" /> Service Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedService ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>Select a service to view its details and rules here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    <div className="p-5 bg-secondary/20">
                      <p className="text-sm font-semibold text-primary mb-1">Service ID: {selectedService.id}</p>
                      <p className="text-foreground font-medium leading-snug">{selectedService.name}</p>
                    </div>
                    
                    <div className="p-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rate per 1000</p>
                        <p className="font-bold text-lg text-foreground">${Number(selectedService.rate).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg. Time</p>
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{selectedService.averageTime || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex flex-wrap gap-2">
                      <Badge variant={selectedService.refill ? "success" : "secondary"} className="text-xs py-1 px-3">
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        {selectedService.refill ? "Refill Available" : "No Refill"}
                      </Badge>
                      <Badge variant={selectedService.cancel ? "outline" : "secondary"} className="text-xs py-1 px-3 border-muted-foreground/30">
                        <XCircle className="w-3 h-3 mr-1.5 text-muted-foreground" />
                        {selectedService.cancel ? "Cancelable" : "No Cancel"}
                      </Badge>
                    </div>

                    {selectedService.description && (
                      <div className="p-5 bg-muted/30">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {selectedService.description}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
