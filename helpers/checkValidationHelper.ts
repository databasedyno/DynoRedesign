import { AnyObjectSchema } from "yup";

interface validationFields {
  field: string;
  message: string;
}

const checkValidation = (yupSchema: AnyObjectSchema, data: any) => {
  let schemaErrors: Array<validationFields> = [];

  try {
    yupSchema.validateSync(data, { abortEarly: false });
  } catch (err: any) {
    schemaErrors = err.inner?.map((err: any) => {
      return { field: err.path, message: err.message };
    });
  }

  // check if all field are valid or note
  const isValid = yupSchema.isValidSync(data, {
    abortEarly: false,
  });

  const tempObject: any = {};
  if (schemaErrors.length > 0) {
    const keys = Object.keys(data).map((x) => x);
    keys.map((objectKey) => {
      const index = schemaErrors.findIndex((x) => x.field === objectKey);
      if (index === -1) {
        tempObject[objectKey] = "";
      } else {
        tempObject[objectKey] = schemaErrors[index].message;
      }
      return null;
    });
  }

  if (isValid) {
    return null;
  } else {
    return tempObject;
  }
};

export default checkValidation;
