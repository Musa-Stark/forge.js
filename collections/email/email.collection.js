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
              subject: () => {
                return "Welcome to StarkForge!";
              },
              to: () => "musa.fullstack08@gmail.com",
              from: "system-email-sender",
              type: "template",
              template: {
                name: "account-created",
                accountCreated: {
                  
                }
              }
            },
          },
        ],
      },
    },
  ],
});
export default emailCollection;
