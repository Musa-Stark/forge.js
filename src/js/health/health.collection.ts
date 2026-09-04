const collection = (vals: any) => {
  return vals;
}

const healthCollection = collection({
  route: "health",
  type: "health",
  routes: [
    {
      handler: "healthGet",
      method: "get",
      path: "/",
      auth: "public",
      validation: false,
    },
    {
      handler: "healthPost",
      method: "post",
      path: "/",
      auth: "public",
      validation: false,
    },
    {
      handler: "healthPatch",
      method: "patch",
      path: "/",
      auth: "public",
      validation: false,
    },
    {
      handler: "healthDelete",
      method: "delete",
      path: "/",
      auth: "public",
      validation: false,
    },
  ],
});

export default healthCollection;
