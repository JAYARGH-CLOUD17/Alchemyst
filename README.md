Sun Son Solar Web System

Team Name: Alchemyst

Project Description

Sun Son Solar Web System is a web-based system developed for Sun Son Solar to provide customers with an easier way to view and learn about its solar products and services. The system organizes important product information, including solar panels, inverters, batteries, and other solar-related products, in one accessible platform.

The system also helps Sun Son Solar manage and present its products more efficiently while allowing customers to explore available solar solutions and submit inquiries. Overall, the system aims to improve how Sun Son Solar presents its products and communicates with its customers.

Figma Design

https://www.figma.com/design/nw6ryNA95WAqDpJeKpz8TN/JAY-WORK-STATION?node-id=297-116&t=cNwMsGlFQ5nJnUBt-1

Requirements

XAMPP — Apache and MySQL/MariaDB

PHP 8.2 or later

Composer

A modern web browser

Installation and Setup

1. Place the Project in XAMPP

Place the project folder inside the XAMPP htdocs directory.

C:\xampp\htdocs\Alchemyst

2. Start XAMPP

Open the XAMPP Control Panel and start:

Apache

MySQL

3. Install Dependencies

Open a terminal in the project directory and run:

composer install

4. Set Up the Database

Open phpMyAdmin.

Create or select the database named sunsonsolar.

Import the database.sql file for a fresh setup.

Important: Review the SQL file before importing it into an existing database containing data you need to keep.

Running the Application

Option 1: XAMPP

After starting Apache and MySQL, open the following URLs.

CodeIgniter Application

http://localhost/Alchemyst/public/

Sun Son Solar Homepage

http://localhost/Alchemyst/public/alchemyst/

The CodeIgniter root route currently displays the framework welcome page, while the branded homepage is available at the separate URL above.

Option 2: CodeIgniter Development Server

Run the following command from the project directory:

php spark serve

Then open http://localhost:8080/.

Keep the terminal open while using the application. MySQL must also be running for database-dependent features.

Test Accounts

The following accounts are available for local testing.

Account Type

Username

Password

Client — Katherine

KittyKat16

K@tSunShine16

Administrator — Sol

admin

admin123

Database Information

Item

Details

SQL File

database.sql

Database Name

sunsonsolar

Database Engine

MySQL/MariaDB

Sun Son Solar Web System
Developed by Alchemyst