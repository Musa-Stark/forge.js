import type { Route } from "../types/Collection.js";

export const sanitizeOne = (item: any, route: Route) => {
  ["password", ...(route?.mongooseConfigObj?.hiddenFieldsArray ?? [])].forEach(
    (key) => delete item[key],
  );

  return item;
};

export const sanitizeMany = (items: any[], route: Route) => {
  return items.map((item) => {
    const clean = item.toObject();

    ["password", ...(route?.mongooseConfigObj?.hiddenFieldsArray ?? [])].forEach(
      (key) => delete clean[key],
    );

    return clean;
  });
};
