import AppError from "./AppError.js";
import z from "zod";

const validate = (validationSchema: any, body: any) => {
  const zodBodyObj = z.object(validationSchema);

  const isValid = zodBodyObj.safeParse(body);
  if (!isValid.success) {
    const issue = isValid.error.issues?.[0];

    const field =
      issue?.path?.reduce<string>((acc, part) => {
        if (typeof part === "number") return `${acc}[${part}]`;
        return acc ? `${acc}.${String(part)}` : String(part);
      }, "") || "body";

    throw new AppError({
      message: `${field}: ${issue?.message ?? "Invalid input"}`,
      statusCode: 409,
    });
  }

  return isValid.data;
};
export default validate;
