<?php
/**
 * Service Controller — public service/category listing
 */

declare(strict_types=1);

class ServiceController
{
    // ── GET /api/services ─────────────────────────────────────────────────────
    public static function index(): void
    {
        $filters = [
            'categoryId' => qs('categoryId'),
            'search'     => qs('search'),
        ];
        $services = ServiceModel::listActive($filters);
        Response::json(['services' => $services]);
    }

    // ── GET /api/services/{id} ────────────────────────────────────────────────
    public static function show(int $id): void
    {
        $service = ServiceModel::findById($id);
        if (!$service) Response::error('Service not found', 404);
        Response::json($service);
    }

    // ── GET /api/categories ───────────────────────────────────────────────────
    public static function categories(): void
    {
        $categories = ServiceModel::listCategories();
        Response::json(['categories' => $categories]);
    }
}
