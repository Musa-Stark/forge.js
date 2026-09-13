import type { Collection } from "../../types/Collection.js";

const collection = (vals: Collection) => {
  return vals;
};

const accountCollection = collection({
  type: "account",
  route: "account",
  routes: [
    {
      auth: "authenticated",
      handler: "getMe",
      method: "get",
      path: "/me",
    },
    {
      handler: "updateMe",
      method: "patch",
      path: "/me",
      auth: "admin-or-owner",
      ownership: "self",
      validation: "updateProfile",
      hashedFields: ["password"],
    },
    {
      handler: "deleteMe",
      method: "delete",
      path: "/me",
      auth: "admin-or-owner",
      ownership: "self",
    },
  ],
});

export default accountCollection;
