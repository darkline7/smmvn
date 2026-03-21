<?php
// Endpoint API
$domain = 'tenmien.com'; //thay thành tên miền web cần lấy lịch sử nhận tiền
$url = "https://{$domain}/client/api/wallet/history-receive";
// Dữ liệu gửi đi
$data = [
    'partner_id' => '', //tạo ở mục kết nối api, hệ thống chấp nhận tất cả module(Softcard, Recharge, Charging)
    'sign' => '', //chữ ký sign, dạng: md5(partner_key . partner_id)
    'limit'   => 100 //số lượng giao dịch muốn lấy (1-1000) - có thể bỏ trống
];
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($data),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded'
    ]
]);
$response = curl_exec($ch);
if (curl_errno($ch)) {
    echo "cURL Error: " . curl_error($ch);
} else {
    // Hiển thị kết quả JSON
    echo $response;
}
// Đóng cURL
curl_close($ch);



//DEMO RESPONSE:
/*
THÀNH CÔNG:
{
    "status": "success",
    "message": "Lấy dữ liệu thành công",
    "data": [
        {
            "order_code": "T68A05FAE2EEAB",
            "pay_amount": "66666",
            "message": "Aiuu đz quá",
            "created_at": "2025-08-16 17:38:38"
        },
        {
            "order_code": "T689F4D2BCAF85",
            "pay_amount": "6666",
            "message": "Góp",
            "created_at": "2025-08-15 22:07:23"
        },
        {
            "order_code": "T689A9CC38B98C",
            "pay_amount": "43210",
            "message": "Mua tool",
            "created_at": "2025-08-12 08:45:39"
        }
    ]
}


THẤT BẠI"
{
    "status": "100",
    "message": "Chu ky sign khong dung"
}
*/
