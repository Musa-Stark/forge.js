/**
 * A complete Forge 2 app: signup/login, a public product catalogue,
 * private notes that only their owner can read, and file uploads.
 *
 * Run it (needs MongoDB):   npx tsx examples/server.ts
 */
import { z } from "zod";
import { collection, Forge, fields, ForbiddenError } from "../src/index.js";

const forge = new Forge({
  ENV: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  isOffline: process.env.NODE_ENV !== "production",
  mongoDBURI: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET, // generate one with generateJWTSecret()
  masterKey: process.env.MASTER_KEY, // generate one with generateMasterKey()
  frontendURL: "http://localhost:3000",
  systemEmailSender: "Acme <noreply@acme.dev>",
  resendAPIKey: process.env.RESEND_API_KEY,

  builtinConfig: {
    auth: {
      mode: "builtin",
      signupMode: "otp", // e-mail a 6-digit code before the account is created
      loginMode: "credentials",
      // "Sign in with Google / GitHub": optional. Add your own provider by subclassing OAuthProvider.
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GITHUB_CLIENT_ID
        ? {
            oauth: {
              providers: [
                { provider: "google" as const, clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "" },
                { provider: "github" as const, clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "" },
              ],
              successRedirect: "http://localhost:3000/welcome",
              failureRedirect: "http://localhost:3000/login",
            },
          }
        : {}),
      // Passwordless e-mail link, and authenticator-app two-factor for anyone who turns it on.
      magicLink: { url: "http://localhost:3000/auth/magic" },
      mfa: { issuer: "Acme" },
      mongooseConfig: {
        model: "User",
        schema: {
          name: fields.requiredString,
          email: fields.email,
          password: fields.password,
          role: fields.role, // only administrators can change it
        },
      },
    },
    account: { mode: "builtin" }, // GET/PATCH/DELETE /account/me, and GET /account/role (what is my role?)
    email: {
      companyName: "Acme",
      companyUrl: "https://acme.dev",
      companyAddress: "1 Main St",
      supportEmail: "help@acme.dev",
      unsubscribeUrl: "https://acme.dev/unsubscribe",
    },
  },

  collections: [
    // Public catalogue. Editors and admins may change it: `roles` is checked on top of `auth`.
    collection({
      type: "crud",
      route: "products",
      model: "Product",
      schema: { name: fields.requiredString, price: fields.requiredNumber },
      validations: {
        create: { name: z.string().min(1).max(120), price: z.number().min(0) },
        update: { name: z.string().min(1).max(120).optional(), price: z.number().min(0).optional() },
      },
      routes: [
        { method: "get", path: "/", handler: "readAll", auth: "public" },
        { method: "get", path: "/:id", handler: "read", auth: "public" },
        { method: "post", path: "/", handler: "create", auth: "authenticated", roles: ["editor", "admin"], validation: "create" },
        { method: "patch", path: "/update/:id", handler: "update", auth: "authenticated", roles: ["editor", "admin"], validation: "update" },
        { method: "delete", path: "/delete/:id", handler: "remove", auth: "admin" }, // administrators only
      ],
    }),

    // Private notes: each user sees only their own. The body is encrypted at rest.
    collection({
      type: "crud",
      route: "notes",
      model: "Note",
      schema: { title: fields.requiredString, secret: fields.encryptedString, owner: fields.userRef },
      validations: { create: { title: z.string().min(1), secret: z.string().optional() } },
      routes: [
        { method: "get", path: "/", handler: "readAll", auth: "admin-or-owner" },
        { method: "get", path: "/:id", handler: "read", auth: "admin-or-owner", decryptedFields: ["secret?"] },
        {
          method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create", encryptedFields: ["secret?"],
          actions: {
            before: [{ customAction: (ctx) => { if (!ctx.user) throw new ForbiddenError({ message: "Sign in first." }); } }],
            after: [{ customAction: (ctx) => console.log(`note created by ${ctx.user?._id}`) }],
          },
        },
        { method: "delete", path: "/delete/:id", handler: "remove", auth: "admin-or-owner" },
      ],
    }),
  ],
});

await forge.start();
