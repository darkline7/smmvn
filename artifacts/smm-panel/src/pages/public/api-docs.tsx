import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, Copy, CheckCircle2 } from "lucide-react";

const BASE = "https://your-domain.com/api/v2";

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl overflow-hidden border">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-gray-400 text-xs">
        <span>{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <><CheckCircle2 className="w-3 h-3 text-green-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
      <pre className="p-4 bg-gray-950 text-gray-100 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre"><code>{code}</code></pre>
    </div>
  );
}

function EndpointDoc({ action, method = "POST", description, params, response, example }: {
  action: string; method?: string; description: string; params: Array<{ name: string; type: string; required: boolean; desc: string }>;
  response: string; example: string;
}) {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-sm mb-6">
      <div className="flex items-center gap-3 p-4 bg-card border-b">
        <Badge variant="outline" className="text-primary border-primary font-mono font-bold">{method}</Badge>
        <code className="text-lg font-bold font-mono">action={action}</code>
        <span className="text-muted-foreground text-sm hidden sm:block">{description}</span>
      </div>
      <div className="p-5 space-y-5">
        <div>
          <h4 className="font-semibold text-sm mb-3">Parameters</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left pb-2 text-muted-foreground font-medium">Tham số</th><th className="text-left pb-2 text-muted-foreground font-medium">Kiểu</th><th className="text-left pb-2 text-muted-foreground font-medium">Bắt buộc</th><th className="text-left pb-2 text-muted-foreground font-medium">Mô tả</th></tr></thead>
              <tbody className="divide-y">
                {params.map(p => (
                  <tr key={p.name}>
                    <td className="py-2 pr-4"><code className="text-primary font-bold">{p.name}</code></td>
                    <td className="py-2 pr-4"><code className="text-muted-foreground">{p.type}</code></td>
                    <td className="py-2 pr-4">{p.required ? <Badge variant="destructive" className="text-xs">Required</Badge> : <Badge variant="secondary" className="text-xs">Optional</Badge>}</td>
                    <td className="py-2 text-muted-foreground">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><h4 className="font-semibold text-sm mb-2">Request Example</h4><CodeBlock lang="cURL" code={example} /></div>
          <div><h4 className="font-semibold text-sm mb-2">Response</h4><CodeBlock lang="JSON" code={response} /></div>
        </div>
      </div>
    </div>
  );
}

export default function ApiDocs() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><Layers className="w-4 h-4 text-white" /></div>
            SMM Pro
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Đăng nhập</Button></Link>
            <Link href="/register"><Button size="sm">Bắt đầu</Button></Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <span className="w-2 h-2 bg-primary rounded-full"></span>API v2 — Tương thích chuẩn SMM panel quốc tế
          </div>
          <h1 className="text-4xl font-bold mb-3">Tài liệu API</h1>
          <p className="text-muted-foreground text-lg">Tích hợp dịch vụ SMM Pro vào website hoặc phần mềm của bạn chỉ với vài dòng code.</p>

          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              { label: "Endpoint", value: `POST ${BASE}`, mono: true },
              { label: "Format", value: "application/x-www-form-urlencoded" },
              { label: "Response", value: "JSON" },
            ].map(({ label, value, mono }) => (
              <div key={label} className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`font-medium ${mono ? "font-mono text-xs text-primary" : ""}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <EndpointDoc action="services" description="Lấy danh sách tất cả dịch vụ"
          params={[
            { name: "key", type: "string", required: true, desc: "API key của bạn" },
            { name: "action", type: "string", required: true, desc: 'Luôn là "services"' },
          ]}
          response={`[\n  {\n    "service": 1,\n    "name": "Instagram Followers",\n    "type": "Default",\n    "rate": "1.50",\n    "min": "100",\n    "max": "10000",\n    "refill": true,\n    "cancel": true,\n    "category": "Instagram"\n  }\n]`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=services"`}
        />

        <EndpointDoc action="add" description="Tạo đơn hàng mới"
          params={[
            { name: "key", type: "string", required: true, desc: "API key" },
            { name: "action", type: "string", required: true, desc: '"add"' },
            { name: "service", type: "number", required: true, desc: "ID dịch vụ" },
            { name: "link", type: "string", required: true, desc: "Link cần tăng" },
            { name: "quantity", type: "number", required: true, desc: "Số lượng" },
          ]}
          response={`{ "order": 12345 }`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=add" \\\n  -d "service=1" \\\n  -d "link=https://instagram.com/username" \\\n  -d "quantity=1000"`}
        />

        <EndpointDoc action="status" description="Kiểm tra trạng thái đơn hàng"
          params={[
            { name: "key", type: "string", required: true, desc: "API key" },
            { name: "action", type: "string", required: true, desc: '"status"' },
            { name: "order", type: "number", required: true, desc: "ID đơn hàng" },
          ]}
          response={`{\n  "charge": "1.50",\n  "start_count": "0",\n  "status": "Active",\n  "remains": "500",\n  "currency": "USD"\n}`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=status" \\\n  -d "order=12345"`}
        />

        <EndpointDoc action="multiple_status" description="Kiểm tra nhiều đơn cùng lúc"
          params={[
            { name: "key", type: "string", required: true, desc: "API key" },
            { name: "action", type: "string", required: true, desc: '"multiple_status"' },
            { name: "orders", type: "string", required: true, desc: "Danh sách ID, phân cách bởi dấu phẩy" },
          ]}
          response={`{\n  "12345": { "charge": "1.50", "status": "Completed" },\n  "12346": { "charge": "0.50", "status": "Active", "remains": "200" }\n}`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=multiple_status" \\\n  -d "orders=12345,12346,12347"`}
        />

        <EndpointDoc action="balance" description="Kiểm tra số dư tài khoản"
          params={[
            { name: "key", type: "string", required: true, desc: "API key" },
            { name: "action", type: "string", required: true, desc: '"balance"' },
          ]}
          response={`{ "balance": "50.00", "currency": "USD" }`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=balance"`}
        />

        <EndpointDoc action="refill" description="Yêu cầu refill đơn hàng"
          params={[
            { name: "key", type: "string", required: true, desc: "API key" },
            { name: "action", type: "string", required: true, desc: '"refill"' },
            { name: "order", type: "number", required: true, desc: "ID đơn hàng cần refill" },
          ]}
          response={`{ "refill": 123 }`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=refill" \\\n  -d "order=12345"`}
        />

        <EndpointDoc action="cancel" description="Hủy đơn hàng (nếu hỗ trợ)"
          params={[
            { name: "key", type: "string", required: true, desc: "API key" },
            { name: "action", type: "string", required: true, desc: '"cancel"' },
            { name: "orders", type: "string", required: true, desc: "Danh sách ID, phân cách bởi dấu phẩy" },
          ]}
          response={`{ "12345": { "cancel": 1 } }`}
          example={`curl -X POST ${BASE} \\\n  -d "key=YOUR_API_KEY" \\\n  -d "action=cancel" \\\n  -d "orders=12345"`}
        />

        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-primary/20 text-center">
          <h3 className="text-2xl font-bold mb-2">Cần hỗ trợ tích hợp?</h3>
          <p className="text-muted-foreground mb-4">Đội ngũ kỹ thuật của chúng tôi sẵn sàng hỗ trợ bạn 24/7</p>
          <Link href="/login"><Button size="lg">Đăng nhập để lấy API Key →</Button></Link>
        </div>
      </div>
    </div>
  );
}
