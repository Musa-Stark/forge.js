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
                name: "welcome",
                placeholders: {
                    companyAddress: "XYZ",
                    companyName: "Stark Industries",
                    companyUrl: "starkindustries.com",
                    currentYear: new Date().getFullYear(),
                    dashboardUrl: "https://dashboard",
                    supportEmail: "notfound@gmail.com",
                    unsubscribeUrl: "not found",
                    userEmail: "musa.fullstack08@gmail.com",
                    userName: "Musa Stark"
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
