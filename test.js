import StarkNexus, {
  collection,
  mongooseFields,
  zodFields,
  startServer,
} from "./dist/js/index.js";
import { healthCollection, testCollection } from "./collections/index.js";

new StarkNexus({
  collections: [testCollection, healthCollection],
});

startServer();
