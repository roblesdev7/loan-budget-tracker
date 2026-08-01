<?php
declare(strict_types=1);

require_once __DIR__ . '/config/Database.php';
require_once __DIR__ . '/helpers/JWT.php';
require_once __DIR__ . '/helpers/Response.php';
require_once __DIR__ . '/middleware/Auth.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/ExchangeRateController.php';
require_once __DIR__ . '/controllers/CategoryController.php';
require_once __DIR__ . '/controllers/DebtController.php';
require_once __DIR__ . '/controllers/IncomeController.php';
require_once __DIR__ . '/controllers/ExpenseController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/controllers/RecurringBillController.php';
require_once __DIR__ . '/controllers/BudgetController.php';
require_once __DIR__ . '/controllers/AdminController.php';
require_once __DIR__ . '/controllers/ExportController.php';

$cfg = require __DIR__ . '/config/config.php';
JWT::init($cfg['jwt_secret'], $cfg['jwt_expiry']);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $cfg['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method   = $_SERVER['REQUEST_METHOD'];
$rawUri   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$uri      = '/' . ltrim(substr($rawUri, strlen($basePath)), '/');
$uri      = preg_replace('#^/index\.php#', '', $uri) ?: '/';
$segments = array_values(array_filter(explode('/', $uri)));

if (empty($segments)) {
    Response::success(['status' => 'Loan & Budget API', 'version' => '1.1']);
}

$s0 = $segments[0] ?? '';
$s1 = $segments[1] ?? '';
$s2 = $segments[2] ?? '';

$debtId = is_numeric($s1) ? (int) $s1 : null;
$id     = null;
if (isset($segments[2]) && is_numeric($segments[2])) {
    $id = (int) $segments[2];
} elseif (is_numeric($s1) && $s0 !== 'debts') {
    $id = (int) $s1;
}

if ($s0 === 'auth') {
    $ctrl = new AuthController(Database::getConnection());
    match ([$method, $s1]) {
        ['GET', 'config']    => $ctrl->config(),
        ['POST', 'register'] => $ctrl->register(),
        ['POST', 'login']    => $ctrl->login(),
        default              => Response::error('Ruta no encontrada', 404),
    };
    exit;
}

$payload = Auth::require();
$userId  = (int) $payload['sub'];
$db      = Database::getConnection();

match (true) {

    $s0 === 'auth' && $s1 === 'me' && $method === 'GET'
        => (new AuthController($db))->me($userId),

    $s0 === 'auth' && $s1 === 'profile' && $method === 'PUT'
        => (new AuthController($db))->updateProfile($userId),

    $s0 === 'admin' && $s1 === 'users' && $method === 'GET'
        => (new AdminController($db))->indexUsers($userId),
    $s0 === 'admin' && $s1 === 'users' && $method === 'POST'
        => (new AdminController($db))->storeUser($userId),
    $s0 === 'admin' && $s1 === 'users' && $id !== null && $method === 'PUT'
        => (new AdminController($db))->updateUser($userId, $id),

    $s0 === 'dashboard' && $method === 'GET'
        => (new DashboardController($db))->summary($userId),

    $s0 === 'analytics' && $method === 'GET'
        => (new AnalyticsController($db))->summary($userId),

    $s0 === 'export' && $s1 === 'csv' && $method === 'GET'
        => (new ExportController($db))->csv($userId),

    $s0 === 'exchange-rates' && $s1 === 'latest' && $method === 'GET'
        => (new ExchangeRateController($db))->latest($userId),
    $s0 === 'exchange-rates' && $method === 'GET'
        => (new ExchangeRateController($db))->history($userId),
    $s0 === 'exchange-rates' && $method === 'POST'
        => (new ExchangeRateController($db))->store($userId),

    $s0 === 'categories' && $s1 === 'income' && $method === 'GET'
        => (new CategoryController($db))->indexIncome($userId),
    $s0 === 'categories' && $s1 === 'income' && $method === 'POST'
        => (new CategoryController($db))->storeIncome($userId),
    $s0 === 'categories' && $s1 === 'income' && $id !== null && $method === 'PUT'
        => (new CategoryController($db))->updateIncome($userId, $id),

    $s0 === 'categories' && $s1 === 'expense' && $method === 'GET'
        => (new CategoryController($db))->indexExpense($userId),
    $s0 === 'categories' && $s1 === 'expense' && $method === 'POST'
        => (new CategoryController($db))->storeExpense($userId),
    $s0 === 'categories' && $s1 === 'expense' && $id !== null && $method === 'PUT'
        => (new CategoryController($db))->updateExpense($userId, $id),

    $s0 === 'recurring-bills' && $method === 'GET'
        => (new RecurringBillController($db))->index($userId),
    $s0 === 'recurring-bills' && $method === 'POST'
        => (new RecurringBillController($db))->store($userId),
    $s0 === 'recurring-bills' && $id !== null && $method === 'PUT'
        => (new RecurringBillController($db))->update($userId, $id),
    $s0 === 'recurring-bills' && $id !== null && $method === 'DELETE'
        => (new RecurringBillController($db))->destroy($userId, $id),

    $s0 === 'budgets' && $method === 'GET'
        => (new BudgetController($db))->index($userId),
    $s0 === 'budgets' && $method === 'POST'
        => (new BudgetController($db))->store($userId),
    $s0 === 'budgets' && $id !== null && $method === 'PUT'
        => (new BudgetController($db))->update($userId, $id),
    $s0 === 'budgets' && $id !== null && $method === 'DELETE'
        => (new BudgetController($db))->destroy($userId, $id),

    $s0 === 'debts' && $method === 'GET' && $debtId === null
        => (new DebtController($db))->index($userId),
    $s0 === 'debts' && $debtId !== null && $s2 === 'balance' && $method === 'PUT'
        => (new DebtController($db))->adjustBalance($userId, $debtId),
    $s0 === 'debts' && $debtId !== null && $method === 'GET'
        => (new DebtController($db))->show($userId, $debtId),
    $s0 === 'debts' && $method === 'POST'
        => (new DebtController($db))->store($userId),
    $s0 === 'debts' && $debtId !== null && $method === 'PUT'
        => (new DebtController($db))->update($userId, $debtId),
    $s0 === 'debts' && $debtId !== null && $method === 'DELETE'
        => (new DebtController($db))->destroy($userId, $debtId),

    $s0 === 'income' && $method === 'GET'
        => (new IncomeController($db))->index($userId),
    $s0 === 'income' && $method === 'POST'
        => (new IncomeController($db))->store($userId),
    $s0 === 'income' && $id !== null && $method === 'PUT'
        => (new IncomeController($db))->update($userId, $id),
    $s0 === 'income' && $id !== null && $method === 'DELETE'
        => (new IncomeController($db))->destroy($userId, $id),

    $s0 === 'expenses' && $method === 'GET'
        => (new ExpenseController($db))->index($userId),
    $s0 === 'expenses' && $method === 'POST'
        => (new ExpenseController($db))->store($userId),
    $s0 === 'expenses' && $id !== null && $method === 'PUT'
        => (new ExpenseController($db))->update($userId, $id),
    $s0 === 'expenses' && $id !== null && $method === 'DELETE'
        => (new ExpenseController($db))->destroy($userId, $id),

    default => Response::error('Ruta no encontrada', 404),
};
