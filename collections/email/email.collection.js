import { collection, defineRoutes } from "../../dist/js/index.js";

const emailCollection = collection({
  type: "crud",
  route: "emails",
  model: "User",
  routes: [
    {
      method: "get",
      path: "/",
      handler: "readAll",
      auth: "public",
      actions: {
        before: [
         {
          emailAction: {
            from: "system-email-sender",
            to: "musa.fullstack08@gmail.com",
            type: "template",
            subject: "Magic Link",
            template: {
              name: "two-factor-code",
              twoFactorCode: {
                expiryMinutes: 5,
                otpCode: "123456",
                userEmail: "musa.fullstack08@gmail.com",
                userName: "Musa Stark"
              }
            }
          }
         }
        ],
      },
    },
  ],
});
export default emailCollection;
