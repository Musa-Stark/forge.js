import AppError from "./AppError.js";
import z from "zod";
import { closest, distance } from "fastest-levenshtein";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

const validate = (validationSchema: any, body: any, routeObj: Route) => {
  if (!validationSchema)
    throw new AppError({
      message: "validationSchema is required to validate",
      statusCode: 409,
      details: getErrorDetail(routeObj),
      hint: "Provide validation in validations. Use same name as key as provided in routeObj configuration",
    });

  if (!body)
    throw new AppError({
      message: "body is required to validate",
      statusCode: 409,
      details: getErrorDetail(routeObj),
      hint: "Provide body (Data from frontend or postman etc.) or if uploading a file, write files : [{...}] in collection -> routes -> routeObj.",
    });

  const zodBodyObj = z.object(validationSchema);

  const isValid = zodBodyObj.safeParse(body);

  if (!isValid.success) {
    const issue = isValid.error.issues?.[0];

    const field =
      issue?.path?.reduce<string>((acc, part) => {
        if (typeof part === "number") return `${acc}[${part}]`;
        return acc ? `${acc}.${String(part)}` : String(part);
      }, "") || "body";

    let message = issue?.message ?? "Invalid input";

    // Improve enum errors with typo suggestions
    if (issue?.code === "invalid_value" && "values" in issue) {
      const values = issue.values.map(String);

      // Get the invalid value from the request body
      const invalidValue = issue.path.reduce<any>(
        (obj, key) => obj?.[key],
        body,
      );

      if (typeof invalidValue === "string") {
        const nearest = closest(invalidValue, values);

        if (distance(invalidValue, nearest) <= 3) {
          message = `Invalid value ${invalidValue}. Did you mean ${nearest}?`;
        } else {
          message = `Expected one of: ${values.join(" | ")}`;
        }
      } else {
        message = `Expected one of: ${values.join(" | ")}`;
      }
    }

    throw new AppError({
      message: `${field}: ${message}`,
      statusCode: 409,
      details: getErrorDetail(routeObj),
      hint: `Check the keys you provided in collection -> valdiationsObj -> ${routeObj.validation}. It should be similar to body -> item key`,
    });
  }

  return isValid.data;
};

export default validate;
