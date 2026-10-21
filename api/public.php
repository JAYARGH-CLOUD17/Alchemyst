<?php

require __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    json_out([
        'ok' => false,
        'message' => 'Method not allowed.'
    ], 405);
}

try {
    $products = db()->query(
        'SELECT id, name, category, description, price, availability, image_url
         FROM products
         WHERE is_active = 1
         ORDER BY sort_order, name'
    )->fetchAll();

    $services = db()->query(
        'SELECT name, description, price, price_label
         FROM services
         WHERE is_available = 1
         ORDER BY sort_order, name'
    )->fetchAll();
    $testimonials = db()->query(
        "SELECT id, customer_name, quote, rating
         FROM testimonials
         WHERE status = 'published'
         ORDER BY created_at DESC
         LIMIT 6"
    )->fetchAll();

    json_out([
        'ok' => true,
        'products' => $products,
        'services' => $services,
        'testimonials' => $testimonials
    ]);
} catch (Throwable $error) {
    error_log((string) $error);
    json_out([
        'ok' => false,
        'message' => 'Unable to load the public product and service catalog.'
    ], 500);
}
