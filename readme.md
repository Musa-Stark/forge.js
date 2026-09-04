<!-- ========================================================= -->
<!--                         STARKLABS FORGE                    -->
<!-- ========================================================= -->

<div align="center">

# ⚒️ StarkLabs Forge

### **Build your backend, not your boilerplate.**

*A modern, opinionated backend framework that eliminates repetitive Express development so you can focus on building your product.*

<br>

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](#)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](#)
[![MongoDB](https://img.shields.io/badge/MongoDB-Supported-success)](#)
[![License](https://img.shields.io/badge/License-MIT-orange)](#)
[![Version](https://img.shields.io/badge/version-v1-informational)](#)

</div>

---

# Why Forge?

Every Express backend starts the same way.

You create folders.

You create routers.

You create controllers.

You create models.

You create validation schemas.

You configure authentication.

You wire middleware.

You implement CRUD operations.

You handle uploads.

You write error handling.

You repeat the exact same architecture for every new project.

None of that is unique to your application.

It's infrastructure.

Yet every backend developer spends hours rebuilding it.

**Forge exists to eliminate that repetition.**

Instead of writing hundreds of lines of repetitive backend code, Forge lets you describe your application through simple configuration objects while the framework handles the implementation behind the scenes.

You focus on your business logic.

Forge takes care of the plumbing.

---

# Philosophy

Forge is built around one simple belief:

> **Software engineers should spend their time solving business problems—not rewriting infrastructure.**

Modern backend applications share an enormous amount of common functionality.

Authentication.

Authorization.

Validation.

CRUD.

Health checks.

Uploads.

Database models.

Routing.

Error handling.

Permissions.

Most projects implement these almost identically.

Forge recognizes those patterns and automates them.

Instead of manually wiring everything together, developers simply describe their resources and let Forge generate the repetitive layers automatically.

---

# What Makes Forge Different?

Forge is **not** an Express starter template.

It is **not** a code generator.

It is **not** another collection of helper utilities.

Forge is a **backend engineering framework**.

Express runs internally.

Mongoose runs internally.

Validation runs internally.

Authentication runs internally.

Developers interact with **Forge**, not with the low-level implementation.

This allows Forge to enforce consistency, reduce boilerplate, and dramatically improve developer productivity.

---

# The Problem

Consider a typical Express backend.

For every new resource you usually create:

```
controllers/
models/
routes/
validators/
middlewares/
services/
utilities/
```

Then you write:

- Route definitions
- Controller methods
- CRUD logic
- Validation middleware
- Authorization middleware
- Owner verification
- Model creation
- Error handling
- Response formatting

Again.

And again.

And again.

After a few projects you realize something:

You're no longer building products.

You're rebuilding your backend architecture.

---

# The Forge Solution

Instead of writing six different files full of repetitive logic...

```text
controllers/
models/
routes/
validators/
middlewares/
services/
```

Forge lets you define your backend like this:

```ts
collection({
    type: "crud",
    route: "expenses",
    model: "Expense",
    routes: routes,
    schema: schema,
    validations: validation,
});
```

That's it.

Forge dynamically creates:

- Models
- Routes
- CRUD handlers
- Validation
- Authentication
- Authorization
- Owner protection
- Upload handling
- Error responses
- Database operations

You describe **what** your backend should do.

Forge handles **how** it gets done.

---

# Design Goals

Forge was designed around five core principles.

## 1. Convention over Configuration

If 90% of applications solve a problem the same way, Forge should solve it automatically.

Developers shouldn't repeatedly configure infrastructure that rarely changes.

---

## 2. Business Logic over Boilerplate

Your application is unique.

CRUD isn't.

Authentication isn't.

Validation isn't.

Routing isn't.

Forge removes repetitive engineering work so developers can invest more time in solving real product problems.

---

## 3. Secure by Default

Security shouldn't depend on whether a developer remembered to install the right middleware.

Authentication.

Authorization.

Validation.

Cookies.

Password hashing.

Error handling.

Forge includes these as first-class citizens rather than optional examples.

---

## 4. Progressive Complexity

A beginner should be able to create a production-ready backend quickly.

An experienced engineer should still have enough flexibility to build larger systems without fighting the framework.

Forge starts simple and grows with your application.

---

## 5. Developer Experience First

Forge optimizes for:

- Readability
- Maintainability
- Consistency
- Excellent error messages
- Strong TypeScript support
- Minimal repetition

Because developers shouldn't have to fight their tools.

---

# Core Principles

Forge asks one question before every new feature is added:

> **Does this remove repetitive work for most backend developers without sacrificing maintainability?**

If the answer is yes...

It belongs in Forge.

If the answer is no...

It probably belongs in the application instead.

This philosophy keeps Forge focused on infrastructure rather than business logic.

---

# Architecture at a Glance

```
Developer
     │
     │
     ▼
Configuration Objects
     │
     ▼
┌──────────────────────────────┐
│         Forge Core           │
│                              │
│ • Routing                    │
│ • Models                     │
│ • CRUD Engine                │
│ • Authentication             │
│ • Authorization              │
│ • Validation                 │
│ • Upload Engine              │
│ • Error Handling             │
│ • Response Formatting        │
└──────────────────────────────┘
     │
     ▼
 Express + Mongoose + Node.js
     │
     ▼
 MongoDB
```

Notice something important.

Developers never interact directly with Express.

Forge becomes the abstraction layer between application code and backend infrastructure.

This allows the framework to evolve internally without forcing users to rewrite their applications.

---

# Build Less Infrastructure.

## Build More Product.

Forge exists so your next backend starts with your ideas—not your boilerplate.

# Features

Forge is designed to eliminate repetitive backend engineering while remaining scalable for production applications.

## Current Features (v1)

### Core

- Convention-based backend architecture
- Dynamic routeObj generation
- Automatic Mongoose model creation
- Built-in CRUD engine
- Zero controller boilerplate
- Zero router boilerplate
- Minimal project structure
- Opinionated architecture

---

### Authentication

- Credentials-based authentication
- JWT authentication
- HTTP-only Cookie support
- Email OTP verification
- Login
- Logout
- Forgot Password
- Reset Password
- Protected routes
- Public routes
- Admin routes
- Owner-based authorization

---

### Validation

- Built-in Zod validation
- Automatic request validation
- Type-safe validation objects
- Zero middleware setup

---

### Database

- Automatic Mongoose schema generation
- Automatic model registration
- Population support
- Hidden field support
- Owner references
- Timestamp support
- CRUD abstraction

---

### Uploads

- Route-based upload configuration
- Integrated CRUD uploads
- File creation
- File updates
- File deletion

---

### Error Handling

Forge provides structured, developer-friendly errors.

Every error includes:

- Message
- Error Code
- HTTP Status Code
- Helpful Hint
- Technical Details

Example:

```json
{
    "success": false,
    "message": "Validation failed.",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "hint": "The 'merchant' field is required.",
    "details": {
        "field": "merchant"
    }
}
```

---

### TypeScript

Forge is written in TypeScript.

You get:

- Autocomplete
- IntelliSense
- Type Safety
- Better Developer Experience

JavaScript developers can use Forge without any additional configuration.

---

# Installation

Install Forge using npm.

```bash
npm install @starklabs/forge
```

or

```bash
pnpm add @starklabs/forge
```

or

```bash
yarn add @starklabs/forge
```

---

# Your First Resource

Every backend resource in Forge follows the same structure.

```
expenses/

├── expenses.collection.js
├── expenses.routes.js
├── expenses.schema.js
└── expenses.validation.js
```

Only four small files.

No controllers.

No routers.

No models.

No middleware.

Forge generates them internally.

---

# Creating a Resource

Every resource starts with a collection.

```ts
collection({
    type: "crud",
    route: "expenses",
    model: "Expense",
    routes: routes,
    schema: schema,
    validations: validation,
});
```

That's the entry point for the entire resource.

Forge uses this configuration to dynamically build everything required for your backend.

---

# Define Your Schema

Instead of writing verbose Mongoose schemas...

```ts
{
    merchant: {
        type: String,
        required: true
    }
}
```

Forge lets you write

```ts
const schema = {
    merchant: mongooseFields.requiredString,
    category: mongooseFields.requiredString,
    amount: mongooseFields.requiredNumber,
    date: mongooseFields.optionalString,
    isUpdated: mongooseFields.booleanFalse,
    owner: mongooseFields.userRef
};
```

Forge converts this into a complete Mongoose schema internally.

---

# Define Validation

Validation follows the same philosophy.

```ts
const validation = {

    create: {

        merchant: zodFields.requiredString,

        category: zodFields.requiredString,

        amount: zodFields.requiredNumber,

        date: zodFields.optionalString

    },

    update: {

        isUpdated: zodFields.booleanTrue

    }

};
```

Each object represents a reusable validation schema.

Routes simply reference the validation by name.

---

# Define Routes

Routes are declarative.

Instead of writing Express routers, middleware, controllers, authentication and validation manually...

You simply describe the routeObj.

```ts
{
    auth: "authenticated",
    handler: "create",
    method: "post",
    path: "/",
    validation: "create"
}
```

Forge handles the rest.

A complete CRUD resource can be expressed in only a handful of routeObj objects.

Example:

```ts
const routes = [

{
    auth: "authenticated",
    handler: "create",
    method: "post",
    path: "/",
    validation: "create"
},

{
    auth: "public",
    handler: "readAll",
    method: "get",
    path: "/",
    validation: false
},

{
    auth: "public",
    handler: "read",
    method: "get",
    path: "/:id",
    validation: false
},

{
    auth: "adminOrOwner",
    handler: "update",
    method: "patch",
    path: "/:id",
    validation: "update"
},

{
    auth: "adminOrOwner",
    handler: "remove",
    method: "delete",
    path: "/:id",
    validation: false
}

];
```

Notice what isn't here.

- No controllers
- No routers
- No middleware
- No auth imports
- No validation middleware
- No CRUD logic

Forge generates those automatically.

---

# Built-in Handlers

Forge ships with production-ready handlers.

### Authentication

- signup
- login
- logout
- verifyOTP
- resendOTP
- forgotPassword
- resetPassword

---

### CRUD

- create
- createBulk
- read
- readAll
- update
- remove
- removeAll
- addFile
- updateFile
- deleteFile

---

### Health

- healthGet
- healthPost
- healthPut
- healthPatch
- healthDelete

No controller implementation required.

Simply reference the handler name inside your routeObj.

---

# Authorization

Authorization is intentionally simple.

```ts
auth: "public"
```

```ts
auth: "authenticated"
```

```ts
auth: "admin"
```

```ts
auth: "adminOrOwner"
```

Forge applies the appropriate middleware automatically.

No imports.

No routeObj protection boilerplate.

---

# Uploads

Uploads are configured per routeObj.

Only routes that need uploads should configure uploads.

This keeps the framework lightweight while allowing complete flexibility.

```ts
{
    handler: "create",

    uploadArray: [

        {
            paramField: "avatar",

            provider: "cloudinary",

            uploadType: "image"

        }

    ]
}
```

The CRUD engine automatically integrates upload processing with database operations.

No manual upload controller required.

---

# Philosophy in Practice

Forge is designed around one idea:

Describe your backend.

Don't build its infrastructure.

# Architecture

Forge is built around a simple architectural idea:

> **Applications should describe backend resources, not implement backend infrastructure.**

Instead of exposing low-level framework internals, Forge provides a declarative layer that sits between your application and the underlying runtime.

```
                Your Application
                       │
                       ▼
         Configuration Objects (Resources)
                       │
                       ▼
            ┌───────────────────────┐
            │       Forge Core      │
            │                       │
            │  • Route Builder      │
            │  • CRUD Engine        │
            │  • Auth Engine        │
            │  • Validation Engine  │
            │  • Upload Engine      │
            │  • Error Engine       │
            │  • Model Generator    │
            └───────────────────────┘
                       │
                       ▼
               Express + Mongoose
                       │
                       ▼
                    MongoDB
```

Your application communicates with Forge.

Forge communicates with Express.

Express communicates with Node.js.

This separation allows the framework to evolve internally while keeping application code clean and stable.

---

# Internal Request Lifecycle

Every request follows the same predictable pipeline.

```
Incoming Request
        │
        ▼
Route Match
        │
        ▼
Authentication
        │
        ▼
Authorization
        │
        ▼
Validation
        │
        ▼
Upload Processing (Optional)
        │
        ▼
CRUD / Auth Handler
        │
        ▼
Database Operation
        │
        ▼
Response Formatter
        │
        ▼
Client
```

Because every request passes through the same pipeline, applications remain consistent regardless of project size.

---

# Convention over Configuration

Forge intentionally follows a convention-first architecture.

Instead of asking developers to configure every layer manually, Forge provides sensible defaults for common backend patterns.

For example:

Instead of writing:

- Routes
- Controllers
- Middleware
- Validation
- Models

every time...

Developers simply define a resource.

Everything else is generated automatically.

This dramatically reduces duplicated code while keeping projects easy to understand.

---

# Why Express is Hidden

Express is one of the most popular backend frameworks in the Node.js ecosystem.

It is also extremely repetitive.

Every application recreates the same structure:

- Routers
- Controllers
- Middleware
- CRUD
- Validation
- Error handling

The framework gives developers complete freedom.

That flexibility is valuable.

But it also means every project spends time rebuilding the same infrastructure.

Forge intentionally hides Express because most applications do not benefit from repeatedly implementing these layers.

Instead, Forge exposes a higher-level API focused on application development rather than framework wiring.

Developers work with business concepts.

Forge works with Express.

---

# Why Controllers Don't Exist

Traditional Express applications usually organize logic like this.

```
Route
    │
    ▼
Controller
    │
    ▼
Service
    │
    ▼
Database
```

Controllers often become repetitive.

Many controller methods only perform operations like:

- validate request
- call model
- send response

The controller exists simply because Express expects one.

Forge removes this layer.

Instead of writing controller functions that contain no unique logic, developers declare their intent.

```
{
    handler: "create"
}
```

Forge executes the appropriate internal handler automatically.

Business logic belongs inside the application.

Infrastructure belongs inside the framework.

---

# Opinionated by Design

Forge is intentionally opinionated.

This is a deliberate architectural decision.

Opinionated frameworks create consistency.

Consistency improves:

- Readability
- Maintainability
- Team collaboration
- Long-term scalability

Instead of allowing ten different ways to solve the same problem, Forge encourages one well-tested approach.

This reduces decision fatigue while making projects easier to navigate.

---

# Design Tradeoffs

Every framework makes compromises.

Forge is no exception.

Understanding these tradeoffs is important.

## Less Flexibility

Forge intentionally limits low-level customization.

This allows the framework to automate repetitive work while keeping projects consistent.

If complete control over Express internals is required, using Express directly may be the better choice.

Forge optimizes for productivity—not unlimited customization.

---

## More Conventions

Forge expects projects to follow its architecture.

In return, developers write significantly less infrastructure code.

Consistency becomes an advantage instead of a restriction.

---

## Higher Abstraction

Forge introduces another abstraction layer.

The framework hides implementation details that developers would otherwise write manually.

This slightly increases abstraction while dramatically reducing repetitive engineering work.

---

## Framework Responsibility

Traditional Express projects ask every application to solve the same infrastructure problems.

Forge moves those responsibilities into the framework itself.

Applications become smaller.

The framework becomes smarter.

---

# Error Philosophy

Errors should help developers fix problems.

Not merely report them.

Every Forge error is designed to answer five questions.

1. What happened?
2. Why did it happen?
3. Which HTTP status should be returned?
4. How can it be fixed?
5. What technical details are useful for debugging?

Instead of vague messages like:

```
Validation failed
```

Forge aims to provide structured errors such as:

```json
{
    "message": "Validation failed.",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "hint": "The 'merchant' field is required.",
    "details": {
        "field": "merchant"
    }
}
```

Good error messages reduce debugging time.

Great error messages reduce frustration.

---

# Security Philosophy

Security should not depend on whether developers remembered to install the correct middleware.

Forge includes security as part of the framework itself.

Authentication.

Authorization.

Validation.

Cookie handling.

Protected routes.

Owner verification.

These are built into the request lifecycle instead of being optional examples copied from documentation.

Applications become safer by default.

---

# Why Configuration Instead of Code?

Imagine two resources.

Products.

Expenses.

The infrastructure behind them is almost identical.

Only the data changes.

Forge embraces this observation.

Instead of writing new infrastructure for every resource, developers simply describe the resource.

The framework generates the repetitive implementation.

Configuration becomes the source of truth.

---

# Scalability

Forge is designed to scale in two different directions.

### Application Scale

As applications grow, backend resources remain consistent because every resource follows the same conventions.

Developers spend less time navigating different architectural styles across projects.

---

### Framework Scale

Forge itself is modular.

New capabilities can be added without changing existing applications.

Examples include:

- PostgreSQL
- Redis
- OAuth
- Magic Links
- Refresh Tokens
- Additional upload providers
- New authentication strategies

Applications remain stable while the framework evolves.

---

# Future Vision

Forge is still in its first generation.

The long-term vision is much larger.

Future releases aim to provide optional support for:

- PostgreSQL
- Redis
- Multiple authentication providers
- OAuth
- Magic Links
- Refresh Tokens
- Advanced querying
- Pagination
- Filtering
- Search
- Caching
- Background jobs
- Event-driven workflows

Each feature will follow the same philosophy that defines Forge today:

> **Reduce repetitive engineering without sacrificing maintainability.**

---

# One Goal

Forge does not aim to replace backend engineers.

It aims to replace repetitive backend engineering.

Because your application deserves your creativity.

Not your boilerplate.

# Why Forge?

There are already many excellent backend frameworks.

Express.

NestJS.

Fastify.

Hono.

AdonisJS.

Each solves a different problem.

Forge was created to solve a very specific one:

> **Backend infrastructure is repetitive.**

Forge does not attempt to replace Express.

It builds upon years of proven ecosystem stability while removing the repetitive engineering work that every project starts with.

---

# Forge vs Traditional Express

| Feature | Express | Forge |
|----------|---------|--------|
| Manual Routes | ✅ | ❌ |
| Manual Controllers | ✅ | ❌ |
| Manual CRUD | ✅ | ❌ |
| Manual Model Registration | ✅ | ❌ |
| Validation Wiring | ✅ | ❌ |
| Auth Middleware Wiring | ✅ | ❌ |
| Owner Verification | ✅ | ❌ |
| Route Configuration | ⚠️ Manual | ✅ Declarative |
| Boilerplate | High | Minimal |
| TypeScript Support | Optional | Built-in |
| Developer Experience | Depends on project | Consistent |

Forge intentionally removes infrastructure code so developers can spend more time building product features.

---

# Why Not NestJS?

NestJS is an excellent framework.

It provides dependency injection, decorators, modules, and enterprise architecture.

Forge has a different philosophy.

NestJS asks developers to build applications using a structured architecture.

Forge asks developers to describe backend resources and lets the framework generate the repetitive implementation automatically.

Both approaches are valid.

Forge simply optimizes for a different developer experience.

---

# Why Not Build Directly With Express?

Express gives developers complete freedom.

That freedom comes with responsibility.

Every project must solve:

- Routing
- Validation
- Authentication
- Authorization
- CRUD
- Uploads
- Error handling
- Folder structure
- Model registration

again and again.

Forge treats these as solved infrastructure problems.

Applications should not need to rebuild them.

---

# Folder Structure

A typical Forge application remains intentionally small.

```text
src/
│
├── app.js
├── server.js
│
├── config/
│
├── collections/
│   ├── users/
│   ├── expenses/
│   ├── products/
│   └── invoices/
│
└── utilities/
```

Each collection contains only the configuration necessary to describe the resource.

The framework generates the infrastructure.

---

# Project Philosophy

Forge follows a simple engineering rule.

> **If every backend writes the same code, that code belongs inside the framework—not inside every application.**

This principle guides every architectural decision.

Before a feature becomes part of Forge, one question is asked:

> Will this eliminate repetitive engineering for most backend developers?

If the answer is yes...

It belongs in the framework.

Otherwise...

It belongs inside the application.

---

# Roadmap

Forge is actively evolving.

The vision extends far beyond CRUD generation.

## Version 1

- Dynamic CRUD
- Authentication
- Authorization
- Health Routes
- Upload Engine
- Validation
- TypeScript Support
- MongoDB
- Structured Errors

---

## Version 2

- PostgreSQL Support
- Redis Integration
- Pagination
- Filtering
- Search
- Sorting
- Better Query Engine
- Multiple Upload Providers

---

## Version 3

- OAuth Providers
- Magic Links
- Refresh Tokens
- Background Jobs
- Event System
- Queue Integration
- Caching
- Real-time Features

---

## Future

Forge aims to become a complete backend engineering platform.

One framework.

Multiple databases.

Multiple authentication providers.

Production-ready infrastructure.

Minimal boilerplate.

Maximum productivity.

---

# Contributing

Contributions are welcome.

Whether it's:

- Bug reports
- Feature requests
- Documentation improvements
- Performance optimizations
- New ideas

Every contribution helps improve Forge.

Please open an issue before making significant architectural changes so discussions can happen early.

---

# Found a Bug?

If something isn't working as expected:

1. Check the documentation.
2. Search existing issues.
3. Create a reproducible example.
4. Open a GitHub issue.

Bug reports with reproduction steps are greatly appreciated.

---

# Philosophy in One Sentence

> **Backend development should be about building products—not rebuilding infrastructure.**

Everything Forge does exists to support that belief.

---

# Credits

Forge is developed and maintained by **StarkLabs**.

Built with ❤️ for developers who would rather solve business problems than write the same backend twice.

---

# License

MIT License

Feel free to use Forge in personal, educational, and commercial projects.

---

<div align="center">

## Build your backend.

### Not your boilerplate.

**Forge** ⚒️

</div>