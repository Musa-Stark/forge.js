import {
  collection,
  defineRoutes,
  mongooseFields,
  zodFields,
} from "../../dist/js/index.js";

const routes = defineRoutes([
  {
    handler: "create",
    method: "post",
    path: "/",
    authRole: "authenticated",
    validationKey: "PostAction",
    actions: {
      before: [
        {
          handler: async ({ data: Data, item }) => {
            console.log("================= before =======================")
            const response = await fetch("http://localhost:10000/api/v1/health")
            const res = await response.json()
            console.log(res)
            console.log(item)
            console.log("================= before =======================")
          },
        },
      ],
      after: [
        {
          handler: async ({item}) => {
            console.log("================= after =======================")
            console.log(item)
            console.log("================= after =======================")
          }
        }
      ]
    },
  },
]);

const actionCollection = collection({
  reqType: "crud",
  routeName: "actions",
  modelName: "Action",
  routesArray: routes,
  mongooseSchemaObj: {
    handler: mongooseFields.optionalString,
  },
  validationsObj: {
    PostAction: {
      handler: zodFields.optionalString
    },
  },
});

export default actionCollection;
