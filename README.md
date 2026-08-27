# Smart Bill Pro

Build a professional Android supermarket billing application using Flutter. The app should have a clean, modern Material Design UI and work smoothly on Android phones.

Main Features

Barcode Scanner

Use the phone camera to scan 1D and 2D barcodes.

Automatically identify the barcode number.

If the barcode exists in the database, display the product details instantly.

If the barcode is not found, show an option to add a new product.

Product Management
Each product should contain:

Product Name

Barcode Number

Category

Selling Price

Cost Price

Stock Quantity

Unit (Piece, Kg, Litre, etc.)

Product Image (Optional)

Allow:

Add Product

Edit Product

Delete Product

Search Product

Filter by Category

Billing System

Scan products one by one.

Automatically add them to the cart.

Increase quantity if the same barcode is scanned again.

Allow manual quantity editing.

Remove products from the cart.

Display:



Product Name

Quantity

Price

Subtotal

Calculate:



Subtotal

Discount

GST

Grand Total

Payment Screen
Support:

Cash

UPI

Card

After payment:

Generate a receipt.

Save the transaction to sales history.

Receipt
Generate a printable PDF containing:

Store Name

Date & Time

Bill Number

Product List

Quantity

Price

GST

Total

Payment Method

Thank You Message

Dashboard
Show:

Today’s Sales

Monthly Sales

Number of Products

Low Stock Products

Recent Transactions

Sales History

Search by Bill Number

Search by Date

Reprint Receipt

Delete Transaction (Admin Only)

Stock Management

Increase Stock

Decrease Stock

Low Stock Alert

Out of Stock Alert

Authentication

Admin Login

Employee Login

Different permissions for Admin and Staff.

Database
Use SQLite for offline storage.
Design the code so Firebase or Supabase can be added later without major changes.

Settings

Store Name

Store Address

GST Number

Receipt Footer

Dark Mode

Backup & Restore

Technical Requirements

Flutter (latest stable version)

Material Design 3

Clean architecture

Provider or Riverpod for state management

Well-organized folder structure

Responsive UI

Proper error handling

Null safety enabled

Required Packages

mobile_scanner

sqflite

path_provider

provider (or Riverpod)

pdf

printing

intl

Deliverables
Generate:

Complete Flutter source code

Folder structure

Database schema

Product model

Billing logic

Barcode scanning implementation

SQLite integration

PDF receipt generation

APK build instructions

Comments explaining the important parts of the code

The application should be production-ready, scalable, and suitable for use in a real supermarket with a fast and easy billing experience.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://a2g-barcode-scan.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7eaeb1ed-70ae-4917-bc9d-8c4752d75ae8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
