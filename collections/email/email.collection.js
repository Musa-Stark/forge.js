import { collection, defineRoutes } from "../../dist/js/index.js";

const emailCollection = collection({
    type: "crud",
    route: "emails",
    routes: [
        {
            method: "get",
            path: "/",
            handler: "readAll",
            auth: "authenticated"
        }
    ]
});
export default emailCollection
