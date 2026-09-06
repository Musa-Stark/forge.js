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
                name: "login-alert",
                loginAlert: {
                  companyAddress: "XYZ",
                  companyName: "Stark Industries",
                  companyUrl: "https://youtube.com",
                  currentYear: new Date().getFullYear(),
                  dashboardUrl: "https://notfound",
                  supportEmail: "musa.fullstack08@gmail.com",
                  unsubscribeUrl: "https://unsubscribe.com",
                  userEmail: "musa.fullstack08@gmail.com",
                  userName: "Musa Stark",
                  confirmLoginUrl: "Confirm",
                  deviceName: "Current device",
                  ipAddress: "192.168.100.39",
                  location: "Pakistan",
                  loginTime: new Date().getTime(),
                  secureAccountUrl: "tony stark"
                },
              },
            },
          },
        ],
      },
    },
  ],
});
export default emailCollection;
