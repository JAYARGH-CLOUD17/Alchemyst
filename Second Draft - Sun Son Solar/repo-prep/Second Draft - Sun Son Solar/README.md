# Sun Son Solar

Sun Son Solar account and discovery site.

## Run locally with XAMPP

1. Start Apache and MySQL in the XAMPP Control Panel.
2. Import `database/SSS_DATABASE.sql` in phpMyAdmin. It creates the `SSS_DATABASE` database with separate `clients` and `associates` tables.
3. Open this folder through Apache in your browser. The registration form posts to `register.php`, which validates the submitted values and hashes passwords before writing them to the database.

The PHP database connection uses the default local XAMPP `root` account with an empty password. Update the PDO credentials in `register.php` if your local MySQL setup uses different credentials.
