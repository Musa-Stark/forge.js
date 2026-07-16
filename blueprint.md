## `handlers/auth/` (Authentication & Identity Handlers)
This module is responsible for handling all operations related to user identity, access control, and session 
management. Every handler here must treat security as the highest priority.

### ## signup
This handler is responsible for creating a new user account. It must perform initial data validation on required 
fields (email format, password strength, etc.). Upon successful validation, it must securely hash the provided 
password using industry-standard algorithms (e.g., bcrypt) and create the corresponding user record in the database. 
It should return a basic success message or a temporary token.

### ## login
This handler verifies the submitted credentials (username/email and password) against the stored, hashed credentials 
in the database. If successful, it generates a set of security tokens (typically an Access Token and a Refresh Token) 
and returns them to the client. It must enforce brute-force protection and implement rate limiting at the network 
layer before running the core logic.

### ## logout
This handler invalidates the current session for the user. Depending on the token strategy used (e.g., JWT 
blacklisting), it will either revoke the active access token or update a session record in the database to prevent 
future use of the old token. It should also implement a soft logout to record the time and source of the user's 
departure.

### ## refresh
This handler is specifically designed to generate new, valid access tokens when the old ones expire, without 
requiring the user to log in again. It receives the user's long-lived Refresh Token, validates it against the user's 
account and any potential revocations, and if valid, issues a fresh pair of short-lived Access and Refresh tokens.

### ## two-factor-auth (2FA)
This handler facilitates the process of verifying a user's second factor of authentication. This typically involves 
receiving a code (via SMS, email, or TOTP/Authenticator App) and comparing it to the expected value. It must be 
designed to handle both initial setup (generating QR codes/keys) and the verification process.

## `handlers/crud/` (Core Business Logic Handlers)
This module contains the majority of the application's transactional logic, handling the fundamental Create, Read, 
Update, and Delete operations for core entities (Products, Orders, Users, etc.).

### ## create
This handler validates all incoming data against defined schemas for a specific resource. It then performs the 
business transaction: calling the necessary services and persisting the new record in the database. Crucially, this 
handler must manage transactional integrity, ensuring that multiple database writes (e.g., creating an Order *and* 
decreasing Inventory) succeed or fail together.

### ## read
This is the read handler, which often includes complex query logic. Instead of simple retrieval, it handles 
filtering, sorting, and pagination. It must accept query parameters (e.g., 
`?sort=price&page=2&limit=50&filter=status:active`) and translate these into efficient database queries to prevent 
resource exhaustion and enforce API performance standards.

### ## update
This handler retrieves an existing resource (usually by ID) and applies changes provided in the request body. Before 
saving, it must perform several checks: ensuring the resource exists, validating that the user making the request has 
the necessary permissions to modify that specific field, and handling optimistic locking (detecting if the record was 
modified by another user since the client loaded it).

### ## delete
This handler removes a resource. Due to the critical nature of data deletion, it often implements a soft delete 
mechanism (marking the record as `is_deleted: true`) instead of a hard delete, allowing for auditing and recovery. It 
must also check for dependencies to prevent deleting a parent record if related child records still exist (e.g., 
cannot delete a User if they still have active Orders).

### ## bulk
This handler is designed for efficiency when multiple resources must be created, updated, or deleted simultaneously. 
It is responsible for batch processing, often optimizing database queries (e.g., using `INSERT INTO (...) VALUES 
(...), (...)`) and performing necessary client-side or server-side validation on the entire payload before execution 
to minimize database round-trips.

## `handlers/middleware/` (Pre-Processing & Filtering Handlers)
While technically not "handlers" that contain business logic, this module contains **pipeline functions** that 
intercept every request *before* it hits the main business logic handler. They modify the request/response flow 
without executing core functionality themselves.

### ## auth
This middleware intercepts the request to validate the presence and validity of a token (e.g., JWT in the 
`Authorization` header). If the token is missing or expired, it stops the request immediately and returns a `401 
Unauthorized` response, preventing the core handler from ever running.

### ## rateLimit
This middleware tracks the number of requests originating from a specific IP address or user ID within a time window. 
If the limit is exceeded (e.g., 100 requests per minute), it halts the request chain and returns a `429 Too Many 
Requests` error, protecting the API from abuse and overload.

### ## cors
This middleware inspects the incoming request's `Origin` header. It checks if the calling domain is explicitly 
allowed to interact with the API, preventing cross-site scripting and ensuring the service adheres to appropriate 
cross-origin resource sharing policies.

### ## validation
This middleware validates the structure and data types of the incoming request body and/or query parameters against a 
schema (e.g., JSON Schema). If the data does not conform to the expected types or constraints (e.g., an email field 
is malformed), it halts the request and returns a detailed `400 Bad Request` error.

## `handlers/upload/` (File Management Handlers)
This module manages the lifecycle of non-textual data, specifically files, images, and documents. These handlers must 
be aware of the difference between temporary local processing and final cloud storage persistence.

### ## file upload
The primary endpoint for accepting binary files from the client. This handler is responsible for streaming the 
incoming file data, performing basic security checks (MIME type validation, file size limits), and then moving the 
data to secure, durable storage (e.g., AWS S3, Google Cloud Storage). It must return a publicly accessible, signed 
URL pointing to the stored file.

### ## thumbnail/resizing
If the uploaded content is an image, this handler takes the full-resolution file and generates various necessary 
derivative versions (thumbnails, social media aspect ratios, previews). This process typically runs asynchronously to 
prevent timeouts and involves communicating with image processing libraries (like Sharp or ImageMagick).

### ## deletion/cleanup
This handler manages the removal of uploaded assets. Since files are stored in external cloud buckets, this logic 
must ensure that both the metadata record in the database *and* the actual file in the storage bucket are deleted, 
preventing orphaned data and unnecessary storage costs.

## `handlers/webhook/` (Asynchronous External Communication Handlers)
Webhooks are handlers that receive data pushed *to* the API by external services (e.g., Stripe payment success, 
GitHub commit, WhatsApp message received). They must be extremely resilient, idempotent, and non-blocking.

### ## endpoint verification
The first step of any webhook handler. It verifies that the request genuinely originated from the claimed external 
source. Most services provide a cryptographic signature (e.g., Stripe's signature header) that must be validated 
against a shared secret key to prove the integrity and origin of the payload.

### ## payload processing
This handler receives the raw, structured JSON payload. Its core task is to parse the data, determine the event type 
(`event.type`), and dispatch the processing to the appropriate internal service logic. This is often the point where 
asynchronous jobs (via a queue like Redis or Kafka) are triggered.

### ## idempotency
A critical function. Since webhooks might be delivered multiple times due to network retries, this handler must check 
a unique identifier provided in the payload (e.g., `event_id`) to ensure that the same event is processed only once, 
preventing data corruption (e.g., charging a customer twice).

## `handlers/realtime/` (Persistent Connection Handlers)
This module handles continuous, bi-directional communication using technologies like WebSockets or Server-Sent Events 
(SSE). Logic here revolves around state management, connection lifecycles, and event broadcasting.

### ## connection management
This handler manages the initial establishment and termination of WebSocket connections. It tracks active user 
sessions, authenticates the user upon connection, and handles connection failure or network drops, re-authenticating 
or alerting the user accordingly.

### ## subscription/event listening
This method allows clients to "subscribe" to specific types of events (e.g., "subscribe to updates for Order #123"). 
The handler maintains a map of which users are listening for which events, ensuring that when an event occurs (e.g., 
inventory update), only the relevant, subscribed clients are notified.

### ## message broadcasting
This handler is responsible for sending messages (events) out to all or select connected clients. It must be 
efficient and scalable, allowing the backend to push notifications like "User X has joined" or "Price Updated" to 
potentially thousands of concurrent connections.

## `handlers/admin/` (Elevated Privilege Handlers)
These handlers are restricted to internal administrators and operational staff. They often bypass standard 
user-facing business logic and interact directly with the system's core configuration and operational data.

### ## user management
Provides elevated CRUD capabilities for users, including creating accounts, forcefully resetting passwords, and 
manually changing user roles or permissions that a standard user would never be able to control.

### ## reporting/metrics
Handles complex, cross-system queries that generate operational reports (e.g., "Sales performance across all regions 
last quarter"). These queries often require accessing and aggregating data from multiple microservices or historical 
data stores.

### ## configuration/settings
Allows administrators to modify global application settings (e.g., changing the default tax rate, modifying API 
endpoint keys, or enabling new features). These changes are often coupled with a necessary cache invalidation 
mechanism.

## `handlers/health/` (Monitoring and Status Handlers)
These are minimalistic, read-only handlers designed for automated systems (monitoring tools, load balancers, CI/CD 
pipelines) to check the operational status of the API.

### ## status/ping
The simplest handler. It checks if the API server itself is running and responding. It typically returns a quick `200 
OK` and minimal JSON payload, ensuring the endpoint is available.

### ## database connection
This handler performs a lightweight query (e.g., `SELECT 1`) against the core database. Its purpose is to confirm 
that the service layer can successfully communicate with and read from the persistent data store.

### ## dependencies/metrics
An advanced handler that verifies connectivity to all critical third-party services (e.g., payment gateway API, 
external SMS provider, cache store like Redis). It aggregates the status and latency measurements of these external 
dependencies into a single, comprehensive health report.

## `handlers/system/` (Internal Framework Handlers)
These handlers manage the scaffolding and mechanics of the application itself, often being invisible to the end-user.

### ## cleanup/cron
This handler executes scheduled, non-time-sensitive maintenance tasks, such as deleting expired session tokens, 
archiving old user data, generating nightly reports, or pruning stale cache entries. This logic is typically 
triggered by a job scheduler (like Cron) rather than an HTTP request.

### ## logging/audit
This handler captures detailed records of critical system actions (e.g., "User X attempted to access restricted 
resource Y," or "System attempted to process payment Z"). It ensures that all state changes are logged, providing a 
non-repudiable audit trail for compliance and debugging.

### ## seed/migration
Used during deployment or local development, this handler executes database migration scripts (e.g., adding a new 
column) and populates the database with necessary initial data (seed data, like default admin user credentials or 
configuration settings).

## `utils/` (Utility & Service Layer)
This folder does not contain HTTP handlers but rather a collection of reusable, pure functions and service classes 
that encapsulate common, deterministic logic, promoting the **Single Responsibility Principle** across the entire 
codebase.

### ## password hashing service
Contains the logic for reliably hashing and verifying user passwords, abstracting away the specific hashing algorithm 
used (e.g., ensuring consistent salt generation and cost parameters).

### ## token generation service
Manages the secure creation, signing, and decoding of JWTs, including setting appropriate expiration times and 
defining the token claims payload.

### ## notification service
A service layer that abstracts the method of communication for user notifications. It contains generic functions to 
send emails, SMS messages, or push notifications, allowing the business handlers to simply call 
`send_notification(user, type, data)` without needing to know *how* the notification is sent.