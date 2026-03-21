import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminListDeposits } from "@workspace/api-client-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, RefreshCw, Search, DollarSign, Copy, Check,
  CheckCircle2, XCircle, Clock, Webhook, ExternalLink, Save,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Chuyển khoản ngân hàng",
  qr_payment: "Quét mã QR",
  crypto: "Tiền điện tử",
  sepay: "SePay",
  thueapibank: "ThueApiBank",
  card: "Thẻ cào",
  manual: "Thủ công",
};

const statusColors: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};
const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};
const StatusIcon = ({ status }: { status: string }) => {
  if (status === "approved") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "rejected") return <XCircle className="w-4 h-4 text-red-600" />;
  return <Clock className="w-4 h-4 text-yellow-600" />;
};

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0" title="Sao chép">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── ThueApiBank Webhook settings card ───────────────────────────────────────
function ThueApiBankSettings() {
  const { toast } = useToast();
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const siteUrl = (() => {
    try { return window.location.origin; } catch { return "https://vietool.cc"; }
  })();
  const webhookUrl = `${siteUrl}${BASE}/api/webhooks/thueapibank`;

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/admin/settings`, { credentials: "include" })
      .then(r => r.json())
      .then(s => { setSignature(s.thueapibank_signature || ""); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/admin/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ thueapibank_signature: signature }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Đã lưu Signature ThueApiBank" });
    } catch {
      toast({ title: "Lỗi lưu cài đặt", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="w-4 h-4 text-primary" />
          Webhook — API Bank (thueapibank.vn)
          <a href="https://thueapibank.vn" target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
              <ExternalLink className="w-3 h-3" />thueapibank.vn
            </Button>
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Callback Webhook URL */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Callback Webhook URL</label>
          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 border">
            <code className="text-xs font-mono flex-1 break-all">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
          <p className="text-xs text-muted-foreground">Dán URL này vào phần cài đặt webhook trên trang thueapibank.vn</p>
        </div>

        {/* Signature */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Signature (từ thueapibank.vn)</label>
          <div className="flex gap-2">
            <Input
              placeholder="Nhập signature được cấp bởi thueapibank.vn..."
              value={signature}
              onChange={e => setSignature(e.target.value)}
              disabled={loading}
              className="font-mono text-sm"
            />
            <Button onClick={save} disabled={saving || !signature} className="gap-1.5 flex-shrink-0">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Signature dùng để xác thực header <code className="bg-muted px-1 rounded">signature</code> từ thueapibank.vn
          </p>
        </div>

        {/* Data format */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Định dạng dữ liệu nhận được</label>
          <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto border font-mono leading-relaxed">{`{
  "status": "success",
  "transactions": [
    {
      "type": "IN",
      "transactionID": "24213",
      "amount": "100000",
      "description": "SMM{depositId}"
    }
  ]
}`}</pre>
          <p className="text-xs text-muted-foreground">
            Người dùng cần ghi nội dung chuyển khoản là <code className="bg-muted px-1 rounded">SMM{"{"}depositId{"}"}</code> để hệ thống tự động cộng tiền.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPayments() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data, isLoading, refetch } = useAdminListDeposits({ limit: 100 });

  const allDeposits: any[] = data?.deposits || [];

  const deposits = allDeposits.filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        String(d.userId).includes(q) ||
        String(d.id).includes(q) ||
        (d.method || "").toLowerCase().includes(q) ||
        (d.note || "").toLowerCase().includes(q) ||
        (d.adminNote || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: allDeposits.length,
    approved: allDeposits.filter((d: any) => d.status === "approved").length,
    pending: allDeposits.filter((d: any) => d.status === "pending").length,
    rejected: allDeposits.filter((d: any) => d.status === "rejected").length,
  };

  return (
    <DashboardLayout isAdminLayout>
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold font-display">Quản lý nạp tiền</h2>
            <p className="text-muted-foreground mt-1">Lịch sử giao dịch nạp tiền · Tự động xử lý qua webhook</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tất cả", value: stats.total, status: "all", color: "text-foreground", bg: "bg-muted/60" },
            { label: "Đã duyệt", value: stats.approved, status: "approved", color: "text-green-600", bg: "bg-green-50" },
            { label: "Chờ xử lý", value: stats.pending, status: "pending", color: "text-yellow-600", bg: "bg-yellow-50" },
            { label: "Từ chối", value: stats.rejected, status: "rejected", color: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, value, status, color, bg }) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`p-4 rounded-xl border text-left transition-all ${statusFilter === status ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"} ${statusFilter === status ? bg : ""}`}
            >
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo User ID, mã nạp, phương thức..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Transaction list */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : !deposits.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Không có giao dịch nào</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {deposits.map((d: any) => (
                  <div key={d.id} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${d.status === "approved" ? "bg-green-100" : d.status === "rejected" ? "bg-red-100" : "bg-yellow-100"}`}>
                      <DollarSign className={`w-5 h-5 ${d.status === "approved" ? "text-green-600" : d.status === "rejected" ? "text-red-600" : "text-yellow-600"}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">#{d.id}</span>
                        <span className="text-muted-foreground text-sm">User #{d.userId}</span>
                        <Badge variant="outline" className={`text-xs px-2 py-0 ${statusColors[d.status]}`}>
                          <StatusIcon status={d.status} />
                          <span className="ml-1">{statusLabels[d.status]}</span>
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>{format(new Date(d.createdAt), "dd/MM/yyyy HH:mm:ss")}</p>
                        <p className="font-medium text-foreground/70">
                          {METHOD_LABELS[d.method] || d.method}
                        </p>
                        {d.note && (
                          <p className="break-words whitespace-pre-wrap text-foreground/60">{d.note}</p>
                        )}
                        {d.adminNote && (
                          <p className="break-words whitespace-pre-wrap italic text-muted-foreground">{d.adminNote}</p>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-base text-primary">
                        {formatCurrency(Number(d.amount))}
                      </p>
                      {d.amountVnd && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {Number(d.amountVnd).toLocaleString("vi-VN")}đ
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ThueApiBank Webhook Settings */}
        <ThueApiBankSettings />
      </div>
    </DashboardLayout>
  );
}
