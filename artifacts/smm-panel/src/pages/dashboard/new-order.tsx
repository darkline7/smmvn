import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NewOrderForm } from "@/components/new-order-form";

export default function NewOrder() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Đặt hàng mới</h2>
          <p className="text-muted-foreground mt-1">Chọn dịch vụ và đặt hàng ngay lập tức.</p>
        </div>
        <NewOrderForm />
      </div>
    </DashboardLayout>
  );
}
