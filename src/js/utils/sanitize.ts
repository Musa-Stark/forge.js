import type { Route } from "../types/Collection.js";

export const sanitizeOne = (item: any, routeObj: Route) => {
  // default excluded sensitive
  const defaultExcluded = ["password"];

  // developer based excluded
  const fields =
    routeObj?.mongooseConfigObj?.hiddenFieldsArray?.filter((item) => item !== "_id") ?? [];

  // merged
  let merged = [...defaultExcluded, ...fields];

  // remove merged[el]; if el: !item and sibling: item
  for (const el of fields) {
    // if el has !
    if (el.startsWith("!")) {
      // !item -> item
      const clean = el.split("!")[1]!;

      // if defaultExcluded has !, remove it
      if (defaultExcluded.includes(clean))
        merged = merged.filter((i) => i !== clean);

      // remove any element having !
      merged = merged.filter((i) => i !== el);
    }
  }

  // remove merged item
  for (const el of merged) {
    delete item[el];
  }

  // return cleaned item
  return item;
};

export const sanitizeMany = (items: any[], routeObj: Route) => {
  return items.map((el) => {
    // make el a JS object
    const item = el.toObject();

    // default excluded sensitive
    const defaultExcluded = ["password"];

    // developer based excluded
    const fields =
      routeObj?.mongooseConfigObj?.hiddenFieldsArray?.filter((item) => item !== "_id") ?? [];

    // merged
    let merged = [...defaultExcluded, ...fields];

    // remove merged[el]; if el: !item and sibling: item
    for (const el of fields) {
      // if el has !
      if (el.startsWith("!")) {
        // !item -> item
        const clean = el.split("!")[1]!;

        // if defaultExcluded has !, remove it
        if (defaultExcluded.includes(clean))
          merged = merged.filter((i) => i !== clean);

        // remove any element having !
        merged = merged.filter((i) => i !== el);
      }
    }

    // remove merged item
    for (const el of merged) {
      delete item[el];
    }

    // return cleaned item
    return item;
  });
};
