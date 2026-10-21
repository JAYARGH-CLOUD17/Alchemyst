<?php

require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

try {
    if ($action === 'products') {
        require_method('GET');
        require_admin();
        $query = db()->query(
            'SELECT id, name, category, description, price, availability,
                    image_url, is_active, sort_order
             FROM products
             ORDER BY sort_order, name'
        );
        json_out(['ok' => true, 'products' => $query->fetchAll()]);
    }

    if ($action === 'testimonials') {
        require_method('GET');
        require_admin();
        $query = db()->query(
            'SELECT id, customer_name, quote, rating, status
             FROM testimonials ORDER BY created_at DESC'
        );
        json_out(['ok' => true, 'testimonials' => $query->fetchAll()]);
    }

    if ($action === 'save-testimonial') {
        $user = require_admin();
        require_method('POST');
        $data = json_body();
        $name = clean_text($data['customer_name'] ?? '', 120);
        $quote = clean_text($data['quote'] ?? '', 2000);
        $rating = filter_var($data['rating'] ?? 5, FILTER_VALIDATE_INT);
        $status = (string) ($data['status'] ?? 'draft');
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (
            $name === '' || $quote === '' ||
            !$rating || $rating < 1 || $rating > 5 ||
            !in_array($status, ['draft', 'published'], true)
        ) {
            json_out(['ok' => false, 'message' => 'Enter valid testimonial details.'], 422);
        }
        if ($id) {
            $query = db()->prepare(
                'UPDATE testimonials SET customer_name = ?, quote = ?, rating = ?, status = ?
                 WHERE id = ?'
            );
            $query->execute([$name, $quote, $rating, $status, $id]);
            $testimonialId = $id;
        } else {
            $query = db()->prepare(
                'INSERT INTO testimonials (customer_name, quote, rating, status, created_by)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $query->execute([$name, $quote, $rating, $status, $user['id']]);
            $testimonialId = (int) db()->lastInsertId();
        }
        $query = db()->prepare(
            'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
             VALUES (?, ?, ?, ?)'
        );
        $query->execute([$user['id'], $id ? 'testimonial_updated' : 'testimonial_created', 'testimonial', $testimonialId]);
        json_out(['ok' => true, 'message' => $id ? 'Testimonial updated.' : 'Testimonial saved.']);
    }

    if ($action === 'save-product') {
        $user = require_admin();
        require_method('POST');
        $data = json_body();
        $name = clean_text($data['name'] ?? '', 160);
        $category = (string) ($data['category'] ?? '');
        $description = clean_text($data['description'] ?? '', 4000);
        $availability = (string) ($data['availability'] ?? 'quote_required');
        $price = $data['price'] ?? null;
        $priceString = is_scalar($price) ? trim((string) $price) : '';
        $imageUrl = trim((string) ($data['image_url'] ?? ''));
        $isActive = array_key_exists('is_active', $data)
            ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;
        $rawId = $data['id'] ?? null;
        $id = $rawId === null || $rawId === ''
            ? null
            : filter_var($rawId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $validCategories = [
            'solar_panel', 'inverter', 'battery',
            'mounting_equipment', 'wire', 'other'
        ];
        $imageScheme = strtolower((string) parse_url($imageUrl, PHP_URL_SCHEME));

        if (
            $name === '' ||
            $description === '' ||
            ($rawId !== null && $rawId !== '' && !$id) ||
            !in_array($category, $validCategories, true) ||
            !in_array($availability, ['available', 'quote_required', 'unavailable'], true) ||
            ($price !== null && $price !== '' && (
                !preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', $priceString) ||
                (float) $priceString < 0
            )) ||
            ($imageUrl !== '' && (
                !filter_var($imageUrl, FILTER_VALIDATE_URL) ||
                !in_array($imageScheme, ['http', 'https'], true)
            )) ||
            ($isActive === null && array_key_exists('is_active', $data))
        ) {
            json_out(['ok' => false, 'message' => 'Enter valid product details.'], 422);
        }

        $pdo = db();
        if ($id !== null) {
            $query = $pdo->prepare('SELECT id, is_active FROM products WHERE id = ?');
            $query->execute([$id]);
            $existingProduct = $query->fetch();
            if (!$existingProduct) {
                json_out(['ok' => false, 'message' => 'Product not found.'], 404);
            }

            if ($isActive === null) {
                $isActive = (bool) $existingProduct['is_active'];
            }

            $query = $pdo->prepare(
                'SELECT id FROM products
                 WHERE name = ? AND category = ? AND id <> ?'
            );
            $query->execute([$name, $category, $id]);
            if ($query->fetch()) {
                json_out(['ok' => false, 'message' => 'A product with this name and category already exists.'], 409);
            }
        } else {
            $query = $pdo->prepare(
                'SELECT id FROM products WHERE name = ? AND category = ?'
            );
            $query->execute([$name, $category]);
            if ($query->fetch()) {
                json_out(['ok' => false, 'message' => 'A product with this name and category already exists.'], 409);
            }
        }

        $pdo->beginTransaction();
        try {
            if ($id !== null) {
                $query = $pdo->prepare(
                    'UPDATE products
                     SET name = ?, category = ?, description = ?, price = ?,
                         availability = ?, image_url = ?, is_active = ?
                     WHERE id = ?'
                );
                $query->execute([
                    $name, $category, $description,
                    $price !== null && $price !== '' ? $price : null,
                    $availability, $imageUrl !== '' ? $imageUrl : null,
                    $isActive ? 1 : 0, $id
                ]);
                $productId = $id;
                $message = 'Product updated.';
            } else {
                $query = $pdo->prepare(
                    'INSERT INTO products
                        (name, category, description, price, availability, image_url, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                $query->execute([
                    $name, $category, $description,
                    $price !== null && $price !== '' ? $price : null,
                    $availability, $imageUrl !== '' ? $imageUrl : null,
                    ($isActive === null || $isActive) ? 1 : 0
                ]);
                $productId = (int) $pdo->lastInsertId();
                $message = 'Product added.';
            }
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$user['id'], $id !== null ? 'product_updated' : 'product_created', 'product', $productId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
        json_out(['ok' => true, 'message' => $message], $id !== null ? 200 : 201);
    }

    if ($action === 'save-service') {
        $user = require_admin();
        require_method('POST');
        $data = json_body();
        $name = clean_text($data['name'] ?? '', 80);
        $description = clean_text($data['description'] ?? '', 4000);
        $priceLabel = clean_text($data['price_label'] ?? 'Quotation required', 120);
        $price = $data['price'] ?? null;
        $available = !empty($data['is_available']) ? 1 : 0;

        if (
            $name === '' ||
            $description === '' ||
            $priceLabel === '' ||
            ($price !== null && $price !== '' && (!is_numeric($price) || (float) $price < 0))
        ) {
            json_out(['ok' => false, 'message' => 'Enter valid service details.'], 422);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $query = $pdo->prepare(
                'INSERT INTO services (name, description, price, price_label, is_available)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    description = VALUES(description),
                    price = VALUES(price),
                    price_label = VALUES(price_label),
                    is_available = VALUES(is_available)'
            );
            $query->execute([
                $name, $description,
                $price !== null && $price !== '' ? $price : null,
                $priceLabel, $available
            ]);
            $query = $pdo->prepare(
                'INSERT INTO service_catalog (service_type, price_label, booking_enabled)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    price_label = VALUES(price_label),
                    booking_enabled = VALUES(booking_enabled)'
            );
            $query->execute([$name, $priceLabel, $available]);
            $query = $pdo->prepare(
                'INSERT INTO audit_logs (actor_id, action, entity_type, details)
                 VALUES (?, ?, ?, ?)'
            );
            $query->execute([$user['id'], 'service_saved', 'service', $name]);
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
        json_out(['ok' => true, 'message' => 'Service saved.']);
    }

    json_out(['ok' => false, 'message' => 'Unknown catalog action.'], 404);
} catch (Throwable $error) {
    error_log((string) $error);
    json_out(['ok' => false, 'message' => 'Catalog update failed. Check the server logs.'], 500);
}
