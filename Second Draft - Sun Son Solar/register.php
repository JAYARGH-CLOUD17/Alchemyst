<?php
declare(strict_types=1);

function showMessage(string $title, string $message, bool $success = false): never
{
    http_response_code($success ? 200 : 422);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    $tone = $success ? '#2f7044' : '#a33c16';
    echo <<<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$safeTitle} | Sun Son Solar</title>
  <link rel="stylesheet" href="style.css">
  <style>
    body { display:grid; place-items:center; padding:24px; }
    .result { max-width:520px; padding:32px; background:#fffaf4; border:1px solid #ffddc6; border-radius:20px; text-align:center; }
    .result h1 { color:{$tone}; }
    .result a { display:inline-block; margin-top:12px; color:#a34b1d; font-weight:700; }
  </style>
</head>
<body>
  <main class="result">
    <h1>{$safeTitle}</h1>
    <p>{$safeMessage}</p>
    <a href="account.html">Return to account form</a>
  </main>
</body>
</html>
HTML;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    showMessage('Invalid request', 'Submit the account form to register.');
}

$accountType = $_POST['account_type'] ?? '';
$firstName = trim((string) ($_POST['first_name'] ?? ''));
$lastName = trim((string) ($_POST['last_name'] ?? ''));
$middleName = trim((string) ($_POST['middle_name'] ?? ''));
$birthdateInput = trim((string) ($_POST['birthdate'] ?? ''));
$gender = (string) ($_POST['gender'] ?? '');
$email = trim((string) ($_POST['email'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));
$address = trim((string) ($_POST['address'] ?? ''));
$username = trim((string) ($_POST['username'] ?? ''));
$password = (string) ($_POST['password'] ?? '');
$passwordConfirmation = (string) ($_POST['password_confirmation'] ?? '');
$department = (string) ($_POST['department'] ?? '');

$required = [$firstName, $lastName, $birthdateInput, $gender, $email, $phone, $address, $username, $password, $passwordConfirmation];
foreach ($required as $value) {
    if (trim($value) === '') {
        showMessage('Missing information', 'Please complete all required fields.');
    }
}

if (!in_array($accountType, ['Client', 'Associate'], true)) {
    showMessage('Invalid account type', 'Choose Client or Associate and try again.');
}

$birthdate = DateTimeImmutable::createFromFormat('!d/m/Y', $birthdateInput);
$dateErrors = DateTimeImmutable::getLastErrors();
if (!$birthdate || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0)) || $birthdate->format('d/m/Y') !== $birthdateInput) {
    showMessage('Invalid birthdate', 'Enter a real date in DD/MM/YYYY format.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@gmail\.com$/i', $email)) {
    showMessage('Invalid email', 'Use a valid Gmail address ending in @gmail.com.');
}
if (!preg_match('/^09[0-9]{9}$/', $phone)) {
    showMessage('Invalid phone number', 'Enter exactly 11 digits starting with 09.');
}
if (!in_array($gender, ['Female', 'Male', 'Prefer not to say'], true)) {
    showMessage('Invalid gender', 'Select one of the listed gender options.');
}
if (!preg_match('/^\S{8,13}$/u', $username)) {
    showMessage('Invalid username', 'Use 8 to 13 characters with no spaces.');
}
if (!preg_match('/^\S{8,15}$/u', $password)) {
    showMessage('Invalid password', 'Use 8 to 15 characters with no spaces.');
}
if ($password !== $passwordConfirmation) {
    showMessage('Passwords do not match', 'Enter the same password in both password fields.');
}

$departments = ['Administration', 'IT', 'Dispatch', 'Accounting', 'HR', 'Marketing', 'Sales', 'Customer Service'];
if ($accountType === 'Associate' && !in_array($department, $departments, true)) {
    showMessage('Invalid department', 'Select a department for the Associate account.');
}

$table = $accountType === 'Associate' ? 'ASSOCIATES' : 'CLIENTS';
$departmentValue = $accountType === 'Associate' ? $department : null;
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    $pdo = new PDO(
        'mysql:host=127.0.0.1;dbname=SSS_DATABASE;charset=utf8mb4',
        'root',
        '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC],
    );

    $duplicate = $pdo->prepare(
        'SELECT USERNAME FROM CLIENTS WHERE USERNAME = :client_username UNION ALL SELECT USERNAME FROM ASSOCIATES WHERE USERNAME = :associate_username LIMIT 1',
    );
    $duplicate->execute(['client_username' => $username, 'associate_username' => $username]);
    if ($duplicate->fetch()) {
        showMessage('Username unavailable', 'That username is already in use. Choose another one.');
    }

    $sql = "INSERT INTO {$table} (FIRST_NAME, LAST_NAME, MIDDLE_NAME, BIRTHDATE, GENDER, EMAIL, PHONE, ADDRESS, USERNAME, PASSWORD_HASH";
    $values = ' VALUES (:first_name, :last_name, :middle_name, :birthdate, :gender, :email, :phone, :address, :username, :password_hash';
    if ($accountType === 'Associate') {
        $sql .= ', DEPARTMENT';
        $values .= ', :department';
    }
    $statement = $pdo->prepare($sql . ')' . $values . ')');
    $statement->execute([
        'first_name' => $firstName,
        'last_name' => $lastName,
        'middle_name' => $middleName !== '' ? $middleName : null,
        'birthdate' => $birthdate->format('Y-m-d'),
        'gender' => $gender,
        'email' => $email,
        'phone' => $phone,
        'address' => $address,
        'username' => $username,
        'password_hash' => $passwordHash,
        ...($accountType === 'Associate' ? ['department' => $departmentValue] : []),
    ]);
} catch (PDOException $exception) {
    if ($exception->getCode() === '23000' || $exception->getCode() === '45000') {
        showMessage('Account already exists', 'That username or email is already registered.');
    }
    error_log($exception->getMessage());
    showMessage('Registration unavailable', 'The account could not be saved. Check that the local database is running and try again.', false);
}

showMessage('Account created', 'Your account information was saved successfully.', true);
