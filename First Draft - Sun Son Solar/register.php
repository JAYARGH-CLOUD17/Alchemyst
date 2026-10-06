<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

function value(string $key): string
{
    return trim((string) ($_POST[$key] ?? ''));
}

$type = value('accountType');
$firstName = value('firstName');
$middleName = value('middleName');
$lastName = value('lastName');
$birthdate = value('birthdate');
$gender = value('gender');
$email = value('email');
$phone = value('phone');
$address = value('address');
$username = value('username');
$password = (string) ($_POST['password'] ?? '');
$confirmPassword = (string) ($_POST['confirmPassword'] ?? '');
$department = value('department');

$errors = [];
if (!in_array($type, ['client', 'associate'], true)) $errors[] = 'Choose a valid account type.';
if ($firstName === '' || $middleName === '' || $lastName === '') $errors[] = 'First, middle, and last name are required.';
if ($type === 'associate' && $department === '') $errors[] = 'Choose a department.';
if (!$birthdate || strtotime($birthdate) === false || $birthdate > date('Y-m-d')) $errors[] = 'Enter a valid birthdate.';
if (!in_array($gender, ['male', 'female', 'other', 'prefer-not'], true)) $errors[] = 'Choose a valid gender.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid email address.';
if (!preg_match('/^09\d{9}$/', $phone)) $errors[] = 'Enter a valid Philippine mobile number.';
if ($address === '') $errors[] = 'Address is required.';
if (!preg_match('/^.{8,12}$/u', $username)) $errors[] = 'Username must be 8 to 12 characters.';
if (strlen($password) < 8 || strlen($password) > 16) $errors[] = 'Password must be 8 to 16 characters.';
if ($password !== $confirmPassword) $errors[] = 'Passwords do not match.';
if ($type === 'associate' && !in_array($department, ['sales', 'marketing', 'operations', 'engineering', 'finance'], true)) $errors[] = 'Choose a valid department.';

if ($errors) {
    http_response_code(422);
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Registration error</title><link rel="stylesheet" href="style.css"><main class="result"><h1>Please check your registration</h1><ul>';
    foreach ($errors as $error) echo '<li>' . htmlspecialchars($error, ENT_QUOTES, 'UTF-8') . '</li>';
    echo '</ul><p><a href="index.php">Return to the form</a></p></main></html>';
    exit;
}

$sql = 'INSERT INTO registrations
    (account_type, first_name, middle_name, last_name, birthdate, gender, email, phone, address, username, password_hash, department)
    VALUES (:account_type, :first_name, :middle_name, :last_name, :birthdate, :gender, :email, :phone, :address, :username, :password_hash, :department)';

try {
    $statement = $pdo->prepare($sql);
    $statement->execute([
        'account_type' => $type,
        'first_name' => $firstName,
        'middle_name' => $middleName,
        'last_name' => $lastName,
        'birthdate' => $birthdate,
        'gender' => $gender,
        'email' => $email,
        'phone' => $phone,
        'address' => $address,
        'username' => $username,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'department' => $type === 'associate' ? $department : null,
    ]);
} catch (PDOException $exception) {
    if ($exception->getCode() === '23000') {
        http_response_code(409);
        exit('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="style.css"><main class="result"><h1>Account already exists</h1><p>Email or username is already registered.</p><a href="index.php">Return to the form</a></main>');
    }
    throw $exception;
}
?>
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Registration complete</title><link rel="stylesheet" href="style.css"></head>
<body><main class="result"><p class="eyebrow">SUN SON SOLAR</p><h1>Account created successfully.</h1><p>Your registration has been saved.</p><a class="submit-btn" href="index.php">Back to registration</a></main></body></html>
