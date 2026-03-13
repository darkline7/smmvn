import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetProfile, useRegenerateApiKey, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, RefreshCw, CheckCircle2, Code, Terminal, Globe, Zap, Eye, EyeOff } from "lucide-react";

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 rounded-t-lg border border-b-0">
        <span className="text-xs text-muted-foreground font-mono">{lang}</span>
        <button onClick={copy} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 bg-gray-950 text-gray-100 rounded-b-lg text-xs overflow-x-auto font-mono leading-relaxed border">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiKeyPage() {
  const { toast } = useToast();
  const { data: profile, refetch } = useGetProfile();
  const { data: me } = useGetMe();
  const regenMut = useRegenerateApiKey();
  const [showKey, setShowKey] = useState(false);
  const apiKey = profile?.apiKey || "your-api-key-here";
  const maskedKey = apiKey ? (apiKey.slice(0, 8) + "•".repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4)) : "";

  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const BASE_API = `${window.location.origin}${BASE_URL}/api/v2`;

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast({ title: "Đã sao chép API Key!" });
  };

  const regen = () => {
    regenMut.mutate(undefined, {
      onSuccess: () => { refetch(); toast({ title: "Tạo API Key mới thành công!" }); },
      onError: () => toast({ title: "Lỗi", variant: "destructive" }),
    });
  };

  const phpCode = `<?php
$api_url = "${BASE_API}";
$api_key = "${apiKey}";

// Lấy danh sách dịch vụ
$data = ['key' => $api_key, 'action' => 'services'];
$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
curl_close($ch);

// Tạo đơn hàng
$order_data = [
  'key' => $api_key,
  'action' => 'add',
  'service' => 1,
  'link' => 'https://instagram.com/username',
  'quantity' => 1000
];
// ... gửi request tương tự`;

  const pythonCode = `import requests

API_URL = "${BASE_API}"
API_KEY = "${apiKey}"

# Lấy danh sách dịch vụ
resp = requests.post(API_URL, data={
    "key": API_KEY,
    "action": "services"
})
services = resp.json()

# Tạo đơn hàng
order = requests.post(API_URL, data={
    "key": API_KEY,
    "action": "add",
    "service": 1,
    "link": "https://instagram.com/username",
    "quantity": 1000
})
print(order.json())  # {"order": 12345}

# Kiểm tra trạng thái
status = requests.post(API_URL, data={
    "key": API_KEY,
    "action": "status",
    "order": 12345
})
print(status.json())`;

  const nodeCode = `const axios = require('axios');

const API_URL = "${BASE_API}";
const API_KEY = "${apiKey}";

// Tạo đơn hàng
async function createOrder() {
  const { data } = await axios.post(API_URL, new URLSearchParams({
    key: API_KEY,
    action: 'add',
    service: '1',
    link: 'https://instagram.com/username',
    quantity: '1000'
  }));
  console.log(data); // { order: 12345 }
  return data.order;
}

// Kiểm tra nhiều đơn cùng lúc
async function multiStatus(orders) {
  const { data } = await axios.post(API_URL, new URLSearchParams({
    key: API_KEY,
    action: 'multiple_status',
    orders: orders.join(',')
  }));
  return data;
}`;

  const actions = [
    { action: "services", desc: "Lấy danh sách dịch vụ", params: ["key", "action"] },
    { action: "add", desc: "Tạo đơn hàng mới", params: ["key", "action", "service", "link", "quantity"] },
    { action: "status", desc: "Kiểm tra trạng thái đơn", params: ["key", "action", "order"] },
    { action: "multiple_status", desc: "Kiểm tra nhiều đơn", params: ["key", "action", "orders"] },
    { action: "balance", desc: "Xem số dư tài khoản", params: ["key", "action"] },
    { action: "refill", desc: "Yêu cầu fill lại", params: ["key", "action", "order"] },
    { action: "cancel", desc: "Hủy đơn hàng", params: ["key", "action", "orders"] },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold font-display">API Integration</h2>
          <p className="text-muted-foreground mt-1">Tích hợp dịch vụ SMM Pro vào website của bạn</p>
        </div>

        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5 text-primary" />API Key của bạn</CardTitle>
            <CardDescription>Giữ bí mật API Key, không chia sẻ với bất kỳ ai</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-background rounded-xl border font-mono text-sm">
              <Key className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="flex-1 truncate">{showKey ? apiKey : maskedKey}</span>
              <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={copyKey} className="text-muted-foreground hover:text-foreground">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={copyKey}><Copy className="w-4 h-4" />Sao chép</Button>
              <Button variant="destructive" className="gap-2" onClick={regen} disabled={regenMut.isPending}>
                <RefreshCw className={`w-4 h-4 ${regenMut.isPending ? "animate-spin" : ""}`} />
                {regenMut.isPending ? "Đang tạo..." : "Tạo key mới"}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-background border text-center">
                <Globe className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Endpoint</p>
                <p className="text-sm font-mono font-medium">POST /api/v2</p>
              </div>
              <div className="p-3 rounded-lg bg-background border text-center">
                <Zap className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Phiên bản</p>
                <p className="text-sm font-bold">API v2</p>
              </div>
              <div className="p-3 rounded-lg bg-background border text-center">
                <Terminal className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">Format</p>
                <p className="text-sm font-bold">JSON</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="actions">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="php">PHP</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="node">Node.js</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-3">
            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="divide-y">
                  {actions.map(({ action, desc, params }) => (
                    <div key={action} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{action}</code>
                            <span className="text-sm text-foreground">{desc}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {params.map(p => (
                              <code key={p} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p}</code>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader><CardTitle className="text-base">Trạng thái đơn hàng</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {[["Pending", "Đang chờ"],["Processing","Đang xử lý"],["Active","Đang chạy"],["Completed","Hoàn thành"],["Partial","Hoàn thành 1 phần"],["Canceled","Đã hủy"],["Paused","Tạm dừng"],["Error","Lỗi"]].map(([k,v]) => (
                    <div key={k} className="flex items-center gap-2 p-2 rounded bg-muted">
                      <code className="text-xs font-bold text-primary">{k}</code>
                      <span className="text-xs text-muted-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="php"><CodeBlock lang="PHP" code={phpCode} /></TabsContent>
          <TabsContent value="python"><CodeBlock lang="Python" code={pythonCode} /></TabsContent>
          <TabsContent value="node"><CodeBlock lang="Node.js" code={nodeCode} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
