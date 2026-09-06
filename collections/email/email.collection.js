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
              name: "magic-link",
              magicLink: {
                expiryMinutes: 10,
                magicLinkUrl: "https://auth.starkindustries.com/magic-link",
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
