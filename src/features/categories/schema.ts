import { z } from "zod";

export const categoryTypeOptions = ["income", "expense", "saving"] as const;
export const categoryExpenseBehaviorOptions = ["fixed", "variable"] as const;

export interface CategorySchemaMessages {
  requiredName: string;
  maxNameLength: string;
  requiredExpenseBehavior: string;
  invalidParentCategory: string;
}

const defaultMessages: CategorySchemaMessages = {
  requiredName: "El nombre es obligatorio.",
  maxNameLength: "El nombre no puede superar 80 caracteres.",
  requiredExpenseBehavior: "Definí si el gasto es fijo o variable.",
  invalidParentCategory: "Categoría padre inválida.",
};

export function createCategoryFormSchema(messages?: Partial<CategorySchemaMessages>) {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };

  const optionalExpenseBehavior = z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) {
        return null;
      }

      return value;
    },
    z.enum(categoryExpenseBehaviorOptions).nullable(),
  );

  const optionalParentCategory = z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) {
        return null;
      }

      return value;
    },
    z.string().uuid(resolvedMessages.invalidParentCategory).nullable(),
  );

  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, resolvedMessages.requiredName)
        .max(80, resolvedMessages.maxNameLength),
      parentCategoryId: optionalParentCategory,
      type: z.enum(categoryTypeOptions),
      expenseBehavior: optionalExpenseBehavior,
    })
    .superRefine((values, context) => {
      if (values.parentCategoryId) {
        return;
      }

      if (values.type !== "expense") {
        return;
      }

      if (!values.expenseBehavior) {
        context.addIssue({
          path: ["expenseBehavior"],
          code: z.ZodIssueCode.custom,
          message: resolvedMessages.requiredExpenseBehavior,
        });
      }
    });
}

export const categoryFormSchema = createCategoryFormSchema();

export type CategoryFormInputValues = z.input<typeof categoryFormSchema>;
export type CategoryFormValues = z.output<typeof categoryFormSchema>;
