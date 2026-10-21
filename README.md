<div align="center">

# Sun Son Solar

### Web System

Solar products, services, and customer inquiries in one place.

**Team Alchemyst**

</div>

---

## About

Sun Son Solar Web System helps customers explore solar products and services and submit inquiries. It also presents product information for solar panels, inverters, batteries, and related equipment.

## Quick start

1. Put the project folder in XAMPP's `htdocs` directory, such as `C:\xampp\htdocs\Alchemyst`.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. From the project folder, install dependencies:

   ```bash
   composer install
   ```

4. In phpMyAdmin, create or select the `sunsonsolar` database and import `database.sql` for a fresh setup. Review the SQL before importing into a database with data you need to keep.
5. Check the database settings in `api/config.php`. The local defaults are host `127.0.0.1`, database `sunsonsolar`, username `root`, and an empty password.

## Open the site

With XAMPP running, use these URLs:

| Page | Address |
| --- | --- |
| Sun Son Solar homepage | [localhost/Alchemyst/public/alchemyst/](http://localhost/Alchemyst/public/alchemyst/) |
| CodeIgniter application | [localhost/Alchemyst/public/](http://localhost/Alchemyst/public/) |

The CodeIgniter root route currently shows the framework welcome page. The branded homepage is available at the first address. Replace `Alchemyst` if your project folder has a different name.

### Optional: CodeIgniter development server

Run this command from the project folder:

```bash
php spark serve
```

Then visit [localhost:8080](http://localhost:8080/). Keep the terminal open while using the site. MySQL must be running for database-backed features.

## Test accounts

| Account | Username | Password |
| --- | --- | --- |
| Client — Katherine | `KittyKat16` | `K@tSunShine16` |
| Administrator — Sol | `admin` | `admin123` |

## Project details

| Item | Details |
| --- | --- |
| Team | Alchemyst |
| Database | `sunsonsolar` |
| Engine | MySQL / MariaDB |
| Schema file | `database.sql` |
