<?php
/**
 * Input Validator — centralized validation rules
 * Prevents XSS, injection, malformed data
 */

declare(strict_types=1);

class Validator
{
    private array $errors = [];
    private array $data   = [];

    public function __construct(private array $input) {}

    // ── Rules ──────────────────────────────────────────────────────────────────

    public function required(string $field, string $label = ''): static
    {
        $label = $label ?: $field;
        $val   = $this->input[$field] ?? null;
        if ($val === null || $val === '') {
            $this->errors[$field] = "$label is required";
        } else {
            $this->data[$field] = $val;
        }
        return $this;
    }

    public function email(string $field, bool $required = true): static
    {
        $val = trim($this->input[$field] ?? '');
        if ($required && !$val) { $this->errors[$field] = 'Email is required'; return $this; }
        if ($val && !filter_var($val, FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field] = 'Invalid email address';
        } else {
            $this->data[$field] = strtolower($val);
        }
        return $this;
    }

    public function password(string $field, int $min = 8): static
    {
        $val = $this->input[$field] ?? '';
        if (strlen($val) < $min) {
            $this->errors[$field] = "Password must be at least $min characters";
        } else {
            $this->data[$field] = $val;
        }
        return $this;
    }

    public function string(string $field, int $min = 0, int $max = 255, bool $required = true): static
    {
        $val = trim($this->input[$field] ?? '');
        if ($required && !$val) { $this->errors[$field] = "$field is required"; return $this; }
        if ($val && strlen($val) < $min) { $this->errors[$field] = "$field must be at least $min characters"; return $this; }
        if (strlen($val) > $max) { $this->errors[$field] = "$field must not exceed $max characters"; return $this; }
        $this->data[$field] = $val;
        return $this;
    }

    public function integer(string $field, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX, bool $required = true): static
    {
        $val = $this->input[$field] ?? null;
        if ($required && $val === null) { $this->errors[$field] = "$field is required"; return $this; }
        if ($val !== null) {
            if (!is_numeric($val) || (int)$val != $val) { $this->errors[$field] = "$field must be an integer"; return $this; }
            $int = (int)$val;
            if ($int < $min || $int > $max) { $this->errors[$field] = "$field must be between $min and $max"; return $this; }
            $this->data[$field] = $int;
        }
        return $this;
    }

    public function numeric(string $field, float $min = PHP_FLOAT_MIN, float $max = PHP_FLOAT_MAX, bool $required = true): static
    {
        $val = $this->input[$field] ?? null;
        if ($required && $val === null) { $this->errors[$field] = "$field is required"; return $this; }
        if ($val !== null) {
            if (!is_numeric($val)) { $this->errors[$field] = "$field must be a number"; return $this; }
            $n = (float)$val;
            if ($n < $min || $n > $max) { $this->errors[$field] = "$field must be between $min and $max"; return $this; }
            $this->data[$field] = $n;
        }
        return $this;
    }

    public function in(string $field, array $allowed, bool $required = true): static
    {
        $val = $this->input[$field] ?? null;
        if ($required && $val === null) { $this->errors[$field] = "$field is required"; return $this; }
        if ($val !== null && !in_array($val, $allowed, true)) {
            $this->errors[$field] = "$field must be one of: " . implode(', ', $allowed);
        } else {
            $this->data[$field] = $val;
        }
        return $this;
    }

    public function url(string $field, bool $required = false): static
    {
        $val = trim($this->input[$field] ?? '');
        if (!$val && !$required) { $this->data[$field] = ''; return $this; }
        if ($required && !$val) { $this->errors[$field] = "$field is required"; return $this; }
        if ($val && !filter_var($val, FILTER_VALIDATE_URL)) {
            $this->errors[$field] = "$field must be a valid URL";
        } else {
            $this->data[$field] = $val;
        }
        return $this;
    }

    public function boolean(string $field): static
    {
        $val = $this->input[$field] ?? null;
        $this->data[$field] = filter_var($val, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        return $this;
    }

    public function optional(string $field, mixed $default = null): static
    {
        $this->data[$field] = $this->input[$field] ?? $default;
        return $this;
    }

    // ── Results ────────────────────────────────────────────────────────────────

    public function fails(): bool
    {
        return !empty($this->errors);
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    public function validated(): array
    {
        return $this->data;
    }

    public function get(string $field, mixed $default = null): mixed
    {
        return $this->data[$field] ?? $default;
    }

    public function abortIfFails(): void
    {
        if ($this->fails()) {
            Response::json(['error' => 'Validation failed', 'errors' => $this->errors], 422);
        }
    }

    // ── Static factory ─────────────────────────────────────────────────────────
    public static function make(array $input): static
    {
        return new static($input);
    }
}
