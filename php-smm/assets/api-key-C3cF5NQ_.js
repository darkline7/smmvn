import{c as I,b as L,r as v,j as e}from"./index-RXxfR8lT.js";import{D as R,K as y,G as E}from"./dashboard-layout-aN1rkfRu.js";import{C as x,a as f,b,d as S,c as h}from"./card-BxL7xGyq.js";import{B as N}from"./button-oYS7DxGx.js";import{T as U,a as q,b as c,c as i}from"./tabs-dEAQH4s-.js";import{p as O,f as Y,q as H}from"./api-C5clztgI.js";import{E as M,a as B}from"./eye-CpJMJTx0.js";import{C as u}from"./copy-Czwb54hY.js";import{R as G}from"./refresh-cw-n8xxMWSo.js";import{Z as D}from"./zap-BA7xEoi5.js";import{C as F}from"./circle-check-QAHTQboW.js";import"./layers-7sM1yHix.js";import"./index-DMDF7bQX.js";import"./index-BMNh91FK.js";const Z=[["path",{d:"M12 19h8",key:"baeox8"}],["path",{d:"m4 17 6-6-6-6",key:"1yngyt"}]],J=I("terminal",Z);function p({code:t,lang:d}){const[o,a]=v.useState(!1),r=()=>{navigator.clipboard.writeText(t),a(!0),setTimeout(()=>a(!1),2e3)};return e.jsxs("div",{className:"relative",children:[e.jsxs("div",{className:"flex items-center justify-between px-4 py-2 bg-muted/80 rounded-t-lg border border-b-0",children:[e.jsx("span",{className:"text-xs text-muted-foreground font-mono",children:d}),e.jsxs("button",{onClick:r,className:"text-xs text-muted-foreground hover:text-foreground flex items-center gap-1",children:[o?e.jsx(F,{className:"w-3 h-3 text-green-500"}):e.jsx(u,{className:"w-3 h-3"}),o?"Copied":"Copy"]})]}),e.jsx("pre",{className:"p-4 bg-gray-950 text-gray-100 rounded-b-lg text-xs overflow-x-auto font-mono leading-relaxed border",children:e.jsx("code",{children:t})})]})}function de(){const{toast:t}=L(),{data:d,refetch:o}=O();Y();const a=H(),[r,P]=v.useState(!1),s=d?.apiKey||"your-api-key-here",k=s.slice(0,8)+"•".repeat(Math.max(0,s.length-12))+s.slice(-4),_="/".replace(/\/$/,"")||"",l=`${window.location.origin}${_}/api/v2`,g=()=>{navigator.clipboard.writeText(s),t({title:"Đã sao chép API Key!"})},w=()=>{a.mutate(void 0,{onSuccess:()=>{o(),t({title:"Tạo API Key mới thành công!"})},onError:()=>t({title:"Lỗi",variant:"destructive"})})},C=`<?php
$api_url = "${l}";
$api_key = "${s}";

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
// ... gửi request tương tự`,T=`import requests

API_URL = "${l}"
API_KEY = "${s}"

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
print(status.json())`,A=`const axios = require('axios');

const API_URL = "${l}";
const API_KEY = "${s}";

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
}`,K=[{action:"services",desc:"Lấy danh sách dịch vụ",params:["key","action"]},{action:"add",desc:"Tạo đơn hàng mới",params:["key","action","service","link","quantity"]},{action:"status",desc:"Kiểm tra trạng thái đơn",params:["key","action","order"]},{action:"multiple_status",desc:"Kiểm tra nhiều đơn",params:["key","action","orders"]},{action:"balance",desc:"Xem số dư tài khoản",params:["key","action"]},{action:"refill",desc:"Yêu cầu fill lại",params:["key","action","order"]},{action:"cancel",desc:"Hủy đơn hàng",params:["key","action","orders"]}];return e.jsx(R,{children:e.jsxs("div",{className:"max-w-4xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-3xl font-bold font-display",children:"API Integration"}),e.jsx("p",{className:"text-muted-foreground mt-1",children:"Tích hợp dịch vụ SMM Pro vào website của bạn"})]}),e.jsxs(x,{className:"border-primary/30 bg-primary/5 shadow-sm",children:[e.jsxs(f,{children:[e.jsxs(b,{className:"text-lg flex items-center gap-2",children:[e.jsx(y,{className:"w-5 h-5 text-primary"}),"API Key của bạn"]}),e.jsx(S,{children:"Giữ bí mật API Key, không chia sẻ với bất kỳ ai"})]}),e.jsxs(h,{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-3 p-4 bg-background rounded-xl border font-mono text-sm",children:[e.jsx(y,{className:"w-4 h-4 text-primary flex-shrink-0"}),e.jsx("span",{className:"flex-1 truncate",children:r?s:k}),e.jsx("button",{onClick:()=>P(!r),className:"text-muted-foreground hover:text-foreground",children:r?e.jsx(M,{className:"w-4 h-4"}):e.jsx(B,{className:"w-4 h-4"})}),e.jsx("button",{onClick:g,className:"text-muted-foreground hover:text-foreground",children:e.jsx(u,{className:"w-4 h-4"})})]}),e.jsxs("div",{className:"flex flex-wrap gap-3",children:[e.jsxs(N,{variant:"outline",className:"gap-2",onClick:g,children:[e.jsx(u,{className:"w-4 h-4"}),"Sao chép"]}),e.jsxs(N,{variant:"destructive",className:"gap-2",onClick:w,disabled:a.isPending,children:[e.jsx(G,{className:`w-4 h-4 ${a.isPending?"animate-spin":""}`}),a.isPending?"Đang tạo...":"Tạo key mới"]})]}),e.jsxs("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2",children:[e.jsxs("div",{className:"p-3 rounded-lg bg-background border text-center",children:[e.jsx(E,{className:"w-5 h-5 mx-auto mb-1 text-primary"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Endpoint"}),e.jsx("p",{className:"text-sm font-mono font-medium",children:"POST /api/v2"})]}),e.jsxs("div",{className:"p-3 rounded-lg bg-background border text-center",children:[e.jsx(D,{className:"w-5 h-5 mx-auto mb-1 text-primary"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Phiên bản"}),e.jsx("p",{className:"text-sm font-bold",children:"API v2"})]}),e.jsxs("div",{className:"p-3 rounded-lg bg-background border text-center",children:[e.jsx(J,{className:"w-5 h-5 mx-auto mb-1 text-primary"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Format"}),e.jsx("p",{className:"text-sm font-bold",children:"JSON"})]})]})]})]}),e.jsxs(U,{defaultValue:"actions",children:[e.jsxs(q,{className:"w-full grid grid-cols-4",children:[e.jsx(c,{value:"actions",children:"Actions"}),e.jsx(c,{value:"php",children:"PHP"}),e.jsx(c,{value:"python",children:"Python"}),e.jsx(c,{value:"node",children:"Node.js"})]}),e.jsxs(i,{value:"actions",className:"space-y-3",children:[e.jsx(x,{className:"border-border/50",children:e.jsx(h,{className:"p-0",children:e.jsx("div",{className:"divide-y",children:K.map(({action:n,desc:m,params:$})=>e.jsx("div",{className:"p-4 hover:bg-muted/30 transition-colors",children:e.jsx("div",{className:"flex items-start justify-between gap-4",children:e.jsxs("div",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx("code",{className:"text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded",children:n}),e.jsx("span",{className:"text-sm text-foreground",children:m})]}),e.jsx("div",{className:"flex flex-wrap gap-1",children:$.map(j=>e.jsx("code",{className:"text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded",children:j},j))})]})})},n))})})}),e.jsxs(x,{className:"border-border/50",children:[e.jsx(f,{children:e.jsx(b,{className:"text-base",children:"Trạng thái đơn hàng"})}),e.jsx(h,{children:e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm",children:[["Pending","Đang chờ"],["Processing","Đang xử lý"],["Active","Đang chạy"],["Completed","Hoàn thành"],["Partial","Hoàn thành 1 phần"],["Canceled","Đã hủy"],["Paused","Tạm dừng"],["Error","Lỗi"]].map(([n,m])=>e.jsxs("div",{className:"flex items-center gap-2 p-2 rounded bg-muted",children:[e.jsx("code",{className:"text-xs font-bold text-primary",children:n}),e.jsx("span",{className:"text-xs text-muted-foreground",children:m})]},n))})})]})]}),e.jsx(i,{value:"php",children:e.jsx(p,{lang:"PHP",code:C})}),e.jsx(i,{value:"python",children:e.jsx(p,{lang:"Python",code:T})}),e.jsx(i,{value:"node",children:e.jsx(p,{lang:"Node.js",code:A})})]})]})})}export{de as default};
