import StarkForge, {
  collection,
  zodFields,
  mongooseFields,
  app,
  getItem,
  getModel,
} from "../../dist/js/index.js";

const testCollection = collection({
  modelName: "Test",
  mongooseSchemaObj: {
    name: mongooseFields.requiredString,
  },
  validationsObj: {
    name: zodFields.requiredString,
  },
});

/*
getModel,
getItem
*/

export default testCollection;

app.get("/api/v1/test", async (req, res) => {
  const Model = await getModel({ modelName: "Test", routeName: "test" });

  const item = await getItem({
    modelName: "Test",
    routeName: "test",
    routeObj: {
      handler: "readAll",
      method: "get",
      path: "/",
    },
  });

  res.json({ sucess: true, message: "working" });
});
